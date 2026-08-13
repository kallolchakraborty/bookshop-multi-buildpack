# File Structure

## BookShop Application Directory Tree

Below is the complete, production-grade file structure of the **BookShop** CAP Multi-Buildpack application:

```
bookshop-multi-buildpack/
├── .buildpacks                         # Multi-buildpack declaration (Python 3.10 + Node.js 24)
├── manifest.yml                        # SAP BTP Cloud Foundry deployment manifest (512 MB Droplet)
├── package.json                        # CAP Node.js dependencies & scripts (@sap/cds v10)
├── package-lock.json                   # Locked npm dependency versions
├── .cfignore                           # Cloud Foundry upload exclusion rules
├── .gitignore                          # Git version control exclusions
├── support.md                          # Comprehensive developer & architecture manual
├── README.md                           # Quick start & features overview
│
├── db/                                 # Database domain models & seed data
│   ├── schema.cds                      # CDS Entity definitions (Book with Vector(1536), Author, Order)
│   └── data/                           # CSV seed datasets
│       ├── kallol.bookshop-Author.csv
│       ├── kallol.bookshop-Book.csv
│       └── kallol.bookshop-Order.csv
│
├── destination/                        # Exported SAP BTP Destination configurations
│   ├── google-diffusiongemma-26b-a4b-it # Priority 1 (Primary Model)
│   ├── google-gemma-4-31b-it           # Priority 2 (P2 Model)
│   ├── z-ai-glm-5.2                    # Priority 3 (Tertiary Model)
│   └── mistralai-mistral-nemotron      # Priority 4 (Designated Fallback Model)
│
├── srv/                                # CAP Service Definitions & Handlers
│   ├── cat-service.cds                 # CatalogService OData V4 annotations & actions
│   ├── cat-service.js                  # CatalogService handlers (discount calculations via Python IPC)
│   ├── ai-service.cds                  # AIService OData V4, RAG, Agent & SSE annotations
│   ├── ai-service.js                   # AI prompt handler & Server-Sent Events (SSE) streaming
│   ├── ai-destination.js               # Zero-hardcoding BTP Destination auto-selection engine
│   ├── python.js                       # Zero-latency stdin/stdout IPC process bridge to functions.py
│   └── server.js                       # Rate limiter (15 req/min), Helmet, and /healthz & /readyz probes
│
├── python/                             # Co-located Python ML & LangGraph Worker
│   ├── functions.py                    # Persistent Python RPC process (stdin/stdout JSON-RPC listener)
│   ├── requirements.txt                # Python packages (langchain, langgraph, hdbcli, redis, httpx)
│   │
│   ├── agent/                          # LangGraph Agent, Guardrails, Cache & Router
│   │   ├── __init__.py
│   │   ├── cache.py                    # Enterprise Redis prompt & response cache (< 5ms)
│   │   ├── graph.py                    # Stateful LangGraph StateGraph pipeline
│   │   ├── guardrails.py               # Defense-in-depth guardrails (injection + PII scrubber)
│   │   ├── llm_router.py               # Multi-model router & 4-destination failover cascade
│   │   ├── logger.py                   # SAP Application Logging Service structured logger
│   │   ├── nodes.py                    # StateGraph node implementations & exponential backoff retries
│   │   ├── prompts.py                  # Enterprise system prompts & tool definitions
│   │   └── rag.py                      # SAP HANA Cloud REAL_VECTOR(1536) cosine similarity search
│   │
│   ├── eval/                           # Evaluation & Benchmark Suite
│   │   ├── __init__.py
│   │   └── eval_rag.py                 # RAG Triad benchmark evaluation suite
│   │
│   └── scripts/                        # Data preparation & migration scripts
│       ├── __init__.py
│       └── seed_embeddings.py          # Generates 1536-dim embeddings for books into HANA
│
└── test/                               # Test Suite & HTTP Request Files
    ├── ai-service.test.js              # Integration tests covering all 4 BTP destination models
    ├── discount.test.js                # Unit tests for Python IPC math discount calls
    ├── mock-ai.js                      # Local mock server for GenAI LLM responses
    ├── helpers.js                      # Test suite setup utilities
    └── http-requests.http              # Complete REST Client executable test suite
```

---

## Key App Files Explained

### `srv/ai-destination.js` (Zero-Hardcoding Auto-Selection Engine)

**Purpose**: Uses `@sap-cloud-sdk/connectivity` to dynamically discover and auto-select available destinations in SAP BTP Cockpit without hardcoded keys or secret URLs.

```javascript
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
      // Candidate not present in BTP Cockpit, proceed to next candidate
    }
  }
}
```

### `python/agent/llm_router.py` (Multi-Model Router & Failover Cascade)

**Purpose**: Routes completion requests with automatic fallback across all 4 configured SAP BTP model destinations.

```python
DEFAULT_FALLBACK_CHAIN = [
    "google/diffusiongemma-26b-a4b-it",  # Priority 1 Primary
    "google/gemma-4-31b-it",             # Priority 2 (P2)
    "z-ai/glm-5.2",                      # Priority 3
    "mistralai/mistral-nemotron",        # Priority 4 (Designated Fallback)
]
```

### `python/agent/cache.py` (Enterprise Redis Prompt Caching)

**Purpose**: Hashes `(model:prompt)` pairs using SHA-256 and retrieves completions from SAP BTP `redis-instance` in **< 5ms**.

### `python/agent/guardrails.py` (Defense-in-Depth Guardrails)

**Purpose**: Scans for DAN attacks, roleplay escapes, masks secrets/PII, and validates output groundedness against bookshop domains.
