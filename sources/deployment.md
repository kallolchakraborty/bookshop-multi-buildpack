# Deployment Guide

## Deployment Modes

### 1. Production Mode (SAP BTP Cloud Foundry Multi-Buildpack)

#### Prerequisites
- SAP BTP subaccount with Cloud Foundry runtime
- Services provisioned: `xsuaa`, `destination`, `hana` (HDI-shared), `redis-instance`
- Cloud Foundry CLI (`cf`) installed and logged in
- Multi-buildpack enabled space

#### Deployment Steps

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/bookshop-multi-buildpack.git
cd bookshop-multi-buildpack

# 2. Install dependencies & build CDS models
npm install
npx cds build --production

# 3. Deploy HDI artifacts to SAP HANA Cloud
npm run deploy:cf:hana

# 4. Deploy multi-buildpack application droplet (512 MB)
cf push
```

#### Production `manifest.yml`
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

### 2. Local Mode (Developer Workstation)

#### Prerequisites
- Node.js 18+ or 20+
- Python 3.10+ with `pip`
- SQLite (for local CAP persistence)

#### Setup

```bash
# 1. Install Node.js dependencies
npm install

# 2. Set up Python virtual environment
python3 -m venv python/venv
source python/venv/bin/activate   # On Windows: python\venv\Scripts\activate
pip install -r python/requirements.txt

# 3. Initialize SQLite local database with mock data
npx cds deploy --to sqlite

# 4. Start local development server
# Node.js automatically spawns python/functions.py --worker via stdio
npm start

# 5. Application is accessible at:
# http://localhost:4004
```

---

### 3. Hybrid Mode (Local Node.js + Remote BTP Services)

#### Architecture
```
┌─────────────────────────────────┐           BTP Service Bindings           ┌─────────────────────────────┐
│  Local Workstation              │ ───────────────────────────────────────► │  SAP BTP Cloud Services     │
│  - CAP Server (:4004)           │      VCAP_SERVICES / @sap-cloud-sdk      │  - SAP HANA Cloud (Vectors) │
│  - Co-located Python Worker     │                                          │  - BTP Destination Service  │
│  - Local Debugger & Hot Reload  │                                          │  - BTP Redis Cache Instance │
└─────────────────────────────────┘                                          └─────────────────────────────┘
```

#### Setup

```bash
# 1. Bind local CAP server to remote BTP services
npx cds bind -2 bookshop-hana:bookshop-hana-key
npx cds bind -2 bookshop-destination:bookshop-dest-key

# 2. Run hybrid development server
npx cds watch --profile hybrid
```

---

## Environment Comparison

![Deployment Modes](assets/diagrams/deployment-modes.svg)

---

## Health Probes & Monitoring

### Health & Readiness Probes
```bash
# System & CAP Memory Health Probe
curl http://localhost:4004/healthz
# Response: {"status":"OK","uptime":128.4,"memory":{"rss":"64MB"}}

# Python IPC Channel & Worker Readiness Probe
curl http://localhost:4004/readyz
# Response: {"status":"READY","python":"OK"}
```

### Cloud Foundry Logs & Telemetry
```bash
# Stream real-time logs from Cloud Foundry
cf logs bookshop-multi-buildpack --recent

# Trace LangSmith agent executions in real-time
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=<your-langsmith-key>
```
