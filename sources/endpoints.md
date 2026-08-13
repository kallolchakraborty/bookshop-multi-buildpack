# Application Endpoints

## Complete Endpoint Catalog

### Node.js (Express/CAP) Endpoints

#### Application Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/health` | Application health check | No |
| GET | `/odata/v4/catalog/Books` | List all books | Yes (optional) |
| GET | `/odata/v4/catalog/Books(:id)` | Get book by ID | Yes (optional) |
| POST | `/odata/v4/catalog/Books` | Create new book | Yes |
| PATCH | `/odata/v4/catalog/Books(:id)` | Update book | Yes |
| DELETE | `/odata/v4/catalog/Books(:id)` | Delete book | Yes |
| GET | `/api/recommendations/:bookId` | Get recommendations (calls Python) | Yes |
| POST | `/api/chat` | AI chat completion proxy | Yes |
| POST | `/api/upload` | Upload book cover image | Yes |
| GET | `/api/admin/stats` | Platform statistics | Yes (Admin) |

#### AI Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/ai/chat` | AI chat with GenAI/AI Core | Yes |
| POST | `/ai/chat/stream` | Streaming AI chat | Yes |
| GET | `/ai/models` | List available AI models | Yes |

**AI Chat Request Format**:
```json
{
  "messages": [
    { "role": "user", "content": "Recommend books about SAP BTP" }
  ],
  "model": "gpt-4",
  "temperature": 0.7,
  "max_tokens": 500
}
```

**AI Chat Response Format**:
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677858242,
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Based on your interest in SAP BTP, I recommend..."
      }
    }
  ]
}
```

### Python Backend Endpoints

| Method | Path | Description | Internal Only |
|--------|------|-------------|---------------|
| GET | `/api/health` | Python service health | No |
| POST | `/api/recommend` | ML recommendation engine | Yes |
| POST | `/api/analyze` | Text sentiment analysis | Yes |
| POST | `/api/predict` | Sales forecasting | Yes |
| GET | `/api/models` | List available ML models | Yes |

## Endpoint Security

All endpoints (except `/health`) are protected by:
- **XSUAA JWT validation** for user-facing endpoints
- **Client credentials** for service-to-service calls
- **Scope-based authorization** for admin endpoints
- **Rate limiting** on `/ai/chat` (50 req/min per user)

## AI Chat Request Flow

![Request Flow](assets/diagrams/request-flow.svg)
## CORS Configuration

```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-xsrf-token']
}));
```

## Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { error: 'Too many AI requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/ai/', aiLimiter);
```
