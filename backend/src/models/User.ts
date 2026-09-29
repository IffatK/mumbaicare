import { Schema, model } from 'mongoose';
export const ROLES = ['ADMIN', 'ANALYST', 'STAFF'] as const;
const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ROLES, required: true },
  hospitalId: { type: Number, default: null },     // required for STAFF
  active: { type: Boolean, default: true },
}, { timestamps: true });
export const User = model('User', UserSchema);
