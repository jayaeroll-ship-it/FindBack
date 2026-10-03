from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: str = "development"
    database_url: str = "sqlite:///./data/findback.db"
    public_origin: str = "http://localhost:5173"
    allowed_hosts: str = "localhost,127.0.0.1,testserver"
    upload_dir: Path = Path("./data/uploads")
    model_cache: Path = Path("./data/models")
    frontend_dist: Path = Path("../frontend/dist")
    embedding_model: str = "clip-ViT-B-32"
    embedding_local_only: bool = False
    match_weights: str = "0.40,0.30,0.15,0.10,0.05"
    match_threshold: float = 0.4
    cookie_secure: bool = False
    session_hours: int = 24
    require_moderation: bool = False
    dev_bot_bypass: bool = False
    turnstile_site_key: str = ""
    turnstile_secret_key: str = ""
    redis_url: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True
    operator_name: str = "[CONFIGURE OPERATOR NAME]"
    contact_email: str = "[CONFIGURE CONTACT EMAIL]"
    retention_days: int = 0
    analytics_script_url: str = ""
    analytics_domain: str = ""
    analytics_provider: str = "off"
    social_profile_url: str = ""

    def validate_runtime(self):
        from urllib.parse import urlparse
        parsed_origin = urlparse(self.public_origin)
        if parsed_origin.scheme not in ("http", "https") or not parsed_origin.hostname or parsed_origin.query or parsed_origin.fragment or parsed_origin.username:
            raise ValueError("PUBLIC_ORIGIN must be a valid HTTP(S) origin")
        if self.analytics_provider not in ("off", "internal"):
            raise ValueError("ANALYTICS_PROVIDER must be off or internal")
        weights = [float(w) for w in self.match_weights.split(",")]
        if len(weights) != 5 or min(weights) < 0 or sum(weights) <= 0:
            raise ValueError("MATCH_WEIGHTS requires five nonnegative weights")
        if not 0 <= self.match_threshold <= 1 or self.session_hours <= 0:
            raise ValueError("Invalid matching threshold or session lifetime")
        if urlparse(self.public_origin).path not in ("", "/"):
            raise ValueError("PUBLIC_ORIGIN must be an origin without a path")
        if self.analytics_script_url and not self.analytics_script_url.startswith("https://"):
            raise ValueError("Analytics script must use HTTPS")
        if self.social_profile_url and not self.social_profile_url.startswith("https://"):
            raise ValueError("Social profile must use HTTPS")
        if self.environment == "production":
            required = {
                "PostgreSQL": self.database_url.startswith("postgresql+psycopg://"),
                "HTTPS public origin": self.public_origin.startswith("https://"),
                "Secure cookies": self.cookie_secure,
                "Turnstile credentials": self.turnstile_site_key and self.turnstile_secret_key,
                "No development bot bypass": not self.dev_bot_bypass,
                "Redis shared rate limiter": self.redis_url,
                "SMTP sender": self.smtp_host and self.smtp_from and self.smtp_starttls,
                "Moderation": self.require_moderation,
                "Operator and retention": "[" not in self.operator_name and "@" in self.contact_email and self.retention_days > 0,
                "Explicit hosts": "*" not in self.allowed_hosts,
            }
            missing = [name for name, ok in required.items() if not ok]
            if missing:
                raise ValueError("Production configuration missing: " + ", ".join(missing))

