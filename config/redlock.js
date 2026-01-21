import Redlock from 'redlock';

export function createRedlock(redisClients) {
  const redlock = new Redlock(redisClients, {
    driftFactor: 0.01,
    retryCount: 10,
    retryDelay: 200,
    retryJitter: 200,
  });

  return redlock;
}

