import { Router } from 'express';
import { z } from 'zod';
import { Patient } from '../models/Patient';
import { Hospital } from '../models/Hospital';
import { EtlRun } from '../models/EtlRun';
import { FactPatientAdmission, DimHospital } from '../models/warehouse';
import { wrap } from '../lib/http';
import { toDate } from '../lib/dates';
import { loadDataset } from '../services/mining/dataset';
import { runKMeans } from '../services/mining/kmeans';
const r = Router();
const cnt = (cond: any) => ({ $sum: { $cond: [cond, 1, 0] } });
r.post('/generate', wrap(async (req, res) => {
  const b = z.object({ title: z.string().min(3).default('MumbaiCare analytical report'), hospitalIds: z.array(z.number()).default([]),
    from: z.string().optional(), to: z.string().optional(), includeMining: z.boolean().default(false) }).parse(req.body);
  const ids = req.user!.role === 'STAFF' ? [req.user!.hospitalId!] : b.hospitalIds;
  const match: any = {}; if (ids.length) match.hospitalId = { $in: ids };
  if (b.from || b.to) match.admissionDate = { ...(b.from ? { $gte: toDate(b.from) } : {}), ...(b.to ? { $lte: toDate(b.to) } : {}) };
  const hs = new Map((await Hospital.find().lean()).map(h => [h.id, h.name]));
  const [[f]] = await Promise.all([Patient.aggregate([{ $match: match }, { $facet: {
    summary: [{ $group: { _id: null, total: { $sum: 1 }, admitted: cnt({ $eq: ['$status', 'ADMITTED'] }), discharged: cnt({ $eq: ['$status', 'DISCHARGED'] }),
      avgStay: { $avg: '$stayDays' }, avgCost: { $avg: '$cost' }, totalCost: { $sum: '$cost' }, firstAdmission: { $min: '$admissionDate' }, lastAdmission: { $max: '$admissionDate' } } }],
    diseases: [{ $group: { _id: '$condition', total: { $sum: 1 }, severe: cnt({ $eq: ['$severity', 'SEVERE'] }), avgCost: { $avg: '$cost' } } }, { $sort: { total: -1 } }],
    severity: [{ $group: { _id: '$severity', total: { $sum: 1 } } }],
    hospitals: [{ $group: { _id: '$hospitalId', total: { $sum: 1 }, avgStay: { $avg: '$stayDays' }, avgCost: { $avg: '$cost' }, totalCost: { $sum: '$cost' } } }],
  } }])]);
  const s = f.summary[0] ?? { total: 0 };
  // warehouse roll-up to quarters, restricted to the same hospitals
  const hk = ids.length ? (await DimHospital.find({ hospitalId: { $in: ids } }).lean()).map(h => h.hospitalKey) : null;
  const olapQuarterly = (await FactPatientAdmission.aggregate([...(hk ? [{ $match: { hospitalKey: { $in: hk } } }] : []),
    { $lookup: { from: 'dw_dim_date', localField: 'admissionDateKey', foreignField: 'dateKey', as: 'd' } }, { $unwind: '$d' },
    { $group: { _id: { year: '$d.year', quarter: '$d.quarter' }, admissions: { $sum: 1 }, avgCost: { $avg: '$treatmentCost' } } }, { $sort: { '_id.year': 1, '_id.quarter': 1 } }]))
    .map(x => ({ year: x._id.year, quarter: x._id.quarter, admissions: x.admissions, avgCost: Math.round(x.avgCost) }));
  let mining: any = null;
  if (b.includeMining && req.user!.role !== 'STAFF') {
    try { const m = runKMeans(await loadDataset(ids.length ? ids : undefined), ['age', 'stay_days', 'treatment_cost'], 3); mining = { k: m.k, sizes: m.clusters, silhouette: m.silhouette }; }
    catch (e: any) { mining = { error: e.message }; }
  }
  const lastEtl = await EtlRun.findOne({ status: 'SUCCESS' }).sort({ startedAt: -1 }).lean();
  const rnd = (x: any, d = 0) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
  res.json({ title: b.title, generatedAt: new Date().toISOString(), generatedBy: req.user!.name,
    hospitals: ids.length ? ids.map(i => hs.get(i) ?? `#${i}`) : ['All hospitals'], range: { from: b.from ?? null, to: b.to ?? null },
    summary: { ...s, avgStay: rnd(s.avgStay, 2), avgCost: rnd(s.avgCost) },
    diseases: f.diseases.map((x: any) => ({ name: x._id, total: x.total, severe: x.severe, avgCost: rnd(x.avgCost) })),
    severity: f.severity.map((x: any) => ({ name: x._id, total: x.total })),
    hospitalComparison: f.hospitals.map((x: any) => ({ name: hs.get(x._id) ?? `#${x._id}`, total: x.total, avgStay: rnd(x.avgStay, 2), avgCost: rnd(x.avgCost), totalCost: x.totalCost }))
      .sort((a: any, b2: any) => a.name.localeCompare(b2.name)),
    olapQuarterly, mining, freshness: lastEtl?.endedAt ?? null });
}));
export default r;
