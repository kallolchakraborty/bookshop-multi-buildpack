# bookshop-multi-buildpack

A SAP Business Technology Platform (BTP) application demonstrating Multi Buildpack deployment, combining Node.js (CAP/Express) with Python (Flask/ML) in a single Cloud Foundry container.

## What's Inside

This repository contains two parts:
1. **The Application** — A complete SAP BTP CAP bookshop app with:
   - Node.js runtime (Express/CAP OData service)
   - Python runtime (discount math + AI ask action)
   - Multi-buildpack deployment (`manifest.yml`)
   - Destination-backed AI integration (`/ai/ask`)
   - Full test suite (`test/`)
   - Database schema and sample data (`db/`)

2. **The Documentation Website** — A searchable, beginner-friendly developer guide with:
   - Architecture diagrams with theme-aware animations
   - Step-by-step setup instructions
   - Configuration for Production / Local / Hybrid modes
   - Download button for the example project
   - Advanced Fuse.js search with keyboard navigation

## Quick Start — Application

```bash
# Install dependencies
npm install

# Run locally
npm start

# Run tests
npm test

# Build for production
npm run build
```

## Quick Start — Documentation Website

```bash
# Build documentation
npm run docs:build

# Serve documentation locally
npm run docs:start
# Visit http://localhost:3000
```

## Deploy to SAP BTP

```bash
# Create services
cf create-service xsuaa application bookshop-xsuaa
cf create-service destination lite bookshop-destination
cf create-service hana cloud hdi-shared bookshop-db

# Deploy
cf push
```

## Documentation

Full documentation available at [https://yourusername.github.io/bookshop-multi-buildpack/](https://yourusername.github.io/bookshop-multi-buildpack/)

## License

MIT
