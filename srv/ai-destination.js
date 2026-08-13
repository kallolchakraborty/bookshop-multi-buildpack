// Dynamic SAP BTP Destination Auto-Selection Module.
// Uses @sap-cloud-sdk/connectivity to dynamically discover and auto-select
// available AI destinations in SAP BTP Cockpit without hardcoded keys or URLs.
const { getDestination } = require('@sap-cloud-sdk/connectivity')

// Strictly the 4 Destination Candidates configured in SAP BTP Cockpit (google-diffusiongemma-26b-a4b-it as Priority 1)
const CANDIDATE_DESTINATIONS = [
  process.env.AI_DESTINATION,
  'google-diffusiongemma-26b-a4b-it',
  'google-gemma-4-31b-it',
  'z-ai-glm-5-2',
  'z-ai-glm-5.2',
  'mistralai-mistral-nemotron'
].filter(Boolean)

let cachedDestination = null

async function getAIDestination() {
  if (process.env.AI_DISABLE_DESTINATION === 'true') return null
  if (cachedDestination) return cachedDestination

  for (const name of CANDIDATE_DESTINATIONS) {
    try {
      const dest = await getDestination({ destinationName: name })
      if (dest?.url) {
        const apiKey =
          process.env.AI_API_KEY ||
          dest.authHeaders?.apikey ||
          dest.originalProperties?.APIKey ||
          dest.originalProperties?.['URL.headers.Authorization'] ||
          ''
        const model = dest.originalProperties?.Model || dest.originalProperties?.AI_MODEL || ''

        cachedDestination = {
          baseUrl: dest.url,
          apiKey,
          model,
          destinationName: name
        }
        console.log(`[ai-destination] Auto-selected SAP BTP Destination: "${name}" -> ${dest.url}`)
        return cachedDestination
      }
    } catch {
      // Candidate destination not present in BTP Cockpit, proceed to next candidate
    }
  }

  console.warn(`[ai-destination] No active BTP Destination found from candidates [${CANDIDATE_DESTINATIONS.join(', ')}]. Falling back to runtime environment.`)
  return null
}

module.exports = { getAIDestination }