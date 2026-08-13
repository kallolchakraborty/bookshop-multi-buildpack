// CAP Service Implementation for AIService (/ai).
// Fetches destination details (URL, API Key, Model) directly from SAP BTP Destination Service
// and delegates completion requests to the co-located Python worker process via IPC.
const cds = require('@sap/cds')
const { python } = require('./python')
const { getAIDestination } = require('./ai-destination')

module.exports = cds.service.impl(async function () {

  // Generic helper: prepares request payload with BTP destination details and delegates to Python worker.
  const delegateToPython = async (action, req) => {
    const { prompt, model } = req.data
    if (!prompt?.trim()) return req.reject(400, 'prompt must not be empty')

    // Resolves SAP BTP Destination Service details (URL + API Key + Model) dynamically
    const destination = await getAIDestination()
    
    // Priority: explicit request model override > BTP destination model property > env default
    const effectiveModel = model?.trim() || destination?.model || undefined
    const args = { action, prompt: prompt.trim(), model: effectiveModel }
    
    if (destination) {
      if (destination.baseUrl) args.baseUrl = destination.baseUrl
      if (destination.apiKey) args.apiKey = destination.apiKey
    }

    try {
      // Execute IPC JSON-RPC call against Python functions.py
      return await python.call(args)
    } catch (err) {
      const hint = destination ? '' : ' (no destination bound and AI_BASE_URL unset)'
      return req.reject(502, `AI service request (${action}) failed: ${err.message}${hint}`)
    }
  }

  // 1. Single-turn LLM completion endpoint
  this.on('ask', async (req) => delegateToPython('ask', req))

  // 2. RAG endpoint (SAP HANA Cloud Vector Search + LLM completion)
  this.on('ask_rag', async (req) => delegateToPython('ask_rag', req))

  // 3. Stateful LangGraph Agent endpoint (Intent Classification + RAG + Guardrails + Discount Rules)
  this.on('ask_agent', async (req) => delegateToPython('ask_agent', req))
})