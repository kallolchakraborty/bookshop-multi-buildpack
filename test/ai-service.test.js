// Integration test for the destination-backed AIService.
// Spawns the local AI mock and a CAP server (development profile -> mock URL)
// and verifies the ask() action reaches the AI API and returns an answer.
const { spawn } = require('node:child_process')
const { startServer, getFreePort } = require('./helpers')

// Boot the OpenAI-compatible mock before any request can hit it.
async function main() {
  const mockPort = process.env.AI_MOCK_PORT || (await getFreePort())
  const mock = spawn(process.execPath, [require.resolve('./mock-ai.js')], {
    env: { ...process.env, AI_MOCK_PORT: String(mockPort) },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let mockLogs = ''
  mock.stderr.on('data', (d) => (mockLogs += d))

  const server = await startServer({
    env: {
      AI_BASE_URL: `http://localhost:${mockPort}/v1`, // dev fallback -> local mock
      AI_API_KEY: 'test-key',
      AI_MODEL: 'mock-model',
    },
  })

  async function waitForMock() {
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://localhost:${mockPort}/health`)
        if (res.ok) return
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 250))
    }
    throw new Error('mock AI did not start: ' + mockLogs)
  }

  try {
    await waitForMock()

    // POST an unbound action: /ai/ask with JSON body.
    const res = await server.request('/ai/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ prompt: 'Recommend a book', model: 'mock-model' }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error('ask failed: ' + res.status + ' ' + JSON.stringify(body))
    if (!String(body.answer).startsWith('[mock]')) {
      throw new Error('unexpected answer: ' + body.answer)
    }
    console.log('PASS: AI ask(prompt, model) via local AI mock ->', JSON.stringify(body))

    // Empty prompt must be rejected with 400, not forwarded to the API.
    const bad = await server.request('/ai/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ prompt: '   ' }),
    })
    if (bad.status !== 400) throw new Error('expected 400 for empty prompt, got ' + bad.status)
    console.log('PASS: empty prompt rejected with HTTP 400')

    // Streaming: /ai/ask/stream must deliver SSE chunks as the mock generates them.
    const stream = await server.request('/ai/ask/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Recommend a book', model: 'mock-model' }),
    })
    if (stream.status !== 200) throw new Error('stream failed: ' + stream.status)
    const text = await stream.text()
    if (!text.includes('data: {') || !text.includes('[done]')) {
      throw new Error('stream did not emit SSE chunks: ' + text.slice(0, 200))
    }
    if (!/data: \{"text":"(?:\\.|[^"\\])*\[mock\][^}]*\}/.test(text)) {
      throw new Error('expected mock answer tokens in stream: ' + text.slice(0, 200))
    }
    console.log('PASS: /ai/ask/stream emits SSE tokens')
  } catch (err) {
    console.error('FAIL:', err.message)
    console.error(server.logs())
    process.exitCode = 1
  } finally {
    server.stop()
    mock.kill('SIGKILL')
  }
}

main().then(
  () => process.exit(process.exitCode || 0), // release keep-alive sockets so the test process exits
  () => process.exit(1),
)