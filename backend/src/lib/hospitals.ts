import { Hospital } from '../models/Hospital';
/** id -> hospital lookup used to attach names to aggregation results. */
export async function hospitalMap() {
  const hs = await Hospital.find({}, { _id: 0, id: 1, name: 1, area: 1, type: 1 }).lean();
  return new Map(hs.map(h => [h.id, h]));
}
