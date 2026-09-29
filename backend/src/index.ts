import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { connectDb } from './db';
import { requireAuth, requireRole } from './middleware/auth';
import { errorHandler } from './lib/http';
import auth from './routes/auth';
import patients from './routes/patients';
import hospitals from './routes/hospitals';
import analytics from './routes/analytics';
import warehouse from './routes/warehouse';
import olap from './routes/olap';
import mining from './routes/mining';
import reports from './routes/reports';
import quality from './routes/quality';
import users from './routes/users';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', auth);
  app.use('/api/patients', requireAuth, patients);
  app.use('/api/hospitals', requireAuth, hospitals);
  app.use('/api/analytics', requireAuth, analytics);
  app.use('/api/warehouse', requireAuth, requireRole('ADMIN', 'ANALYST'), warehouse);
  app.use('/api/olap', requireAuth, requireRole('ADMIN', 'ANALYST'), olap);
  app.use('/api/mining', requireAuth, requireRole('ADMIN', 'ANALYST'), mining);
  app.use('/api/reports', requireAuth, reports);
  app.use('/api/quality', requireAuth, requireRole('ADMIN', 'ANALYST'), quality);
  app.use('/api/users', requireAuth, requireRole('ADMIN'), users);
  app.use(errorHandler);
  return app;
}
if (require.main === module) {
  if (!config.jwtSecret) throw new Error('JWT_SECRET is not set (backend/.env)');
  connectDb().then(() => createApp().listen(config.port, () => console.log(`MumbaiCare API listening on :${config.port}`)))
    .catch(e => { console.error('Failed to start:', e.message); process.exit(1); });
}
