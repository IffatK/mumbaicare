import { Schema, model } from 'mongoose';
const HospitalSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  area: { type: String, required: true },
  type: { type: String, required: true },
  phone: String, email: String,
  active: { type: Boolean, default: true },
}, { timestamps: true });
export const Hospital = model('Hospital', HospitalSchema);
