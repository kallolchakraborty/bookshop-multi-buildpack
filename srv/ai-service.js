// Service implementation for AIService (/ai): delegates the OpenAI-compatible
// call to the persistent Python worker. The streaming endpoint /ai/ask/stream is
// registered in srv/server.js (cds.once('bootstrap')) because adding raw Express
// routes after the service impl has loaded no longer works.
const cds = require('@sap/cds')
const { python } = require('./python')
const { getAIDestination } = require('./ai-destination')

module.exports = cds.service.impl(async function () {
  this.on('ask', async (req) => {
    const { prompt, model } = req.data
    if (!prompt?.trim()) return req.reject(400, 'prompt must not be empty')

    // Node side resolves the destination (URL + API key); null in local dev.
    const destination = await getAIDestination()

    const args = { action: 'ask', prompt: prompt.trim(), model: model?.trim() }
    if (destination) Object.assign(args, destination) // baseUrl + apiKey -> Python

    // Delegate to the Python worker, which performs the OpenAI-compatible call.
    try {
      return await python.call(args) // { answer, model, latency } straight from Python
    } catch (err) {
      // Make the failure actionable: the destination was unavailable AND no
      // AI_BASE_URL/AI_API_KEY fallback was configured.
      const hint = destination
        ? ''
        : ' (no destination bound and AI_BASE_URL unset)'
      return req.reject(502, `AI request failed: ${err.message}${hint}`)
    }
  })
})