from slowapi import Limiter
from starlette.requests import Request


def get_real_ip(request: Request) -> str:
    """Use X-Real-IP from nginx if present, else fall back to socket peer."""
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=get_real_ip)
