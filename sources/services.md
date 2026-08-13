# SAP BTP Services Used

## Mandatory Services

### 1. XSUAA (Extended Services for User Account and Authentication)

**Purpose**: OAuth 2.0 / JWT-based authentication and authorization

**Configuration in xs-security.json**:
```json
{
  "xsappname": "bookshop-multi-buildpack",
  "tenant-mode": "dedicated",
  "scopes": [
    {
      "name": "$XSAPPNAME.bookshop-read",
      "description": "Read books"
    },
    {
      "name": "$XSAPPNAME.bookshop-write",
      "description": "Modify books"
    },
    {
      "name": "$XSAPPNAME.bookshop-ai",
      "description": "Access AI features"
    },
    {
      "name": "$XSAPPNAME.bookshop-admin",
      "description": "Administrator access"
    }
  ],
  "role-templates": [
    {
      "name": "BookshopReader",
      "description": "Bookshop reader",
      "scope-references": ["$XSAPPNAME.bookshop-read"]
    },
    {
      "name": "BookshopWriter",
      "description": "Bookshop writer",
      "scope-references": [
        "$XSAPPNAME.bookshop-read",
        "$XSAPPNAME.bookshop-write"
      ]
    },
    {
      "name": "BookshopAIUser",
      "description": "AI chat user",
      "scope-references": [
        "$XSAPPNAME.bookshop-read",
        "$XSAPPNAME.bookshop-ai"
      ]
    },
    {
      "name": "BookshopAdmin",
      "description": "Administrator",
      "scope-references": [
        "$XSAPPNAME.bookshop-read",
        "$XSAPPNAME.bookshop-write",
        "$XSAPPNAME.bookshop-ai",
        "$XSAPPNAME.bookshop-admin"
      ]
    }
  ]
}
```

**manifest.yml binding**:
```yaml
services:
  - name: bookshop-xsuaa
    parameters:
      config:
        xsappname: bookshop-multi-buildpack
        tenant-mode: dedicated
```

### 2. Destination Service

**Purpose**: Centralized connectivity configuration for AI Model Endpoints in SAP BTP Cockpit.

**BTP AI Destinations Configuration Table**:

| Destination Name | Type | Target Model | Priority / Role | Authentication |
|------------------|------|--------------|-----------------|----------------|
| `google-diffusiongemma-26b-a4b-it` | `HTTP` | `google/diffusiongemma-26b-a4b-it` | **Priority 1 (Primary)** | Custom (API Key in Header) |
| `google-gemma-4-31b-it` | `HTTP` | `google/gemma-4-31b-it` | **Priority 2 (P2)** | Custom (API Key in Header) |
| `z-ai-glm-5-2` | `HTTP` | `z-ai/glm-5.2` | **Priority 3** | Custom (API Key in Header) |
| `mistralai-mistral-nemotron` | `HTTP` | `mistralai/mistral-nemotron` | **Priority 4 (Fallback)** | Custom (API Key in Header) |

**Dynamic Auto-Selection in Code (`srv/ai-destination.js`)**:
```javascript
const { getDestination } = require('@sap-cloud-sdk/connectivity')

const CANDIDATE_DESTINATIONS = [
  process.env.AI_DESTINATION,
  'google-diffusiongemma-26b-a4b-it',
  'google-gemma-4-31b-it',
  'z-ai-glm-5-2',
  'mistralai-mistral-nemotron'
].filter(Boolean)

async function getAIDestination() {
  for (const name of CANDIDATE_DESTINATIONS) {
    try {
      const dest = await getDestination({ destinationName: name })
      if (dest?.url) {
        return {
          baseUrl: dest.url,
          apiKey: dest.authHeaders?.apikey || dest.originalProperties?.APIKey || '',
          model: dest.originalProperties?.Model || '',
          destinationName: name
        }
      }
    } catch {
      // Candidate not present in BTP Cockpit, proceed to next candidate
    }
  }
}
```

---

### 3. SAP HANA Cloud (REAL_VECTOR Search)

**Purpose**: Stores 1536-dimensional vector embeddings for book titles and synopses.
- **Data Type**: `REAL_VECTOR(1536)`
- **Similarity Metric**: `COSINE_SIMILARITY()`
- **Service Plan**: `hdi-shared`

---

### 4. SAP BTP Redis Instance

**Purpose**: High-throughput prompt completion cache.
- **Cache Hit Latency**: **< 5ms**
- **Key Strategy**: `SHA-256(model + ":" + prompt)`
- **Auto-Binding**: Discovered automatically from `VCAP_SERVICES["redis-instance"]`

---

## Service Bindings in `manifest.yml`

```yaml
services:
  - bookshop-xsuaa
  - bookshop-destination
  - bookshop-hana
  - bookshop-redis
```

