# 📚 bookshop-multi-buildpack

[![Live Documentation](https://img.shields.io/badge/Docs-Live%20Website-E95420?style=for-the-badge&logo=githubpages&logoColor=white)](https://kallolchakraborty.github.io/bookshop-multi-buildpack/)
[![SAP BTP](https://img.shields.io/badge/SAP%20BTP-Cloud%20Foundry-0FA5E9?style=for-the-badge&logo=sap&logoColor=white)](https://cloudfoundry.org)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-v3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

An enterprise-grade SAP Business Technology Platform (BTP) reference application demonstrating **Cloud Foundry Multi-Buildpack** deployment. It co-locates a **Node.js CAP (Cloud Application Programming)** service with a persistent **Python ML worker bridge** inside a single Cloud Foundry container droplet.

---

## 🌟 Key Highlights

- **Dual-Runtime Co-location**: Runs Node.js (`@sap/cds` v10) and Python 3.10 inside a single SAP BTP Cloud Foundry container droplet.
- **Zero-Latency IPC Bridge**: Communicates over newline-delimited `stdin/stdout` JSON-RPC (`srv/python.js` $\leftrightarrow$ `python/functions.py`) with zero HTTP overhead or cold start penalty.
- **AI Core & Destination Integration**: Built-in support for NVIDIA Llama 3.3 70B and OpenAI-compatible LLMs via SAP BTP Destination Service with XSUAA authorization.
- **Server-Sent Events (SSE) Streaming**: Low-latency token-by-token streaming endpoint (`/ai/ask/stream`) for generative AI chat responses.
- **Integrated Interactive Documentation**: Complete developer guide with interactive architecture diagrams and Fuse.js fuzzy search published live via GitHub Pages.

---

## 🏗️ Architecture Overview

```
                      +---------------------------------------------------------+
                      |         SAP BTP Cloud Foundry Container (Droplet)       |
                      |                                                         |
                      |  +---------------------+        +--------------------+  |
                      |  |  Node.js CAP Server |  IPC   |  Python Worker     |  |
[Client Requests] ----+->|  (@sap/cds v10)     |<------>|  (functions.py)    |  |
(OData V4 / SSE)      |  |  Port $PORT (8080)  | (stdin |  Persistent RPC    |  |
                      |  +----------+----------+ stdout)|  (Discount / ML)   |  |
                      +-------------|-------------------+--------------------+--+
                                    |
            +-----------------------+-----------------------+
            |                       |                       |
            v                       v                       v
    +---------------+       +---------------+       +---------------+
    |  SAP XSUAA    |       | Destination   |       |  HANA Cloud / |
    |  Auth Service |       | Service       |       |  SQLite DB    |
    +---------------+       +---------------+       +---------------+
```

### Process Flow
1. **Client Gateway**: External HTTP traffic hits Node.js CAP on `$PORT` (default 4004 local, 8080 CF).
2. **Node.js CAP Server**: Handles OData V4 routing (`/browse`), Fiori preview, entity persistence, and BTP destination resolution.
3. **Python Worker Bridge**: A single persistent Python sub-process spawned lazily by `srv/python.js` on startup. Exposes business math algorithms and LLM chat completions.
4. **BTP Service Bindings**: Integrates XSUAA JWT authentication, BTP Destination Service, and SAP HANA Cloud database storage.

---

## 📁 Repository Structure

```
bookshop-multi-buildpack/
├── .buildpacks                   # Multi-buildpack declarations (Python + Node.js)
├── manifest.yml                  # SAP BTP Cloud Foundry deployment manifest
├── package.json                  # CAP Node.js dependencies & scripts
├── db/                           # CDS Data Models & Seed Data
│   ├── schema.cds                # CDS Entity definitions (Book, Author, Order)
│   └── data/                     # CSV seed files
├── srv/                          # CAP Service Definition & Custom Handlers
│   ├── server.js                 # Custom CAP bootstrap orchestrator & SSE streaming
│   ├── cat-service.cds           # CatalogService OData V4 annotations
│   ├── cat-service.js            # Catalog business logic & Python IPC delegator
│   ├── ai-service.cds            # AIService & prompt endpoint definitions
│   ├── ai-service.js             # AI request handlers & destination lookup
│   ├── ai-destination.js         # SAP BTP Destination resolution for LLMs
│   └── python.js                 # Zero-latency stdin/stdout JSON-RPC process bridge
├── python/                       # Co-located Python Backend Engine
│   ├── functions.py              # Persistent Python RPC process listener & LLM bridge
│   └── requirements.txt          # Python dependencies
├── sources/                      # Markdown source files for documentation generator
├── scripts/                      # Build & static content generator scripts
│   └── build.js                  # Pre-compiles markdown to JSON search index
├── assets/                       # SVG Architecture diagrams & brand assets
├── index.html                    # Documentation homepage
└── docs.html                     # Interactive documentation reader
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js**: `v18.x` or higher
- **Python**: `v3.10` or higher
- **npm**: `v9.x` or higher

### Local Installation & Running

```bash
# 1. Clone the repository
git clone https://github.com/kallolchakraborty/bookshop-multi-buildpack.git
cd bookshop-multi-buildpack

# 2. Install Node.js dependencies
npm install

# 3. Start the application locally
npm start
```

The application will start at `http://localhost:4004`.

### Testing the Endpoints

- **Catalog OData V4 Service**: `http://localhost:4004/browse/Books`
- **Apply Discount Action**:
  ```bash
  curl -X POST http://localhost:4004/browse/discount \
    -H "Content-Type: application/json" \
    -d '{"title":"classic Bestseller", "price":100}'
  ```
- **AI Chat SSE Token Stream**:
  ```bash
  curl -N -X POST http://localhost:4004/ai/ask/stream \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Explain SAP BTP Multi-Buildpack in 2 sentences"}'
  ```

---

## ☁️ Deployment Modes

### 1. Production Mode (SAP BTP Cloud Foundry)

Deployment to SAP BTP uses the declared multi-buildpack sequence in `manifest.yml`:

```yaml
applications:
  - name: bookshop-multi-buildpack
    memory: 512M
    buildpacks:
      - python_buildpack
      - nodejs_buildpack
    command: npm start
    env:
      PYTHON_BIN: python3
      NODE_ENV: production
      AI_MODEL: meta/llama-3.3-70b-instruct
    services:
      - bookshop-multi-buildpack-db
      - destination-service
      - bookshop-multi-buildpack-uaa
```

#### Steps to Deploy:
```bash
# 1. Login to Cloud Foundry CLI
cf login -a https://api.cf.<region>.hana.ondemand.com

# 2. Create required SAP BTP services
cf create-service xsuaa application bookshop-multi-buildpack-uaa -c xs-security.json
cf create-service destination lite destination-service
cf create-service hana cloud hdi-shared bookshop-multi-buildpack-db

# 3. Deploy application droplet
cf push
```

---

## 🧪 Testing

Run the full automated integration test suite:

```bash
# Run all unit and integration tests
npm test
```

Test coverage includes:
- **`test/discount.test.js`**: Unit tests verifying Python IPC discount algorithms.
- **`test/ai-service.test.js`**: Integration tests for AI prompt handler & SSE token streaming.

---

## 📖 Live Documentation Website

The repository features an interactive, search-enabled documentation website published live:

🌐 **[https://kallolchakraborty.github.io/bookshop-multi-buildpack/](https://kallolchakraborty.github.io/bookshop-multi-buildpack/)**

### Building Documentation Locally
```bash
# Pre-compile documentation markdown files into JSON search indices
node scripts/build.js

# Serve the static documentation site
npx serve .
```

---

## 👤 Author

Made with ❤️ by **[Kallol Chakraborty](https://www.linkedin.com/in/kallol-chakraborty-9728a699/)**.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
