# How Node.js Calls Python

## Communication Mechanisms

### 1. HTTP (Recommended for Production)

The Python backend runs as a standalone HTTP server. Node.js communicates via HTTP requests.

**Python backend (FastAPI/Flask)**:
```python
from flask import Flask, jsonify, request
app = Flask(__name__)

@app.route('/api/recommend', methods=['POST'])
def recommend():
    data = request.json
    # ML logic here
    return jsonify({"recommendations": [...], "model": "recommender-v1"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

**Node.js caller**:
```javascript
const axios = require('axios');

async function getRecommendations(bookId) {
  try {
    const response = await axios.post(
      'http://localhost:5000/api/recommend',
      { bookId },
      { timeout: 3000 }
    );
    return response.data;
  } catch (error) {
    console.error('Python service error:', error.message);
    throw error;
  }
}
```

### 2. Internal URL Configuration

In production, use environment variables to avoid hardcoding:

```javascript
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
```

### 3. Request/Response Contract

```javascript
// Node.js sends
{
  "action": "recommend",
  "payload": { "bookId": "123", "userId": "user-abc" }
}

// Python responds
{
  "status": "success",
  "data": {
    "recommendations": [
      { "id": "456", "title": "Book Title", "score": 0.92 }
    ],
    "model": "collaborative-filtering-v2"
  },
  "timestamp": "2026-08-12T12:00:00Z"
}
```

## Error Handling Strategy

```javascript
async function callPythonService(action, payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/api/action`,
      { action, payload },
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    return response.data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Python backend not ready');
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Python backend timeout');
    }
    throw error;
  }
}
```

## Retry Logic

```javascript
const axios = require('axios');
const axiosRetry = require('axios-retry');

axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => Math.pow(2, retryCount) * 1000,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           error.code === 'ECONNRESET' ||
           error.response?.status === 503;
  }
});
```

## Why Not Direct Library Import?

Some developers attempt `python-shell` or `child_process.exec` for synchronous calls. This approach is **not recommended** for production because:
- Blocks the Node.js event loop
- Difficult to scale
- Hard to debug
- Loses network boundaries benefits

HTTP communication provides:
- Clear service boundaries
- Independent scaling
- Language-agnostic interface
- Easy testing with mock servers
