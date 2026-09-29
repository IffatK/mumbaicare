import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User, ROLES } from '../models/User';
import { Hospital } from '../models/Hospital';
import { wrap, HttpError } from '../lib/http';
const r = Router();

const dto = (u: any) => ({ id: String(u._id), email: u.email, name: u.name, role: u.role, hospitalId: u.hospitalId ?? null, active: u.active, createdAt: u.createdAt });

async function resolveHospital(role: string, hospitalId?: number | null) {
  if (role !== 'STAFF') return null;
  if (!hospitalId) throw new HttpError(400, 'Staff accounts need a hospital assigned');
  if (!(await Hospital.findOne({ id: hospitalId }))) throw new HttpError(400, 'Hospital not found');
  return hospitalId;
}

r.get('/', wrap(async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  res.json(users.map(dto));
}));

const createBody = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(120),
  role: z.enum(ROLES),
  hospitalId: z.number().int().positive().optional().nullable(),
  password: z.string().min(8, 'At least 8 characters').max(72),
});
r.post('/', wrap(async (req, res) => {
  const d = createBody.parse(req.body);
  const hospitalId = await resolveHospital(d.role, d.hospitalId);
  const passwordHash = await bcrypt.hash(d.password, 10);
  const u = await User.create({ email: d.email.toLowerCase(), name: d.name, role: d.role, hospitalId, passwordHash });
  res.status(201).json(dto(u));
}));

const updateBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ROLES).optional(),
  hospitalId: z.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
});
r.put('/:id', wrap(async (req, res) => {
  const d = updateBody.parse(req.body);
  const u = await User.findById(req.params.id);
  if (!u) throw new HttpError(404, 'User not found');
  const self = String(u._id) === req.user!.id;
  if (self && (d.active === false || (d.role && d.role !== 'ADMIN'))) throw new HttpError(400, "You can't remove your own admin access");
  const role = d.role ?? u.role;
  const wantsHospitalChange = d.role !== undefined || d.hospitalId !== undefined;
  u.hospitalId = wantsHospitalChange ? await resolveHospital(role, d.hospitalId !== undefined ? d.hospitalId : u.hospitalId) : u.hospitalId;
  if (d.name !== undefined) u.name = d.name;
  if (d.role !== undefined) u.role = d.role;
  if (d.active !== undefined) u.active = d.active;
  await u.save();
  res.json(dto(u));
}));

const resetBody = z.object({ password: z.string().min(8, 'At least 8 characters').max(72) });
r.post('/:id/reset-password', wrap(async (req, res) => {
  const { password } = resetBody.parse(req.body);
  const u = await User.findById(req.params.id);
  if (!u) throw new HttpError(404, 'User not found');
  u.passwordHash = await bcrypt.hash(password, 10);
  await u.save();
  res.json({ ok: true });
}));

export default r;
