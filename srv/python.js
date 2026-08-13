// Persistent bridge to the Python worker (python/functions.py --worker).
// Keeps one interpreter alive and exchanges newline-delimited JSON over its
// stdin/stdout, so the interpreter startup cost is paid only once per app run.
const { spawn } = require('node:child_process')
const path = require('node:path')

const SCRIPT = path.join(__dirname, '..', 'python', 'functions.py')
// Allow overriding the interpreter, e.g. PYTHON_BIN=python3.9 (set in manifest.yml).
const PYTHON = process.env.PYTHON_BIN || 'python3'

class PythonWorker {
  constructor() {
    this.proc = null // child process, lazily started on the first call
    this.buffer = '' // partial stdout lines not yet split on newlines
    this.nextId = 1 // request ids, echoed back by the worker to route deltas
    this.waiters = new Map() // id -> { resolve, reject, onDelta }
    this.stderr = '' // accumulated stderr for error diagnostics
  }

  // Send a JSON payload to Python; onDelta is invoked per streamed token.
  call(payload, onDelta) {
    this.#start() // ensure the worker process is running
    const id = `req${this.nextId++}`
    return new Promise((resolve, reject) => {
      // The worker echoes the id back on every line, so responses and streamed
      // deltas are matched to the right request via the waiters map alone.
      this.waiters.set(id, { resolve, reject, onDelta })
      this.proc.stdin.write(JSON.stringify({ id, ...payload }) + '\n') // one JSON doc per line
    })
  }

  // Lazily spawn the worker process (idempotent; no-op if already running).
  #start() {
    if (this.proc) return
    const proc = spawn(PYTHON, [SCRIPT, '--worker'], { stdio: ['pipe', 'pipe', 'pipe'] }) // <script> <flag>, so Python runs the file with our argv
    this.proc = proc
    this.buffer = ''
    this.stderr = ''
    proc.stdout.on('data', (d) => this.#onData(d)) // split incoming stream into lines
    proc.stderr.on('data', (d) => (this.stderr += d))
    proc.on('error', (err) => this.#fail(err)) // spawn failed
    proc.on('close', (code) => this.#fail(new Error(`python worker exited with ${code}: ${this.stderr}`)))
  }

  // Accumulate stdout chunks and handle each complete newline-separated message.
  #onData(d) {
    this.buffer += d
    let nl
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, nl).trim()
      this.buffer = this.buffer.slice(nl + 1)
      if (line) this.#resolveLine(line)
    }
  }

  // Resolve the oldest pending request with the next response line.
  #resolveLine(line) {
    let message
    try {
      message = JSON.parse(line)
    } catch (err) {
      this.#fail(err) // malformed JSON from the worker
      return
    }
    const id = message.id
    const entry = this.waiters.get(id)
    if (!entry) return // response without a matching request; drop it

    // Streaming token: invoke the callback and keep waiting for the 'done' line.
    if (message.event === 'delta') {
      if (entry.onDelta) entry.onDelta(message.token)
      return
    }

    // Done/error line terminates the call.
    this.waiters.delete(id)
    if (message.error) entry.reject(new Error(message.error))
    else entry.resolve(message)
  }

  // Reject all in-flight requests and allow a fresh process on the next call.
  #fail(err) {
    for (const { reject } of this.waiters.values()) reject(err)
    this.waiters.clear()
    this.proc = null
  }
}

module.exports = { python: new PythonWorker() } // export a shared singleton