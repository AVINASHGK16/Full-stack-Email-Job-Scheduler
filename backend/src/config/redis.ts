import Redis from 'ioredis';
import { env } from './env';

// Create a shared Redis connection configuration instance
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ to run properly
});

redisConnection.on('connect', () => {
  console.log('🔌 Redis connected successfully');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});
