# 📚 bookshop-multi-buildpack

[![Live Documentation](https://img.shields.io/badge/Docs-Live%20Website-E95420?style=for-the-badge&logo=githubpages&logoColor=white)](https://kallolchakraborty.github.io/bookshop-multi-buildpack/)
[![SAP BTP](https://img.shields.io/badge/SAP%20BTP-Cloud%20Foundry-0FA5E9?style=for-the-badge&logo=sap&logoColor=white)](https://cloudfoundry.org)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B%20%7C%20v20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-v3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![CAP](https://img.shields.io/badge/SAP%20CAP-v10-F59E0B?style=for-the-badge&logo=sap&logoColor=white)](https://cap.cloud.sap)
[![LangChain](https://img.shields.io/badge/LangChain%20%7C%20LangGraph-v0.3%2B-121011?style=for-the-badge&logo=chainlink&logoColor=white)](https://langchain.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

An enterprise-grade SAP Business Technology Platform (BTP) reference architecture demonstrating **Cloud Foundry Multi-Buildpack** co-location. It combines an **SAP CAP Node.js edge gateway** (`@sap/cds` v10) with an **Enterprise Python LangGraph AI Agent & SAP HANA Cloud REAL_VECTOR Engine** inside a single 512 MB container droplet.

---

## 📑 Table of Contents

- [Overview & Architecture](#-overview--architecture)
- [Key Features & Highlights](#-key-features--highlights)
- [4-Destination Real-Time Failover Cascade](#-4-destination-real-time-failover-cascade)
- [Application Directory Structure](#-application-directory-structure)
- [Application Endpoints](#-application-endpoints)
- [IPC & Communication Mechanism](#-ipc--communication-mechanism)
- [Security & Defense-in-Depth Guardrails](#-security--defense-in-depth-guardrails)
- [Local Development & Getting Started](#-local-development--getting-started)
- [Cloud Foundry Deployment](#-cloud-foundry-deployment)
- [Testing Strategy](#-testing-strategy)
- [Live Routes & Observability](#-live-routes--observability)
- [Author & License](#-author--license)

---

## 🏛 Overview & Architecture

In standard Cloud Foundry architectures, combining polyglot runtimes often requires separate microservice droplets, incurring extra memory costs, network hops (15–80ms), and complex inter-service security. 

**`bookshop-multi-buildpack`** solves this with multi-buildpack co-location:
1. **Node.js Gateway (`@sap/cds` v10)**: Serves OData V4 APIs (`/browse`), enforces sliding-window rate limiting (15 req/min), handles XSUAA JWT authentication, and dynamically auto-selects BTP Cockpit Destinations.
2. **Python Worker (`python/functions.py --worker`)**: A single persistent child process running LangChain, LangGraph StateGraph, Redis caching, and SAP HANA Cloud Vector search over newline-delimited `stdin/stdout` JSON-RPC with **0ms cold start**.
3. **Resource Efficiency**: Entire multi-runtime stack fits into a single **512 MB** Cloud Foundry droplet.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    SAP BTP Cloud Foundry Container Droplet (512 MB)                     │
│                                                                                         │
│   ┌─────────────────────────────────────────┐   stdin/stdout JSON-RPC   ┌───────────┐   │
│   │ Node.js Gateway (@sap/cds v10)          │ ◄───────────────────────► │ Python 3  │   │
│   │ - OData V4 Catalog (/browse)            │          (0ms cold start) │ LangGraph │   │
│   │ - Dynamic BTP Destination Auto-Selector │                           │ RAG Engine│   │
│   │ - Rate Limiter & SSE Stream Handler     │                           │ Guardrails│   │
│   └────────────────────┬────────────────────┘                           └─────┬─────┘   │
└────────────────────────┼──────────────────────────────────────────────────────┼─────────┘
                         ▼                                                      ▼
           ┌───────────────────────────┐                          ┌───────────────────────────┐
           │ SAP BTP Destination Svc   │                          │ SAP HANA Cloud            │
           │ (4 AI Model Endpoints)    │                          │ (REAL_VECTOR 1536-dim)    │
           └───────────────────────────┘                          └───────────────────────────┘
```

---

## 🌟 Key Features & Highlights

- **Dual-Runtime Co-location**: Node.js and Python 3 co-located in a single droplet via `.buildpacks` (`python_buildpack` + `nodejs_buildpack`).
- **Zero-Hardcoding BTP Destination Auto-Selection**: Uses `@sap-cloud-sdk/connectivity` to auto-discover and bind to available BTP Cockpit Destinations at runtime without hardcoded keys or secret URLs.
- **4-Destination Real-Time Failover Cascade**: Multi-model routing with automated fallback from Priority 1 to Priority 4.
- **Enterprise Redis Prompt Cache**: Checks `redis-instance` via SHA-256 `(model:prompt)` signatures with **< 5ms** hit response times.
- **SAP HANA Cloud REAL_VECTOR Engine**: Cosine similarity search over 1536-dimensional book vector embeddings using native HANA `TO_REAL_VECTOR()`.
- **Defense-in-Depth Guardrails**: Real-time detection of DAN attacks, prompt injections, PII/secret scrubbing, XML prompt isolation, and competitor filtering.
- **Server-Sent Events (SSE) Streaming**: Real-time token streaming (`/ai/ask/stream`) for fluid conversational interfaces.
- **Health & Readiness Probes**: Integrated `/healthz` (CAP memory & uptime) and `/readyz` (Python IPC channel & worker readiness) probes.

---

## 🔄 4-Destination Real-Time Failover Cascade

The application automatically cascades requests through configured SAP BTP Cockpit Destinations:

| Priority | Destination Name | Target Model | Role |
|:---:|---|---|---|
| **P1** | `google-diffusiongemma-26b-a4b-it` | `google/diffusiongemma-26b-a4b-it` | **Primary Model** |
| **P2** | `google-gemma-4-31b-it` | `google/gemma-4-31b-it` | **Secondary Model** |
| **P3** | `z-ai-glm-5-2` | `z-ai/glm-5.2` | **Tertiary Model** |
| **Fallback** | `mistralai-mistral-nemotron` | `mistralai/mistral-nemotron` | **Designated Fallback** |

```
[Client Request] ──► P1: google/diffusiongemma-26b-a4b-it
                           │ (on timeout/error)
                           ▼
                     P2: google/gemma-4-31b-it
                           │ (on timeout/error)
                           ▼
                     P3: z-ai/glm-5.2
                           │ (on timeout/error)
                           ▼
                     Fallback: mistralai/mistral-nemotron
```

---

## 📂 Application Directory Structure

```
bookshop-multi-buildpack/
├── .buildpacks                         # Multi-buildpack declaration (Python 3.10 + Node.js 24)
├── manifest.yml                        # Cloud Foundry deployment manifest (512 MB Droplet)
├── package.json                        # CAP Node.js dependencies & scripts (@sap/cds v10)
├── support.md                          # Detailed developer manual & architecture specs
├── README.md                           # Project overview & documentation
│
├── db/                                 # Database domain models & seed datasets
│   ├── schema.cds                      # CDS Entity definitions (Books with Vector(1536), Authors, Orders)
│   └── data/                           # CSV seed data
│       ├── kallol.bookshop-Author.csv
│       ├── kallol.bookshop-Book.csv
│       └── kallol.bookshop-Order.csv
│
├── destination/                        # BTP Destination template configurations
│   ├── google-diffusiongemma-26b-a4b-it # Priority 1 (Primary Model)
│   ├── google-gemma-4-31b-it           # Priority 2 (P2 Model)
│   ├── z-ai-glm-5.2                    # Priority 3 (Tertiary Model)
│   └── mistralai-mistral-nemotron      # Priority 4 (Fallback Model)
│
├── srv/                                # CAP Service Definitions & Handlers
│   ├── cat-service.cds                 # CatalogService OData V4 annotations & discount actions
│   ├── cat-service.js                  # CatalogService handlers (discount calculation via Python IPC)
│   ├── ai-service.cds                  # AIService OData V4, RAG, Agent & SSE annotations
│   ├── ai-service.js                   # AI prompt handler & Server-Sent Events (SSE) streaming
│   ├── ai-destination.js               # Zero-hardcoding BTP Destination auto-selection engine
│   ├── python.js                       # Stdin/stdout JSON-RPC process bridge to functions.py
│   └── server.js                       # Custom CAP server with rate limiting, Helmet & probes
│
├── python/                             # Co-located Python ML & LangGraph Worker
│   ├── functions.py                    # Persistent Python RPC process (stdin/stdout JSON-RPC listener)
│   ├── requirements.txt                # Python dependencies (langchain, langgraph, redis, hdbcli)
│   │
│   ├── agent/                          # LangGraph Agent, Guardrails, Cache & Router
│   │   ├── cache.py                    # Enterprise Redis prompt & completion cache (< 5ms)
│   │   ├── graph.py                    # Stateful LangGraph StateGraph workflow pipeline
│   │   ├── guardrails.py               # Defense-in-depth guardrails (injection + PII scrubber)
│   │   ├── llm_router.py               # Multi-model router & 4-destination failover cascade
│   │   ├── logger.py                   # SAP Application Logging Service structured logger
│   │   ├── nodes.py                    # StateGraph node implementations & exponential backoff
│   │   ├── prompts.py                  # Enterprise system prompts & tool schemas
│   │   └── rag.py                      # SAP HANA Cloud REAL_VECTOR(1536) cosine similarity search
│   │
│   ├── eval/                           # Evaluation & Benchmark Suite
│   │   └── eval_rag.py                 # RAG Triad benchmark evaluation suite
│   │
│   └── scripts/                        # Vector embedding preparation scripts
│       └── seed_embeddings.py          # Seeds 1536-dim embeddings for books into HANA
│
└── test/                               # Test Suite & HTTP Request Files
    ├── ai-service.test.js              # Integration tests covering all 4 BTP destination models
    ├── discount.test.js                # Unit tests for Python IPC math discount calls
    ├── mock-ai.js                      # Local mock server for GenAI LLM responses
    └── http-requests.http              # Complete REST Client executable test suite
```

---

## 🔌 Application Endpoints

### System Probes
| Method | Path | Description | Response |
|---|---|---|---|
| `GET` | `/healthz` | CAP Server & Memory Health Probe | `{"status":"OK","uptime":...}` |
| `GET` | `/readyz` | Python IPC Channel & Worker Probe | `{"status":"READY","python":"OK"}` |

### OData V4 Catalog Endpoints (`/browse`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/browse/Books` | List all catalog books with author details & stock levels |
| `GET` | `/browse/Authors` | List authors and book counts |
| `GET` | `/browse/discount(title='The%20Bestseller')` | ML Python dynamic discount calculation |
| `POST` | `/browse/Orders` | Place a new book order |

### Enterprise GenAI Endpoints (`/ai`)
| Method | Path | Description | Payload Parameters |
|---|---|---|---|
| `POST` | `/ai/ask` | Single-turn LLM completion | `{"prompt":"...", "model":"..."}` |
| `POST` | `/ai/ask_rag` | SAP HANA Cloud Vector RAG search | `{"prompt":"...", "model":"..."}` |
| `POST` | `/ai/ask_agent` | Stateful LangGraph agentic workflow | `{"prompt":"...", "model":"..."}` |
| `POST` | `/ai/ask/stream` | Server-Sent Events (SSE) token streaming | `{"prompt":"...", "model":"..."}` |

---

## ⚡ IPC & Communication Mechanism

Node.js and Python communicate via newline-delimited **JSON-RPC 2.0** over standard OS pipes (`stdin`/`stdout`):

```json
// 1. Request Frame (Node.js -> Python via stdin)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "ask_agent",
  "params": {
    "prompt": "Recommend top books on cloud software architecture.",
    "model": "google/diffusiongemma-26b-a4b-it"
  }
}

// 2. Response Frame (Python -> Node.js via stdout)
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "response": "Here are the top recommended architecture books...",
    "model_used": "google/diffusiongemma-26b-a4b-it",
    "cached": false,
    "latency_ms": 210
  }
}
```

---

## 🛡 Security & Defense-in-Depth Guardrails

1. **Authentication & Authorization**: SAP BTP XSUAA JWT validation with role templates (`BookshopReader`, `BookshopWriter`, `BookshopAIUser`, `BookshopAdmin`).
2. **Network Isolation**: Python runs co-located inside the container without exposed external network ports; all traffic routes through Node.js CAP.
3. **Sliding-Window Rate Limiter**: Enforces a strict 15 req/min threshold per IP, returning HTTP 429 on abuse.
4. **Input Guardrails**:
   - Scans for prompt injection attacks, DAN escapes, and role-play bypass attempts.
   - Redacts PII, access tokens, API keys, and sensitive database credentials.
   - Wraps inputs in XML prompt boundaries (`<user_query>...</user_query>`).
5. **Output Guardrails**:
   - Mask competitor mentions and sanitize generated markdown.
   - Validates groundedness against bookshop catalog domains.

---

## 💻 Local Development & Getting Started

### Prerequisites
- **Node.js**: v18+ or v20+
- **Python**: v3.10+ with `pip`
- **SQLite**: (Built-in for local CAP storage)

### Setup & Run
```bash
# 1. Clone repository
git clone https://github.com/yourusername/bookshop-multi-buildpack.git
cd bookshop-multi-buildpack

# 2. Install Node.js dependencies
npm install

# 3. Setup Python virtual environment
python3 -m venv python/venv
source python/venv/bin/activate    # On Windows: python\venv\Scripts\activate
pip install -r python/requirements.txt

# 4. Initialize SQLite local database
npx cds deploy --to sqlite

# 5. Start the application
# Node.js automatically launches python/functions.py --worker
npm start
```

Access the application locally at: **`http://localhost:4004`**

---

## ☁️ Cloud Foundry Deployment

```bash
# 1. Build CDS models for production
npx cds build --production

# 2. Deploy HDI database artifacts to SAP HANA Cloud
npm run deploy:cf:hana

# 3. Push droplet to SAP BTP Cloud Foundry
cf push
```

### Production `manifest.yml`
```yaml
applications:
  - name: bookshop-multi-buildpack
    memory: 512M
    disk_quota: 1024M
    buildpacks:
      - python_buildpack
      - nodejs_buildpack
    command: npm start
    routes:
      - route: bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com
    health-check-type: http
    health-check-http-endpoint: /healthz
    timeout: 180
    env:
      PYTHON_BIN: python3
      NODE_ENV: production
      AI_DESTINATION: google-diffusiongemma-26b-a4b-it
    services:
      - bookshop-hana
      - bookshop-destination
      - bookshop-xsuaa
      - bookshop-redis
```

---

## 🧪 Testing Strategy

```bash
# Run CAP OData & discount calculation tests
npm test

# Run AI integration tests covering all 4 BTP destination models
npm run test:ai

# Run all test suites
npm run test:all
```

You can also execute the complete HTTP test suite using **[`test/http-requests.http`](file:///Users/kallolchakraborty/Downloads/BookShop-Multibuildpack/bookshop/test/http-requests.http)** in VS Code REST Client or Antigravity IDE.

---

## 🌐 Live Routes & Observability

- **Documentation Website**: [https://kallolchakraborty.github.io/bookshop-multi-buildpack/](https://kallolchakraborty.github.io/bookshop-multi-buildpack/)
- **OData Catalog Route**: `https://bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com/browse/`
- **Health Check**: `https://bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com/healthz`
- **Readiness Check**: `https://bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com/readyz`

---

## 👤 Author

Made with ❤️ by **[Kallol Chakraborty](https://www.linkedin.com/in/kallol-chakraborty-9728a699/)**.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
