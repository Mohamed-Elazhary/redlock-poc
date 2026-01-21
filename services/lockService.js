import { updateADS } from './adsService.js';

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

    await lock.release();
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

