import { Router } from 'express';
import { WAREHOUSE_TABLES } from '../models/warehouse';
import { EtlRun } from '../models/EtlRun';
import { Patient } from '../models/Patient';
import { logActivity } from '../models/ActivityLog';
import { wrap, HttpError } from '../lib/http';
import { requireRole } from '../middleware/auth';
import { runEtl } from '../services/etl';
const r = Router();
const runDto = (x: any) => ({ id: x.id, status: x.status, startedAt: x.startedAt, endedAt: x.endedAt ?? null, extracted: x.extracted,
  transformed: x.transformed, loaded: x.loaded, rejected: x.rejected, errors: x.issues ?? [] });
r.get('/schema', wrap(async (_req, res) => {
  res.json(await Promise.all(WAREHOUSE_TABLES.map(async t => ({ name: t.name, kind: t.kind, columns: t.columns, rows: await t.model.estimatedDocumentCount() }))));
}));
r.get('/status', wrap(async (_req, res) => {
  const runs = (await EtlRun.find().sort({ startedAt: -1 }).limit(20).lean()).map(runDto);
  const last = runs.find(x => x.status === 'SUCCESS');
  const ops = await Patient.countDocuments();
  const pending = last ? await Patient.countDocuments({ updatedAt: { $gt: last.startedAt } }) : ops;
  res.json({ runs, lastSuccess: last ?? null, operationalRecords: ops, pendingChanges: pending });
}));
r.post('/etl/run', requireRole('ADMIN'), wrap(async (req, res) => {
  try { const result = await runEtl(); logActivity(req.user!.id, 'ETL_RUN', `run ${result.runId}`); res.json(result); }
  catch (e: any) { if (e.status === 409) throw new HttpError(409, e.message); throw e; }
}));
export default r;
