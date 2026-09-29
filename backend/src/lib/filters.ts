import { Request } from 'express';
import { toDate } from './dates';
/** Builds a MongoDB $match for patients from query params, honouring staff hospital scoping. */
export function patientMatch(req: Request): Record<string, any> {
  const q = req.query as Record<string, string>; const m: Record<string, any> = {};
  const ids = req.user!.role === 'STAFF' ? [req.user!.hospitalId!] : q.hospitalIds ? q.hospitalIds.split(',').map(Number).filter(Boolean) : [];
  if (ids.length) m.hospitalId = { $in: ids };
  if (q.from || q.to) m.admissionDate = { ...(q.from ? { $gte: toDate(q.from) } : {}), ...(q.to ? { $lte: toDate(q.to) } : {}) };
  if (q.condition) m.condition = String(q.condition);
  if (q.severity) m.severity = String(q.severity);
  if (q.gender) m.gender = String(q.gender);
  return m;
}
