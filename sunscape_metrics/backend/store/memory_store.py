"""
Temporary in-process storage for the prototype.

No database is used. Everything here lives in the Flask process and disappears
when the server restarts, which is acceptable (and intentional) for a
prototype: the store only holds a cache of upstream responses, the area the
user last selected, and the counters used by the rate limiter.
"""

import threading
import time

_lock = threading.Lock()

# key -> (expires_at_epoch, value)
_cache = {}

# arbitrary small key/value scratch space (e.g. selected area)
_session = {}

# client_ip -> (window_start_epoch, request_count)
_rate_buckets = {}

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

def cache_get(key):
    """Return the cached value for ``key`` or ``None`` if absent/expired."""
    now = time.time()
    with _lock:
        entry = _cache.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if expires_at < now:
            _cache.pop(key, None)
            return None
        return value

def cache_set(key, value, ttl_seconds):
    """Store ``value`` under ``key`` for ``ttl_seconds``."""
    with _lock:
        _cache[key] = (time.time() + ttl_seconds, value)
        return value

def cache_clear():
    with _lock:
        _cache.clear()

def cache_stats():
    now = time.time()
    with _lock:
        live = sum(1 for expires_at, _ in _cache.values() if expires_at >= now)
        return {"entries": len(_cache), "live_entries": live}

# ---------------------------------------------------------------------------
# Session scratch space
# ---------------------------------------------------------------------------

def set_value(key, value):
    with _lock:
        _session[key] = value
        return value

def get_value(key, default=None):
    with _lock:
        return _session.get(key, default)

def snapshot():
    with _lock:
        return dict(_session)

# ---------------------------------------------------------------------------
# Rate limiting - fixed window counter per client
# ---------------------------------------------------------------------------

def hit_rate_limit(client_id, limit, window_seconds):
    """Record a request from ``client_id``.

    Returns ``(allowed, remaining, retry_after_seconds)``.
    """
    now = time.time()
    with _lock:
        window_start, count = _rate_buckets.get(client_id, (now, 0))
        if now - window_start >= window_seconds:
            window_start, count = now, 0

        count += 1
        _rate_buckets[client_id] = (window_start, count)

        if count > limit:
            retry_after = int(window_seconds - (now - window_start)) + 1
            return False, 0, max(retry_after, 1)

        return True, limit - count, 0