/**
 * MumbaiCare ETL — operational collections → Extract → Transform → Validate → Load → star-schema warehouse.
 *
 * Transformation rules
 *   T1  Categorical values trimmed; gender title-cased; severity upper-cased.
 *   T2  Dates normalised to UTC midnight; date keys are yyyymmdd integers.
 *   T3  Age group derived: 0-17, 18-34, 35-49, 50-64, 65+.
 *   T4  Stay duration recomputed from the dates (the operational value is never modified).
 *   T5  Tests normalised to a sorted, de-duplicated comma list.
 * Validation rules — a failing record is REJECTED and reported, never silently fixed
 *   R01 missing required field   R02 age outside 0-110          R03 discharge before admission
 *   R04 negative cost            R05 status/discharge mismatch  R06 admission in the future
 *   R07 unknown hospital
 * Load
 *   Dimensions are upserted on their natural keys and receive a surrogate key once.
 *   Facts are upserted on sourceRecordId, so re-running the ETL updates instead of duplicating.
 *   Facts whose source record was deleted (or is now rejected) are removed.
 */
import { Patient } from '../models/Patient';
import { Hospital } from '../models/Hospital';
import { EtlRun } from '../models/EtlRun';
import { nextSeq } from '../models/Counter';
import { DimHospital, DimPatient, DimDisease, DimDate, FactPatientAdmission } from '../models/warehouse';
import { dateKey, daysBetween, toDate, todayStr } from '../lib/dates';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const ageGroup = (a: number) => (a < 18 ? '0-17' : a < 35 ? '18-34' : a < 50 ? '35-49' : a < 65 ? '50-64' : '65+');
const title = (s: string) => s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export interface Clean {
  recordId: string; hospitalId: number; age: number; ageGroup: string; gender: string; condition: string; severity: string;
  admission: Date; discharge: Date | null; stay: number | null; isDischarged: number; cost: number;
  systolicBp: number; diastolicBp: number; cholesterol: number; heartRate: number; treatment: string; tests: string;
}
export interface Rejected { recordId: string; rule: string }

/** Pure transform + validate step (unit-tested in scripts/selfTest.ts). */
export function transform(raw: any[], hospitalIds: Set<number>) {
  const clean: Clean[] = []; const rejected: Rejected[] = [];
  const today = toDate(todayStr());
  for (const p of raw) {
    const reject = (rule: string) => rejected.push({ recordId: p.recordId ?? `(id ${p.id})`, rule });
    const required = ['recordId', 'hospitalId', 'age', 'gender', 'condition', 'severity', 'admissionDate', 'cost', 'status', 'treatment'];
    if (required.some(k => p[k] === null || p[k] === undefined || p[k] === '')) { reject('R01 missing required field'); continue; }
    const admission = toDate(new Date(p.admissionDate).toISOString());                               // T2
    const discharge = p.dischargeDate ? toDate(new Date(p.dischargeDate).toISOString()) : null;
    if (!(p.age >= 0 && p.age <= 110)) { reject('R02 age outside 0-110'); continue; }
    if (discharge && discharge < admission) { reject('R03 discharge before admission'); continue; }
    if (p.cost < 0) { reject('R04 negative cost'); continue; }
    if ((p.status === 'DISCHARGED') !== !!discharge) { reject('R05 status/discharge mismatch'); continue; }
    if (admission > today) { reject('R06 admission in the future'); continue; }
    if (!hospitalIds.has(p.hospitalId)) { reject('R07 unknown hospital'); continue; }
    clean.push({
      recordId: p.recordId, hospitalId: p.hospitalId, age: p.age, ageGroup: ageGroup(p.age),                                // T3
      gender: title(p.gender), condition: String(p.condition).trim(), severity: String(p.severity).trim().toUpperCase(),  // T1
      admission, discharge, stay: discharge ? daysBetween(admission, discharge) : null,                                    // T4
      isDischarged: discharge ? 1 : 0, cost: Number(p.cost),
      systolicBp: p.systolicBp, diastolicBp: p.diastolicBp, cholesterol: p.cholesterol, heartRate: p.heartRate,
      treatment: String(p.treatment).trim(),
      tests: [...new Set(String(p.tests ?? '').split(',').map((t: string) => t.trim()).filter(Boolean))].sort().join(','),  // T5
    });
  }
  return { clean, rejected };
}

/**
 * Upserts one dimension. `naturalFields` identify a member (its natural key); existing members keep
 * their surrogate key and new members receive the next key from a counter.
 */
async function loadDimension<T>(model: any, keyField: string, naturalFields: string[], natural: (x: T) => Record<string, any>,
  attrs: (x: T) => Record<string, any>, members: T[], seqName: string) {
  const existing: any[] = await model.find({}).lean();
  const id = (o: Record<string, any>) => JSON.stringify(naturalFields.map(f => o[f]));
  const keys = new Map<string, number>(existing.map(e => [id(e), e[keyField]]));
  const unique = new Map<string, T>(); for (const m of members) unique.set(id(natural(m)), m);
  const missing = [...unique.keys()].filter(k => !keys.has(k));
  if (missing.length) { const last = await nextSeq(seqName, missing.length); missing.forEach((k, i) => keys.set(k, last - missing.length + 1 + i)); }
  const ops = [...unique.entries()].map(([k, m]) => { const a = attrs(m);   // MongoDB rejects an empty $set, so only add it when there are attributes
    return { updateOne: { filter: natural(m), update: { ...(Object.keys(a).length ? { $set: a } : {}), $setOnInsert: { [keyField]: keys.get(k) } }, upsert: true } }; });
  for (let i = 0; i < ops.length; i += 1000) await model.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
  return (m: T) => keys.get(id(natural(m)))!;
}

export async function runEtl() {
  if (await EtlRun.exists({ status: 'RUNNING', startedAt: { $gt: new Date(Date.now() - 10 * 60_000) } }))
    throw Object.assign(new Error('An ETL run is already in progress'), { status: 409 });
  const run = await EtlRun.create({ id: await nextSeq('etlRun'), status: 'RUNNING' });
  const stats = { extracted: 0, transformed: 0, loaded: 0, rejected: 0 };
  let issues: any[] = [];
  try {
    // ---- Extract
    const [raw, hospitals] = await Promise.all([Patient.find().lean(), Hospital.find().lean()]);
    stats.extracted = raw.length;
    // ---- Transform + Validate
    const { clean, rejected } = transform(raw, new Set(hospitals.map(h => h.id)));
    stats.transformed = clean.length; stats.rejected = rejected.length; issues = rejected.slice(0, 500);
    // ---- Load dimensions
    const hKey = await loadDimension<any>(DimHospital, 'hospitalKey', ['hospitalId'], h => ({ hospitalId: h.id }),
      h => ({ hospitalName: h.name, area: h.area, hospitalType: h.type }), hospitals, 'dimHospital');
    const pKey = await loadDimension<Clean>(DimPatient, 'patientKey', ['patientRecordId'], c => ({ patientRecordId: c.recordId }),
      c => ({ age: c.age, ageGroup: c.ageGroup, gender: c.gender }), clean, 'dimPatient');
    const dKey = await loadDimension<Clean>(DimDisease, 'diseaseKey', ['disease', 'severity'], c => ({ disease: c.condition, severity: c.severity }),
      () => ({}), clean, 'dimDisease');
    const dates = new Map<number, Date>();
    for (const c of clean) { dates.set(dateKey(c.admission), c.admission); if (c.discharge) dates.set(dateKey(c.discharge), c.discharge); }
    const dateOps = [...dates.entries()].map(([k, d]) => ({ updateOne: { filter: { dateKey: k }, upsert: true, update: { $setOnInsert: {
      dateKey: k, fullDate: d, day: d.getUTCDate(), month: d.getUTCMonth() + 1, monthName: MONTHS[d.getUTCMonth()],
      quarter: Math.floor(d.getUTCMonth() / 3) + 1, year: d.getUTCFullYear(), weekday: WEEKDAYS[d.getUTCDay()] } } } }));
    if (dateOps.length) await DimDate.bulkWrite(dateOps, { ordered: false });
    // ---- Load facts (idempotent upsert on sourceRecordId)
    const factOps = clean.map(c => ({ updateOne: { filter: { sourceRecordId: c.recordId }, upsert: true, update: { $set: {
      patientKey: pKey(c), hospitalKey: hKey({ id: c.hospitalId }), diseaseKey: dKey(c),
      admissionDateKey: dateKey(c.admission), dischargeDateKey: c.discharge ? dateKey(c.discharge) : null,
      patientCount: 1, isDischarged: c.isDischarged, stayDays: c.stay, treatmentCost: c.cost,
      systolicBp: c.systolicBp, diastolicBp: c.diastolicBp, cholesterol: c.cholesterol, heartRate: c.heartRate, treatment: c.treatment, tests: c.tests } } } }));
    for (let i = 0; i < factOps.length; i += 1000) await FactPatientAdmission.bulkWrite(factOps.slice(i, i + 1000), { ordered: false });
    await FactPatientAdmission.deleteMany({ sourceRecordId: { $nin: clean.map(c => c.recordId) } });
    stats.loaded = clean.length;
    run.set({ ...stats, status: 'SUCCESS', endedAt: new Date(), issues });
  } catch (e: any) {
    run.set({ ...stats, status: 'FAILED', endedAt: new Date(), issues: [{ rule: 'PIPELINE', message: String(e?.message ?? e).slice(0, 500) }] });
  }
  await run.save();
  return { runId: run.id, status: run.status, ...stats, errors: (run.issues as any[]).slice(0, 50), finishedAt: run.endedAt };
}
