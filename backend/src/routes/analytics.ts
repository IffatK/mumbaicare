/** Operational analytics — every number is a MongoDB aggregation over the patients collection. */
import { Router } from 'express';
import { Patient } from '../models/Patient';
import { wrap } from '../lib/http';
import { patientMatch } from '../lib/filters';
import { hospitalMap } from '../lib/hospitals';
const r = Router();
const month = (f: string) => ({ $dateToString: { format: '%Y-%m', date: f } });
const GRAIN: Record<string, string> = { day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' };
const cnt = (cond: any) => ({ $sum: { $cond: [cond, 1, 0] } });
const r2 = (x: any, d = 2) => ({ $round: [x, d] });
const AGE_GROUP = { $switch: { branches: [
  { case: { $lt: ['$age', 18] }, then: '0-17' }, { case: { $lt: ['$age', 35] }, then: '18-34' },
  { case: { $lt: ['$age', 50] }, then: '35-49' }, { case: { $lt: ['$age', 65] }, then: '50-64' }], default: '65+' } };
const kv = (arr: any[], k = 'name') => arr.map(({ _id, ...rest }) => ({ [k]: _id, ...rest }));

r.get('/overview', wrap(async (req, res) => {
  const [[f], hs] = await Promise.all([Patient.aggregate([{ $match: patientMatch(req) }, { $facet: {
    kpis: [{ $group: { _id: null, total: { $sum: 1 }, admitted: cnt({ $eq: ['$status', 'ADMITTED'] }), discharged: cnt({ $eq: ['$status', 'DISCHARGED'] }),
      hospitals: { $addToSet: '$hospitalId' }, avgStay: { $avg: '$stayDays' }, avgCost: { $avg: '$cost' }, totalCost: { $sum: '$cost' },
      severe: cnt({ $eq: ['$severity', 'SEVERE'] }) } },
      { $project: { _id: 0, total: 1, admitted: 1, discharged: 1, hospitals: { $size: '$hospitals' }, avgStay: r2('$avgStay'), avgCost: r2('$avgCost', 0), totalCost: 1, severe: 1 } }],
    admissions: [{ $group: { _id: month('$admissionDate'), value: { $sum: 1 } } }, { $sort: { _id: 1 } }],
    discharges: [{ $match: { dischargeDate: { $ne: null } } }, { $group: { _id: month('$dischargeDate'), value: { $sum: 1 } } }, { $sort: { _id: 1 } }],
    byHospital: [{ $group: { _id: '$hospitalId', patients: { $sum: 1 }, avgCost: { $avg: '$cost' } } }, { $sort: { patients: -1 } }],
    diseases: [{ $group: { _id: '$condition', value: { $sum: 1 } } }, { $sort: { value: -1 } }],
    severity: [{ $group: { _id: '$severity', value: { $sum: 1 } } }],
    stayHist: [{ $match: { stayDays: { $ne: null } } }, { $group: { _id: { $min: ['$stayDays', 20] }, value: { $sum: 1 } } }, { $sort: { _id: 1 } }],
    scatter: [{ $sort: { id: 1 } }, { $limit: 600 }, { $project: { _id: 0, age: 1, cost: 1, severity: 1 } }],
  } }]), hospitalMap()]);
  res.json({
    kpis: f.kpis[0] ?? { total: 0, admitted: 0, discharged: 0, hospitals: 0, avgStay: null, avgCost: null, totalCost: 0, severe: 0 },
    admissions: kv(f.admissions, 'period'), discharges: kv(f.discharges, 'period'),
    byHospital: f.byHospital.map((x: any) => ({ name: hs.get(x._id)?.name ?? `#${x._id}`, patients: x.patients, avgCost: Math.round(x.avgCost) })),
    diseases: kv(f.diseases), severity: kv(f.severity), stayHist: kv(f.stayHist, 'bucket'), scatter: f.scatter,
  });
}));

r.get('/admissions', wrap(async (req, res) => {
  const g = GRAIN[String(req.query.grain)] ?? GRAIN.month;
  const [[f], hs] = await Promise.all([Patient.aggregate([{ $match: patientMatch(req) }, { $facet: {
    kpis: [{ $group: { _id: null, current: cnt({ $eq: ['$status', 'ADMITTED'] }), discharged: cnt({ $eq: ['$status', 'DISCHARGED'] }), avgStay: { $avg: '$stayDays' } } },
      { $project: { _id: 0, current: 1, discharged: 1, avgStay: r2('$avgStay') } }],
    trend: [{ $group: { _id: { $dateToString: { format: g, date: '$admissionDate' } }, admissions: { $sum: 1 }, discharged: cnt({ $eq: ['$status', 'DISCHARGED'] }), avgStay: { $avg: '$stayDays' } } },
      { $sort: { _id: 1 } }, { $project: { admissions: 1, discharged: 1, avgStay: r2('$avgStay') } }],
    byHospital: [{ $group: { _id: '$hospitalId', admissions: { $sum: 1 }, current: cnt({ $eq: ['$status', 'ADMITTED'] }), discharged: cnt({ $eq: ['$status', 'DISCHARGED'] }), avgStay: { $avg: '$stayDays' } } },
      { $sort: { admissions: -1 } }, { $project: { admissions: 1, current: 1, discharged: 1, avgStay: r2('$avgStay') } }],
  } }]), hospitalMap()]);
  res.json({ kpis: f.kpis[0] ?? { current: 0, discharged: 0, avgStay: null }, trend: kv(f.trend, 'period'),
    byHospital: f.byHospital.map(({ _id, ...x }: any) => ({ name: hs.get(_id)?.name ?? `#${_id}`, ...x })) });
}));

r.get('/diseases', wrap(async (req, res) => {
  const [[f], hs] = await Promise.all([Patient.aggregate([{ $match: patientMatch(req) }, { $facet: {
    byDisease: [{ $group: { _id: '$condition', total: { $sum: 1 }, mild: cnt({ $eq: ['$severity', 'MILD'] }), moderate: cnt({ $eq: ['$severity', 'MODERATE'] }),
      severe: cnt({ $eq: ['$severity', 'SEVERE'] }), avgAge: { $avg: '$age' } } }, { $sort: { total: -1 } },
      { $project: { total: 1, mild: 1, moderate: 1, severe: 1, avgAge: r2('$avgAge', 1) } }],
    byHospital: [{ $group: { _id: { h: '$hospitalId', c: '$condition' }, value: { $sum: 1 } } }],
    trend: [{ $group: { _id: { p: month('$admissionDate'), c: '$condition' }, value: { $sum: 1 } } }, { $sort: { '_id.p': 1 } }],
    ageGroups: [{ $group: { _id: AGE_GROUP, value: { $sum: 1 } } }, { $sort: { _id: 1 } }],
    gender: [{ $group: { _id: '$gender', value: { $sum: 1 } } }],
  } }]), hospitalMap()]);
  res.json({ byDisease: kv(f.byDisease), byHospital: f.byHospital.map((x: any) => ({ hospital: hs.get(x._id.h)?.name, name: x._id.c, value: x.value })),
    trend: f.trend.map((x: any) => ({ period: x._id.p, name: x._id.c, value: x.value })), ageGroups: kv(f.ageGroups, 'grp'), gender: kv(f.gender) });
}));

r.get('/hospitals', wrap(async (req, res) => {
  const [[f], hs] = await Promise.all([Patient.aggregate([{ $match: patientMatch(req) }, { $facet: {
    metrics: [{ $group: { _id: '$hospitalId', total: { $sum: 1 }, discharges: cnt({ $eq: ['$status', 'DISCHARGED'] }), current: cnt({ $eq: ['$status', 'ADMITTED'] }),
      avgStay: { $avg: '$stayDays' }, avgCost: { $avg: '$cost' }, totalCost: { $sum: '$cost' } } }],
    severity: [{ $group: { _id: { h: '$hospitalId', s: '$severity' }, value: { $sum: 1 } } }],
    disease: [{ $group: { _id: { h: '$hospitalId', c: '$condition' }, value: { $sum: 1 } } }],
    monthly: [{ $group: { _id: { p: month('$admissionDate'), h: '$hospitalId' }, value: { $sum: 1 } } }, { $sort: { '_id.p': 1 } }],
  } }]), hospitalMap()]);
  const name = (id: number) => hs.get(id)?.name ?? `#${id}`;
  res.json({
    metrics: f.metrics.map((x: any) => ({ id: x._id, name: name(x._id), total: x.total, admissions: x.total, discharges: x.discharges, current: x.current,
      avgStay: x.avgStay == null ? null : Math.round(x.avgStay * 100) / 100, avgCost: Math.round(x.avgCost), totalCost: x.totalCost })).sort((a: any, b: any) => a.name.localeCompare(b.name)),
    severity: f.severity.map((x: any) => ({ hospital: name(x._id.h), name: x._id.s, value: x.value })),
    disease: f.disease.map((x: any) => ({ hospital: name(x._id.h), name: x._id.c, value: x.value })),
    monthly: f.monthly.map((x: any) => ({ period: x._id.p, hospital: name(x._id.h), value: x.value })),
  });
}));
export default r;
