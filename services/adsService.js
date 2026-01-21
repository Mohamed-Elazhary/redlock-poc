export async function validateAndInitializeADS(redis, workerId, processId) {
  try {
    const existing = await redis.get('ADS_REDLOCK');
    
    if (existing) {
      const adsData = JSON.parse(existing);
      console.log(`[Worker ${workerId} (PID: ${processId})] ADS_REDLOCK key exists:`, adsData);
      return adsData;
    } else {
      console.log(`[Worker ${workerId} (PID: ${processId})] ADS_REDLOCK key does not exist. Creating initial value...`);
      const initialADS = {
        id: `worker-${workerId}`,
        name: `Initial Worker ${workerId}`,
        time: new Date().toISOString(),
      };
      await redis.set('ADS_REDLOCK', JSON.stringify(initialADS));
      console.log(`[Worker ${workerId} (PID: ${processId})] Created ADS_REDLOCK key:`, initialADS);
      return initialADS;
    }
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

