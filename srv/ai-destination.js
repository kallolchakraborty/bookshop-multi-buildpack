// Resolves the BTP destination "meta-llama-3-3-70b-instruct" into connection
// values handed to the Python worker (which then performs the actual AI call).
//
// On Cloud Foundry the app binds destination + connectivity services, so the SAP
// Cloud SDK resolves the destination incl. URL and auth. In local development no
// destination service is bound -> returns null and the Python worker falls back
// to the AI_BASE_URL / AI_API_KEY environment variables (defaults: local mock).
const { getDestination } = require('@sap-cloud-sdk/connectivity')

const DESTINATION_NAME = process.env.AI_DESTINATION || 'meta-llama-3-3-70b-instruct'
let cached // memoize the resolved destination for the process lifetime

async function getAIDestination() {
  // Allow tests/teardown to force the env-level fallback without a service binding.
  if (process.env.AI_DISABLE_DESTINATION === 'true') return null
  try {
    cached ??= await getDestination({ destinationName: DESTINATION_NAME })
    const url = cached.url
    if (!url) return null
    // apiKey may be overridden by env; otherwise taken from the destination config.
    // NoAuthentication + APIKeyHeaderName destinations keep the key in the raw config.
    const apiKey =
      process.env.AI_API_KEY ||
      cached.authHeaders?.apikey ||
      cached.originalProperties?.APIKey ||
      ''
    return { baseUrl: url, apiKey }
  } catch (err) {
    // No destination/connectivity service bound in local dev -> log loudly so a
    // 502 later is attributable, then fall back to the env vars (AI_BASE_URL...).
    console.warn(`[ai-service] destination "${DESTINATION_NAME}" unavailable (${err.message}). Falling back to AI_BASE_URL env.`)
    return null
  }
}

module.exports = { getAIDestination }