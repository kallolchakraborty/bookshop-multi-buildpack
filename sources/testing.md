# Testing Strategy

## Running the Test Suite

```bash
# CAP OData & discount calculation tests
npm test

# AI integration tests (all 4 BTP destination models)
npm run test:ai

# Run all tests
npm run test:all
```

---

## 1. HTTP REST Client Test Suite (`test/http-requests.http`)

Open [`test/http-requests.http`](file:///Users/kallolchakraborty/Downloads/BookShop-Multibuildpack/bookshop-multi-buildpack/test/http-requests.http) in VS Code REST Client or Antigravity IDE.

### System Probes
```http
### Health Probe
GET https://bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com/healthz

### Readiness Probe (tests Python IPC channel)
GET https://bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com/readyz
```

### OData V4 Catalog Endpoints
```http
### List Books
GET https://bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com/browse/Books

### ML Python Discount Calculation
GET https://bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com/browse/discount(title='The%20Bestseller')
```

### AI Endpoints — 4-Destination Failover Coverage
```http
### Priority 1: google/diffusiongemma-26b-a4b-it
POST .../ai/ask
{ "prompt": "What are the core concepts of software architecture?", "model": "google/diffusiongemma-26b-a4b-it" }

### Priority 2: google/gemma-4-31b-it
POST .../ai/ask
{ "prompt": "Explain the difference between microservices and monoliths.", "model": "google/gemma-4-31b-it" }

### Priority 3: z-ai/glm-5.2
POST .../ai/ask
{ "prompt": "Summarize the benefits of cloud native applications.", "model": "z-ai/glm-5.2" }

### Fallback: mistralai/mistral-nemotron
POST .../ai/ask
{ "prompt": "Recommend top 2 technology books and explain why.", "model": "mistralai/mistral-nemotron" }

### SAP HANA REAL_VECTOR RAG Search
POST .../ai/ask_rag
{ "prompt": "Which bestseller books are available in stock with fantasy themes?", "model": "google/diffusiongemma-26b-a4b-it" }

### Stateful LangGraph Agent
POST .../ai/ask_agent
{ "prompt": "What is the discounted price for classic books?", "model": "google/diffusiongemma-26b-a4b-it" }

### SSE Streaming
POST .../ai/ask/stream
{ "prompt": "Provide a quick overview of cloud design patterns.", "model": "z-ai/glm-5.2" }
```

---

## 2. Automated Integration Tests (`test/ai-service.test.js`)

```javascript
// Verifies all 4 BTP destination models respond correctly
const modelsToTest = [
  'google/diffusiongemma-26b-a4b-it',  // Priority 1 Primary
  'google/gemma-4-31b-it',             // Priority 2
  'z-ai/glm-5.2',                      // Priority 3
  'mistralai/mistral-nemotron'         // Designated Fallback
]

// Also validates:
// - Input guardrails block prompt injection
// - SSE streaming endpoint emits data: chunks
// - RAG endpoint performs HANA vector search
```

Run with: `npm run test:ai`

---

## 3. CAP OData Tests (`test/discount.test.js`)

```javascript
// Validates:
// - Book catalog entity queries
// - Discount calculation Python function
// - Author entity joins
```

Run with: `npm test`
