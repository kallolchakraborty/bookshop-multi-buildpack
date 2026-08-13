# Architecture Overview

## Main Architecture

![Architecture Diagram](assets/diagrams/architecture.svg)

The **BookShop Multi-Buildpack** application is an SAP BTP Cloud Foundry enterprise pattern built with SAP CAP (`@sap/cds`). It seamlessly combines a **Node.js runtime** (accepting OData V4 client requests) with a **co-located Python process** (handling ML discount calculations and LLM streaming inference).

### Component & Process Flow

1. **Client Request**: Clients connect to the CAP OData V4 endpoints (`/browse` or `/ai`) or Fiori Elements UI.
2. **Node.js CAP Server (`@sap/cds`)**:
   - Handles entity persistence, OData V4 routing, and XSUAA authentication.
   - For special actions (`discount` or `ask`), Node.js delegates tasks to Python.
   - Resolves BTP Destinations (e.g. `destination-service` resolving `meta-llama-3-3-70b-instruct`) and passes connection credentials down to Python.
3. **Python Worker Bridge (`python/functions.py --worker`)**:
   - A single, persistent Python 3 process spawned lazily by `srv/python.js`.
   - Communicates with Node.js via newline-delimited JSON-RPC over `stdin`/`stdout` (paid once per container lifecycle, 0ms per-request cold start).
   - Performs discount math and OpenAI-compatible HTTP chat completion / SSE token streaming.
4. **HANA Cloud / In-Memory DB**: Serves persistent catalog data (`Book`, `Author`, `Order`).

### Component Responsibilities

| Component | Technology | Responsibility | Communication |
|-----------|------------|----------------|---------------|
| **Node.js CAP Server** | `@sap/cds` v10 / Express | OData V4 API (`/browse`), Fiori preview, Destination resolution, SSE streaming endpoint (`/ai/ask/stream`) | `http` on `$PORT` (default 4004 / 8080) |
| **Python Worker** | Python 3 / `urllib` | Discount keyword calculations, NVIDIA Llama 3.3 70B AI chat completions | `stdin`/`stdout` JSON-RPC bridge |
| **BTP Services** | XSUAA, Destination, HDI | Auth JWT validation, Destination key lookup, HANA DB storage | SAP BTP Service Bindings |

## Security Boundaries

![Security Boundaries](assets/diagrams/security-boundaries.svg)

- **Authentication**: User authentication is enforced via SAP BTP XSUAA JWT validation.
- **Service Isolation**: The Python process is co-located in the container and isolated from external networks; only the Node.js CAP server exposes external HTTP ports.
- **Destination Security**: Outbound AI Core and external API credentials are managed securely through SAP BTP Destination Service.
