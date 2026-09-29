/** Read-only data quality checks on the patients collection. Nothing is auto-corrected. */
import { Router } from 'express';
import { Patient } from '../models/Patient';
import { Hospital } from '../models/Hospital';
import { wrap, HttpError } from '../lib/http';
import { toDate, todayStr } from '../lib/dates';
const r = Router();
async function checks() {
  const ids = (await Hospital.find({}, { id: 1 }).lean()).map(h => h.id);
  return [
    { key: 'missing_discharge', label: 'Discharged without discharge date', q: { status: 'DISCHARGED', dischargeDate: null } },
    { key: 'admitted_with_discharge', label: 'Admitted but has discharge date', q: { status: 'ADMITTED', dischargeDate: { $ne: null } } },
    { key: 'discharge_before_admission', label: 'Discharge before admission', q: { dischargeDate: { $ne: null }, $expr: { $lt: ['$dischargeDate', '$admissionDate'] } } },
    { key: 'future_admission', label: 'Admission date in the future', q: { admissionDate: { $gt: toDate(todayStr()) } } },
    { key: 'stay_mismatch', label: 'Stay duration does not match dates', q: { dischargeDate: { $ne: null },
      $expr: { $ne: ['$stayDays', { $dateDiff: { startDate: '$admissionDate', endDate: '$dischargeDate', unit: 'day' } }] } } },
    { key: 'negative_cost', label: 'Negative treatment cost', q: { cost: { $lt: 0 } } },
    { key: 'age_out_of_range', label: 'Age outside 0–110', q: { $or: [{ age: { $lt: 0 } }, { age: { $gt: 110 } }] } },
    { key: 'vitals_out_of_range', label: 'Vital signs outside plausible range', q: { $or: [{ systolicBp: { $not: { $gte: 60, $lte: 250 } } },
      { heartRate: { $not: { $gte: 30, $lte: 220 } } }, { cholesterol: { $not: { $gte: 80, $lte: 450 } } }] } },
    { key: 'invalid_hospital', label: 'Invalid hospital reference', q: { hospitalId: { $nin: ids } } },
  ];
}
r.get('/', wrap(async (_req, res) => {
  const cs = await checks(); const total = await Patient.countDocuments();
  const results = await Promise.all(cs.map(async c => ({ key: c.key, label: c.label, count: await Patient.countDocuments(c.q) })));
  const missing = await Promise.all([['dischargeDate', { dischargeDate: null }], ['stayDays', { stayDays: null }], ['tests', { tests: { $in: ['', null] } }], ['treatment', { treatment: { $in: ['', null] } }]]
    .map(async ([field, q]) => ({ field, count: await Patient.countDocuments(q as any) })));
  const duplicates = await Patient.aggregate([{ $group: { _id: '$recordId', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $project: { _id: 0, recordId: '$_id', n: 1 } }]);
  res.json({ total, checks: results, missing, duplicates, checkedAt: new Date().toISOString(),
    note: 'Missing discharge date / stay days is expected for currently admitted patients.' });
}));
r.get('/records/:key', wrap(async (req, res) => {
  const c = (await checks()).find(x => x.key === req.params.key); if (!c) throw new HttpError(404, 'Unknown check');
  res.json(await Patient.find(c.q, { _id: 0, id: 1, recordId: 1, hospitalId: 1, status: 1, admissionDate: 1, dischargeDate: 1, stayDays: 1, cost: 1, age: 1 }).limit(200).lean());
}));
export default r;
