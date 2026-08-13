# File Structure

## BookShop Application Directory Tree

Below is the complete file structure of the **BookShop** CAP application (`bookshop/`):

```
bookshop/
├── .buildpacks                   # Multi-buildpack declaration (Python + Node.js)
├── manifest.yml                  # SAP BTP Cloud Foundry deployment manifest
├── package.json                  # CAP Node.js dependencies & scripts (@sap/cds)
├── package-lock.json             # Locked npm dependency versions
├── .cfignore                     # Cloud Foundry upload exclusion rules
├── .gitignore                    # Git version control exclusions
│
├── db/                           # Database domain models & seed data
│   ├── schema.cds                # CDS Entity definitions (Book, Author, Order)
│   └── data/                     # Initial CSV seed datasets
│       ├── kallol.bookshop-Author.csv
│       └── kallol.bookshop-Book.csv
│
├── srv/                          # CAP Service Definitions & Handlers
│   ├── cat-service.cds           # CatalogService OData V4 annotations & actions
│   ├── cat-service.js            # CatalogService handlers (discount calculations via Python IPC)
│   ├── ai-service.cds            # AIService OData V4 & SSE endpoint annotations
│   ├── ai-service.js            # AI prompt handler & Server-Sent Events (SSE) streaming
│   ├── ai-destination.js        # BTP Destination resolution for NVIDIA AI / GenAI models
│   ├── python.js                 # Zero-latency stdin/stdout IPC process bridge to functions.py
│   └── server.js                 # Custom CAP bootstrap server (spawns Python worker before Express)
│
├── python/                       # Co-located Python Backend Worker
│   ├── functions.py              # Persistent Python RPC process (stdin/stdout JSON listener)
│   └── requirements.txt          # Python runtime package dependencies
│
└── test/                         # Test Suite & HTTP Mock Services
    ├── ai-service.test.js        # Integration tests for AI service & streaming
    ├── discount.test.js          # Unit tests for Python IPC math discount calls
    ├── mock-ai.js                # Local mock server for GenAI LLM responses
    ├── helpers.js                # Test suite setup utilities
    └── http-requests.http        # REST Client endpoint test requests
```

---

## Key App Files Explained

### `srv/server.js` (Custom Bootstrap Orchestrator)

**Purpose**: Overrides the standard `@sap/cds` server bootstrap to launch the co-located Python process before binding Express to `$PORT`.

```javascript
const cds = require('@sap/cds');
const pythonBridge = require('./python');

cds.on('bootstrap', (app) => {
    // Initialize persistent Python worker process before handling client requests
    pythonBridge.init();
});

module.exports = cds.server;
```

### `srv/python.js` (Zero-Latency IPC Bridge)

**Purpose**: Manages long-lived sub-process communication with `python/functions.py` using non-blocking JSON-RPC over `stdin`/`stdout`.

```javascript
const { spawn } = require('child_process');
const readline = require('readline');

class PythonBridge {
    constructor() {
        this.pythonProcess = null;
        this.pendingRequests = new Map();
        this.requestId = 0;
    }

    init() {
        this.pythonProcess = spawn('python3', ['python/functions.py'], {
            stdio: ['pipe', 'pipe', 'inherit']
        });
        
        const rl = readline.createInterface({ input: this.pythonProcess.stdout });
        rl.on('line', (line) => {
            const response = JSON.parse(line);
            const resolver = this.pendingRequests.get(response.id);
            if (resolver) {
                resolver(response.result);
                this.pendingRequests.delete(response.id);
            }
        });
    }

    async exec(action, data) {
        const id = ++this.requestId;
        return new Promise((resolve) => {
            this.pendingRequests.set(id, resolve);
            this.pythonProcess.stdin.write(JSON.stringify({ id, action, data }) + '\n');
        });
    }
}

module.exports = new PythonBridge();
```

### `srv/cat-service.js` (Catalog Service Handlers)

**Purpose**: Implements custom business logic on top of CAP entity handlers, delegating mathematical operations to Python.

- Intercepts `READ` and `discount` actions on `Books` entity.
- Dispatches computation payloads to Python IPC worker (`pythonBridge.exec('apply_discount', ...)`).
- Returns enriched OData V4 responses to callers.

### `python/functions.py` (Persistent Python Worker)

**Purpose**: Python worker engine executing mathematical algorithms and ML helper functions in the background.

```python
import sys
import json

def apply_discount(book_data):
    price = book_data.get('price', 0)
    discount_pct = book_data.get('discount', 10)
    return round(price * (1 - discount_pct / 100.0), 2)

for line in sys.stdin:
    if not line.strip():
        continue
    request = json.loads(line)
    req_id = request.get('id')
    action = request.get('action')
    data = request.get('data')

    if action == 'apply_discount':
        result = apply_discount(data)
    else:
        result = {'error': f'Unknown action {action}'}

    sys.stdout.write(json.dumps({'id': req_id, 'result': result}) + '\n')
    sys.stdout.flush()
```

### `db/schema.cds` (CDS Entity Definitions)

**Purpose**: Declares core data entities (`Book`, `Author`, `Order`) and database associations for SAP HANA / SQLite.
