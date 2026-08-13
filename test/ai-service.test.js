// Integration test for the destination-backed AIService (/ai).
// Spawns local AI mock and CAP server, verifying ask(), ask_rag(), and ask_agent() endpoints
// across all 4 configured model destinations:
// 1. mistralai/mistral-nemotron (mistralai-mistral-nemotron)
// 2. google/diffusiongemma-26b-a4b-it (google-diffusiongemma-26b-a4b-it)
// 3. meta/llama-3.3-70b-instruct (meta-llama-3-3-70b-instruct)
// 4. z-ai/glm-5.2 (z-ai-glm-5-2)

const { spawn } = require('node:child_process')
const { startServer, getFreePort } = require('./helpers')

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
      AI_MODEL: 'mistralai/mistral-nemotron',
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

    // 1. Test Single-Turn AI completion (/ai/ask) across all 4 BTP destination models
    const modelsToTest = [
      'google/diffusiongemma-26b-a4b-it',
      'mistralai/mistral-nemotron',
      'google/gemma-4-31b-it',
      'z-ai/glm-5.2'
    ]

    for (const modelName of modelsToTest) {
      const resAsk = await server.request('/ai/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ prompt: `Recommend a book using ${modelName}`, model: modelName }),
      })
      const bodyAsk = await resAsk.json()
      if (!resAsk.ok) throw new Error(`ask failed for ${modelName}: ` + resAsk.status + ' ' + JSON.stringify(bodyAsk))
      console.log(`PASS: AI ask(prompt, model='${modelName}') ->`, JSON.stringify(bodyAsk))
    }

    // 2. Test SAP HANA Vector Engine RAG endpoint (/ai/ask_rag)
    const resRag = await server.request('/ai/ask_rag', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ prompt: 'Recommend SAP books', model: 'google/diffusiongemma-26b-a4b-it' }),
    })
    const bodyRag = await resRag.json()
    if (!resRag.ok) throw new Error('ask_rag failed: ' + resRag.status + ' ' + JSON.stringify(bodyRag))
    console.log('PASS: AI ask_rag(prompt, model) ->', JSON.stringify(bodyRag))

    // 3. Test Stateful LangGraph Agentic workflow endpoint (/ai/ask_agent)
    const resAgent = await server.request('/ai/ask_agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ prompt: 'What is the price of bestseller books?', model: 'z-ai/glm-5.2' }),
    })
    const bodyAgent = await resAgent.json()
    if (!resAgent.ok) throw new Error('ask_agent failed: ' + resAgent.status + ' ' + JSON.stringify(bodyAgent))
    console.log('PASS: AI ask_agent(prompt, model) ->', JSON.stringify(bodyAgent))

    // 4. Test Input Validation Guardrail: Empty prompt rejected with HTTP 400
    const bad = await server.request('/ai/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ prompt: '   ' }),
    })
    if (bad.status !== 400) throw new Error('expected 400 for empty prompt, got ' + bad.status)
    console.log('PASS: empty prompt rejected with HTTP 400')

    // 5. Test Real-Time Server-Sent Events (SSE) Streaming (/ai/ask/stream)
    const stream = await server.request('/ai/ask/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Recommend a book', model: 'mistralai/mistral-nemotron' }),
    })
    if (stream.status !== 200) throw new Error('stream failed: ' + stream.status)
    const text = await stream.text()
    if (!text.includes('data: {') || !text.includes('[done]')) {
      throw new Error('stream did not emit SSE chunks: ' + text.slice(0, 200))
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
  () => process.exit(process.exitCode || 0),
  () => process.exit(1),
)