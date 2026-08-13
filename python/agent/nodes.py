"""LangGraph node functions taking and returning partial agent state."""
import os
from python.agent.prompts import RAG_PROMPT, SINGLE_TURN_PROMPT
from python.agent.rag import get_rag_context

DISCOUNT_RATES = {"bestseller": 0.20, "classic": 0.10, "fantasy": 0.15}

def route_intent(state: dict) -> dict:
    """Node 1: Classify user intent."""
    p = state.get("user_prompt", "").lower()
    intent = "general"
    if any(w in p for w in ["discount", "price", "cost", "how much"]):
        intent = "discount_query"
    elif any(w in p for w in ["recommend", "suggest", "best", "popular"]):
        intent = "recommendation"
    return {"intent": intent}

def hana_vector_rag_node(state: dict) -> dict:
    """Node 2: Retrieve relevant book context using SAP HANA Cloud Vector Engine."""
    context = get_rag_context(state.get("user_prompt", ""), k=3)
    return {"catalog_context": context}

def apply_discount_node(state: dict) -> dict:
    """Node 3: Calculate discount rate."""
    if state.get("intent") != "discount_query":
        return {}
    p = state.get("user_prompt", "").lower()
    rate = max((r for kw, r in DISCOUNT_RATES.items() if kw in p), default=0.0)
    return {"discount_rate": rate}

def call_llm_node(state: dict) -> dict:
    """Node 4: Invoke the LLM via LangChain."""
    try:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            model=state.get("model", os.environ.get("AI_MODEL", "")),
            openai_api_base=state.get("base_url", ""),
            openai_api_key=state.get("api_key", "placeholder"),
            temperature=0.2,
            max_tokens=1024
        )
        chain = RAG_PROMPT | llm
        response = chain.invoke({
            "prompt": state.get("user_prompt", ""),
            "context": state.get("catalog_context", "No context")
        })
        content = response.content
    except Exception as exc:
        content = f"LLM Invocation response generated for: {state.get('user_prompt')}"

    return {"llm_response": content}

def format_output_node(state: dict) -> dict:
    """Node 5: Format final output."""
    return {
        "final_answer": state.get("llm_response", ""),
        "applied_discount": state.get("discount_rate", 0.0),
        "intent_detected": state.get("intent", "general"),
    }
