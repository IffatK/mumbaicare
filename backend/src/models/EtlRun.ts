import { Schema, model } from 'mongoose';
const EtlRunSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  startedAt: { type: Date, default: Date.now }, endedAt: Date,
  status: { type: String, enum: ['RUNNING', 'SUCCESS', 'FAILED'], required: true },
  extracted: { type: Number, default: 0 }, transformed: { type: Number, default: 0 },
  loaded: { type: Number, default: 0 }, rejected: { type: Number, default: 0 },
  issues: { type: [Schema.Types.Mixed], default: [] },   // rejected records + errors ("errors" is reserved in Mongoose)
});
export const EtlRun = model('EtlRun', EtlRunSchema);
