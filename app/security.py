import hashlib
import secrets
import time
from collections import defaultdict, deque
from threading import Lock
import httpx
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import HTTPException

hasher = PasswordHasher()
DUMMY_HASH = hasher.hash("constant-comparison-password-not-an-account")


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def token():
    return secrets.token_urlsafe(32)


def verify_password(encoded, password):
    try:
        return hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


class Limiter:
    def __init__(self, redis_url=""):
        self.redis = None
        self.hits = defaultdict(deque)
        self.lock = Lock()
        if redis_url:
            import redis
            self.redis = redis.Redis.from_url(redis_url)
            self.redis.ping()

    def check(self, key, limit=30, seconds=60):
        key = "findback:limit:" + digest(key)
        if self.redis:
            # Atomic increment + expiry, shared across production workers.
            count = self.redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, key, seconds)
        else:
            with self.lock:
                current = time.monotonic()
                if len(self.hits) > 10000:
                    for old in list(self.hits):
                        if not self.hits[old] or current - self.hits[old][-1] >= seconds:
                            del self.hits[old]
                q = self.hits[key]
                while q and q[0] <= current - seconds:
                    q.popleft()
                q.append(current)
                count = len(q)
        if count > limit:
            raise HTTPException(429, "Too many requests. Please try again later.", headers={"Retry-After": str(seconds)})


def verify_bot(settings, challenge, action):
    if settings.environment != "production" and settings.dev_bot_bypass:
        return
    if not settings.turnstile_secret_key:
        raise HTTPException(503, "Bot protection is not configured. Contact the operator.")
    try:
        result = httpx.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", data={"secret": settings.turnstile_secret_key, "response": challenge}, timeout=10).json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Bot protection is temporarily unavailable")
    from urllib.parse import urlparse
    if not result.get("success") or result.get("action") != action or result.get("hostname") != urlparse(settings.public_origin).hostname:
        raise HTTPException(400, "Please complete the security check again")

