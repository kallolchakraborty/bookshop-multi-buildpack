# Why server.js is Needed

## The Problem Without server.js

In a standard single-buildpack deployment:
- One start command launches one process
- That process runs on the assigned port (usually 8080)
- Lifecycle is managed by Cloud Foundry

With **multiple buildpacks**, you have multiple runtimes but still only **one start command**. Without `server.js`:
1. Only the first buildpack's runtime starts
2. The second runtime (Python) never launches
3. The application fails health checks because Python endpoints are unavailable

## The Solution: server.js as Orchestrator

`server.js` acts as a **process manager** that:
1. Launches the Python backend
2. Waits for it to become healthy
3. Starts the Node.js server
4. Handles lifecycle events for both processes

## server.js Complete Implementation

```javascript
#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// ============================================
// Configuration
// ============================================
const CONFIG = {
  pythonPort: process.env.PYTHON_PORT || process.env.PORT || 8080,
  pythonHost: process.env.PYTHON_HOST || '127.0.0.1',
  pythonScript: path.join(__dirname, 'backend', 'main.py'),
  maxStartupRetries: 30,
  retryIntervalMs: 1000,
  healthCheckTimeoutMs: 5000,
  shutdownTimeoutMs: 10000
};

// ============================================
// Health Check Utility
// ============================================
function checkHealth(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const req = http.get(url, (res) => {
      resolve({ status: res.statusCode, time: Date.now() - startTime });
    });
    
    req.on('error', (err) => reject(err));
    req.setTimeout(CONFIG.healthCheckTimeoutMs, () => {
      req.destroy();
      reject(new Error('Health check timeout'));
    });
  });
}

async function waitForPython() {
  const healthUrl = `http://${CONFIG.pythonHost}:${CONFIG.pythonPort}/api/health`;
  console.log(`[server.js] Waiting for Python at ${healthUrl}...`);
  
  for (let i = 1; i <= CONFIG.maxStartupRetries; i++) {
    try {
      const result = await checkHealth(healthUrl);
      console.log(`[server.js] Python is healthy (${result.status}) in ${result.time}ms`);
      return true;
    } catch (err) {
      if (i === CONFIG.maxStartupRetries) {
        console.error(`[server.js] Python failed to start after ${CONFIG.maxStartupRetries} retries`);
        return false;
      }
      console.log(`[server.js] Python not ready (attempt ${i}/${CONFIG.maxStartupRetries})`);
      await new Promise(r => setTimeout(r, CONFIG.retryIntervalMs));
    }
  }
  return false;
}

// ============================================
// Process Spawning
// ============================================
function spawnPython() {
  console.log('[server.js] Starting Python backend...');
  
  const pythonEnv = {
    ...process.env,
    PORT: String(CONFIG.pythonPort),
    HOST: CONFIG.pythonHost,
    FLASK_APP: 'main.py',
    PYTHONUNBUFFERED: '1'
  };
  
  const python = spawn('python3', [CONFIG.pythonScript], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: pythonEnv,
    cwd: path.join(__dirname, 'backend')
  });
  
  python.stdout.on('data', (data) => {
    console.log(`[Python] ${data.toString().trim()}`);
  });
  
  python.stderr.on('data', (data) => {
    console.error(`[Python] ${data.toString().trim()}`);
  });
  
  python.on('error', (err) => {
    console.error('[server.js] Failed to start Python:', err);
  });
  
  python.on('exit', (code, signal) => {
    console.log(`[server.js] Python exited: code=${code}, signal=${signal}`);
  });
  
  return python;
}

// ============================================
// Node.js Server Startup
// ============================================
function startNodeServer() {
  return new Promise((resolve, reject) => {
    console.log('[server.js] Starting Node.js server...');
    
    try {
      const app = require('./src/app');
      const server = app.listen(CONFIG.pythonPort || 8080, () => {
        console.log(`[server.js] Node.js server running on port ${server.address().port}`);
        resolve(server);
      });
      
      server.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================
// Graceful Shutdown
// ============================================
function setupGracefulShutdown(python, nodeServer) {
  async function shutdown(signal) {
    console.log(`\n[server.js] Received ${signal}, shutting down...`);
    
    // Stop accepting new connections
    nodeServer.close(() => {
      console.log('[server.js] Node.js server closed');
    });
    
    // Terminate Python
    python.kill('SIGTERM');
    
    // Force kill after timeout
    setTimeout(() => {
      console.log('[server.js] Force killing processes...');
      python.kill('SIGKILL');
      process.exit(1);
    }, CONFIG.shutdownTimeoutMs).unref();
    
    // Normal exit
    setTimeout(() => process.exit(0), 1000).unref();
  }
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ============================================
// Main
// ============================================
async function main() {
  try {
    // 1. Start Python backend
    const python = spawnPython();
    
    // 2. Wait for Python to be ready
    const pythonHealthy = await waitForPython();
    if (!pythonHealthy) {
      console.error('[server.js] Aborting: Python backend not ready');
      process.exit(1);
    }
    
    // 3. Start Node.js server
    const nodeServer = await startNodeServer();
    
    // 4. Setup graceful shutdown
    setupGracefulShutdown(python, nodeServer);
    
    console.log('[server.js] All services started successfully');
    
  } catch (err) {
    console.error('[server.js] Startup failed:', err);
    process.exit(1);
  }
}

main();
```

## Alternative Approaches (and why they don't work)

### Approach 1: Multiple Start Commands
```yaml
command: python3 backend/main.py & node src/app.js
```
**Why it fails**: Cloud Foundry expects the command to run a foreground process. Background processes are killed immediately after the primary process exits.

### Approach 2: Supervisor Process
```yaml
command: supervisord -c supervisord.conf
```
**Why it fails**: Adds operational complexity, requires additional configuration files, and complicates log aggregation.

### Approach 3: Process Manager (PM2)
```javascript
require('pm2').start('src/app.js');
```
**Why it fails**: Not available in buildpack environments, violates single-binary principle.

## server.js Lifecycle

```
START
  │
  ▼
[1] Spawn Python Process
  │
  ▼
[2] Wait for Python /api/health (max 30 retries)
  │
  ▼
[3] Python Healthy? ──No──► Exit with Error
  │
  Yes
  ▼
[4] Start Node.js Express Server
  │
  ▼
[5] Setup Signal Handlers
  │
  ▼
[6] Running
  │
  ▼
[Shutdown] SIGTERM/SIGINT
  │
  ▼
[7] Stop Node.js Server
  │
  ▼
[8] Terminate Python
  │
  ▼
END
```
