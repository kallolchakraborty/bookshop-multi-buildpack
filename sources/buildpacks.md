# How Both Buildpacks Work

## The Two Buildpacks

1. **Node.js Buildpack** (SAP BTP standard)
   - Detects presence of `package.json`
   - Installs Node.js runtime (LTS version)
   - Runs `npm install`
   - Executes start command (`npm start` or `node server.js`)
   - Exposes app on `$PORT` (default 8080)

2. **Python Buildpack** (SAP BTP standard)
   - Detects presence of `requirements.txt` or `setup.py`
   - Installs Python runtime
   - Runs `pip install -r requirements.txt`
   - Executes the Python entrypoint

## The Multi Buildpack Mechanism

In `manifest.yml`, the `buildpacks` array specifies multiple buildpacks. The BTP deployment engine runs them **sequentially**:

```yaml
# manifest.yml - Multi-Buildpack Configuration
applications:
  - name: bookshop-multi-buildpack
    memory: 512M
    buildpacks:
      - python_buildpack
      - nodejs_buildpack
    command: npm start
    routes:
      - route: bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com
    env:
      PYTHON_BIN: python3
      NODE_ENV: production
      AI_MODEL: meta/llama-3.3-70b-instruct
      AI_TIMEOUT: "900"
    services:
      - bookshop-multi-buildpack-db
      - destination-service
      - bookshop-multi-buildpack-uaa
```

Each buildpack contributes its runtime layer to the final **Droplet** (container image). The droplet contains:
- Linux base (Ubuntu/Debian)
- Node.js binaries + npm packages
- Python interpreter + pip packages
- Application source code
- Start script

## How the Startup Works

### The Role of server.js

The `server.js` file is **the critical orchestrator** that makes Multi Buildpack work. Without it, the application would fail to start because:

1. **Single Entrypoint Problem**: Cloud Foundry expects one start command. Node.js is the primary runtime (first buildpack), so its start script runs.

2. **Python Service Co-location**: The Python service must run alongside Node.js. `server.js` spawns the Python backend as a child process before starting the Express server.

3. **Process Management**: `server.js` ensures:
   - Python process is alive before Node.js begins accepting traffic
   - Graceful shutdown of Python when Node.js exits
   - Environment variables are propagated to both runtimes

### server.js Implementation Pattern

```javascript
const { spawn } = require('child_process');
const express = require('express');

// Start Python backend
const python = spawn('python3', ['backend/main.py'], {
  env: { ...process.env, PORT: process.env.PYTHON_PORT || 5000 }
});

python.stdout.on('data', (data) => console.log(`[Python] ${data}`));
python.stderr.on('data', (data) => console.error(`[Python] ${data}`));

// Start Node.js frontend server
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', node: 'up', python: 'up' }));

const server = app.listen(process.env.PORT || 8080, () => {
  console.log(`Node.js server listening on ${process.env.PORT}`);
});
```

## Buildpack Execution Order

![Buildpack Flow](assets/diagrams/buildpack-flow.svg)

## Health Checks

```json
{
  "nodejs_health": {
    "endpoint": "/health",
    "expects": "200 OK"
  },
  "python_health": {
    "endpoint": "/api/health",
    "expects": "200 OK"
  }
}
```
