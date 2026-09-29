import { z } from 'zod';
/** Mirrors apps/api/src/routes/patients.ts — the backend re-validates everything. */
const today = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };
export const patientFormSchema = z.object({
  hospitalId: z.coerce.number().int().positive('Select a hospital'),
  age: z.coerce.number().int().min(0, 'Age must be 0–110').max(110, 'Age must be 0–110'),
  gender: z.enum(['Male', 'Female', 'Other']),
  condition: z.string().min(2, 'Enter a condition'),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']),
  systolicBp: z.coerce.number().int().min(60).max(250), diastolicBp: z.coerce.number().int().min(30).max(150),
  cholesterol: z.coerce.number().int().min(80).max(450), heartRate: z.coerce.number().int().min(30).max(220),
  admissionDate: z.string().min(1, 'Enter the admission date'),
  dischargeDate: z.string().optional(),
  treatment: z.string().min(2, 'Enter a treatment'), tests: z.string().optional(),
  cost: z.coerce.number().min(0, 'Cost cannot be negative'),
  status: z.enum(['ADMITTED', 'DISCHARGED']),
}).superRefine((d, ctx) => {
  const a = new Date(d.admissionDate), dis = d.dischargeDate ? new Date(d.dischargeDate) : null;
  if (a > today()) ctx.addIssue({ code: 'custom', path: ['admissionDate'], message: 'Admission cannot be in the future' });
  if (d.status === 'DISCHARGED' && !dis) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Discharged patients need a discharge date' });
  if (d.status === 'ADMITTED' && dis) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Clear this date or set status to Discharged' });
  if (dis && dis < a) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Discharge cannot be before admission' });
  if (dis && dis > today()) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Discharge cannot be in the future' });
});
export type PatientForm = z.infer<typeof patientFormSchema>;
