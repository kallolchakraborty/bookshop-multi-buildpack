# Application Endpoints

## Complete Endpoint Catalog

### System & Health Probes

| Method | Path | Description | Response Example |
|--------|------|-------------|------------------|
| GET | `/healthz` | CAP Server & Memory Health Probe | `{"status":"OK"}` |
| GET | `/readyz` | Stdin/Stdout IPC Channel & Python Worker Probe | `{"status":"READY","python":"OK"}` |

### OData V4 CatalogService (`/browse`)

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/browse/Books` | List all catalog books with authors & stock | Optional |
| GET | `/browse/Authors` | List all authors | Optional |
| GET | `/browse/Orders` | List user order history | Yes |
| POST | `/browse/Orders` | Place a new order | Yes |
| GET | `/browse/discount(title='The%20Bestseller')` | ML Python discount calculation function | Optional |

### Enterprise GenAI Endpoints (`/ai`)

| Method | Path | Description | Payload Parameters |
|--------|------|-------------|--------------------|
| POST | `/ai/ask` | Single-turn LLM completion | `{"prompt":"...", "model":"..."}` |
| POST | `/ai/ask_rag` | SAP HANA Cloud REAL_VECTOR RAG search | `{"prompt":"...", "model":"..."}` |
| POST | `/ai/ask_agent` | Stateful LangGraph Agentic workflow | `{"prompt":"...", "model":"..."}` |
| POST | `/ai/ask/stream` | Real-time Server-Sent Events (SSE) streaming | `{"prompt":"...", "model":"..."}` |

---

## 4-Destination Model Selection Examples

### 1. Priority 1 Primary (`google/diffusiongemma-26b-a4b-it`)
```http
POST /ai/ask
Content-Type: application/json

{
  "prompt": "What are the core concepts of software architecture?",
  "model": "google/diffusiongemma-26b-a4b-it"
}
```

### 2. Priority 2 (`google/gemma-4-31b-it`)
```http
POST /ai/ask
Content-Type: application/json

{
  "prompt": "Explain the difference between microservices and monoliths.",
  "model": "google/gemma-4-31b-it"
}
```

### 3. Priority 3 (`z-ai/glm-5.2`)
```http
POST /ai/ask
Content-Type: application/json

{
  "prompt": "Summarize the benefits of cloud native applications.",
  "model": "z-ai/glm-5.2"
}
```

### 4. Priority 4 Fallback (`mistralai/mistral-nemotron`)
```http
POST /ai/ask
Content-Type: application/json

{
  "prompt": "Recommend top 2 technology books and explain why.",
  "model": "mistralai/mistral-nemotron"
}
```

---

## SAP HANA Cloud Vector RAG Request

```http
POST /ai/ask_rag
Content-Type: application/json

{
  "prompt": "Which bestseller books are available in stock with fantasy themes?",
  "model": "google/diffusiongemma-26b-a4b-it"
}
```

---

## Stateful LangGraph Agent Request

```http
POST /ai/ask_agent
Content-Type: application/json

{
  "prompt": "What is the discounted price for classic books?",
  "model": "google/diffusiongemma-26b-a4b-it"
}
```

---

## Rate Limiting & Security Headers

- **Sliding Window Rate Limiter**: Enforces 15 req/min per client IP. Returns HTTP 429 upon abuse.
- **Security Headers**: Helmet & CORS configured for cross-origin protection.
