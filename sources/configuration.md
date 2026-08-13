# Configuration Guide

## Overview

The application supports three deployment modes:
1. **Production** (SAP BTP Cloud Foundry)
2. **Local** (Developer machine)
3. **Hybrid** (Local Node.js + BTP-hosted Python)

## Configuration Files

### .env (Local Development)

```bash
# Node.js Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# XSUAA Configuration
UAA_SERVER_URL=https://your-xsuaa.authentication.sap.hana.ondemand.com
UAA_CLIENT_ID=bookshop-multi-buildpack!t1234
UAA_CLIENT_SECRET=<client-secret>
UAA_CREDENTIALS_TYPE=XSUAA-CREDENTIALS

# Service URLs
PYTHON_SERVICE_URL=http://localhost:5000
AI_CORE_URL=https://api.ai.core.sap/v2

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<password>
DB_NAME=bookshop

# AI Configuration
AI_API_KEY=<your-ai-core-key>
AI_MODEL=gpt-4

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Destination Service (local mock)
DESTINATION_SERVICE_URL=http://localhost:5000

# Flask/Python Configuration (in python.env)
FLASK_APP=main.py
FLASK_ENV=development
PYTHON_PORT=5000
```

### manifest.yml (Production)

```yaml
# Cloud Foundry Multi-Buildpack Manifest
applications:
  - name: bookshop-multi-buildpack
    memory: 512M
    disk_quota: 1024M
    instances: 1
    path: .
    buildpacks:
      - python_buildpack
      - nodejs_buildpack
    command: npm start
    routes:
      - route: bookshop-multi-buildpack.cfapps.us10-003.hana.ondemand.com
    health-check-type: http
    health-check-http-endpoint: /health
    timeout: 180
    env:
      PYTHON_BIN: python3
      NODE_ENV: production
      AI_MODEL: meta/llama-3.3-70b-instruct
      AI_TIMEOUT: "900"
      LOG_LEVEL: info
    services:
      - bookshop-multi-buildpack-db
      - destination-service
      - bookshop-multi-buildpack-uaa
```

### xs-security.json (XSUAA)

See Services section for full configuration.

### xs-app.json (Route Configuration)

```json
{
  "welcomeFile": "index.html",
  "routes": [
    {
      "source": "^/api/(.*)$",
      "target": "/$1",
      "service": "bookshop-multi-buildpack",
      "authenticationType": "xsuaa",
      "scope": "$XSAPPNAME.bookshop-read"
    },
    {
      "source": "^/ai/(.*)$",
      "target": "/ai/$1",
      "service": "bookshop-multi-buildpack",
      "authenticationType": "xsuaa",
      "scope": "$XSAPPNAME.bookshop-ai"
    },
    {
      "source": "^/odata/(.*)$",
      "target": "/odata/$1",
      "service": "bookshop-multi-buildpack",
      "authenticationType": "xsuaa"
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "service": "bookshop-multi-buildpack",
      "authenticationType": "none"
    }
  ]
}
```

## Environment Variable Matrix

| Variable | Production | Local | Hybrid |
|----------|-----------|-------|--------|
| PORT | 8080 (CF sets) | 3000 | 3000 |
| PYTHON_SERVICE_URL | http://localhost:5000 | http://localhost:5000 | https://hybrid-python.cfapps... |
| NODE_ENV | production | development | development |
| UAA_SERVER_URL | CF-provided | Local mock | CF-provided |
| DESTINATION_SERVICE_URL | CF-provided | Local mock | CF-provided |

## Hybrid Mode Details

In hybrid mode:
- Node.js runs locally for rapid development
- Python backend deploys to BTP Cloud Foundry
- Node.js connects to BTP Python via public URL

```javascript
// hybrid.env
NODE_ENV=development
PORT=3000
PYTHON_SERVICE_URL=https://bookshop-python-backend.cfapps.us10-001.hana.ondemand.com
UAA_SERVER_URL=https://your-xsuaa.authentication.sap.hana.ondemand.com
UAA_CLIENT_ID=bookshop-multi-buildpack!t1234
UAA_CLIENT_SECRET=<from BTP>
```

Start local:
```bash
npm run dev
```

Deploy Python only:
```bash
cd python-backend
cf push bookshop-python-backend
```
