// Shared helpers for the local integration tests.
// Starts a real CAP server (cds run --in-memory) on a random free port so tests
// never collide, and exercises endpoints over HTTP as they run when deployed.
const { spawn } = require('node:child_process')
const net = require('node:net')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Reserve a random free port for the test server (avoids EADDRINUSE clashes).
function getFreePort() {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.listen(0, () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

// Boot the CAP server and return a handle to talk to it.
async function startServer({ env = {} } = {}) {
  const port = await getFreePort()
  // --in-memory uses an ephemeral sqlite DB seeded from db/data/*.csv.
  const server = spawn(
    'npx',
    ['cds', 'run', '--in-memory', '--port', String(port)],
    // Neutralize the sandbox's global NODE_PATH so only the app-local
    // @sap/cds is used; otherwise CAP 10 fails with "loaded from different locations".
    {
      stdio: ['ignore', 'pipe', 'pipe'], // capture stdout/stderr for diagnostics
      env: { ...process.env, NODE_PATH: '', ...env },
      detached: true, // run in its own process group so stop() can kill it wholesale
    },
  )
  let logs = '' // rolling buffer of server output for debugging failures
  server.stdout.on('data', (d) => (logs += d))
  server.stderr.on('data', (d) => (logs += d))
  const base = `http://localhost:${port}`

  // Fetch with retry: the server may still be booting when the first request hits.
  async function request(path, options) {
    for (let i = 0; i < 40; i++) {
      try {
        return await fetch(base + path, options)
      } catch {
        await wait(500) // connection refused -> wait and retry
      }
    }
    throw new Error('server not reachable: ' + logs)
  }

  return {
    base,
    request,
    // Kill the whole process group (npx + real cds server + python worker) hard,
    // so no process is left holding the port even if the app ignores SIGTERM.
    stop: () => process.kill(-server.pid, 'SIGKILL'),
    logs: () => logs,
  }
}

module.exports = { startServer, getFreePort, wait }