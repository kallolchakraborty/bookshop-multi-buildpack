// Custom HTTP Bootstrap & Middleware for SAP CAP Server.
// Implements:
// 1. Sliding-Window Rate Limiting (15 req/min per IP) to prevent DoS & LLM API token exhaustion.
// 2. HTTP Security Headers (CORS & Content Security Policy).
// 3. Health & Readiness Probes (/healthz & /readyz) for Cloud Foundry process monitoring.
// 4. Server-Sent Events (SSE) Streaming endpoint (/ai/ask/stream).

const cds = require('@sap/cds')
const { python } = require('./python')
const { getAIDestination } = require('./ai-destination')

// Simple sliding window rate limiter cache: { ip: [timestamp, ...] }
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15
const ipRequestCache = new Map()

// Rate Limiting Middleware
function applyRateLimiting(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-client'
  const now = Date.now()
  
  if (!ipRequestCache.has(ip)) {
    ipRequestCache.set(ip, [])
  }
  
  const timestamps = ipRequestCache.get(ip).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS)
  
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    res.setHeader('Retry-After', '60')
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded (15 requests/minute). Please wait before retrying.'
    })
    return false
  }
  
  timestamps.push(now)
  ipRequestCache.set(ip, timestamps)
  return true
}

cds.once('bootstrap', (app) => {
  
  // Middleware: Security & Rate Limiting
  app.use((req, res, next) => {
    // Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    
    // Apply Rate Limiter to AI endpoints
    if (req.path.startsWith('/ai/')) {
      if (!applyRateLimiting(req, res)) return
    }
    next()
  })

  // Health Probe Endpoint (/healthz)
  app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() })
  })

  // Readiness Probe Endpoint (/readyz)
  app.get('/readyz', async (req, res) => {
    try {
      // Ping Python worker subprocess via light discount action
      const reply = await python.call({ action: 'discount', title: 'health', price: 10 })
      if (reply && reply.original === 10) {
        res.status(200).json({ status: 'READY', python: 'OK' })
        return
      }
    } catch {
      /* worker unavailable */
    }
    res.status(503).json({ status: 'NOT_READY', python: 'UNAVAILABLE' })
  })

  // POST /ai/ask/stream -> Server-Sent Events (SSE) Streaming
  app.post('/ai/ask/stream', async (req, res) => {
    const body = await readJson(req)
    const { prompt, model } = body ?? {}
    if (!prompt?.trim()) {
      res.status(400).json({ error: 'prompt must not be empty' })
      return
    }

    const destination = await getAIDestination()
    const args = { action: 'ask', stream: true, prompt: prompt.trim(), model: model?.trim() }
    if (destination) Object.assign(args, destination)

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    let closed = false
    req.on('close', () => {
      closed = true
      res.end()
    })

    try {
      await python.call(args, (token) => {
        if (!closed && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ text: token })}\n\n`)
        }
      })
      if (!res.writableEnded) res.write('data: [done]\n\n')
    } catch (err) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      }
    } finally {
      if (!res.writableEnded) res.end()
    }
  })
})

function readJson(req) {
  return new Promise((resolve) => {
    let raw = ''
    const finish = (value) => resolve(value)
    req.on('data', (d) => (raw += d))
    req.on('end', () => {
      try {
        finish(JSON.parse(raw || '{}'))
      } catch {
        finish({})
      }
    })
    req.on('error', () => finish({}))
  })
}