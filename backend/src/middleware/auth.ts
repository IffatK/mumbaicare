import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
export type Role = 'ADMIN' | 'ANALYST' | 'STAFF';
export interface AuthUser { id: string; role: Role; hospitalId: number | null; name: string; email: string }
declare global { namespace Express { interface Request { user?: AuthUser } } }

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in to continue' });
  try { req.user = jwt.verify(h.slice(7), config.jwtSecret) as AuthUser; next(); }
  catch { res.status(401).json({ error: 'Session expired. Sign in again.' }); }
}
export const requireRole = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) =>
  roles.includes(req.user!.role) ? next() : res.status(403).json({ error: 'Your role does not allow this action' });
