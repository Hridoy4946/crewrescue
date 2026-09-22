import mongoose from 'mongoose';
import { logger } from './logger.js';

export async function connectDB() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/crewrescue';

  mongoose.connection.on('connected', () => logger.info('✅ MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  });
}
