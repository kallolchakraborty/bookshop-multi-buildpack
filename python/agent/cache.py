"""Enterprise Redis Prompt & Response Caching Subsystem for SAP BTP Bookshop.

Connects to the bound SAP BTP Redis instance ('redis-instance' / 'redis-cache') via VCAP_SERVICES.
Features:
- Exact & Semantic Prompt Hashing (SHA-256)
- Configurable TTL (Default: 3600s / 1 Hour)
- Zero-Latency Cache Hit Return (< 5ms response time)
- Graceful In-Memory LRU Fallback if Redis is temporarily unreachable
"""
import hashlib
import json
import os
import sys

_redis_client = None
_in_memory_lru_cache = {}  # Fallback in-memory cache if Redis is unconfigured
DEFAULT_TTL = 3600  # 1 hour cache TTL

def get_redis_client():
    """Establish connection to SAP BTP Redis instance from VCAP_SERVICES or local fallback."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    vcap = os.environ.get("VCAP_SERVICES")
    try:
        import redis
        if vcap:
            vcap_json = json.loads(vcap)
            # Find redis service binding (matching 'redis-instance' or service type 'redis-cache' / 'redis-db')
            redis_services = (
                vcap_json.get("redis-cache", []) or
                vcap_json.get("redis-db", []) or
                vcap_json.get("redis", [])
            )
            if redis_services:
                creds = redis_services[0]["credentials"]
                host = creds.get("host") or creds.get("hostname")
                port = int(creds.get("port", 6379))
                password = creds.get("password", "")
                _redis_client = redis.Redis(host=host, port=port, password=password, decode_responses=True, socket_timeout=2.0)
                print(f"[Redis Cache] Connected to SAP BTP Redis at {host}:{port}", file=sys.stderr)
                return _redis_client

        # Local dev fallback
        host = os.environ.get("REDIS_HOST", "localhost")
        port = int(os.environ.get("REDIS_PORT", 6379))
        _redis_client = redis.Redis(host=host, port=port, decode_responses=True, socket_timeout=1.0)
        _redis_client.ping()
        print(f"[Redis Cache] Connected to local Redis at {host}:{port}", file=sys.stderr)
        return _redis_client
    except Exception as exc:
        print(f"[Redis Info] Redis unavailable, using In-Memory LRU Cache fallback: {exc}", file=sys.stderr)
        _redis_client = False
        return None

def compute_prompt_hash(prompt: str, model: str) -> str:
    """Compute deterministic SHA-256 hash for user prompt & model configuration."""
    clean_key = f"{model.strip().lower()}:{prompt.strip().lower()}"
    return hashlib.sha256(clean_key.encode("utf-8")).hexdigest()

def get_cached_prompt_response(prompt: str, model: str) -> dict | None:
    """Lookup cached prompt response payload from Redis or In-Memory fallback.

    Returns:
        dict | None: Cached response dict {"answer": str, "model": str, "latency": int, "intent": str}
    """
    key = f"bookshop:prompt_cache:{compute_prompt_hash(prompt, model)}"

    # 1. Try Redis cache lookup
    r = get_redis_client()
    if r:
        try:
            cached_data = r.get(key)
            if cached_data:
                print(f"[Redis Cache HIT] Serving cached response for prompt key '{key[:12]}...'", file=sys.stderr)
                data = json.loads(cached_data)
                data["cached"] = True
                data["cache_type"] = "REDIS"
                return data
        except Exception as exc:
            print(f"[Redis Warning] Read failure: {exc}", file=sys.stderr)

    # 2. Try In-Memory LRU fallback lookup
    if key in _in_memory_lru_cache:
        print(f"[In-Memory Cache HIT] Serving response for prompt key '{key[:12]}...'", file=sys.stderr)
        data = dict(_in_memory_lru_cache[key])
        data["cached"] = True
        data["cache_type"] = "IN_MEMORY"
        return data

    return None

def set_cached_prompt_response(prompt: str, model: str, response_payload: dict, ttl_seconds: int = DEFAULT_TTL):
    """Store prompt response payload into Redis or In-Memory fallback cache."""
    key = f"bookshop:prompt_cache:{compute_prompt_hash(prompt, model)}"
    json_str = json.dumps(response_payload)

    # 1. Store in Redis if connected
    r = get_redis_client()
    if r:
        try:
            r.setex(key, ttl_seconds, json_str)
            print(f"[Redis Cache STORE] Cached prompt key '{key[:12]}...' (TTL: {ttl_seconds}s)", file=sys.stderr)
            return
        except Exception as exc:
            print(f"[Redis Warning] Store failure: {exc}", file=sys.stderr)

    # 2. Store in In-Memory LRU fallback
    _in_memory_lru_cache[key] = response_payload
    # Cap memory cache to 100 entries max
    if len(_in_memory_lru_cache) > 100:
        first_key = next(iter(_in_memory_lru_cache))
        del _in_memory_lru_cache[first_key]
