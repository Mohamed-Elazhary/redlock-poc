# Redlock POC - Distributed Locking with Node.js Cluster

A proof of concept demonstrating distributed locking using Redlock with Node.js cluster mode and Redis.

## Overview

This application demonstrates how Redlock ensures that only one worker process can write to Redis at a time, even when multiple instances are running in parallel. When one worker acquires a lock, all other workers must wait until the lock is released.

## Features

- **Cluster Mode**: Runs multiple worker processes using Node.js cluster
- **HTTP Server**: Each worker runs an HTTP server on a unique port
- **Redis Integration**: Connects to Redis for data storage
- **Redlock**: Implements distributed locking to prevent concurrent writes
- **ADS_REDLOCK Key Validation**: Checks if the ADS_REDLOCK key exists at startup and initializes it if needed
- **Warmup Guard**: Prevents frequent re-initialization using WARMUP_LAST_SUCCESSFUL key (once per minute) with retry mechanism
- **Concurrent Operations**: Multiple workers attempt operations simultaneously, demonstrating lock behavior
- **Modular Architecture**: Clean separation of concerns with organized file structure

## Prerequisites

- Node.js (v18 or higher)
- Redis server running (default: localhost:6379)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Make sure Redis is running:
```bash
redis-server
```

## Project Structure

The project follows a modular architecture with clear separation of concerns:

```
redlock-poc/
├── index.js                    # Main entry point (cluster setup)
├── config/
│   ├── redis.js               # Redis connection configuration
│   └── redlock.js             # Redlock configuration
├── services/
│   ├── adsService.js          # ADS operations (validate, get, update)
│   └── lockService.js         # Lock operations (performLockedOperation)
├── server/
│   └── httpServer.js          # HTTP server setup and routes
└── worker/
    └── worker.js              # Worker initialization and lifecycle
```

### File Responsibilities

- **`index.js`**: Cluster setup, spawns worker processes, handles worker lifecycle
- **`config/redis.js`**: Creates and configures Redis client with connection handling
- **`config/redlock.js`**: Creates Redlock instance with distributed locking configuration
- **`services/adsService.js`**: Business logic for ADS operations:
  - `validateAndInitializeADS()` - Check/create ADS key at startup with warmup guard
  - `getADS()` - Get current ADS value from Redis
  - `updateADS()` - Update ADS value in Redis
- **`services/lockService.js`**: Lock management and operations:
  - `performLockedOperation()` - Acquire lock, perform operation, release lock
- **`server/httpServer.js`**: HTTP server implementation with all API routes
- **`worker/worker.js`**: Worker lifecycle management (initialization, graceful shutdown)

## Usage

Start the application:
```bash
npm start
```

## Environment Variables

- `REDIS_HOST`: Redis host (default: localhost)
- `REDIS_PORT`: Redis port (default: 6379)
- `NUM_WORKERS`: Number of worker processes (default: 4)
- `HTTP_PORT`: Base HTTP port (default: 3000). Each worker listens on HTTP_PORT + workerId

Example:
```bash
REDIS_HOST=localhost REDIS_PORT=6379 NUM_WORKERS=4 HTTP_PORT=3000 npm start
```

## HTTP API

Each worker runs an HTTP server on port `HTTP_PORT + workerId`. For example, with default settings:
- Worker 1: `http://localhost:3001`
- Worker 2: `http://localhost:3002`
- Worker 3: `http://localhost:3003`
- Worker 4: `http://localhost:3004`

### Endpoints

#### GET `/status`
Get worker status information.

**Response:**
```json
{
  "workerId": 1,
  "processId": 12345,
  "status": "running",
  "timestamp": "2026-01-21T00:00:00.000Z"
}
```

#### GET `/ads`
Get the current ADS_REDLOCK value from Redis.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "worker-1",
    "name": "Cache Update Operation 1 by Worker 1",
    "time": "2026-01-21T00:00:00.000Z"
  }
}
```

#### POST `/update`
Trigger a locked operation to update the ADS_REDLOCK value.

**Request Body (optional):**
```json
{
  "operationName": "Custom Operation Name",
  "duration": 2000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "id": "worker-1",
    "name": "Custom Operation Name by Worker 1",
    "time": "2026-01-21T00:00:00.000Z"
  }
}
```

If lock cannot be acquired:
```json
{
  "success": false,
  "message": "Could not acquire lock. Please try again later."
}
```

#### GET `/health`
Health check endpoint. Verifies Redis connection.

**Response:**
```json
{
  "status": "healthy",
  "workerId": 1,
  "redis": "connected"
}
```

### Example Usage

```bash
# Get worker status
curl http://localhost:3001/status

# Get current ADS value
curl http://localhost:3001/ads

# Trigger an update operation
curl -X POST http://localhost:3001/update \
  -H "Content-Type: application/json" \
  -d '{"operationName": "Manual Update", "duration": 2000}'

# Health check
curl http://localhost:3001/health
```

## How It Works

1. **Primary Process** (`index.js`): 
   - Spawns multiple worker processes (default: 4)
   - Monitors worker health and restarts failed workers

2. **Worker Initialization** (`worker/worker.js`):
   - Creates Redis connection using `config/redis.js`
   - Initializes Redlock using `config/redlock.js`
   - Validates/initializes ADS_REDLOCK key using `services/adsService.js`:
     - Checks `WARMUP_LAST_SUCCESSFUL` with retry mechanism (up to 3 attempts)
     - If valid and within current minute: Uses existing `ADS_REDLOCK`
     - If invalid or expired: Initializes both `ADS_REDLOCK` and `WARMUP_LAST_SUCCESSFUL`
   - Starts HTTP server using `server/httpServer.js`
   - Sets up graceful shutdown handlers

3. **HTTP Requests** (`server/httpServer.js`):
   - Routes requests to appropriate handlers
   - `/update` endpoint triggers locked operations via `services/lockService.js`

4. **Locked Operations** (`services/lockService.js`):
   - Attempts to acquire a lock using Redlock
   - If lock is acquired, reads current `ADS_REDLOCK` value
   - Updates the value using `services/adsService.js`
   - Releases the lock after completion
   - Other workers wait if the lock is held by another worker

## Initialization Logic

The `validateAndInitializeADS` function implements a warmup guard mechanism with retry logic:

1. **Check `WARMUP_LAST_SUCCESSFUL` with Retry**:
   - Uses `async-retry` to retry validation up to 3 times
   - Checks if `WARMUP_LAST_SUCCESSFUL` exists and is within the current minute (UTC)
   - Retry configuration: 3 attempts, 100-500ms timeout between retries
   - If validation succeeds → Get existing `ADS_REDLOCK` and return it (skip initialization)
   - If all retries fail → Proceed to initialization

2. **Initialize Both Keys**:
   - Create/update `ADS_REDLOCK` with initial data
   - Set `WARMUP_LAST_SUCCESSFUL` with current UTC date

This approach:
- Prevents multiple workers from re-initializing simultaneously
- Limits initialization to once per minute
- Handles transient Redis read issues with retry mechanism
- Uses `WARMUP_LAST_SUCCESSFUL` as the single source of truth

## Expected Output

You'll see output showing:
- Each worker connecting to Redis
- ADS_REDLOCK key validation/initialization
- WARMUP_LAST_SUCCESSFUL key creation/check
- Lock acquisition attempts and timing
- Operations being performed sequentially (not concurrently) due to locks
- Lock releases allowing the next worker to proceed

## Example Output

```
Primary process 12345 is running
Starting 4 worker processes...

[Worker 1 (PID: 12346)] Connected to Redis
[Worker 1 (PID: 12346)] Redis connection established
[Worker 1 (PID: 12346)] ADS_REDLOCK does not exist. Creating initial value...
[Worker 1 (PID: 12346)] Created ADS_REDLOCK key: { id: 'worker-1', name: 'Initial Worker 1', time: '...' }
[Worker 1 (PID: 12346)] Set WARMUP_LAST_SUCCESSFUL to: 2026-01-21T00:00:00.000Z

[Worker 1 (PID: 12346)] Attempting to acquire lock for: Cache Update Operation 1
[Worker 1 (PID: 12346)] ✓ Lock acquired after 5ms for: Cache Update Operation 1
[Worker 1 (PID: 12346)] Current ADS_REDLOCK value: { id: 'worker-1', name: 'Initial Worker 1', time: '...' }
[Worker 1 (PID: 12346)] ✓ Updated ADS_REDLOCK to: { id: 'worker-1', name: 'Cache Update Operation 1 by Worker 1', time: '...' }
[Worker 1 (PID: 12346)] Operation took 2000ms
[Worker 1 (PID: 12346)] ✓ Lock released for: Cache Update Operation 1
```

