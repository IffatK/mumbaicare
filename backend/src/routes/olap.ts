/**
 * OLAP engine over the star schema, implemented as a MongoDB aggregation pipeline:
 *   fact  ─$lookup→  dimension collections  ─$match (slice/dice)→  $group (cube cell)  → measure
 *  roll-up / drill-down = change the time level (year > quarter > month > day)
 *  slice = one filter · dice = several filters · pivot = rows × columns cross-tab
 * Dimensions and measures come from whitelists; user values are only compared as data.
 */
import { Router } from 'express';
import { z } from 'zod';
import { FactPatientAdmission } from '../models/warehouse';
import { wrap, HttpError } from '../lib/http';
const r = Router();
type Dim = { expr: any; label: string; needs: 'h' | 'd' | 'p' | 'ad' };
export const DIMS: Record<string, Dim> = {
  hospital: { expr: '$h.hospitalName', label: 'Hospital', needs: 'h' },
  area: { expr: '$h.area', label: 'Area', needs: 'h' },
  disease: { expr: '$d.disease', label: 'Disease', needs: 'd' },
  severity: { expr: '$d.severity', label: 'Severity', needs: 'd' },
  year: { expr: '$ad.year', label: 'Admission year', needs: 'ad' },
  quarter: { expr: { $concat: [{ $toString: '$ad.year' }, '-Q', { $toString: '$ad.quarter' }] }, label: 'Admission quarter', needs: 'ad' },
  month: { expr: { $dateToString: { format: '%Y-%m', date: '$ad.fullDate' } }, label: 'Admission month', needs: 'ad' },
  day: { expr: { $dateToString: { format: '%Y-%m-%d', date: '$ad.fullDate' } }, label: 'Admission day', needs: 'ad' },
  gender: { expr: '$p.gender', label: 'Gender', needs: 'p' },
  ageGroup: { expr: '$p.ageGroup', label: 'Age group', needs: 'p' },
};
export const MEASURES: Record<string, { acc: any; label: string; digits?: number }> = {
  patientCount: { acc: { $sum: '$patientCount' }, label: 'Patient count' },
  admissionCount: { acc: { $sum: 1 }, label: 'Admission count' },
  dischargeCount: { acc: { $sum: '$isDischarged' }, label: 'Discharge count' },
  avgStay: { acc: { $avg: '$stayDays' }, label: 'Average stay (days)', digits: 2 },
  avgCost: { acc: { $avg: '$treatmentCost' }, label: 'Average treatment cost', digits: 2 },
  totalCost: { acc: { $sum: '$treatmentCost' }, label: 'Total treatment cost', digits: 2 },
};
const LOOKUPS: Record<string, any[]> = {
  h: [{ $lookup: { from: 'dw_dim_hospital', localField: 'hospitalKey', foreignField: 'hospitalKey', as: 'h' } }, { $unwind: '$h' }],
  d: [{ $lookup: { from: 'dw_dim_disease', localField: 'diseaseKey', foreignField: 'diseaseKey', as: 'd' } }, { $unwind: '$d' }],
  p: [{ $lookup: { from: 'dw_dim_patient', localField: 'patientKey', foreignField: 'patientKey', as: 'p' } }, { $unwind: '$p' }],
  ad: [{ $lookup: { from: 'dw_dim_date', localField: 'admissionDateKey', foreignField: 'dateKey', as: 'ad' } }, { $unwind: '$ad' }],
};
const joinsFor = (dims: string[]) => [...new Set(dims.map(d => DIMS[d].needs))].flatMap(n => LOOKUPS[n]);

/** Builds the cube pipeline. Exported for the self-test. */
export function cubePipeline(rows: string[], columns: string[], measure: string, filters: { dimension: string; values: (string | number)[] }[]) {
  const dims = [...rows, ...columns]; const fdims = filters.map(f => f.dimension);
  for (const d of [...dims, ...fdims]) if (!DIMS[d]) throw new HttpError(400, `Unknown dimension: ${d}`);
  const m = MEASURES[measure]; if (!m) throw new HttpError(400, `Unknown measure: ${measure}`);
  const pipeline: any[] = [...joinsFor([...dims, ...fdims])];
  if (filters.length) {
    // compute each filtered dimension as a string field, then slice/dice with $in
    pipeline.push({ $addFields: Object.fromEntries(filters.map((f, i) => [`__f${i}`, { $toString: DIMS[f.dimension].expr }])) });
    pipeline.push({ $match: Object.fromEntries(filters.map((f, i) => [`__f${i}`, { $in: f.values.map(String) }])) });
  }
  pipeline.push({ $group: { _id: Object.fromEntries(dims.map((d, i) => [`d${i}`, DIMS[d].expr])), value: m.acc } });
  pipeline.push({ $sort: Object.fromEntries(dims.map((_, i) => [`_id.d${i}`, 1])) }, { $limit: 5000 });
  return { pipeline, m, dims };
}
const querySchema = z.object({
  rows: z.array(z.string()).min(1).max(3), columns: z.array(z.string()).max(1).default([]), measure: z.string(),
  filters: z.array(z.object({ dimension: z.string(), values: z.array(z.union([z.string(), z.number()])).min(1) })).default([]),
});
r.get('/meta', wrap(async (_req, res) => {
  const values: Record<string, any[]> = {};
  await Promise.all(['hospital', 'disease', 'severity', 'year', 'gender', 'ageGroup', 'area'].map(async k => {
    values[k] = (await FactPatientAdmission.aggregate([...joinsFor([k]), { $group: { _id: DIMS[k].expr } }, { $sort: { _id: 1 } }])).map(x => x._id);
  }));
  res.json({ dimensions: Object.entries(DIMS).map(([key, d]) => ({ key, label: d.label })),
    measures: Object.entries(MEASURES).map(([key, m]) => ({ key, label: m.label })), values });
}));
r.post('/query', wrap(async (req, res) => {
  const b = querySchema.parse(req.body);
  const { pipeline, m, dims } = cubePipeline(b.rows, b.columns, b.measure, b.filters);
  const t0 = Date.now(); const raw = await FactPatientAdmission.aggregate(pipeline);
  const rows = raw.map(x => { const o: any = { value: x.value == null ? null : m.digits ? Math.round(x.value * 100) / 100 : x.value };
    dims.forEach((d, i) => (o[d] = x._id[`d${i}`])); return o; });
  let pivot: any = null;
  if (b.columns.length) {
    const col = b.columns[0]; const cols = [...new Set(rows.map(x => String(x[col])))].sort(); const map = new Map<string, any>();
    for (const x of rows) { const key = b.rows.map(d => x[d]).join('||');
      if (!map.has(key)) map.set(key, Object.fromEntries(b.rows.map(d => [d, x[d]]))); map.get(key)[String(x[col])] = x.value; }
    pivot = { columns: cols, rows: [...map.values()] };
  }
  const explain = `${m.label} by ${b.rows.map(d => DIMS[d].label).join(' > ')}${b.columns.length ? ` across ${DIMS[b.columns[0]].label}` : ''}` +
    (b.filters.length ? `, where ${b.filters.map(f => `${DIMS[f.dimension].label} ∈ {${f.values.join(', ')}}`).join(' and ')}` : '');
  res.json({ rows, pivot, explain, ms: Date.now() - t0, operation: b.filters.length > 1 ? 'dice' : b.filters.length === 1 ? 'slice' : 'aggregate' });
}));
export default r;
