import { Schema, model } from 'mongoose';
/** Sequence generator for readable numeric ids (hospital id, patient id, record number, warehouse keys). */
const CounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = model('Counter', CounterSchema);
export async function nextSeq(name: string, by = 1): Promise<number> {
  const c = await Counter.findByIdAndUpdate(name, { $inc: { seq: by } }, { new: true, upsert: true });
  return c!.seq;
}
