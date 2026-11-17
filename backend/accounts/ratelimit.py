from django.core.cache import cache


def hit(key: str, limit: int, window: int) -> bool:
    """Count one hit. Returns True if still within the limit."""
    k = f"rl:{key}"
    n = cache.get(k, 0) + 1
    if n == 1:
        cache.set(k, n, timeout=window)
    else:
        try:
            cache.incr(k)
        except ValueError:
            cache.set(k, n, timeout=window)
    return n <= limit


def client_ip(request) -> str:
    return request.META.get("REMOTE_ADDR", "")
