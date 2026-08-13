// Custom HTTP routes that must be registered at bootstrap time (before the
// OData middleware serves the /ai service). Streaming chat is exposed here as
// Server-Sent Events so clients can render the LLM's tokens as they are generated.
//
// Config: the app's cds server automatically loads srv/server.js.
const cds = require('@sap/cds')
const { python } = require('./python')
const { getAIDestination } = require('./ai-destination')

cds.once('bootstrap', (app) => {
  // POST /ai/ask/stream -> text/event-stream (SSE), one data: line per token.
  app.post('/ai/ask/stream', async (req, res) => {
    // Parse the JSON body manually: CDS mounts its body parser late, after this route.
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

    // Once the client disconnects (navigated away, etc.) stop forwarding tokens.
    let closed = false
    req.on('close', () => {
      closed = true
      res.end()
    })

    // Each token Python receives is forwarded to the client as an SSE event.
    try {
      await python.call(args, (token) => {
        if (!closed && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ text: token })}\n\n`)
        }
      })
      if (!res.writableEnded) res.write('data: [done]\n\n')
    } catch (err) {
      // Push worker/provider failures into the stream so the client sees the
      // error instead of hanging on an open-but-silent connection.
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      }
    } finally {
      if (!res.writableEnded) res.end()
    }
  })
})

// Read a JSON request body defensively; never hang on malformed input.
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