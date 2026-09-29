import dotenv from 'dotenv';
dotenv.config();
export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/mumbaicare',
  jwtSecret: process.env.JWT_SECRET ?? '',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
};
