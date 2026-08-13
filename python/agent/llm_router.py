"""Multi-Model Router & Automated Fallback Cascade Engine for SAP BTP Bookshop.

Strictly routes across the 4 configured SAP BTP Model Destinations with google/diffusiongemma-26b-a4b-it as Priority 1:
1. google/diffusiongemma-26b-a4b-it (Priority 1)
2. mistralai/mistral-nemotron
3. meta/llama-3.3-70b-instruct
4. z-ai/glm-5.2 (Fallback)
"""
import os
from python.agent.logger import log_warn, log_info, log_error

# Strictly the 4 Destination Models configured in SAP BTP Cockpit
DEFAULT_FALLBACK_CHAIN = [
    "google/diffusiongemma-26b-a4b-it",
    "google/gemma-4-31b-it",
    "z-ai/glm-5.2",
    "mistralai/mistral-nemotron",
]

def get_model_fallback_chain(requested_model: str = None) -> list[str]:
    """Build model failover chain strictly using the 4 configured BTP model destinations."""
    chain = []
    
    # 1. Primary requested model (if provided and valid)
    if requested_model and requested_model.strip():
        chain.append(requested_model.strip())

    # 2. Configured env primary model
    env_primary = os.environ.get("AI_MODEL", "").strip()
    if env_primary and env_primary not in chain:
        chain.append(env_primary)

    # 3. Environment override list (AI_MODEL_FALLBACKS="model1,model2,model3,model4")
    env_fallbacks = os.environ.get("AI_MODEL_FALLBACKS", "")
    if env_fallbacks:
        for m in env_fallbacks.split(","):
            m_clean = m.strip()
            if m_clean and m_clean not in chain:
                chain.append(m_clean)

    # 4. Strictly the 4 BTP destination models
    for default_m in DEFAULT_FALLBACK_CHAIN:
        if default_m not in chain:
            chain.append(default_m)

    return chain

def invoke_llm_chain_with_fallback(chain_factory_fn, payload: dict, requested_model: str = None) -> tuple[str, str]:
    """Execute LLM chain strictly against the 4 BTP destination model fallback cascade.

    Args:
        chain_factory_fn: Callable taking (model_name: str) -> LangChain RunnableChain
        payload: Prompt dictionary payload for chain invocation
        requested_model: Primary model identifier requested by client

    Returns:
        tuple[str, str]: (llm_answer: str, successful_model_used: str)
    """
    models_to_try = get_model_fallback_chain(requested_model)
    last_exception = None

    for idx, model_name in enumerate(models_to_try, start=1):
        try:
            log_info(f"Invoking destination model attempt {idx}/{len(models_to_try)}", model=model_name)
            chain = chain_factory_fn(model_name)
            response = chain.invoke(payload)
            answer = response.content
            if answer and answer.strip():
                log_info(f"Model invocation succeeded", model=model_name, attempt=idx)
                return answer, model_name
        except Exception as exc:
            last_exception = exc
            log_warn(
                f"Model attempt {idx}/{len(models_to_try)} failed for model '{model_name}': {exc}. Cascading to next model destination...",
                failed_model=model_name,
                next_attempt=idx + 1
            )

    # If all 4 model destinations fail, raise RuntimeError
    log_error("All 4 model destinations in fallback cascade chain failed", exc=last_exception)
    raise RuntimeError(f"All 4 BTP model destinations failed to complete request: {last_exception}")
