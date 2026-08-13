# LangChain + LangGraph + LangSmith + RAG (SAP HANA Cloud Vector Engine) — Implementation Plan
## bookshop-multi-buildpack (SAP BTP Multi-Buildpack CAP App)

> **Status**: Planning
> **Target Runtime**: Python 3.10+ (co-located Python worker inside SAP BTP Cloud Foundry)
> **Target Database**: SAP HANA Cloud (BTP Trial compatible with native Vector Engine support)
> **Cost**: LangChain & LangGraph are **100% free / MIT open-source**. LangSmith has a **free tier (5,000 traces/month)**. SAP BTP Trial HANA Cloud is **free**.

---

## Table of Contents

1. [Overview & Motivation](#1-overview--motivation)
2. [Current Architecture Summary](#2-current-architecture-summary)
3. [What Each Tool Does in This Project](#3-what-each-tool-does-in-this-project)
4. [File-by-File Change Plan](#4-file-by-file-change-plan)
5. [Phase 1 — LangChain Drop-in Replacement](#phase-1--langchain-drop-in-replacement)
6. [Phase 2 — RAG via SAP HANA Cloud Vector Engine (BTP Trial)](#phase-2--rag-via-sap-hana-cloud-vector-engine-btp-trial)
7. [Phase 3 — LangGraph Agentic Workflow](#phase-3--langgraph-agentic-workflow)
8. [Phase 4 — LangSmith Observability](#phase-4--langsmith-observability)
9. [SAP BTP Buildpack & Environment Setup](#9-sap-btp-buildpack--environment-setup)
10. [Testing Plan](#10-testing-plan)
11. [Risks & Mitigations](#11-risks--mitigations)

---

## 1. Overview & Motivation

The current project uses a **raw `urllib`-based HTTP client** in `python/functions.py` to make OpenAI-compatible LLM calls. While functional, this approach:

- Lacks **prompt management** (no templates, no versioning)
- Has no **conversation memory** (each `/ai/ask` call is stateless)
- Cannot perform **Retrieval-Augmented Generation (RAG)** over the book catalog stored in HANA DB
- Cannot perform **multi-step reasoning** (e.g., semantic search → check stock → apply discount → recommend)
- Produces **no observability** into what prompts were sent, what the model responded, or why failures occurred

This plan introduces LangChain, LangGraph, LangSmith, and **SAP HANA Cloud Vector Engine RAG** to solve all of these problems while staying entirely within the existing Multi-Buildpack architecture.

**No breaking changes to the Node.js CAP layer or IPC bridge are required.**

---

## 2. Current Architecture Summary

```
Browser/Client
     │
     ▼ HTTP (OData V4 / REST)
┌──────────────────────────────────────┐
│  Node.js CAP Server (srv/)           │
│  @sap/cds + Express                  │
│                                      │
│  srv/ai-service.js  ─────────────────┼──► getAIDestination()
│  srv/cat-service.js ─────────────────┼     (resolves BTP Destination:
│  srv/python.js  ◄────────────────────┼      baseUrl + apiKey)
│     └─ JSON-RPC over stdin/stdout    │
└──────────┬───────────────────────────┘
           │ spawn (lazily, once per app run)
           ▼
┌──────────────────────────────────────┐
│  Python Worker (python/functions.py) │
│  --worker mode                       │
│                                      │
│  Actions:                            │
│  • discount  → apply_discount()      │
│  • ask       → ask_ai() via urllib   │
│  • ask_rag   → RAG via HANA Vector   │  ← NEW
│  • ask_agent → LangGraph Workflow    │  ← NEW
└──────────────────────────────────────┘
```

---

## 3. What Each Tool Does in This Project

| Tool | Role in This Project | Free / Trial Support? |
|------|---------------------|-----------------------|
| **LangChain** | Prompt templates, chat model abstraction, output parsers, conversation memory, RAG chains | ✅ 100% Free (MIT) |
| **SAP HANA Cloud Vector Engine** | Stores text embeddings in `Vector(1536)` columns and runs `COSINE_SIMILARITY()` searches | ✅ Included in BTP Trial (30 GB Memory, 2 vCPUs) |
| **LangGraph** | Stateful multi-step agent: `route → vector_rag_search → apply_discount → call_llm → format` | ✅ 100% Free (MIT) |
| **LangSmith** | Traces every LLM call + graph node execution; visible in web dashboard for debugging | ✅ Free up to 5,000 traces/mo |

---

## 4. File-by-File Change Plan

### Files to MODIFY

| File | What Changes |
|------|-------------|
| `db/schema.cds` | Add `descr : String(1000)` and `embedding : Vector(1536)` fields to `Book` entity |
| `python/functions.py` | Add `ask_rag()` and `ask_agent()` handler functions |
| `python/requirements.txt` | Add `langchain`, `langgraph`, `langsmith`, `langchain-openai`, `hdbcli` |
| `manifest.yml` | Add `LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT` env vars |

### Files to CREATE

| File | Purpose |
|------|---------|
| `python/agent/__init__.py` | Package init |
| `python/agent/rag.py` | SAP HANA Cloud Vector Store connection & RAG retriever module |
| `python/agent/prompts.py` | LangChain `ChatPromptTemplate` definitions |
| `python/agent/nodes.py` | Individual graph node functions (RAG search, discount lookup, LLM call, formatter) |
| `python/agent/graph.py` | LangGraph `StateGraph` definition (the agentic workflow) |

---

## Phase 1 — LangChain Drop-in Replacement

**Goal**: Replace the raw `urllib` LLM call in `ask_ai()` with a LangChain-managed chat model.
This is the lowest-risk first step — the existing IPC contract is fully preserved.

### 1.1 `python/requirements.txt`

```txt
# LangChain ecosystem
langchain>=0.3.0
langchain-core>=0.3.0
langchain-community>=0.3.0
langchain-openai>=0.2.0

# SAP HANA Cloud client (for HANA Vector Engine RAG)
hdbcli>=2.20.0

# LangGraph (agent orchestration)
langgraph>=0.2.0

# LangSmith (observability — optional, no-op if keys not set)
langsmith>=0.1.0

# Streaming helpers
httpx>=0.27.0
```

### 1.2 New `python/agent/prompts.py`

```python
"""Centralized prompt templates for the Bookshop AI assistant."""
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

BOOKSHOP_SYSTEM = (
    "You are a concise, helpful bookshop assistant for the SAP BTP Bookshop app. "
    "You have access to a catalog of books including pricing and stock information. "
    "When asked about books, give specific, actionable recommendations. "
    "Current active discount rates: Bestseller 20%, Classic 10%, Fantasy 15%."
)

SINGLE_TURN_PROMPT = ChatPromptTemplate.from_messages([
    ("system", BOOKSHOP_SYSTEM),
    ("human", "{prompt}"),
])

# RAG Prompt Template
RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are an expert SAP BTP Bookshop assistant. "
        "Answer the user's question using ONLY the retrieved book catalog context below.\n\n"
        "Retrieved Catalog Context:\n{context}\n\n"
        "Active Discounts: Bestsellers 20%, Classics 10%, Fantasy 15%."
    )),
    ("human", "{prompt}"),
])
```

---

## Phase 2 — RAG via SAP HANA Cloud Vector Engine (BTP Trial)

**Goal**: Store book vector embeddings in SAP HANA Cloud and retrieve relevant book descriptions using cosine similarity during user queries.

### 2.1 CDS Schema Update (`db/schema.cds`)

```cds
namespace kallol.bookshop;

/// A single book title sold in the shop.
entity Book {
  key ID      : Integer;
  title       : String(200);
  author      : Association to Author;
  stock       : Integer;
  price       : Decimal(9, 2);
  descr       : String(1000);        // Book description for semantic embedding
  embedding   : Vector(1536);        // Native SAP HANA Cloud REAL_VECTOR column
}
```

### 2.2 New `python/agent/rag.py` (HANA Vector Store Retriever)

```python
"""RAG module using SAP HANA Cloud Vector Engine (BTP Trial compatible)."""
import os
from hdbcli import dbapi
from langchain_community.vectorstores.hanavector import HanaDB
from langchain_openai import OpenAIEmbeddings

def get_hana_connection():
    """Establish direct connection to SAP HANA Cloud HDI container."""
    # VCAP_SERVICES parsed automatically in BTP Cloud Foundry
    vcap = os.environ.get("VCAP_SERVICES")
    if not vcap:
        # Fallback to env vars for local dev
        return dbapi.connect(
            address=os.environ.get("HANA_HOST", "localhost"),
            port=int(os.environ.get("HANA_PORT", "30015")),
            user=os.environ.get("HANA_USER", "SYSTEM"),
            password=os.environ.get("HANA_PASSWORD", "")
        )
    # Extract from VCAP_SERVICES
    import json
    vcap_json = json.loads(vcap)
    hana_creds = vcap_json["hana"][0]["credentials"]
    return dbapi.connect(
        address=hana_creds["host"],
        port=int(hana_creds["port"]),
        user=hana_creds["user"],
        password=hana_creds["password"],
        sslValidateCertificate=False
    )

def get_rag_context(query: str, k: int = 3) -> str:
    """Perform cosine similarity search against SAP HANA Cloud Vector Engine."""
    try:
        connection = get_hana_connection()
        embeddings = OpenAIEmbeddings(
            model=os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small"),
            openai_api_key=os.environ.get("AI_API_KEY", "")
        )
        
        db = HanaDB(
            connection=connection,
            embedding=embeddings,
            table_name="KALLOL_BOOKSHOP_BOOK"
        )
        
        docs = db.similarity_search(query, k=k)
        return "\n---\n".join([d.page_content for d in docs])
    except Exception as exc:
        print(f"[RAG Warning] HANA Vector Search fallback: {exc}")
        return "Catalog context unavailable (HANA connection uninitialized)."
```

---

## Phase 3 — LangGraph Agentic Workflow

**Goal**: Combine Intent Classification, SAP HANA Vector RAG, Discount Rules, and LLM Generation into a unified `StateGraph`.

### Graph Flow

```
[START]
   │
   ▼
route_intent          → Classify: "recommendation" / "discount_query" / "stock_query" / "general"
   │
   ▼
hana_vector_rag       → Perform SAP HANA Cloud REAL_VECTOR similarity search (if RAG needed)
   │
   ▼
apply_discount        → Calculate discount rate if intent = "discount_query"
   │
   ▼
call_llm              → LangChain ChatOpenAI call with RAG + catalog context
   │
   ▼
format_output         → Shape final response to match IPC contract
   │
   ▼
[END]
```

### 3.1 New `python/agent/nodes.py`

```python
"""LangGraph node functions taking and returning partial agent state."""
import os
from langchain_openai import ChatOpenAI
from python.agent.prompts import RAG_PROMPT
from python.agent.rag import get_rag_context

DISCOUNT_RATES = {"bestseller": 0.20, "classic": 0.10, "fantasy": 0.15}

def route_intent(state):
    p = state["user_prompt"].lower()
    intent = "general"
    if any(w in p for w in ["discount", "price", "cost", "how much"]):
        intent = "discount_query"
    elif any(w in p for w in ["recommend", "suggest", "best", "popular"]):
        intent = "recommendation"
    return {"intent": intent}

def hana_vector_rag_node(state):
    """Node 2: Retrieve relevant book context using SAP HANA Cloud Vector Engine."""
    context = get_rag_context(state["user_prompt"], k=3)
    return {"catalog_context": context}

def apply_discount_node(state):
    if state.get("intent") != "discount_query":
        return {}
    p = state["user_prompt"].lower()
    rate = max((r for kw, r in DISCOUNT_RATES.items() if kw in p), default=0.0)
    return {"discount_rate": rate}

def call_llm_node(state):
    llm = ChatOpenAI(
        model=state.get("model", os.environ.get("AI_MODEL", "")),
        openai_api_base=state.get("base_url", ""),
        openai_api_key=state.get("api_key", "placeholder"),
        temperature=0.2, max_tokens=1024
    )
    chain = RAG_PROMPT | llm
    response = chain.invoke({
        "prompt": state["user_prompt"],
        "context": state.get("catalog_context", "No context")
    })
    return {"llm_response": response.content}

def format_output_node(state):
    return {
        "final_answer": state.get("llm_response", ""),
        "applied_discount": state.get("discount_rate", 0.0),
        "intent_detected": state.get("intent", "general"),
    }
```

---

## Phase 4 — LangSmith Observability

**Goal**: Enable automatic tracing of every RAG retrieval and graph execution step.

### 4.1 Environment Variables

Add to `manifest.yml` for SAP BTP Cloud Foundry:
```yaml
env:
  PYTHON_BIN: python3
  NODE_ENV: production
  AI_MODEL: meta/llama-3.3-70b-instruct
  AI_TIMEOUT: "900"
  # ── LangSmith ──
  LANGCHAIN_TRACING_V2: "true"
  LANGCHAIN_ENDPOINT: "https://api.smith.langchain.com"
  LANGCHAIN_API_KEY: "<set-in-cf-env-not-in-git>"
  LANGCHAIN_PROJECT: "bookshop-multi-buildpack"
```

---

## 9. SAP BTP Buildpack & Environment Setup

### 9.1 BTP Trial HANA Cloud Notes
- **Automatic Nightly Pause**: Trial instances stop at midnight UTC. Simply restart via SAP BTP Cockpit → HANA Cloud Central if connection fails.
- **Resource Allocation**: Trial includes 30 GB Memory and 2 vCPUs (more than sufficient for vector search).

---

## 10. Testing Plan

```bash
# 1. Test vector search locally / against BTP Trial HANA
python3 -c "from python.agent.rag import get_rag_context; print(get_rag_context('SAP BTP'))"

# 2. Test agent end-to-end via IPC worker
echo '{"id":"req1","action":"ask_agent","prompt":"Recommend SAP books","stream":false}' \
  | python3 python/functions.py --worker
```

---

## 11. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| HANA Trial instance paused overnight | High | Graceful fallback in `python/agent/rag.py` to static context if connection times out |
| Large embeddings payload | Low | `text-embedding-3-small` creates 1536-dim vectors (~6 KB per book) |
| Missing `hdbcli` wheel on Cloud Foundry | Low | Standard SAP Python buildpack includes C++ compilation headers for `hdbcli` |

---

*Updated: 2026-08-13 | bookshop-multi-buildpack v1.1.0*
