import { Schema, model } from 'mongoose';
const ActivityLogSchema = new Schema({ userId: String, action: String, detail: String }, { timestamps: { createdAt: true, updatedAt: false } });
export const ActivityLog = model('ActivityLog', ActivityLogSchema);
export const logActivity = (userId: string, action: string, detail?: string) => ActivityLog.create({ userId, action, detail }).catch(() => {});
