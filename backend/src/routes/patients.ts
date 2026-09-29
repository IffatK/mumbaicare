import { Router, Request } from 'express';
import { z } from 'zod';
import { Patient } from '../models/Patient';
import { Hospital } from '../models/Hospital';
import { nextSeq } from '../models/Counter';
import { logActivity } from '../models/ActivityLog';
import { wrap, HttpError } from '../lib/http';
import { requireRole } from '../middleware/auth';
import { toDate, todayStr, daysBetween, escapeRegex } from '../lib/dates';
import { hospitalMap } from '../lib/hospitals';
const r = Router();

/** Business rules — mirrored in frontend/src/lib/schemas.ts; the API always re-validates. */
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD').transform(s => s.slice(0, 10));
export const patientSchema = z.object({
  hospitalId: z.number().int().positive(), age: z.number().int().min(0).max(110),
  gender: z.enum(['Male', 'Female', 'Other']), condition: z.string().trim().min(2).max(80),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']),
  systolicBp: z.number().int().min(60).max(250), diastolicBp: z.number().int().min(30).max(150),
  cholesterol: z.number().int().min(80).max(450), heartRate: z.number().int().min(30).max(220),
  admissionDate: dateStr, dischargeDate: dateStr.nullable().optional(),
  treatment: z.string().trim().min(2).max(80), tests: z.string().max(255).default(''),
  cost: z.number().min(0, 'Cost cannot be negative'), status: z.enum(['ADMITTED', 'DISCHARGED']),
}).superRefine((d, ctx) => {
  const t = todayStr();
  if (d.admissionDate > t) ctx.addIssue({ code: 'custom', path: ['admissionDate'], message: 'Admission date cannot be in the future' });
  if (d.status === 'DISCHARGED' && !d.dischargeDate) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Discharged patients need a discharge date' });
  if (d.status === 'ADMITTED' && d.dischargeDate) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Admitted patients cannot have a discharge date' });
  if (d.dischargeDate && d.dischargeDate < d.admissionDate) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Discharge cannot be before admission' });
  if (d.dischargeDate && d.dischargeDate > t) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Discharge date cannot be in the future' });
});
function toDoc(d: z.infer<typeof patientSchema>) {
  const adm = toDate(d.admissionDate), dis = d.dischargeDate ? toDate(d.dischargeDate) : null;
  return { ...d, admissionDate: adm, dischargeDate: dis, stayDays: dis ? daysBetween(adm, dis) : null,   // stay always derived from dates
    tests: d.tests.split(',').map(s => s.trim()).filter(Boolean).join(',') };
}
export const patientDto = (p: any, hosp?: any) => ({
  id: p.id, recordId: p.recordId, hospitalId: p.hospitalId, age: p.age, gender: p.gender, condition: p.condition, severity: p.severity,
  systolicBp: p.systolicBp, diastolicBp: p.diastolicBp, cholesterol: p.cholesterol, heartRate: p.heartRate,
  admissionDate: p.admissionDate, dischargeDate: p.dischargeDate, stayDays: p.stayDays, treatment: p.treatment, tests: p.tests,
  cost: p.cost, status: p.status, createdAt: p.createdAt, updatedAt: p.updatedAt,
  hospital: hosp ? { id: hosp.id, name: hosp.name, area: hosp.area, type: hosp.type } : null,
});
const scope = (req: Request) => (req.user!.role === 'STAFF' ? { hospitalId: req.user!.hospitalId! } : {});
async function assertHospitalAllowed(req: Request, hospitalId: number) {
  if (req.user!.role === 'STAFF' && req.user!.hospitalId !== hospitalId) throw new HttpError(403, 'You can only manage records for your hospital');
  if (!(await Hospital.exists({ id: hospitalId }))) throw new HttpError(400, 'Hospital does not exist');
}

const SORT: Record<string, string> = { recordId: 'recordId', age: 'age', admissionDate: 'admissionDate', cost: 'cost', stayDays: 'stayDays' };
r.get('/', wrap(async (req, res) => {
  const f = z.object({ page: z.coerce.number().min(1).default(1), pageSize: z.coerce.number().min(5).max(100).default(20),
    search: z.string().optional(), hospitalId: z.coerce.number().optional(), condition: z.string().optional(),
    severity: z.enum(['MILD', 'MODERATE', 'SEVERE']).optional(), status: z.enum(['ADMITTED', 'DISCHARGED']).optional(),
    from: z.string().optional(), to: z.string().optional(), sort: z.enum(['recordId', 'age', 'admissionDate', 'cost', 'stayDays']).default('admissionDate'),
    dir: z.enum(['asc', 'desc']).default('desc'), all: z.string().optional() }).parse(req.query);
  const m: Record<string, any> = { ...scope(req) };
  if (f.hospitalId && req.user!.role !== 'STAFF') m.hospitalId = f.hospitalId;
  if (f.search) { const rx = new RegExp(escapeRegex(f.search), 'i'); m.$or = [{ recordId: rx }, { condition: rx }, { treatment: rx }]; }
  if (f.condition) m.condition = f.condition;
  if (f.severity) m.severity = f.severity;
  if (f.status) m.status = f.status;
  if (f.from || f.to) m.admissionDate = { ...(f.from ? { $gte: toDate(f.from) } : {}), ...(f.to ? { $lte: toDate(f.to) } : {}) };
  const all = f.all === 'true'; // CSV export
  const [total, rows, hs] = await Promise.all([Patient.countDocuments(m),
    Patient.find(m).sort({ [SORT[f.sort]]: f.dir === 'asc' ? 1 : -1, id: 1 }).skip(all ? 0 : (f.page - 1) * f.pageSize).limit(all ? 10000 : f.pageSize).lean(),
    hospitalMap()]);
  res.json({ total, page: f.page, pageSize: f.pageSize, rows: rows.map(p => patientDto(p, hs.get(p.hospitalId))) });
}));
r.get('/conditions', wrap(async (_req, res) => res.json((await Patient.distinct('condition')).sort())));
r.get('/:id', wrap(async (req, res) => {
  const p = await Patient.findOne({ id: Number(req.params.id), ...scope(req) }).lean();
  if (!p) throw new HttpError(404, 'Record not found or not in your hospital');
  res.json(patientDto(p, await Hospital.findOne({ id: p.hospitalId }).lean()));
}));
r.post('/', requireRole('ADMIN', 'STAFF'), wrap(async (req, res) => {
  const d = patientSchema.parse(req.body); await assertHospitalAllowed(req, d.hospitalId);
  const [id, n] = await Promise.all([nextSeq('patient'), nextSeq('recordNumber')]);
  const p = await Patient.create({ ...toDoc(d), id, recordId: `MC-${String(n).padStart(6, '0')}` });
  logActivity(req.user!.id, 'PATIENT_CREATE', p.recordId);
  res.status(201).json({ id: p.id, recordId: p.recordId });
}));
r.put('/:id', requireRole('ADMIN', 'STAFF'), wrap(async (req, res) => {
  const existing = await Patient.findOne({ id: Number(req.params.id), ...scope(req) });
  if (!existing) throw new HttpError(404, 'Record not found or not in your hospital');
  const d = patientSchema.parse(req.body); await assertHospitalAllowed(req, d.hospitalId);
  existing.set(toDoc(d)); await existing.save();
  logActivity(req.user!.id, 'PATIENT_UPDATE', existing.recordId);
  res.json({ id: existing.id, recordId: existing.recordId });
}));
r.delete('/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  const p = await Patient.findOneAndDelete({ id: Number(req.params.id) });
  if (!p) throw new HttpError(404, 'Record not found');
  logActivity(req.user!.id, 'PATIENT_DELETE', p.recordId);
  res.status(204).end();
}));
export default r;
