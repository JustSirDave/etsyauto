"""
Application Configuration
Using Pydantic Settings for environment variable management
"""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    APP_NAME: str = "Etsy Automation Platform"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/etsy_platform"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_PRIVATE_KEY: str = ""
    JWT_PUBLIC_KEY: str = ""
    JWT_ALGORITHM: str = "RS256"
    JWT_ISSUER: str = "api"
    JWT_AUDIENCE: str = "api"
    JWT_TTL_SECONDS: int = 300  # 5 minutes

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Load JWT keys from files
        try:
            with open('private.pem', 'r') as f:
                self.JWT_PRIVATE_KEY = f.read()
            with open('public.pem', 'r') as f:
                self.JWT_PUBLIC_KEY = f.read()
        except FileNotFoundError:
            print("Warning: JWT key files not found. Authentication will not work.")

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Etsy API
    ETSY_CLIENT_ID: str = ""
    ETSY_CLIENT_SECRET: str = ""
    ETSY_REDIRECT_URI: str = "http://localhost:3000/api/auth/callback/etsy"
    ETSY_API_BASE_URL: str = "https://openapi.etsy.com/v3"
    ETSY_RATE_LIMIT_CAPACITY: int = 100
    ETSY_RATE_LIMIT_REFILL_PER_SEC: float = 0.5

    # AI Providers
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    AI_DEFAULT_MODEL: str = "gpt-4o-mini"
    AI_MAX_TOKENS: int = 1000
    AI_TEMPERATURE: float = 0.7

    # Printful API
    PRINTFUL_API_KEY: str = ""
    PRINTFUL_API_BASE_URL: str = "https://api.printful.com"

    # Feature Flags
    ENABLE_PRINTFUL_SYNC: bool = False
    ENABLE_SCHEDULED_PUBLISHING: bool = True
    ENABLE_AI_GENERATION: bool = True

    # Monitoring
    SENTRY_DSN: str = ""

    # Storage (optional)
    S3_BUCKET: str = ""
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # Security
    ENCRYPTION_KEY: str = ""  # 32-byte key for AES-GCM

    # Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Etsy Automation Platform"
    FRONTEND_URL: str = "http://localhost:3000"

    # Auth Configuration
    EMAIL_VERIFICATION_REQUIRED: bool = True
    VERIFICATION_TOKEN_EXPIRY_HOURS: int = 24
    RESET_TOKEN_EXPIRY_HOURS: int = 1
    MAX_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 30
    REMEMBER_ME_TTL_DAYS: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )


# Global settings instance
settings = Settings()
