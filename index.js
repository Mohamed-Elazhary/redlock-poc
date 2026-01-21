import cluster from 'cluster';
import { startWorker } from './worker/worker.js';

const NUM_WORKERS = process.env.NUM_WORKERS || 4;
const isPrimary = cluster.isPrimary || cluster.isMaster;

if (isPrimary) {
  console.log(`Primary process ${process.pid} is running`);
  console.log(`Starting ${NUM_WORKERS} worker processes...\n`);

  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.log(`Worker ${worker.process.pid} died with code ${code}. Restarting...`);
      cluster.fork();
    } else {
      console.log(`Worker ${worker.process.pid} exited normally.`);
    }
  });
} else {
  if (!cluster.worker) {
    console.error('Worker process but cluster.worker is undefined');
    process.exit(1);
  }
  
  const workerId = cluster.worker.id;
  const processId = process.pid;

  startWorker(workerId, processId);
}
