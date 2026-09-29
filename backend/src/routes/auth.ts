import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Hospital } from '../models/Hospital';
import { logActivity } from '../models/ActivityLog';
import { config } from '../config';
import { wrap, HttpError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
const r = Router();

// simple in-memory brute-force guard: 10 failed attempts per email per 15 minutes
const failures = new Map<string, { n: number; until: number }>();

async function profile(u: any) {
  const h = u.hospitalId ? await Hospital.findOne({ id: u.hospitalId }).lean() : null;
  return { id: String(u._id), name: u.name, email: u.email, role: u.role, hospitalId: u.hospitalId ?? null, hospitalName: h?.name ?? null };
}
r.post('/login', wrap(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const key = email.toLowerCase(); const f = failures.get(key);
  if (f && f.n >= 10 && f.until > Date.now()) throw new HttpError(429, 'Too many failed attempts. Try again in 15 minutes.');
  const u = await User.findOne({ email: key });
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) {
    failures.set(key, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    throw new HttpError(401, 'Email or password is incorrect');
  }
  failures.delete(key);
  if (u.active === false) throw new HttpError(403, 'This account has been deactivated');
  const user = await profile(u);
  const token = jwt.sign({ id: user.id, role: user.role, hospitalId: user.hospitalId, name: user.name, email: user.email }, config.jwtSecret, { expiresIn: '8h' });
  logActivity(user.id, 'LOGIN');
  res.json({ token, user });
}));
r.get('/me', requireAuth, wrap(async (req, res) => {
  const u = await User.findById(req.user!.id).lean(); if (!u) throw new HttpError(401, 'Account no longer exists');
  res.json(await profile(u));
}));
export default r;
