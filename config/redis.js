import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

export function createRedisClient(workerId, processId) {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on('connect', () => {
    console.log(`[Worker ${workerId} (PID: ${processId})] Connected to Redis`);
  });

  redis.on('error', (err) => {
    console.error(`[Worker ${workerId} (PID: ${processId})] Redis error:`, err.message);
  });

  return redis;
}

