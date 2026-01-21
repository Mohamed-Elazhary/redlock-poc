import { updateADS, performWarmUp } from './adsService.js';

export async function performLockedWarmUp(redlock, redis, workerId, processId) {
  const lockKey = 'resource:warmup:write';
  const lockTTL = 5000;

  try {
    console.log(`[Worker ${workerId} (PID: ${processId})] Attempting to acquire lock for cache warmup...`);
    const startTime = Date.now();

    const lock = await redlock.acquire([lockKey], lockTTL);
    const acquireTime = Date.now() - startTime;

    console.log(`[Worker ${workerId} (PID: ${processId})] ✓ Lock acquired after ${acquireTime}ms for cache warmup`);

    const warmupStart = Date.now();
    
    const result = await performWarmUp(redis, workerId, processId);
    
    const warmupEnd = Date.now();
    const warmupDuration = warmupEnd - warmupStart;
    
    console.log(`[Worker ${workerId} (PID: ${processId})] ✓ Cache warmup completed in ${warmupDuration}ms`);

    await redlock.release(lock);
    console.log(`[Worker ${workerId} (PID: ${processId})] ✓ Lock released for cache warmup\n`);

    return result;
  } catch (error) {
    if (error.name === 'ExecutionError' || error.name === 'LockError') {
      console.log(`[Worker ${workerId} (PID: ${processId})] ⚠ Could not acquire lock for cache warmup. Skipping warmup and continuing...`);
      try {
        const existing = await redis.get('ADS_REDLOCK');
        if (existing) {
          const adsData = JSON.parse(existing);
          console.log(`[Worker ${workerId} (PID: ${processId})] Using existing ADS_REDLOCK without lock:`, adsData);
          return adsData;
        }
      } catch (readError) {
        console.error(`[Worker ${workerId} (PID: ${processId})] Error reading ADS_REDLOCK:`, readError.message);
      }
      return null;
    } else {
      console.error(`[Worker ${workerId} (PID: ${processId})] ✗ Error in cache warmup:`, error.message);
      throw error;
    }
  }
}

export async function performLockedOperation(redlock, redis, workerId, processId, operationName, duration = 2000) {
  const lockKey = 'resource:cache:write';
  const lockTTL = 5000;

  try {
    console.log(`[Worker ${workerId} (PID: ${processId})] Attempting to acquire lock for: ${operationName}`);
    const startTime = Date.now();

    const lock = await redlock.acquire([lockKey], lockTTL);
    const acquireTime = Date.now() - startTime;

    console.log(`[Worker ${workerId} (PID: ${processId})] ✓ Lock acquired after ${acquireTime}ms for: ${operationName}`);

    const operationStart = Date.now();
    
    const currentADS = await redis.get('ADS_REDLOCK');
    const adsData = currentADS ? JSON.parse(currentADS) : { id: '', name: '', time: '' };
    
    console.log(`[Worker ${workerId} (PID: ${processId})] Current ADS_REDLOCK value:`, adsData);
    
    await new Promise((resolve) => setTimeout(resolve, duration));
    
    const updatedADS = await updateADS(redis, workerId, operationName);
    
    const operationEnd = Date.now();
    const operationDuration = operationEnd - operationStart;
    
    console.log(`[Worker ${workerId} (PID: ${processId})] ✓ Updated ADS_REDLOCK to:`, updatedADS);
    console.log(`[Worker ${workerId} (PID: ${processId})] Operation took ${operationDuration}ms`);

    await redlock.release(lock);
    console.log(`[Worker ${workerId} (PID: ${processId})] ✓ Lock released for: ${operationName}\n`);

    return updatedADS;
  } catch (error) {
    if (error.name === 'ExecutionError' || error.name === 'LockError') {
      console.log(`[Worker ${workerId} (PID: ${processId})] ⚠ Could not acquire lock for: ${operationName}`);
    } else {
      console.error(`[Worker ${workerId} (PID: ${processId})] ✗ Error in operation: ${operationName}`, error.message);
    }
    return null;
  }
}

