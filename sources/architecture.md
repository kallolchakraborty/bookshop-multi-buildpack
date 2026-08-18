# Architecture Overview

## Main Architecture

![Architecture Diagram](assets/diagrams/architecture.svg)

The **BookShop Multi-Buildpack** application is an SAP BTP Cloud Foundry enterprise pattern built with SAP CAP (`@sap/cds`). It seamlessly combines a **Node.js runtime** (accepting OData V4 client requests) with a **co-located Python process** running an **AI Service Worker**, **Enterprise Redis Prompt Cache**, **Defense-in-Depth Guardrails**, and an **SAP HANA Cloud REAL_VECTOR RAG Engine**.

### Component & Process Flow

1. **Client Request**: Clients connect to CAP OData V4 endpoints (`/browse`), AI endpoints (`/ai/ask`, `/ai/ask_rag`, `/ai/ask_agent`, `/ai/ask/stream`), or Fiori Elements UI.
2. **Node.js CAP Server (`@sap/cds`)**:
   - Handles entity persistence, OData V4 routing, and XSUAA authentication.
   - Enforces sliding-window rate limiting (15 req/min) and security headers.
   - Auto-discovers BTP Destinations via `@sap-cloud-sdk/connectivity` (`google-diffusiongemma-26b-a4b-it`, `google-gemma-4-31b-it`, `z-ai-glm-5-2`, `mistralai-mistral-nemotron`) without hardcoded keys or secret URLs.
3. **Python Worker Bridge (`python/functions.py --worker`)**:
   - A single, persistent Python process spawned lazily on startup by `srv/python.js`.
   - Communicates with Node.js via newline-delimited JSON-RPC over `stdin`/`stdout` (0ms per-request cold start).
4. **Python AI Execution & Guardrail Pipeline**:
   - **Input Guardrails**: Scans for prompt injection attacks and redacts PII/secrets.
   - **Enterprise Redis Prompt Cache**: Checks `redis-instance` for cached completions (< 5ms response time).
   - **SAP HANA Cloud REAL_VECTOR Search**: Performs 1536-dim vector similarity search over book embeddings.
   - **Multi-Model Router**: Executes failover cascade across BTP destinations:
      <div class="failover-cascade">
        <span class="fc-step p1">P1 · google/diffusiongemma-26b-a4b-it</span>
        <span class="fc-arrow">→</span>
        <span class="fc-step p2">P2 · google/gemma-4-31b-it</span>
        <span class="fc-arrow">→</span>
        <span class="fc-step p3">P3 · z-ai/glm-5.2</span>
        <span class="fc-arrow">→</span>
        <span class="fc-step fallback">Fallback · mistralai/mistral-nemotron</span>
      </div>
   - **Output Guardrails**: Redacts competitor names and validates response groundedness.

### Component Responsibilities

| Component | Technology | Responsibility | Communication |
|-----------|------------|----------------|---------------|
| **Node.js CAP Gateway** | `@sap/cds` v10 / Express | OData V4 API (`/browse`), Rate limiting, Auto-Destination resolution, SSE streaming (`/ai/ask/stream`) | `http` on `$PORT` |
| **Python ML & AI Worker** | Python 3 | Input/Output Guardrails, Redis Cache, SAP HANA Vector RAG, AI Worker Execution, Failover LLM Routing | `stdin`/`stdout` JSON-RPC bridge |
| **SAP BTP Services** | XSUAA, Destination, Redis, SAP HANA Cloud | Auth JWT validation, Destination key lookup, Prompt cache (< 5ms), `REAL_VECTOR(1536)` storage | SAP BTP Service Bindings |

## Security Boundaries

![Security Boundaries](assets/diagrams/security-boundaries.svg)

- **Authentication**: User authentication is enforced via SAP BTP XSUAA JWT validation.
- **Service Isolation**: The Python process is co-located in the container and isolated from external networks; only the Node.js CAP server exposes external HTTP ports.
- **Anthropic Defense-in-Depth Guardrails**: Direct/indirect prompt injection defense, secret/PII redactor, XML tag prompt isolation, and competitor filtering.
