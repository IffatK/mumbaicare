/** Loads the analytical dataset by joining the fact collection to its dimensions (never from raw operational data). */
import { FactPatientAdmission } from '../../models/warehouse';
import { MiningError } from './random';
export interface Row {
  record_id: string; hospital: string; hospital_id: number; age: number; age_group: string; gender: string; disease: string; severity: string;
  systolic_bp: number; diastolic_bp: number; cholesterol: number; heart_rate: number; stay_days: number | null; treatment_cost: number;
  is_discharged: number; treatment: string; tests: string;
}
export async function loadDataset(hospitalIds?: number[]): Promise<Row[]> {
  const rows = await FactPatientAdmission.aggregate([
    { $lookup: { from: 'dw_dim_hospital', localField: 'hospitalKey', foreignField: 'hospitalKey', as: 'h' } }, { $unwind: '$h' },
    ...(hospitalIds?.length ? [{ $match: { 'h.hospitalId': { $in: hospitalIds } } }] : []),
    { $lookup: { from: 'dw_dim_patient', localField: 'patientKey', foreignField: 'patientKey', as: 'p' } }, { $unwind: '$p' },
    { $lookup: { from: 'dw_dim_disease', localField: 'diseaseKey', foreignField: 'diseaseKey', as: 'd' } }, { $unwind: '$d' },
    { $sort: { sourceRecordId: 1 } },
    { $project: { _id: 0, record_id: '$sourceRecordId', hospital: '$h.hospitalName', hospital_id: '$h.hospitalId', age: '$p.age', age_group: '$p.ageGroup',
      gender: '$p.gender', disease: '$d.disease', severity: '$d.severity', systolic_bp: '$systolicBp', diastolic_bp: '$diastolicBp', cholesterol: 1,
      heart_rate: '$heartRate', stay_days: '$stayDays', treatment_cost: '$treatmentCost', is_discharged: '$isDischarged', treatment: 1, tests: 1 } },
  ]);
  if (!rows.length) throw new MiningError('The warehouse is empty for this selection. Run the ETL first.');
  return rows;
}
