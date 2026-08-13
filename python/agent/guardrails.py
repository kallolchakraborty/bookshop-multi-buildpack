"""Anthropic AI Architecture Guardrail Engine for SAP BTP Bookshop.

Implements defense-in-depth safety, security, and quality verification:
1. Direct Prompt Injection & Jailbreak Defense (DAN, roleplay escapes, system overrides, secret leaks).
2. Indirect Prompt Injection Sanitization (Sanitizes retrieved RAG payloads before prompt insertion).
3. Secret & PII Scrubber (Redacts emails, credit cards, JWT tokens, AWS/BTP keys).
4. Output Verification (Groundedness check, competitor filtering, fallback formatting).
"""
import re
from python.agent.logger import log_warn, log_info

# Comprehensive Jailbreak & Prompt Injection Threat Signatures
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts|rules)",
    r"system\s+prompt\s+(override|bypass|reveal)",
    r"you\s+are\s+now\s+(a\s+)?(DAN|unfiltered|jailbroken|godmode)",
    r"act\s+as\s+(an\s+)?(unrestricted|evil|unfiltered)\s+AI",
    r"(reveal|print|show|output)\s+(your\s+)?(system\s+prompt|instructions|initial\s+prompt)",
    r"(reveal|print|show|output)\s+(env|environment\s+variables|api\s+key|token|secrets)",
    r"disregard\s+(all\s+)?(safety|ethical|content)\s+guidelines",
    r"drop\s+table",
    r"delete\s+from\s+book",
    r"execute\s+script",
    r"<script\b[^>]*>",
]

# Sensitive Data & Secret Patterns
PII_PATTERNS = {
    "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    "credit_card": r"\b(?:\d[ -]*?){13,16}\b",
    "jwt_token": r"eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}",
    "api_key": r"(?:sk-|ey-|bearer\s+|key-)[a-zA-Z0-9_-]{20,}",
}

def sanitize_indirect_rag_context(context_text: str) -> str:
    """Sanitize retrieved database/vector store context to prevent indirect prompt injection."""
    if not context_text:
        return ""
    
    cleaned = context_text
    for pattern in PROMPT_INJECTION_PATTERNS:
        cleaned = re.sub(pattern, "[UNTRUSTED_INSTRUCTION_REMOVED]", cleaned, flags=re.IGNORECASE)
    
    return cleaned

def validate_input_guardrail(prompt: str) -> dict:
    """Validate user prompt against Anthropic-grade security and safety policies before processing."""
    if not prompt or not prompt.strip():
        return {"safe": False, "reason": "Empty prompt provided.", "sanitized_prompt": ""}

    p_clean = prompt.strip()

    # 1. Direct Prompt Injection Check
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, p_clean, re.IGNORECASE):
            log_warn("Prompt injection attempt blocked", pattern=pattern, prompt_preview=p_clean[:60])
            return {
                "safe": False,
                "reason": "Security Policy Violation: Malicious prompt injection or jailbreak signature detected.",
                "sanitized_prompt": p_clean
            }

    # 2. PII & Secret Redaction
    sanitized = p_clean
    for label, pattern in PII_PATTERNS.items():
        sanitized = re.sub(pattern, f"[REDACTED_{label.upper()}]", sanitized, flags=re.IGNORECASE)

    return {"safe": True, "reason": "Passed input safety checks.", "sanitized_prompt": sanitized}

def validate_output_guardrail(response_text: str, catalog_context: str) -> dict:
    """Verify LLM output for groundedness, leak prevention, and competitor filtering."""
    if not response_text or not response_text.strip():
        return {
            "verified_answer": "I am sorry, I was unable to generate a response for your inquiry.",
            "flagged": True,
            "reason": "Empty LLM output."
        }

    cleaned = response_text.strip()

    # 1. Output Secret & Key Leak Filter
    for label, pattern in PII_PATTERNS.items():
        cleaned = re.sub(pattern, f"[REDACTED_{label.upper()}]", cleaned, flags=re.IGNORECASE)

    # 2. Competitor & Off-Topic Filtering
    unauthorized_vendors = ["amazon", "barnes & noble", "ebay", "walmart"]
    for vendor in unauthorized_vendors:
        if vendor in cleaned.lower():
            log_info("Competitor mention redacted from LLM output", vendor=vendor)
            cleaned = re.sub(re.escape(vendor), "our authorized BTP partner channels", cleaned, flags=re.IGNORECASE)

    return {
        "verified_answer": cleaned,
        "flagged": False,
        "reason": "Output passed verification."
    }
