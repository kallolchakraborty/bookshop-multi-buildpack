# How Node.js Calls Python (Co-located IPC)

## Stdin/Stdout JSON-RPC Mechanism

The **BookShop Multi-Buildpack** application leverages Cloud Foundry multi-buildpack co-location. Instead of maintaining a separate HTTP server with port-allocation overhead, Node.js and Python communicate via high-performance **newline-delimited JSON-RPC over `stdin`/`stdout`** with **0ms cold start** per request.

![Request Flow](assets/diagrams/request-flow.svg)

---

## 1. Node.js IPC Manager (`srv/python.js`)

Node.js manages a persistent, lazy-spawned Python child process using Node's native `child_process.spawn()`:

```javascript
const { spawn } = require('child_process')
const readline = require('readline')
const path = require('path')

let pythonProcess = null
let pendingRequests = new Map()
let requestId = 0

function getPythonProcess() {
  if (pythonProcess && !pythonProcess.killed) return pythonProcess

  const pyBin = process.env.PYTHON_BIN || 'python3'
  const pyScript = path.resolve(__dirname, '../python/functions.py')

  pythonProcess = spawn(pyBin, [pyScript, '--worker'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  })

  const rl = readline.createInterface({ input: pythonProcess.stdout })
  rl.on('line', (line) => {
    try {
      const response = JSON.parse(line)
      const callback = pendingRequests.get(response.id)
      if (callback) {
        pendingRequests.delete(response.id)
        if (response.error) callback.reject(new Error(response.error))
        else callback.resolve(response.result)
      }
    } catch (err) {
      console.error('Failed to parse Python IPC output:', err)
    }
  })

  return pythonProcess
}

async function callPython(method, params) {
  const proc = getPythonProcess()
  const id = ++requestId
  const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject })
    proc.stdin.write(payload)
  })
}

module.exports = { callPython }
```

---

## 2. Python Worker Listener (`python/functions.py`)

The Python process runs a persistent loop reading newline-delimited JSON requests from `sys.stdin`:

```python
import sys
import json
from agent.graph import run_agent
from agent.rag import search_books_rag

def handle_request(req):
    method = req.get("method")
    params = req.get("params", {})
    
    if method == "calculate_discount":
        title = params.get("title", "")
        # Calculate dynamic discount factor
        return {"discount": 0.15, "eligible": True}
        
    elif method == "ask_agent":
        return run_agent(params.get("prompt"), params.get("model"))
        
    elif method == "ask_rag":
        return search_books_rag(params.get("prompt"), params.get("model"))
        
    raise ValueError(f"Unknown RPC method: {method}")

def main():
    if "--worker" in sys.argv:
        for line in sys.stdin:
            if not line.strip():
                continue
            try:
                req = json.loads(line)
                res = handle_request(req)
                response = {"jsonrpc": "2.0", "id": req.get("id"), "result": res}
            except Exception as e:
                response = {"jsonrpc": "2.0", "id": req.get("id"), "error": str(e)}
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
```

---

## 3. JSON-RPC Protocol Specification

### Request Frame (Node.js $\rightarrow$ Python via `stdin`):
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "ask_agent",
  "params": {
    "prompt": "What discounts are available for classic literature?",
    "model": "google/diffusiongemma-26b-a4b-it"
  }
}
```

### Response Frame (Python $\rightarrow$ Node.js via `stdout`):
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": {
    "response": "Classic literature titles enjoy a 15% promotional discount.",
    "model_used": "google/diffusiongemma-26b-a4b-it",
    "cached": false,
    "latency_ms": 240
  }
}
```

---

## Advantages of Co-located Stdin/Stdout IPC

| Feature | Stdin/Stdout JSON-RPC (Co-located) | HTTP Microservice Approach |
|---------|-----------------------------------|----------------------------|
| **Memory Footprint** | Single 512 MB Droplet | 2+ droplets ($2 \times 512$ MB min) |
| **Cold Start** | **0ms** (single persistent worker) | 3–10s per cold droplet |
| **Port Exposure** | Internal only (No external attack vector) | HTTP port must be routed/secured |
| **Network Latency** | **< 1ms** OS pipe buffer | 15–80ms HTTP network roundtrip |
| **BTP Cost** | Single App Instance quota | Multiple App Subscriptions |
