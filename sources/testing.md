# Testing Strategy

## Test Pyramid

```
         ┌──────────┐
         │   E2E    │  (Playwright / Cypress)
         ├──────────┤
         │   API    │  (Integration Tests)
         ├──────────┤
         │ Unit     │  (Jest + Pytest)
         └──────────┘
```

## Unit Tests

### Node.js Unit Tests (Jest)

```javascript
// tests/unit/services/recommendation.service.test.js
const recommendationService = require('../../../src/services/recommendation.service');

describe('RecommendationService', () => {
  test('should fetch recommendations from Python backend', async () => {
    const mockResponse = {
      data: {
        recommendations: [
          { id: '456', title: 'Test Book', score: 0.9 }
        ]
      }
    };

    global.axios = {
      post: jest.fn().mockResolvedValue(mockResponse)
    };

    const result = await recommendationService.getRecommendations('123');
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].title).toBe('Test Book');
  });

  test('should handle Python backend timeout', async () => {
    global.axios = {
      post: jest.fn().mockRejectedValue({ code: 'ECONNABORTED' })
    };

    await expect(recommendationService.getRecommendations('123'))
      .rejects.toThrow('Python backend timeout');
  });
});
```

### Python Unit Tests (Pytest)

```python
# tests/unit/test_recommendation.py
import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    return app.test_client()

def test_health_endpoint(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json['status'] == 'healthy'

def test_recommend_endpoint(client):
    response = client.post('/api/recommend', json={'bookId': '123'})
    assert response.status_code == 200
    assert 'recommendations' in response.json
```

## Integration Tests

### Node.js Integration Tests (Supertest)

```javascript
// tests/integration/api.test.js
const request = require('supertest');
const app = require('../../src/app');

describe('API Integration', () => {
  test('GET /health returns 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('POST /ai/chat returns AI response', async () => {
    const response = await request(app)
      .post('/ai/chat')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send({ messages: [{ role: 'user', content: 'Hello' }] });
    
    expect(response.status).toBe(200);
    expect(response.body.choices).toBeDefined();
  });
});
```

### Python Integration Tests

```python
# tests/integration/test_ml_pipeline.py
def test_full_recommendation_pipeline(client):
    response = client.post('/api/recommend', json={
        'bookId': '123',
        'userId': 'user-abc',
        'algorithm': 'collaborative-filtering'
    })
    assert response.status_code == 200
    data = response.json
    assert 'recommendations' in data
    assert len(data['recommendations']) > 0
    assert 'model' in data
```

## End-to-End Tests (Playwright)

```javascript
// tests/e2e/bookshop.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Bookshop E2E', () => {
  test('user can browse books and get AI recommendations', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    await page.fill('[data-testid="search-books"]', 'SAP');
    await page.click('[data-testid="search-button"]');
    
    await expect(page.locator('[data-testid="book-card"]')).toHaveCount(5);
    
    await page.click('[data-testid="book-card"]:first-child');
    await page.click('[data-testid="get-recommendations"]');
    
    await expect(page.locator('[data-testid="recommendation-card"]')).toHaveCount(3);
  });

  test('AI chat responds correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/chat');
    
    await page.fill('[data-testid="chat-input"]', 'Recommend SAP books');
    await page.click('[data-testid="send-button"]');
    
    await expect(page.locator('[data-testid="ai-response"]')).toBeVisible();
  });
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run Node.js unit tests
npm run test:unit

# Run Python unit tests
cd python-backend && pytest

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## package.json Test Scripts

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration && cd python-backend && pytest",
    "test:unit": "jest --config jest.config.js",
    "test:integration": "jest --config jest.integration.config.js",
    "test:e2e": "playwright test",
    "test:coverage": "jest --coverage && cd python-backend && pytest --cov=app",
    "test:watch": "jest --watch"
  }
}
```

## CI/CD Pipeline Tests

```yaml
# .github/workflows/test.yml
name: Test Pipeline
on: [push, pull_request]
jobs:
  test-node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
  
  test-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
      - run: cd python-backend && pip install -r requirements.txt && pytest
```
