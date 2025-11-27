"""
Security utilities - JWT tokens and password hashing
"""
import jwt
import time
import bcrypt
from datetime import datetime, timedelta
from typing import Dict, Any

from app.core.config import settings


def hash_password(password: str) -> str:
    """Hash a password for storing"""
    # Convert password to bytes and hash with bcrypt
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(user_id: int, tenant_id: int, role: str, shop_ids: list, remember_me: bool = False) -> str:
    """
    Create JWT access token

    Args:
        user_id: User ID
        tenant_id: Tenant/Organization ID
        role: User role (owner, admin, creator, viewer)
        shop_ids: List of shop IDs user has access to
        remember_me: If True, extends token expiry to 30 days

    Returns:
        Encoded JWT token string
    """
    now = int(time.time())

    # Use extended TTL if remember_me is enabled
    if remember_me:
        ttl_seconds = settings.REMEMBER_ME_TTL_DAYS * 24 * 60 * 60  # Convert days to seconds
    else:
        ttl_seconds = settings.JWT_TTL_SECONDS

    payload = {
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "role": role,
        "shop_ids": shop_ids,
        "iat": now,
        "exp": now + ttl_seconds,
        "remember_me": remember_me
    }

    return jwt.encode(payload, settings.JWT_PRIVATE_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode and verify JWT token
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded payload dictionary
    
    Raises:
        jwt.InvalidTokenError: If token is invalid or expired
    """
    return jwt.decode(
        token, 
        settings.JWT_PUBLIC_KEY, 
        algorithms=[settings.JWT_ALGORITHM],
        audience=settings.JWT_AUDIENCE,
        issuer=settings.JWT_ISSUER
    )