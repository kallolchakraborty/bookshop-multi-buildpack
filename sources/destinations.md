# Destination Creation and Configuration

## What are Destinations?

In SAP BTP, **destinations** are configuration objects that define how applications connect to external systems or services. They centralize connection details (URL, authentication, proxy) so applications don't hardcode them.

## Why Destinations Matter for bookshop-multi-buildpack

The application uses destinations to connect to:
1. **Python backend** (local or remote)
2. **AI Core service** (GenAI/HuggingFace models)
3. **External APIs** (payment gateways, email services)

## Creating Destinations via BTP Cockpit

### Step 1: Navigate to Destinations

1. Log into SAP BTP Cockpit
2. Select your subaccount
3. Go to **Connectivity → Destinations**
4. Click **New Destination**

### Step 2: Create Python Backend Destination

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `python-service` | Used in code as destination name |
| **Type** | `HTTP` | Standard HTTP destination |
| **URL** | `http://localhost:5000` | Local proxy or actual URL |
| **Proxy Type** | `None` | Internal service |
| **Authentication** | `NoAuthentication` | Internal service |
| **Additional Properties** | `WebIDEEnabled=true` | Enable for development |

### Step 3: Create AI Core Destination

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `ai-core-service` | GenAI service |
| **Type** | `HTTP` | HTTPS endpoint |
| **URL** | `https://api.ai.core.sap/v2` | AI Core API |
| **Proxy Type** | `Internet` | Public internet |
| **Authentication** | `OAuth2UserTokenExchange` | Token exchange auth |
| **Scope** | `bookshop-multi-buildpack.bookshop-ai` | Required scope |
| **HTML5.DynamicDestination** | `true` | Enable for HTML5 apps |

## Creating Destinations via BTP CLI

```bash
# Login to BTP
btp login --url https://cpcli.cf.sap.hana.ondemand.com --subaccount <subaccount-id>

# List destination instances
btp get destinations/instance-key

# Create destination
btp create destinations/config \
  --name python-service \
  --host localhost \
  --path / \
  --destination-type HTTP \
  --proxy-type None \
  --authentication NoAuthentication \
  --user-token-service-url https://your-xsuaa.authentication.sap.hana.ondemand.com
```

## Using Destinations in Code

```javascript
// src/services/destination-service.js
const { executeHttpRequest } = require('@sap-cloud-sdk/connectivity');

class DestinationService {
  async getDestination(name) {
    return await getDestination({ destinationName: name });
  }

  async callDestination(name, options) {
    const destination = await this.getDestination(name);
    return await executeHttpRequest(destination, {
      method: options.method || 'GET',
      url: options.url,
      headers: options.headers,
      data: options.body
    });
  }
}

// Usage for AI chat
async function callAIChat(messages) {
  const destination = await destinationService.getDestination('ai-core-service');
  const response = await executeHttpRequest(destination, {
    method: 'POST',
    url: '/chat/completions',
    headers: { 'Content-Type': 'application/json' },
    data: { model: 'gpt-4', messages }
  });
  return response.data;
}
```

## /ai/chat Endpoint with Authenticated Destinations

### Question: Does /ai/chat support destinations with authentication?

**Answer: YES, fully supported.**

The `/ai/chat` endpoint supports multiple authentication types for destinations:

#### Supported Authentication Types

| Authentication | Use Case | Configuration |
|----------------|----------|---------------|
| **OAuth2UserTokenExchange** | User-context AI calls | Recommended for AI Core |
| **OAuth2ClientCredentials** | Service-to-service | For automated AI workflows |
| **BasicAuthentication** | Simple API auth | Legacy systems |
| **PrincipalPropagation** | End-to-end identity | Multi-tier architectures |

#### OAuth2UserTokenExchange Example

```json
{
  "name": "ai-core-service",
  "type": "HTTP",
  "url": "https://api.ai.core.sap/v2",
  "proxyType": "Internet",
  "authentication": "OAuth2UserTokenExchange",
  "scope": "$XSAPPNAME.bookshop-ai",
  "tokenServiceURL": "https://your-xsuaa.authentication.sap.hana.ondemand.com",
  "tokenServiceUser": "bookshop-multi-buildpack!t1234",
  "clientId": "sb-bookshop-multi-buildpack!t1234",
  "userId": "<current-user-jwt-sub>",
  "WebIDEEnabled": true
}
```

#### Code Implementation

```javascript
// src/routes/ai.js
const { executeHttpRequest } = require('@sap-cloud-sdk/connectivity');

async function chatWithAI(req, res) {
  try {
    const destination = await getDestination({ 
      destinationName: 'ai-core-service' 
    });
    
    const response = await executeHttpRequest(destination, {
      method: 'POST',
      url: '/openai/deployments/gpt-4/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'api-key': req.authInfo.getAttr('api-key') // if needed
      },
      data: {
        messages: req.body.messages,
        temperature: req.body.temperature || 0.7,
        max_tokens: req.body.max_tokens || 500
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
}
```

## Destination Validation

```javascript
// src/middleware/validate-destination.js
async function validateDestination(destinationName) {
  try {
    const destination = await getDestination({ destinationName });
    if (!destination) {
      throw new Error(`Destination ${destinationName} not found`);
    }
    
    // Verify authentication configuration
    const auth = destination.getAuthentication();
    if (!auth && destination.authentication !== 'NoAuthentication') {
      throw new Error(`Destination ${destinationName} missing authentication`);
    }
    
    return destination;
  } catch (error) {
    console.error(`Destination validation failed: ${error.message}`);
    throw error;
  }
}
```

## Local Destination Mock

For local development without BTP services:

```javascript
// src/config/destinations.js
const mockDestinations = {
  'python-service': {
    url: 'http://localhost:5000',
    authentication: 'NoAuthentication'
  },
  'ai-core-service': {
    url: 'http://localhost:8000',
    authentication: 'BasicAuthentication',
    username: 'mock-user',
    password: 'mock-password'
  }
};

function getLocalDestination(name) {
  return mockDestinations[name] || null;
}
```
