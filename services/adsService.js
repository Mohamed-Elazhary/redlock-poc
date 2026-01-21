function isWithinCurrentMinute(timestamp) {
  const now = new Date();
  const timestampDate = new Date(timestamp);
  
  return (
    now.getUTCFullYear() === timestampDate.getUTCFullYear() &&
    now.getUTCMonth() === timestampDate.getUTCMonth() &&
    now.getUTCDate() === timestampDate.getUTCDate() &&
    now.getUTCHours() === timestampDate.getUTCHours() &&
    now.getUTCMinutes() === timestampDate.getUTCMinutes()
  );
}

export async function validateAndInitializeADS(redis, workerId, processId) {
  try {
    const existing = await redis.get('ADS_REDLOCK');
    const currentUTCDate = new Date().toISOString();
    
    if (!existing) {
      console.log(`[Worker ${workerId} (PID: ${processId})] ADS_REDLOCK does not exist. Creating initial value...`);
      const initialADS = {
        id: `worker-${workerId}`,
        name: `Initial Worker ${workerId}`,
        time: currentUTCDate,
      };
      
      await redis.set('ADS_REDLOCK', JSON.stringify(initialADS));
      await redis.set('WARMUP_LAST_UPDATE', currentUTCDate);
      
      console.log(`[Worker ${workerId} (PID: ${processId})] Created ADS_REDLOCK key:`, initialADS);
      console.log(`[Worker ${workerId} (PID: ${processId})] Set WARMUP_LAST_UPDATE to:`, currentUTCDate);
      
      return initialADS;
    }
    
    const adsData = JSON.parse(existing);
    const warmupLastUpdate = await redis.get('WARMUP_LAST_UPDATE');
    
    if (warmupLastUpdate && isWithinCurrentMinute(warmupLastUpdate)) {
      console.log(`[Worker ${workerId} (PID: ${processId})] ADS_REDLOCK exists and WARMUP_LAST_UPDATE is within current minute. Using existing ADS_REDLOCK:`, adsData);
      return adsData;
    }
    
    console.log(`[Worker ${workerId} (PID: ${processId})] ADS_REDLOCK exists but WARMUP_LAST_UPDATE is not within current minute. Re-initializing...`);
    const initialADS = {
      id: `worker-${workerId}`,
      name: `Initial Worker ${workerId}`,
      time: currentUTCDate,
    };
    
    await redis.set('ADS_REDLOCK', JSON.stringify(initialADS));
    await redis.set('WARMUP_LAST_UPDATE', currentUTCDate);
    
    console.log(`[Worker ${workerId} (PID: ${processId})] Re-initialized ADS_REDLOCK key:`, initialADS);
    console.log(`[Worker ${workerId} (PID: ${processId})] Updated WARMUP_LAST_UPDATE to:`, currentUTCDate);
    
    return initialADS;
  } catch (error) {
    console.error(`[Worker ${workerId} (PID: ${processId})] Error validating ADS_REDLOCK:`, error.message);
    throw error;
  }
}

export async function getADS(redis) {
  const existing = await redis.get('ADS_REDLOCK');
  return existing ? JSON.parse(existing) : null;
}

export async function updateADS(redis, workerId, operationName) {
  const updatedADS = {
    id: `worker-${workerId}`,
    name: `${operationName} by Worker ${workerId}`,
    time: new Date().toISOString(),
  };
  await redis.set('ADS_REDLOCK', JSON.stringify(updatedADS));
  return updatedADS;
}

