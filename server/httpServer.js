import http from 'http';
import url from 'url';
import { getADS } from '../services/adsService.js';
import { performLockedOperation } from '../services/lockService.js';

export function createHTTPServer(redis, redlock, workerId, processId, httpPort) {
  const serverPort = parseInt(httpPort) + workerId;
  
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (method === 'GET' && path === '/status') {
      res.writeHead(200);
      res.end(JSON.stringify({
        workerId,
        processId,
        status: 'running',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    if (method === 'GET' && path === '/ads') {
      try {
        const adsData = await getADS(redis);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: adsData
        }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
      return;
    }

    if (method === 'POST' && path === '/update') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const params = body ? JSON.parse(body) : {};
          const operationName = params.operationName || `HTTP Update Request from Worker ${workerId}`;
          const duration = params.duration || 2000;

          const result = await performLockedOperation(redlock, redis, workerId, processId, operationName, duration);
          
          if (result) {
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              message: 'Operation completed successfully',
              data: result
            }));
          } else {
            res.writeHead(503);
            res.end(JSON.stringify({
              success: false,
              message: 'Could not acquire lock. Please try again later.'
            }));
          }
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({
            success: false,
            error: error.message
          }));
        }
      });
      return;
    }

    if (method === 'GET' && path === '/health') {
      try {
        await redis.ping();
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'healthy',
          workerId,
          redis: 'connected'
        }));
      } catch (error) {
        res.writeHead(503);
        res.end(JSON.stringify({
          status: 'unhealthy',
          workerId,
          redis: 'disconnected',
          error: error.message
        }));
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not Found',
      availableEndpoints: [
        'GET /status - Get worker status',
        'GET /ads - Get current ADS_REDLOCK value',
        'POST /update - Trigger a locked operation',
        'GET /health - Health check'
      ]
    }));
  });

  server.listen(serverPort, () => {
    console.log(`[Worker ${workerId} (PID: ${processId})] HTTP server listening on port ${serverPort}`);
  });

  return server;
}

