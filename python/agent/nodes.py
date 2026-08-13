"""LangGraph node functions taking and returning partial agent state."""
import os
import sys
import time
from python.agent.prompts import RAG_PROMPT, SINGLE_TURN_PROMPT
from python.agent.rag import get_rag_context
from python.agent.guardrails import validate_input_guardrail, validate_output_guardrail

DISCOUNT_RATES = {"bestseller": 0.20, "classic": 0.10, "fantasy": 0.15}

def invoke_llm_with_resilience(chain, payload: dict, max_retries: int = 3) -> str:
    """Resilience & Retry Harnessing: Executes LLM chain with exponential backoff on transient network/API failures."""
    delay = 1.0
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            response = chain.invoke(payload)
            return response.content
        except Exception as exc:
            last_error = exc
            print(f"[LLM Resilience Retry] Attempt {attempt}/{max_retries} failed: {exc}. Retrying in {delay}s...", file=sys.stderr)
            if attempt < max_retries:
                time.sleep(delay)
                delay *= 2.0
    
    raise last_error

def input_guardrail_node(state: dict) -> dict:
    """Node 0: Validate input for direct prompt injection and PII sanitization."""
    prompt = state.get("user_prompt", "")
    res = validate_input_guardrail(prompt)
    if not res["safe"]:
        return {
            "blocked": True,
            "user_prompt": res["sanitized_prompt"],
            "llm_response": f"Request blocked by safety policy: {res['reason']}"
        }
    return {"blocked": False, "user_prompt": res["sanitized_prompt"]}

def route_intent(state: dict) -> dict:
    """Node 1: Classify user intent."""
    if state.get("blocked"):
        return {"intent": "blocked"}
    p = state.get("user_prompt", "").lower()
    intent = "general"
    if any(w in p for w in ["discount", "price", "cost", "how much"]):
        intent = "discount_query"
    elif any(w in p for w in ["recommend", "suggest", "best", "popular", "book", "read"]):
        intent = "recommendation"
    return {"intent": intent}

def hana_vector_rag_node(state: dict) -> dict:
    """Node 2: Retrieve relevant book context conditionally using SAP HANA Cloud Vector Engine."""
    if state.get("blocked"):
        return {"catalog_context": ""}
    intent = state.get("intent", "general")
    if intent not in ("recommendation", "discount_query"):
        return {"catalog_context": "No catalog retrieval required for general query."}
    
    context = get_rag_context(state.get("user_prompt", ""), k=3)
    return {"catalog_context": context}

def apply_discount_node(state: dict) -> dict:
    """Node 3: Calculate discount rate."""
    if state.get("blocked") or state.get("intent") != "discount_query":
        return {"discount_rate": 0.0}
    p = state.get("user_prompt", "").lower()
    rate = max((r for kw, r in DISCOUNT_RATES.items() if kw in p), default=0.0)
    return {"discount_rate": rate}

def call_llm_node(state: dict) -> dict:
    """Node 4: Invoke the LLM via Multi-Model Router & Automated Fallback Cascade."""
    if state.get("blocked"):
        return {}

    base_url = (state.get("base_url") or os.environ.get("AI_BASE_URL", "")).rstrip("/")
    api_key = state.get("api_key") or os.environ.get("AI_API_KEY", "placeholder")
    requested_model = state.get("model") or os.environ.get("AI_MODEL", "meta/llama-3.3-70b-instruct")

    discount_rate = state.get("discount_rate", 0.0)
    discount_str = f"{int(discount_rate * 100)}%" if discount_rate > 0 else "0%"
    payload = {
        "prompt": state.get("user_prompt", ""),
        "context": f"{state.get('catalog_context', 'No context')}\nCalculated Applicable Discount: {discount_str}"
    }

    def chain_factory(model_name: str):
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            model=model_name,
            openai_api_base=base_url if base_url else None,
            openai_api_key=api_key,
            temperature=0.2,
            max_tokens=1024
        )
        return RAG_PROMPT | llm

    try:
        from python.agent.llm_router import invoke_llm_chain_with_fallback
        content, model_used = invoke_llm_chain_with_fallback(chain_factory, payload, requested_model)
    except Exception as exc:
        print(f"[LLM Node Error] {exc}", file=sys.stderr)
        content = f"I am your SAP BTP Bookshop AI Assistant. Response for: '{state.get('user_prompt')}'"
        model_used = requested_model

    return {"llm_response": content, "model_used": model_used}

def output_guardrail_node(state: dict) -> dict:
    """Node 5: Verify LLM output for groundedness, leak prevention, and competitor filtering."""
    if state.get("blocked"):
        return {}
    res = validate_output_guardrail(
        response_text=state.get("llm_response", ""),
        catalog_context=state.get("catalog_context", "")
    )
    return {"llm_response": res["verified_answer"]}

def format_output_node(state: dict) -> dict:
    """Node 6: Format final output and update conversation history memory."""
    answer = state.get("llm_response", "")
    prompt = state.get("user_prompt", "")
    
    # Update chat history memory list
    history = list(state.get("chat_history", []))
    if prompt and answer:
        history.append({"user": prompt, "assistant": answer})
    
    return {
        "final_answer": answer,
        "applied_discount": state.get("discount_rate", 0.0),
        "intent_detected": state.get("intent", "general"),
        "chat_history": history,
    }
