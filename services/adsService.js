import retry from 'async-retry';

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

async function retryValidateLastSuccessful(redis, workerId, processId) {
  return await retry(
    async () => {
      const lastSuccessful = await redis.get('WARMUP_LAST_SUCCESSFUL');
      if (lastSuccessful && isWithinCurrentMinute(lastSuccessful)) {
        return true;
      }
      return false;
    },
    {
      retries: 3,
      minTimeout: 100,
      maxTimeout: 500,
      onRetry: (error, attempt) => {
        console.log(`[Worker ${workerId} (PID: ${processId})] Retry attempt ${attempt} to validate WARMUP_LAST_SUCCESSFUL...`);
      }
    }
  );
}

export async function validateAndInitializeADS(redis, workerId, processId) {
  try {
    console.log(`[Worker ${workerId} (PID: ${processId})] Validating and initializing ADS_REDLOCK...`);
    const currentUTCDate = new Date().toISOString();
    
    try {
      const isValid = await retryValidateLastSuccessful(redis, workerId, processId);
      if (isValid) {
        const existing = await redis.get('ADS_REDLOCK');
        if (existing) {
          const adsData = JSON.parse(existing);
          console.log(`[Worker ${workerId} (PID: ${processId})] WARMUP_LAST_SUCCESSFUL is within current minute. Using existing ADS_REDLOCK:`, adsData);
          return adsData;
        }
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

