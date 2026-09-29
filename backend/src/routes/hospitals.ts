import { Router } from 'express';
import { z } from 'zod';
import { Hospital } from '../models/Hospital';
import { Patient } from '../models/Patient';
import { nextSeq } from '../models/Counter';
import { wrap, HttpError } from '../lib/http';
import { requireRole } from '../middleware/auth';
const r = Router();
const body = z.object({ code: z.string().trim().min(2).max(20), name: z.string().trim().min(3).max(120), area: z.string().trim().min(2),
  type: z.string().min(2), phone: z.string().optional().nullable(), email: z.string().email().optional().nullable().or(z.literal('')), active: z.boolean().optional() });
const dto = (h: any, count = 0) => ({ id: h.id, code: h.code, name: h.name, area: h.area, type: h.type, phone: h.phone ?? null, email: h.email ?? null, active: h.active, patientCount: count });

r.get('/', wrap(async (_req, res) => {
  const [hs, counts] = await Promise.all([Hospital.find().sort({ name: 1 }).lean(), Patient.aggregate([{ $group: { _id: '$hospitalId', n: { $sum: 1 } } }])]);
  const c = new Map(counts.map(x => [x._id, x.n]));
  res.json(hs.map(h => dto(h, c.get(h.id) ?? 0)));
}));
r.get('/:id', wrap(async (req, res) => {
  const h = await Hospital.findOne({ id: Number(req.params.id) }).lean(); if (!h) throw new HttpError(404, 'Hospital not found');
  const [total, admitted] = await Promise.all([Patient.countDocuments({ hospitalId: h.id }), Patient.countDocuments({ hospitalId: h.id, status: 'ADMITTED' })]);
  res.json({ ...dto(h, total), admitted });
}));
r.post('/', requireRole('ADMIN'), wrap(async (req, res) => {
  const d = body.parse(req.body);
  const h = await Hospital.create({ ...d, email: d.email || null, id: await nextSeq('hospital') });
  res.status(201).json(dto(h));
}));
r.put('/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  const d = body.partial().parse(req.body);
  if (d.email !== undefined) d.email = d.email || null;
  const h = await Hospital.findOneAndUpdate({ id: Number(req.params.id) }, { $set: d }, { new: true }).lean();
  if (!h) throw new HttpError(404, 'Hospital not found');
  res.json(dto(h));
}));
export default r;
