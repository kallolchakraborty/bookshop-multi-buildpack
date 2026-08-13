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

**Purpose**: Centralized connectivity configuration for outbound systems

**Destination Creation Details**:

1. **Via SAP BTP Cockpit**:
   - Navigate to subaccount → Connectivity → Destinations
   - Click "New Destination"
   - Fill in the configuration (see table below)

2. **Via BTP CLI**:
   ```bash
   btp set accounts/enablement
   btp get destinations/instance-key
   btp create destinations/config \
     --name python-service \
     --host my-destination-host \
     --path / \
     --destination-type HTTP
   ```

**Destination Configuration Table**:

| Property | Value | Description |
|----------|-------|-------------|
| Name | `python-service` | Unique destination name |
| Type | `HTTP` | HTTP destination type |
| URL | `http://localhost:5000` | Backend URL |
| Proxy Type | `OnPremise` or `Internet` | Network proxy setting |
| Authentication | `NoAuthentication` | Internal service, no auth |
| WebIDEEnabled | `true` | Enable for development |
| WebIDEUsage | `odata_abap,dev_abap` | Usage context |

**Destination for /ai/chat with Authentication**:
```json
{
  "name": "ai-core-service",
  "type": "HTTP",
  "url": "https://api.ai.core.sap/v2",
  "proxyType": "Internet",
  "authentication": "OAuth2UserTokenExchange",
  "scope": "$XSAPPNAME.bookshop-ai",
  "WebIDEEnabled": true,
  "WebIDEUsage": "odata_abap,api_abap"
}
```

**Does /ai/chat support destinations with authentication?**  
**YES**. The `/ai/chat` endpoint supports destinations with authentication, specifically:
- **OAuth2UserTokenExchange**: Recommended for AI services requiring user context propagation
- **OAuth2ClientCredentials**: For service-to-service AI calls
- **BasicAuthentication**: For simple backend AI APIs
- **PrincipalPropagation**: For end-to-end user identity propagation

The application reads the destination configuration at runtime:
```javascript
const destination = await destinationService.getDestination({
  destinationName: 'ai-core-service'
});
const auth = destination.getAuthentication();
// Handles OAuth2UserTokenExchange, OAuth2ClientCredentials, etc.
```

### 3. Cloud Foundry Application Runtime

**Purpose**: Hosting platform for the multi-buildpack application

### 4. Optional Services

| Service | Purpose | Required |
|---------|---------|----------|
| HANA Cloud | Persistent database for books, users | Yes |
| AI Core | ML model deployment and serving | Recommended |
| Email Service | Notifications and password reset | Optional |
| Redis | Session caching and rate limiting | Recommended |

## Service Bindings in Manifest

```yaml
services:
  - bookshop-xsuaa
  - bookshop-destination
  - bookshop-hana
  - bookshop-ai-core

env:
  destinations: '[{"name":"python-service","url":"http://localhost:5000"}]'
```
