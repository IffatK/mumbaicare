/**
 * Seed: demo users, 8 fictional hospitals and 3000 reproducible synthetic patients.
 * Seeded PRNG (mulberry32, seed 42) → every fresh database gets identical data. ALL DATA IS SYNTHETIC.
 * Safe to re-run: skips patients if they already exist.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../db';
import { User } from '../models/User';
import { Hospital } from '../models/Hospital';
import { Patient } from '../models/Patient';
import { Counter } from '../models/Counter';
import { rng } from '../services/mining/random';

const rnd = rng(42);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));
const gauss = (m: number, s: number) => { const u = 1 - rnd(), v = rnd(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

const HOSPITALS = [
  ['H-AND-01', 'Andheri Community Care (Demo)', 'Andheri', 'Multi-specialty'],
  ['H-BAN-02', 'Bandra Seaside General (Demo)', 'Bandra', 'General'],
  ['H-DAD-03', 'Dadar Central Clinic (Demo)', 'Dadar', 'Municipal'],
  ['H-GHA-04', 'Ghatkopar Wellness Hospital (Demo)', 'Ghatkopar', 'Multi-specialty'],
  ['H-BOR-05', 'Borivali Parkview Hospital (Demo)', 'Borivali', 'General'],
  ['H-CHE-06', 'Chembur Riverside Medical (Demo)', 'Chembur', 'Municipal'],
  ['H-COL-07', 'Colaba Harbour Hospital (Demo)', 'Colaba', 'Multi-specialty'],
  ['H-THA-08', 'Thane Lakeside Care (Demo)', 'Thane', 'General'],
];
// condition -> [baseline stay, baseline cost, treatments, characteristic tests]
const CONDITIONS: Record<string, [number, number, string[], string[]]> = {
  'Dengue': [5, 35000, ['IV Fluids', 'Supportive Care'], ['CBC', 'Platelet Count', 'NS1 Antigen']],
  'Malaria': [5, 30000, ['Antimalarial Therapy'], ['CBC', 'Blood Smear', 'LFT']],
  'Typhoid': [6, 28000, ['Antibiotic Therapy'], ['CBC', 'Widal Test', 'Blood Culture']],
  'Pneumonia': [7, 60000, ['Antibiotic Therapy', 'Oxygen Therapy'], ['Chest X-Ray', 'CBC', 'Sputum Culture']],
  'Diabetes Complications': [6, 55000, ['Insulin Management'], ['HbA1c', 'Blood Glucose', 'KFT']],
  'Hypertension': [4, 32000, ['Antihypertensive Therapy'], ['ECG', 'Lipid Profile', 'KFT']],
  'Cardiac Event': [9, 220000, ['Angioplasty', 'Cardiac Monitoring'], ['ECG', 'Troponin', 'Echocardiogram', 'Lipid Profile']],
  'Fracture': [6, 90000, ['Orthopaedic Surgery', 'Casting'], ['X-Ray', 'CBC']],
  'Gastroenteritis': [3, 18000, ['IV Fluids'], ['CBC', 'Stool Test', 'Electrolytes']],
  'Asthma Exacerbation': [4, 25000, ['Nebulization', 'Oxygen Therapy'], ['Spirometry', 'Chest X-Ray']],
};
const SEV_MULT = { MILD: 0.7, MODERATE: 1.0, SEVERE: 1.8 } as const;

export async function seed() {
  // hospitals
  for (let i = 0; i < HOSPITALS.length; i++) {
    const [code, name, area, type] = HOSPITALS[i];
    await Hospital.updateOne({ code }, { $setOnInsert: { id: i + 1, code, name, area, type, phone: `+91-22-5550-${between(1000, 9999)}`, email: `${code.toLowerCase()}@demo.mumbaicare.local` } }, { upsert: true });
  }
  await Counter.updateOne({ _id: 'hospital' }, { $max: { seq: HOSPITALS.length } }, { upsert: true });
  // users (password for all: Password@123)
  const hash = await bcrypt.hash('Password@123', 10);
  for (const u of [
    { email: 'admin@mumbaicare.local', name: 'Asha Admin', role: 'ADMIN', hospitalId: null },
    { email: 'analyst@mumbaicare.local', name: 'Rohan Analyst', role: 'ANALYST', hospitalId: null },
    { email: 'staff.andheri@mumbaicare.local', name: 'Meera Staff', role: 'STAFF', hospitalId: 1 },
    { email: 'staff.dadar@mumbaicare.local', name: 'Kiran Staff', role: 'STAFF', hospitalId: 3 },
  ]) await User.updateOne({ email: u.email }, { $setOnInsert: { ...u, passwordHash: hash } }, { upsert: true });

  const existing = await Patient.estimatedDocumentCount();
  if (existing > 0) { console.log(`Seed: ${existing} patients already present; users and hospitals ensured.`); return; }
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const start = today.getTime() - 730 * 86400000;
  const weight = [1.3, 1.1, 1.4, 1.0, 0.8, 0.9, 0.6, 0.9]; const tot = weight.reduce((a, b) => a + b);
  const extra = ['CBC', 'ECG', 'Chest X-Ray', 'Electrolytes', 'KFT', 'LFT'];
  const docs: any[] = [];
  for (let i = 1; i <= 3000; i++) {
    let r = rnd() * tot, h = 0; for (let k = 0; k < weight.length; k++) { r -= weight[k]; if (r <= 0) { h = k; break; } }
    const condition = pick(Object.keys(CONDITIONS)); const [bStay, bCost, trs, tests] = CONDITIONS[condition];
    const age = Math.min(90, Math.max(1, Math.round(gauss(condition === 'Cardiac Event' ? 62 : 42, 17))));
    const sr = rnd() + (age > 60 ? 0.2 : 0);
    const severity = sr < 0.5 ? 'MILD' : sr < 0.85 ? 'MODERATE' : 'SEVERE'; const m = SEV_MULT[severity];
    const adm = new Date(start + Math.floor(rnd() * 730) * 86400000);
    const stay = Math.max(1, Math.round(gauss(bStay * m, 1.5)));
    let dis: Date | null = new Date(adm.getTime() + stay * 86400000); let status = 'DISCHARGED';
    if (dis > today) { dis = null; status = 'ADMITTED'; }
    const t = [...tests]; if (rnd() < 0.35) t.push(pick(extra));
    docs.push({ id: i, recordId: `MC-${String(i).padStart(6, '0')}`, hospitalId: h + 1, age,
      gender: rnd() < 0.52 ? 'Male' : rnd() < 0.97 ? 'Female' : 'Other', condition, severity,
      systolicBp: Math.round(gauss(118 + age * 0.3 + (condition === 'Hypertension' ? 25 : 0) + (severity === 'SEVERE' ? 10 : 0), 10)),
      diastolicBp: Math.round(gauss(76 + (condition === 'Hypertension' ? 12 : 0), 7)),
      cholesterol: Math.round(gauss(180 + age * 0.6 + (condition === 'Cardiac Event' ? 40 : 0), 25)),
      heartRate: Math.round(gauss(76 + (severity === 'SEVERE' ? 14 : severity === 'MODERATE' ? 6 : 0), 8)),
      admissionDate: adm, dischargeDate: dis, stayDays: dis ? stay : null, treatment: pick(trs), tests: [...new Set(t)].join(','),
      cost: Math.max(2000, Math.round(gauss(bCost * m * (0.85 + weight[h] * 0.15) + stay * 2500, bCost * 0.12))), status });
  }
  await Patient.insertMany(docs, { ordered: false });
  await Counter.updateOne({ _id: 'patient' }, { $max: { seq: 3000 } }, { upsert: true });
  await Counter.updateOne({ _id: 'recordNumber' }, { $max: { seq: 3000 } }, { upsert: true });
  console.log(`Seeded ${HOSPITALS.length} hospitals, 4 users, ${docs.length} synthetic patients.`);
}
if (require.main === module) connectDb().then(seed).then(() => mongoose.disconnect()).catch(e => { console.error(e.message); process.exit(1); });
