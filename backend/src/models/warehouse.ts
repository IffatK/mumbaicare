/**
 * DATA WAREHOUSE — Star schema stored as separate MongoDB collections (prefix "dw_").
 * The fact collection holds only numeric surrogate keys + measures; descriptive attributes
 * live in the dimension collections and are joined with $lookup during OLAP queries.
 */
import { Schema, model } from 'mongoose';
const opts = { versionKey: false } as const;

export const DimHospital = model('DimHospital', new Schema({
  hospitalKey: { type: Number, required: true, unique: true },
  hospitalId: { type: Number, required: true, unique: true },   // natural key
  hospitalName: String, area: String, hospitalType: String,
}, opts), 'dw_dim_hospital');

export const DimPatient = model('DimPatient', new Schema({
  patientKey: { type: Number, required: true, unique: true },
  patientRecordId: { type: String, required: true, unique: true }, // natural key
  age: Number, ageGroup: String, gender: String,
}, opts), 'dw_dim_patient');

const DimDiseaseSchema = new Schema({
  diseaseKey: { type: Number, required: true, unique: true },
  disease: String, severity: String,
}, opts);
DimDiseaseSchema.index({ disease: 1, severity: 1 }, { unique: true });
export const DimDisease = model('DimDisease', DimDiseaseSchema, 'dw_dim_disease');

export const DimDate = model('DimDate', new Schema({
  dateKey: { type: Number, required: true, unique: true },       // yyyymmdd
  fullDate: Date, day: Number, month: Number, monthName: String, quarter: Number, year: Number, weekday: String,
}, opts), 'dw_dim_date');

const FactSchema = new Schema({
  sourceRecordId: { type: String, required: true, unique: true }, // idempotency guard for repeated ETL runs
  patientKey: Number, hospitalKey: Number, diseaseKey: Number,
  admissionDateKey: Number, dischargeDateKey: { type: Number, default: null },
  patientCount: { type: Number, default: 1 }, isDischarged: Number,
  stayDays: { type: Number, default: null }, treatmentCost: Number,
  systolicBp: Number, diastolicBp: Number, cholesterol: Number, heartRate: Number,
  treatment: String, tests: String,
}, opts);
FactSchema.index({ hospitalKey: 1, admissionDateKey: 1 });
FactSchema.index({ diseaseKey: 1 });
export const FactPatientAdmission = model('FactPatientAdmission', FactSchema, 'dw_fact_patient_admission');

/** Metadata used by the Data Warehouse page. */
export const WAREHOUSE_TABLES = [
  { name: 'dw_fact_patient_admission', kind: 'fact', model: FactPatientAdmission, columns: ['sourceRecordId', 'patientKey', 'hospitalKey', 'diseaseKey', 'admissionDateKey', 'dischargeDateKey', 'patientCount', 'isDischarged', 'stayDays', 'treatmentCost', 'systolicBp', 'diastolicBp', 'cholesterol', 'heartRate', 'treatment', 'tests'] },
  { name: 'dw_dim_hospital', kind: 'dimension', model: DimHospital, columns: ['hospitalKey', 'hospitalId', 'hospitalName', 'area', 'hospitalType'] },
  { name: 'dw_dim_patient', kind: 'dimension', model: DimPatient, columns: ['patientKey', 'patientRecordId', 'age', 'ageGroup', 'gender'] },
  { name: 'dw_dim_disease', kind: 'dimension', model: DimDisease, columns: ['diseaseKey', 'disease', 'severity'] },
  { name: 'dw_dim_date', kind: 'dimension', model: DimDate, columns: ['dateKey', 'fullDate', 'day', 'month', 'monthName', 'quarter', 'year', 'weekday'] },
];
