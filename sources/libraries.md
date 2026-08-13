# Libraries and Dependencies

## Node.js Dependencies (`package.json`)

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@sap/cds` | `^10.0.5` | SAP Cloud Application Programming Model (OData V4, CQL, service gateway) |
| `@sap-cloud-sdk/connectivity` | `^4.8.0` | Zero-hardcoding BTP Destination Auto-Selection Engine |
| `@sap-cloud-sdk/http-client` | `^4.8.0` | Authenticated outbound HTTP via BTP Destinations |
| `@sap-cloud-sdk/resilience` | `^4.8.0` | Resilient HTTP (timeouts, retries) for destination calls |
| `@cap-js/hana` | `^3.0.2` | SAP HANA Cloud DB adapter for CDS |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@cap-js/sqlite` | `^3.0.2` | In-memory SQLite for local dev/testing (no HANA needed) |
| `@sap/cds-dk` | `^10.0.7` | `cds` CLI — build, deploy, watch |
| `@sap/hdi-deploy` | `^5.7.0` | SAP HANA HDI container deployer |

---

## Python Dependencies (`python/requirements.txt`)

### LangChain / LangGraph / LangSmith Ecosystem

| Package | Version | Purpose |
|---------|---------|---------|
| `langchain` | `>=0.3.0` | Prompt templates, chain construction, LLM I/O |
| `langchain-core` | `>=0.3.0` | Core LangChain primitives (RunnableSequence, ChatMessages) |
| `langchain-community` | `>=0.3.0` | Community integrations (HanaDB VectorStore) |
| `langchain-openai` | `>=0.2.0` | ChatOpenAI wrapper for NVIDIA API-compatible endpoints |
| `langgraph` | `>=0.2.0` | Stateful multi-node agent StateGraph orchestration |
| `langsmith` | `>=0.1.0` | Real-time LLM observability & prompt chain tracing (optional, no-op if keys not set) |

### SAP HANA Cloud & Vector Engine

| Package | Version | Purpose |
|---------|---------|---------|
| `hdbcli` | `>=2.20.0` | SAP HANA Cloud Python client for `REAL_VECTOR(1536)` embeddings & `COSINE_SIMILARITY()` search |

### Enterprise Prompt Caching

| Package | Version | Purpose |
|---------|---------|---------|
| `redis` | `>=5.0.0` | SAP BTP `redis-instance` client for prompt/response caching (< 5ms TTL lookups) |

### HTTP & Streaming

| Package | Version | Purpose |
|---------|---------|---------|
| `httpx` | `>=0.27.0` | Async HTTP streaming client (SSE token streaming to `/ai/ask/stream`) |
