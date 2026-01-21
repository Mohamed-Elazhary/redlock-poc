import { createRedisClient } from '../config/redis.js';
import { createRedlock } from '../config/redlock.js';
import { performLockedWarmUp } from '../services/lockService.js';
import { createHTTPServer } from '../server/httpServer.js';

const HTTP_PORT = process.env.HTTP_PORT || 3000;

export async function startWorker(workerId, processId) {
  const redis = createRedisClient(workerId, processId);
  const redlock = createRedlock([redis]);

  try {
    await redis.ping();
    console.log(`[Worker ${workerId} (PID: ${processId})] Redis connection established\n`);

    try {
      await performLockedWarmUp(redlock, redis, workerId, processId);
    } catch (error) {
      console.log(`[Worker ${workerId} (PID: ${processId})] Warmup failed but continuing worker startup...`);
    }

    const httpServer = createHTTPServer(redis, redlock, workerId, processId, HTTP_PORT);

    console.log(`[Worker ${workerId} (PID: ${processId})] Worker is ready and running. HTTP server is active.\n`);

    process.on('SIGTERM', async () => {
      console.log(`[Worker ${workerId} (PID: ${processId})] Received SIGTERM. Shutting down gracefully...`);
      httpServer.close();
      await redis.quit();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log(`[Worker ${workerId} (PID: ${processId})] Received SIGINT. Shutting down gracefully...`);
      httpServer.close();
      await redis.quit();
      process.exit(0);
    });
  } catch (error) {
    console.error(`[Worker ${workerId} (PID: ${processId})] Fatal error:`, error);
    await redis.quit();
    process.exit(1);
  }
}

