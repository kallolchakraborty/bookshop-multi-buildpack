// Zero-dependency mock of an OpenAI-compatible chat completions API.
// Lets the bookshop run and be tested locally without a real AI provider:
//   npm run mock:ai  (listens on http://localhost:8008 by default)
const http = require('node:http')

const PORT = process.env.AI_MOCK_PORT || 8008

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"ok":true}')
    return
  }

  // Only the chat completions endpoint is faked; everything else is 404.
  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end('{"error":"not found"}')
    return
  }

  let body = ''
  req.on('data', (d) => (body += d))
  req.on('end', () => {
    const parsed = JSON.parse(body || '{}')
    const prompt = parsed.messages?.at(-1)?.content ?? ''
    const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length
    // Echo the prompt back so tests can verify the round trip reached the mock.
    const answer = `[mock] Discussion of "${prompt.slice(0, 40)}..." (${wordCount} words).`

    if (parsed.stream) {
      // Emit the answer token-by-token as an SSE stream like a real provider.
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
      for (const chunk of answer.match(/.{1,8}/gs) || []) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        choices: [{ message: { content: answer } }],
        model: parsed.model,
        usage: { total_tokens: wordCount },
      }),
    )
  })
})

server.listen(PORT, () => {
  console.log(`mock AI listening on http://localhost:${PORT}`)
})