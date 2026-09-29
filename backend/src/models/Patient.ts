import { Schema, model } from 'mongoose';
/** Operational patient admission record (synthetic). */
const PatientSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  recordId: { type: String, required: true, unique: true },
  hospitalId: { type: Number, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  condition: { type: String, required: true },
  severity: { type: String, enum: ['MILD', 'MODERATE', 'SEVERE'], required: true },
  systolicBp: Number, diastolicBp: Number, cholesterol: Number, heartRate: Number,
  admissionDate: { type: Date, required: true },
  dischargeDate: { type: Date, default: null },
  stayDays: { type: Number, default: null },
  treatment: { type: String, required: true },
  tests: { type: String, default: '' },
  cost: { type: Number, required: true },
  status: { type: String, enum: ['ADMITTED', 'DISCHARGED'], required: true },
}, { timestamps: true });
PatientSchema.index({ hospitalId: 1, admissionDate: 1 });
PatientSchema.index({ condition: 1 });
PatientSchema.index({ severity: 1 });
PatientSchema.index({ status: 1 });
PatientSchema.index({ updatedAt: 1 });
export const Patient = model('Patient', PatientSchema);
