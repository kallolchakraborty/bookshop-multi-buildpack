# Developer Guide

## Welcome to bookshop-multi-buildpack!

This guide will take you from zero to a running application in 30 minutes.

## Prerequisites

Before you begin, ensure you have:
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Python** 3.10+ ([Download](https://python.org/))
- **npm** or **yarn** (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- A code editor (VS Code recommended)

## Step 1: Get the Code

```bash
# Clone the repository
git clone https://github.com/yourusername/bookshop-multi-buildpack.git
cd bookshop-multi-buildpack
```

Or download the ZIP directly from this documentation site (see Download button).

## Step 2: Install Dependencies

```bash
# Node.js dependencies
npm install

# Python dependencies
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate

# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
cd ..
```

## Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
# At minimum, set:
# - PORT=3000
# - PYTHON_SERVICE_URL=http://localhost:5000
# - DB_CONNECTION_STRING=your-connection-string
```

### Minimal .env Configuration
```bash
PORT=3000
PYTHON_SERVICE_URL=http://localhost:5000
NODE_ENV=development
LOG_LEVEL=debug
```

## Step 4: Start the Application

Open **two terminal windows**:

**Terminal 1 - Python Backend:**
```bash
cd backend
python main.py
# You should see: "Python backend running on http://localhost:5000"
```

**Terminal 2 - Node.js Frontend:**
```bash
npm start
# You should see: "Node.js server running on http://localhost:3000"
```

## Step 5: Verify Installation

```bash
# Test Node.js
curl http://localhost:3000/health

# Test Python
curl http://localhost:5000/api/health

# Expected response:
# {"status":"ok","node":"up","python":"up"}
```

## Your First Change

Let's add a simple endpoint to understand the codebase.

### 1. Add Python Endpoint

**File: `backend/main.py`**
```python
@app.route('/api/hello', methods=['GET'])
def hello():
    return jsonify({
        'message': 'Hello from Python!',
        'runtime': 'python',
        'version': '1.0.0'
    })
```

### 2. Call from Node.js

**File: `src/app.js`**
```javascript
app.get('/api/python-hello', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:5000/api/hello');
    res.json({ fromPython: response.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3. Test
```bash
curl http://localhost:3000/api/python-hello
```

## Understanding the Code Flow

```
Client Request
     │
     ▼
Express Server (port 3000)
     │
     ▼
Middleware (Auth, CORS, Rate Limit)
     │
     ▼
Route Handler
     │
     ├───► Node.js Logic ──► Database
     │
     └───► HTTP Call ──► Python Backend (port 5000)
                              │
                              ▼
                         ML/AI Processing
                              │
                              ▼
                         Response
```

## Common Development Tasks

### Running Tests
```bash
# All tests
npm test

# Just Node.js tests
npm run test:unit

# Just Python tests
cd backend && pytest
```

### Debugging

**Node.js debugging:**
```bash
node --inspect src/app.js
# Open chrome://inspect in Chrome
```

**Python debugging:**
```bash
python -m debugpy --listen 5678 backend/main.py
# Connect from VS Code
```

### Linting
```bash
# JavaScript
npx eslint src/

# Python
cd backend && flake8
```

## Next Steps

1. Read the [Architecture](#) section to understand the design
2. Explore the [Endpoints](#) section to learn available APIs
3. Check [Configuration](#) for production setup
4. Review [Testing](#) to write your own tests

## Getting Help

- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Ask questions in GitHub Discussions
- **Documentation**: Browse this site
- **SAP BTP Docs**: [https://help.sap.com/docs/btp](https://help.sap.com/docs/btp)

## Download the Project

You can download the complete `bookshop-multi-buildpack` project as a ZIP file from the download button above. Extract and follow the setup instructions above.

## Quick Reference

```bash
# Start local development
npm run dev

# Run tests
npm test

# Build docs
npm run build

# Deploy to BTP
cf push bookshop-multi-buildpack

# View logs
cf logs bookshop-multi-buildpack

# Restart app
cf restart bookshop-multi-buildpack
```
