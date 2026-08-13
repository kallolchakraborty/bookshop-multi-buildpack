"""Pure-Python functions used by the CAP Node.js bookshop.

Two modes:
  * one-shot (default): reads a single JSON document from stdin, writes one to stdout
  * --worker            : persistent line-based JSON-RPC over stdin/stdout, so the
                          Node.js process pays the interpreter startup cost only once

Protocol: each line is one compact JSON document; responses arrive in request order.

The AI "ask" action calls the OpenAI-compatible chat completions endpoint in
Python (mirroring the provided client sample), while all other app logic stays
in Node.js. Connection values are injected by Node (BTP destination resolution)
or taken from the environment: AI_BASE_URL, AI_API_KEY, AI_MODEL.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request


DISCOUNT_RATES = {
    "bestseller": 0.20,
    "classic": 0.10,
    "fantasy": 0.15,
}

AI_BASE_URL = os.environ.get("AI_BASE_URL", "").rstrip("/")
AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_MODEL = os.environ.get("AI_MODEL", "")
AI_PATH = os.environ.get("AI_PATH", "/chat/completions")
AI_TIMEOUT = float(os.environ.get("AI_TIMEOUT", "60"))

# LLM request parameters; all overridable via environment.
AI_TEMPERATURE = float(os.environ.get("AI_TEMPERATURE", "0.2"))
AI_TOP_P = float(os.environ.get("AI_TOP_P", "0.7"))
AI_MAX_TOKENS = int(os.environ.get("AI_MAX_TOKENS", "1024"))
AI_STREAM = os.environ.get("AI_STREAM", "false").lower() in ("1", "true", "yes")
AI_SYSTEM_PROMPT = os.environ.get(
    "AI_SYSTEM_PROMPT", "You are a concise, helpful bookshop assistant."
)


def sanitize(text):
    return re.sub(r"[^a-z0-9 ]", "", str(text).lower())


def apply_discount(payload):
    """Return discounted price for a book based on title keywords."""
    title = payload.get("title", "")
    price = float(payload.get("price", 0))
    norm = sanitize(title)
    rate = 0.0
    for keyword, r in DISCOUNT_RATES.items():
        if keyword in norm:
            rate = max(rate, r)
    return {
        "original": price,
        "discounted": round(price * (1 - rate), 2),
        "rate": rate,
    }


def ask_ai(payload, emit=None):
    """Call the OpenAI-compatible chat completions endpoint (model + parameters
    follow the meta/llama-3.3-70b-instruct sample) and return the answer.

    When ``emit`` is given, ``stream=True`` is sent to the provider and each
    content delta is delivered via ``emit(token)`` as it arrives.
    """
    prompt = payload.get("prompt", "")
    model = payload.get("model") or AI_MODEL
    base_url = payload.get("baseUrl") or AI_BASE_URL
    api_key = payload.get("apiKey") or AI_API_KEY
    if not base_url:
        raise RuntimeError("AI_BASE_URL is not configured (no destination available)")
    if not model:
        raise RuntimeError("AI_MODEL is not configured")

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": AI_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": AI_TEMPERATURE,
        "top_p": AI_TOP_P,
        "max_tokens": AI_MAX_TOKENS,
        "stream": emit is not None,
    }
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    started = time.time() * 1000
    request = urllib.request.Request(
        base_url + AI_PATH,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=AI_TIMEOUT) as response:
            if emit is None:
                data = json.loads(response.read().decode("utf-8"))
                answer = (data.get("choices") or [{}])[0].get("message", {}).get("content")
            else:
                answer = _read_stream(response, emit)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise RuntimeError(f"AI API returned HTTP {exc.code}: {detail}") from exc

    if not answer:
        raise RuntimeError("AI API returned no answer")
    return {
        "answer": answer,
        "model": model,
        "latency": int(time.time() * 1000 - started),
    }


def _read_stream(response, emit):
    """Consume an SSE `data:` stream, emitting deltas and returning the text."""
    answer = ""
    for raw in response:
        line = raw.decode("utf-8", "replace").strip()
        if not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            continue
        try:
            obj = json.loads(data)
        except ValueError:
            continue
        delta = (obj.get("choices") or [{}])[0].get("delta", {}).get("content")
        if delta:
            answer += delta
            emit(delta)
    return answer

def ask_agent(payload, emit=None):
    """LangGraph + SAP HANA Vector Engine RAG Agent workflow handler."""
    try:
        from python.agent.graph import bookshop_graph
        if bookshop_graph is not None:
            model = payload.get("model") or AI_MODEL
            base_url = (payload.get("baseUrl") or AI_BASE_URL).rstrip("/")
            api_key = payload.get("apiKey") or AI_API_KEY

            initial_state = {
                "user_prompt": payload.get("prompt", ""),
                "model": model,
                "base_url": base_url,
                "api_key": api_key,
                "streaming": emit is not None,
                "chat_history": [],
                "catalog_context": "",
                "intent": "",
                "discount_rate": 0.0,
                "llm_response": "",
                "final_answer": "",
                "applied_discount": 0.0,
                "intent_detected": "",
            }

            started = time.time() * 1000
            res = bookshop_graph.invoke(initial_state)
            answer = res.get("final_answer", "")
            if emit:
                for char in answer:
                    emit(char)
            return {
                "answer": answer,
                "model": model,
                "latency": int(time.time() * 1000 - started),
                "intent": res.get("intent_detected", "general"),
                "discount_applied": res.get("applied_discount", 0.0),
            }
    except Exception as exc:
        print(f"[Agent Fallback] Using ask_ai fallback: {exc}")

    # Fallback to standard ask_ai if LangGraph/LangChain packages aren't present
    return ask_ai(payload, emit=emit)


ACTIONS = {
    "discount": apply_discount,
    "ask": ask_ai,
    "ask_rag": ask_agent,
    "ask_agent": ask_agent,
}


def handle(payload):
    action = payload.get("action", "discount")
    fn = ACTIONS.get(action)
    if fn is None:
        return {"error": f"unknown action: {action}"}
    return fn(payload)


def write(payload):
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def main():
    write(handle(json.load(sys.stdin)))


def worker():
    # Results are written in request order, so the Node bridge pairs each line
    # with the matching request via a simple FIFO queue. Streaming "ask" calls
    # emit one {event:'delta'} line per token and a final {event:'done'} line,
    # all carrying the request's id so the bridge can route them correctly.
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        payload = json.loads(line)
        rid = payload.get("id", 0)  # Node wraps each request with a unique id
        try:
            action = payload.get("action", "discount")
            if action == "ask" and payload.get("stream"):
                def emit(token, id=rid):
                    write({"id": id, "event": "delta", "token": token})
                result = ask_ai(payload, emit=emit)
                write({"id": rid, "event": "done", **result})
            else:
                write({"id": rid, **handle(payload)})
        except Exception as exc:  # keep the worker alive on bad input/provider errors
            write({"id": rid, "event": "done", "error": repr(exc)})


if __name__ == "__main__":
    worker() if "--worker" in sys.argv else main()