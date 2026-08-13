# Deployment Guide

## Deployment Modes

### 1. Production Mode (SAP BTP Cloud Foundry)

#### Prerequisites
- SAP BTP subaccount with Cloud Foundry runtime
- XSUAA, Destination, and HANA services provisioned
- Cloud Foundry CLI installed and logged in
- Multi-buildpack enabled in org space

#### Deployment Steps

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/bookshop-multi-buildpack.git
cd bookshop-multi-buildpack

# 2. Install dependencies
npm install

# 3. Build documentation site
npm run build

# 4. Create services in BTP
cf create-service xsuaa application bookshop-xsuaa -c xs-security.json
cf create-service destination lite bookshop-destination
cf create-service hana cloud hdi-shared bookshop-hana

# 5. Deploy application
cf push bookshop-multi-buildpack
```

#### Manifest.yml (Production)
```yaml
# Cloud Foundry Multi-Buildpack Manifest
applications:
  - name: bookshop-multi-buildpack
    memory: 512M
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
    services:
      - bookshop-multi-buildpack-db
      - destination-service
      - bookshop-multi-buildpack-uaa
```

### 2. Local Mode (Developer Machine)

#### Prerequisites
- Node.js 18+ installed
- Python 3.10+ installed
- npm installed

#### Setup

```bash
# 1. Clone repository
git clone https://github.com/yourusername/bookshop-multi-buildpack.git
cd bookshop-multi-buildpack

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with local values

# 5. Start Python backend (Terminal 1)
cd backend
python main.py

# 6. Start Node.js server (Terminal 2)
npm start

# 7. Access application
# http://localhost:3000
```

#### Local docker-compose.yml (Optional)
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - PYTHON_SERVICE_URL=http://python:5000
    depends_on:
      - python

  python:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=development
```

### 3. Hybrid Mode

#### Architecture
```
┌──────────────┐      HTTPS       ┌──────────────────┐
│   Local Dev  │ ◄──────────────► │ BTP Cloud Foundry│
│   Node.js    │                  │ Python Backend   │
│   :3000      │                  │ (deployed)       │
└──────────────┘                  └──────────────────┘
```

#### Setup

```bash
# 1. Deploy Python backend to BTP
cd backend
cf push bookshop-python-backend \
  -b python_buildpack \
  -m 256M \
  -c "gunicorn main:app"

# 2. Note the Python URL (e.g., https://bookshop-python.cfapps.us10...)

# 3. Configure local Node.js
# In .env:
PYTHON_SERVICE_URL=https://bookshop-python.cfapps.us10-001.hana.ondemand.com
UAA_SERVER_URL=https://your-xsuaa.authentication.sap.hana.ondemand.com
UAA_CLIENT_ID=bookshop-multi-buildpack!t1234
UAA_CLIENT_SECRET=<your-secret>

# 4. Start local Node.js
npm start
```

#### Route Service Configuration
```javascript
// Ensure XSUAA tokens are forwarded
const xss = require('@sap/xssec');
const destination = await getDestination({ destinationName: 'python-service' });

// Forward auth header
const authHeader = req.headers.authorization;
const pythonResponse = await axios.post(
  `${PYTHON_SERVICE_URL}/api/action`,
  payload,
  { headers: { Authorization: authHeader } }
);
```

## Environment Comparison

![Deployment Modes](assets/diagrams/deployment-modes.svg)

## Monitoring

### Health Check Endpoints
```bash
# Node.js
curl http://localhost:8080/health

# Python
curl http://localhost:5000/api/health
```

### Cloud Foundry Logs
```bash
cf logs bookshop-multi-buildpack --recent
cf logs bookshop-multi-buildpack
```

### Application Metrics
- Response time (p50, p95, p99)
- Error rate
- Python process memory/CPU
- AI request latency
- Database query performance
