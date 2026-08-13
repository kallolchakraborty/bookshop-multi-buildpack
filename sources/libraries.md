# Libraries and Dependencies

## Node.js Dependencies (package.json)

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.2 | Web framework |
| `@sap/cds` | ^7.0.0 | SAP Cloud Application Programming Model |
| `@sap/xssec` | ^3.2.0 | XSUAA JWT validation |
| `@sap/xsenv` | ^3.1.0 | Environment variable management |
| `@sap-cloud-sdk/connectivity` | ^3.0.0 | Destination service client |
| `axios` | ^1.6.0 | HTTP client for Python calls |
| `axios-retry` | ^4.0.0 | Retry logic for Python calls |
| `cors` | ^2.8.5 | Cross-origin resource sharing |
| `helmet` | ^7.1.0 | Security headers |
| `express-rate-limit` | ^7.1.0 | Rate limiting |
| `morgan` | ^1.10.0 | HTTP request logging |
| `dotenv` | ^16.3.1 | Environment variable loading |
| `@hapi/boom` | ^10.0.0 | Error handling utilities |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `jest` | ^29.7.0 | Unit testing framework |
| `supertest` | ^6.3.3 | API integration testing |
| `eslint` | ^8.50.0 | Code linting |
| `prettier` | ^3.0.3 | Code formatting |

## Python Dependencies (requirements.txt)

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `flask` | ^3.0.0 | Web framework for Python backend |
| `flask-cors` | ^4.0.0 | CORS support for Flask |
| `requests` | ^2.31.0 | HTTP client for outbound calls |
| `numpy` | ^1.24.0 | Numerical computing |
| `pandas` | ^2.1.0 | Data manipulation |
| `scikit-learn` | ^1.3.0 | ML model library |
| `PyJWT` | ^2.8.0 | JWT token validation |
| `python-dotenv` | ^1.0.0 | Environment variables |
| `gunicorn` | ^21.2.0 | WSGI HTTP server |

### AI/ML Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `openai` | ^1.3.0 | OpenAI API client |
| `tensorflow` | ^2.14.0 | Deep learning framework |
| `transformers` | ^4.35.0 | Hugging Face models |
| `sentence-transformers` | ^2.2.0 | Text embeddings |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `pytest` | ^7.4.0 | Testing framework |
| `pytest-cov` | ^4.1.0 | Coverage reporting |
| `black` | ^23.0.0 | Code formatting |
| `flake8` | ^6.1.0 | Linting |

## Library Rationale

### Why Express over Fastify/Koa?
- Mature ecosystem with SAP CAP integration
- Extensive middleware support (CORS, rate limiting, helmet)
- Team familiarity and community support

### Why Flask over FastAPI/Django?
- Lightweight, easy to embed in server.js
- Sufficient for ML proxy endpoints
- Minimal overhead alongside Node.js

### Why Axios over Fetch?
- Automatic JSON serialization
- Built-in timeout support
- Interceptor support for auth token injection
- Better error handling

### Why Jest over Mocha/Vitest?
- Official SAP BTP stack preference
- Built-in mocking and coverage
- Excellent TypeScript support
