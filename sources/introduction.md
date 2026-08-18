# Bookshop Multi Buildpack

## What is This Project?

**bookshop-multi-buildpack** is an enterprise SAP Business Technology Platform (BTP) reference application demonstrating **Cloud Foundry Multi-Buildpack co-location**. It pairs an **SAP CAP Node.js edge gateway** (`@sap/cds` v10) with a **Python AI Service Worker & SAP HANA Cloud REAL_VECTOR RAG Engine** inside a single 512 MB container droplet.

## Key Features & Production Architecture

- **Dual Runtime Co-location**: Node.js and Python 3 co-located in a single Cloud Foundry container droplet with zero cold-start penalty over stdin/stdout JSON-RPC.
- **Zero-Hardcoding BTP Destination Auto-Selection Engine**: Uses `@sap-cloud-sdk/connectivity` to auto-discover and resolve BTP Cockpit Destinations dynamically.
- **4-Destination Real-Time Failover Cascade**:
  <div class="failover-cascade">
    <span class="fc-step p1">P1 · google/diffusiongemma-26b-a4b-it</span>
    <span class="fc-arrow">→</span>
    <span class="fc-step p2">P2 · google/gemma-4-31b-it</span>
    <span class="fc-arrow">→</span>
    <span class="fc-step p3">P3 · z-ai/glm-5.2</span>
    <span class="fc-arrow">→</span>
    <span class="fc-step fallback">Fallback · mistralai/mistral-nemotron</span>
  </div>
- **Enterprise Python AI Worker Pipeline**: Multi-turn AI worker workflow supporting catalog search, discount calculations, and AI completions.
- **Enterprise Redis Prompt Cache**: Caches repeat completions (< 5ms response time) with automatic SAP BTP `redis-instance` binding.
- **SAP HANA Cloud REAL_VECTOR Engine**: Cosine similarity search over 1536-dimensional book vector embeddings.
- **Defense-in-Depth Guardrails**: Direct/indirect prompt injection defense, PII/secret scrubbing, XML prompt isolation, and competitor output filtering.
- **Structured Application Telemetry & Observability**: Real-time logging and tracing for prompt executions and backend responses.

