# Why server.js is Needed

## The Problem Without server.js

In a standard single-buildpack deployment, one start command launches one process. With **multiple buildpacks**, you have multiple runtimes but still only **one start command**.

The `start` command in `package.json` is:
```bash
cds-serve
```

This starts the Node.js CAP server which also lazily spawns the Python worker process via `srv/python.js`. Without this orchestration, the Python AI agent would never start.

---

## How the Python Worker is Spawned

`srv/python.js` manages the lifecycle of the persistent Python worker process:

```javascript
// srv/python.js
const { spawn } = require('child_process')
const path = require('path')

let pythonProcess = null

function spawnPython() {
  const pythonBin = process.env.PYTHON_BIN || 'python'
  const script = path.join(__dirname, '..', 'python', 'functions.py')
  pythonProcess = spawn(pythonBin, [script, '--worker'], {
    stdio: ['pipe', 'pipe', 'inherit']
  })
  pythonProcess.stdout.on('data', handleResponse)
}
```

Key properties:
- **Lazy spawn**: Python is started once on the first AI request, not at boot time.
- **Zero cold start overhead per request**: JSON-RPC calls over `stdin`/`stdout` have 0ms latency after warm-up.
- **stdin/stdout IPC bridge**: Node.js sends newline-delimited JSON requests; Python reads them line by line and responds.

---

## IPC Message Flow

```
Node.js CAP Server (srv/ai-service.js)
    │
    │  { "fn": "ask", "args": { "prompt": "...", "model": "...", "baseUrl": "...", "apiKey": "..." } }\n
    ▼
Python Worker (python/functions.py --worker)
    │
    │  [Input Guardrails] → [Redis Cache Check] → [HANA Vector RAG] → [LLM Router] → [Output Guardrails]
    ▼
    │  { "result": "..." }\n
    ▼
Node.js sends HTTP response to client
```

---

## Health & Readiness Probes

Both probes are registered in `srv/server.js`:

```javascript
// /healthz - Basic CAP server health
app.get('/healthz', (req, res) => res.json({ status: 'OK' }))

// /readyz - Tests Python IPC channel is alive
app.get('/readyz', async (req, res) => {
  try {
    const result = await python.call('ping', {})
    res.json({ status: 'READY', python: result === 'pong' ? 'OK' : 'DEGRADED' })
  } catch {
    res.status(503).json({ status: 'NOT_READY', python: 'DOWN' })
  }
})
```

Live endpoints:
- `https://bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com/healthz` → `{"status":"OK"}`
- `https://bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com/readyz` → `{"status":"READY","python":"OK"}`
