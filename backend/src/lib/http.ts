import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export const wrap = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Validation failed', issues: err.issues });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.code === 11000) return res.status(409).json({ error: 'A record with this identifier already exists' });
  if (err?.name === 'ValidationError' || err?.name === 'CastError') return res.status(400).json({ error: 'Invalid value in request' });
  console.error('[error]', err?.message); // never log patient payloads
  res.status(500).json({ error: 'Internal server error' });
}
