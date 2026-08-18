# Libraries and Dependencies

## Node.js Dependencies (`package.json`)

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@sap/cds` | `^10.0.5` | SAP Cloud Application Programming Model (OData V4, CQL, service gateway) |
| `@sap-cloud-sdk/connectivity` | `^4.8.0` | Zero-hardcoding BTP Destination Auto-Selection Engine |
| `@sap-cloud-sdk/http-client` | `^4.8.0` | Authenticated outbound HTTP via BTP Destinations |
| `@sap-cloud-sdk/resilience` | `^4.8.0` | Resilient HTTP (timeouts, retries) for destination calls |
| `@cap-js/hana` | `^3.0.2` | SAP HANA Cloud DB adapter for CDS |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@cap-js/sqlite` | `^3.0.2` | In-memory SQLite for local dev/testing (no HANA needed) |
| `@sap/cds-dk` | `^10.0.7` | `cds` CLI — build, deploy, watch |
| `@sap/hdi-deploy` | `^5.7.0` | SAP HANA HDI container deployer |

---

## Python Dependencies (`python/requirements.txt`)

### Core Database, Redis & Networking

| Package | Version | Purpose |
|---------|---------|---------|
| `hdbcli` | `>=2.20.0` | SAP HANA Cloud Python client for `REAL_VECTOR(1536)` embeddings & `COSINE_SIMILARITY()` search |
| `redis` | `>=5.0.0` | SAP BTP `redis-instance` client for prompt/response caching (< 5ms TTL lookups) |
| `httpx` | `>=0.27.0` | Async HTTP streaming client (SSE token streaming to `/ai/ask/stream`) |
