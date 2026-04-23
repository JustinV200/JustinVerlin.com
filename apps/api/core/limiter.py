from slowapi import Limiter
from slowapi.util import get_remote_address
#gets the ip address of the client making the request, and uses it as the key for rate limiting. This way, each client is limited based on their own IP address.
limiter = Limiter(key_func=get_remote_address)
