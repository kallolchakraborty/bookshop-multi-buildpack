# Destination Creation and Configuration

## What are Destinations?

In SAP BTP, **destinations** are configuration objects that define how applications connect to external systems or services. They centralize connection details (URL, authentication, proxy) so applications don't hardcode them.

## BTP Cockpit Auto-Discovery Engine for AI Models

The application uses `@sap-cloud-sdk/connectivity` in [`srv/ai-destination.js`](file:///Users/kallolchakraborty/Downloads/BookShop-Multibuildpack/bookshop-multi-buildpack/srv/ai-destination.js) to dynamically discover and auto-select bound Destinations from SAP BTP Cockpit without hardcoded API keys or secret URLs.

## The 4 BTP Cockpit Model Destinations & Priority Order

| Priority Rank | BTP Cockpit Destination Name | Target Model ID | Role in Failover Cascade |
|---------------|------------------------------|-----------------|--------------------------|
| **Priority 1 (Primary)** | `google-diffusiongemma-26b-a4b-it` | `google/diffusiongemma-26b-a4b-it` | Primary Model (First Choice) |
| **Priority 2 (P2)** | `google-gemma-4-31b-it` | `google/gemma-4-31b-it` | Secondary Model (P2) |
| **Priority 3** | `z-ai-glm-5-2` | `z-ai/glm-5.2` | Tertiary Model |
| **Priority 4 (Fallback)** | `mistralai-mistral-nemotron` | `mistralai/mistral-nemotron` | Designated Fallback Model |

---

## Destination Export Configurations

Export configuration files are stored under `destination/`:

### 1. `google-diffusiongemma-26b-a4b-it`
```ini
Name=google-diffusiongemma-26b-a4b-it
Type=HTTP
URL=https://integrate.api.nvidia.com/v1
Authentication=NoAuthentication
ProxyType=Internet
Description=Google DiffusionGemma 26B Instruct Model
URL.headers.Authorization=Bearer nvapi-***
Model=google/diffusiongemma-26b-a4b-it
```

### 2. `google-gemma-4-31b-it` (P2)
```ini
Name=google-gemma-4-31b-it
Type=HTTP
URL=https://integrate.api.nvidia.com/v1
Authentication=NoAuthentication
ProxyType=Internet
Description=NVIDIA AI Foundation API for Google Gemma 4 31B Instruct LLM
URL.headers.Authorization=Bearer nvapi-***
Model=google/gemma-4-31b-it
```

### 3. `z-ai-glm-5-2`
```ini
Name=z-ai-glm-5-2
Type=HTTP
URL=https://integrate.api.nvidia.com/v1
Authentication=NoAuthentication
ProxyType=Internet
Description=Z-AI GLM 5.2 LLM Model
URL.headers.Authorization=Bearer nvapi-***
Model=z-ai/glm-5.2
```

### 4. `mistralai-mistral-nemotron` (Fallback)
```ini
Name=mistralai-mistral-nemotron
Type=HTTP
URL=https://integrate.api.nvidia.com/v1
Authentication=NoAuthentication
ProxyType=Internet
Description=Mistral AI Nemotron LLM Model
URL.headers.Authorization=Bearer nvapi-***
Model=mistralai/mistral-nemotron
```

---

## Dynamic Auto-Selection Code Implementation

```javascript
// srv/ai-destination.js
const { getDestination } = require('@sap-cloud-sdk/connectivity')

const CANDIDATE_DESTINATIONS = [
  process.env.AI_DESTINATION,
  'google-diffusiongemma-26b-a4b-it',
  'google-gemma-4-31b-it',
  'z-ai-glm-5-2',
  'z-ai-glm-5.2',
  'mistralai-mistral-nemotron'
].filter(Boolean)

async function getAIDestination() {
  if (cachedDestination) return cachedDestination

  for (const name of CANDIDATE_DESTINATIONS) {
    try {
      const dest = await getDestination({ destinationName: name })
      if (dest?.url) {
        cachedDestination = {
          baseUrl: dest.url,
          apiKey: dest.authHeaders?.apikey || dest.originalProperties?.APIKey || '',
          model: dest.originalProperties?.Model || '',
          destinationName: name
        }
        return cachedDestination
      }
    } catch {
      // Candidate not bound in BTP Cockpit, check next
    }
  }
}
```
