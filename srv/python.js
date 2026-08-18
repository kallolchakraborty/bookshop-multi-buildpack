// Persistent bridge to the Python worker (python/functions.py --worker).
// Keeps one interpreter alive and exchanges newline-delimited JSON over its
// stdin/stdout, so the interpreter startup cost is paid only once per app run.
const { spawn } = require('node:child_process')
const path = require('node:path')

const SCRIPT = path.join(__dirname, '..', 'python', 'functions.py')
// Allow overriding the interpreter, e.g. PYTHON_BIN=python3.9 (set in manifest.yml).
const PYTHON = process.env.PYTHON_BIN || 'python3'

class SingleWorker {
  constructor(id, pythonBin, scriptPath) {
    this.id = id
    this.pythonBin = pythonBin
    this.scriptPath = scriptPath
    this.proc = null
    this.buffer = ''
    this.stderr = ''
    this.activeWaiters = new Map()
    this.start()
  }

  start() {
    if (this.proc) return
    this.proc = spawn(this.pythonBin, [this.scriptPath, '--worker'], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.buffer = ''
    this.stderr = ''

    this.proc.stdout.on('data', (d) => this.#onData(d))
    this.proc.stderr.on('data', (d) => (this.stderr += d))
    this.proc.on('error', (err) => this.#fail(err))
    this.proc.on('close', (code) => this.#fail(new Error(`Worker ${this.id} exited with code ${code}: ${this.stderr}`)))
  }

  call(payload, id, onDelta) {
    this.start()
    return new Promise((resolve, reject) => {
      this.activeWaiters.set(id, { resolve, reject, onDelta })
      this.proc.stdin.write(JSON.stringify({ id, ...payload }) + '\n')
    })
  }

  #onData(d) {
    this.buffer += d
    let nl
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, nl).trim()
      this.buffer = this.buffer.slice(nl + 1)
      if (line) this.#resolveLine(line)
    }
  }

  #resolveLine(line) {
    let message
    try {
      message = JSON.parse(line)
    } catch (err) {
      this.#fail(err)
      return
    }
    const id = message.id
    const entry = this.activeWaiters.get(id)
    if (!entry) return

    if (message.event === 'delta') {
      if (entry.onDelta) entry.onDelta(message.token)
      return
    }

    this.activeWaiters.delete(id)
    if (message.error) entry.reject(new Error(message.error))
    else entry.resolve(message)
  }

  #fail(err) {
    for (const { reject } of this.activeWaiters.values()) reject(err)
    this.activeWaiters.clear()
    this.proc = null
  }
}

class PythonWorkerPool {
  constructor(poolSize = parseInt(process.env.PYTHON_WORKER_POOL_SIZE || '2', 10)) {
    this.poolSize = poolSize
    this.pythonBin = process.env.PYTHON_BIN || 'python3'
    this.scriptPath = SCRIPT
    this.workers = []
    this.rrIndex = 0
    this.nextId = 1
    this.#initPool()
  }

  #initPool() {
    for (let i = 0; i < this.poolSize; i++) {
      this.workers.push(new SingleWorker(i + 1, this.pythonBin, this.scriptPath))
    }
  }

  call(payload, onDelta) {
    const id = `req${this.nextId++}`
    const worker = this.workers[this.rrIndex]
    this.rrIndex = (this.rrIndex + 1) % this.poolSize
    return worker.call(payload, id, onDelta)
  }
}

module.exports = { python: new PythonWorkerPool() }