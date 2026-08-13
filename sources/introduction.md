# Bookshop Multi Buildpack

## What is This Project?

**bookshop-multi-buildpack** is a SAP Business Technology Platform (BTP) application that demonstrates the power of **Multi Buildpack** deployment. It combines a **Node.js** frontend (CAP/Express service) with a **Python** backend (ML/AI service) into a single deployable unit using the Multi Buildpack feature of SAP BTP Cloud Foundry.

## Why Multi Buildpack?

Single buildpack deployments are limited to one runtime environment. Multi Buildpack allows you to:
- Run multiple languages/runtimes in the same application container
- Keep frontend and backend concerns separated but co-located
- Leverage the strengths of Node.js for HTTP/OData/API and Python for ML/Data processing
- Simplify deployment topology without managing multiple applications

## High-Level Architecture

The application combines Node.js and Python runtimes in a single SAP BTP Cloud Foundry container, orchestrated by `server.js`.

![Architecture Diagram](assets/diagrams/architecture.svg)

## Key Features

- **Dual Runtime**: Node.js (CAP/Express) + Python (Flask/FastAPI) in one container
- **AI Integration**: `/ai/chat` endpoint with XSUAA-secured destinations
- **Service Mesh**: Seamless binding to SAP BTP services (XSUAA, Destination, AI Core)
- **Multi-Environment**: Production, local, and hybrid deployment configurations
- **Automated Testing**: Integration tests for both runtimes and service bindings
- **Developer Friendly**: Beginner-ready guide with downloadable source
