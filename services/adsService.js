
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

export async function performWarmUp(redis, workerId, processId) {
  const currentUTCDate = new Date().toISOString();

  try {
   const lastSuccessful = await redis.get('WARMUP_LAST_SUCCESSFUL');
   const isValid = lastSuccessful && isWithinCurrentMinute(lastSuccessful);
    if (isValid) {
      const existing = await redis.get('ADS_REDLOCK');
      if (existing) {
        const adsData = JSON.parse(existing);
        console.log(`[Worker ${workerId} (PID: ${processId})] WARMUP_LAST_SUCCESSFUL is within current minute. Using existing ADS_REDLOCK:`, adsData);
        return adsData;
      }
    } else {
      console.log(`[Worker ${workerId} (PID: ${processId})] WARMUP_LAST_SUCCESSFUL is not within current minute. Re-initializing...`);
    }
  } catch (error) {
    console.log(`[Worker ${workerId} (PID: ${processId})] WARMUP_LAST_SUCCESSFUL validation failed after retries. Re-initializing...`);
  }

  console.log(`[Worker ${workerId} (PID: ${processId})] Initializing ADS_REDLOCK...`);
  const initialADS = {
    id: `worker-${workerId}`,
    name: `Initial Worker ${workerId}`,
    time: currentUTCDate,
  };

  await redis.set('ADS_REDLOCK', JSON.stringify(initialADS));
  await redis.set('WARMUP_LAST_SUCCESSFUL', currentUTCDate);

  console.log(`[Worker ${workerId} (PID: ${processId})] Created ADS_REDLOCK key:`, initialADS);
  console.log(`[Worker ${workerId} (PID: ${processId})] Set WARMUP_LAST_SUCCESSFUL to:`, currentUTCDate);

  return initialADS;
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
  await redis.set('WARMUP_LAST_SUCCESSFUL', new Date().toISOString());
  return updatedADS;
}

