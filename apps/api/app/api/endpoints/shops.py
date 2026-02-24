"""
Shops API Endpoints - Etsy OAuth Integration
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import logging
import redis
import json

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.api.dependencies import (
    get_user_context,
    UserContext,
    require_permission,
    require_shop_access
)
from app.core.rbac import Permission
from app.core.query_helpers import filter_by_tenant, ensure_shop_access
from app.models.tenancy import Shop, OAuthToken, Membership, ConnectLink
from app.services.etsy_oauth import etsy_oauth, EtsyOAuthService
from app.services.encryption import token_encryptor
from app.services.token_manager import TokenManager
from app.core.config import settings
from app.core.security import check_rate_limit, rate_limit_key, SecurityHeaders
import secrets

# Redis client for PKCE state storage and token management
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

router = APIRouter()


class ConnectShopResponse(BaseModel):
    authorization_url: str


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


class UpdateShopRequest(BaseModel):
    display_name: str


class CreateConnectLinkRequest(BaseModel):
    shop_name: str | None = None


@router.post("/connect-link", tags=["Shops"])
async def create_connect_link(
    request: CreateConnectLinkRequest = CreateConnectLinkRequest(),
    context: UserContext = Depends(require_permission(Permission.CONNECT_SHOP)),
    db: Session = Depends(get_db),
):
    """
    Generate a one-time expiring connection link.
    The link is valid for 30 minutes and can only be used once.
    The user copies this link and opens it in their browser to start the OAuth flow.
    """
    rl_key = rate_limit_key(context.tenant_id, 0, "connect_link")
    if not check_rate_limit(redis_client, rl_key, max_attempts=20, window_seconds=3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many link generation attempts. Please try again later.",
        )

    token = secrets.token_urlsafe(48)
    link = ConnectLink(
        tenant_id=context.tenant_id,
        created_by_user_id=context.user_id,
        token=token,
        shop_name=request.shop_name.strip() if request.shop_name else None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    db.add(link)
    db.commit()

    frontend_url = settings.FRONTEND_URL.rstrip("/")
    connect_url = f"{frontend_url}/oauth/etsy/start?link_token={token}"

    return {"connect_url": connect_url, "expires_in_minutes": 30}


@router.get("/connect-link/{token}/validate", tags=["Shops"])
async def validate_connect_link(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Validate a one-time connect link token (no auth required).
    Returns the tenant context needed to start the OAuth flow.
    """
    link = db.query(ConnectLink).filter(ConnectLink.token == token).first()
    if not link:
        raise HTTPException(status_code=404, detail="Invalid or expired connection link.")
    if link.used_at is not None:
        raise HTTPException(status_code=410, detail="This connection link has already been used.")
    if link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This connection link has expired.")
    return {
        "valid": True,
        "shop_name": link.shop_name,
        "tenant_id": link.tenant_id,
        "expires_at": link.expires_at.isoformat(),
    }


@router.post("/connect-link/{token}/start", tags=["Shops"])
async def start_oauth_from_connect_link(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Consume a one-time connect link and initiate the Etsy OAuth flow.
    Marks the link as used and returns the authorization URL.
    """
    link = db.query(ConnectLink).filter(ConnectLink.token == token).first()
    if not link:
        raise HTTPException(status_code=404, detail="Invalid connection link.")
    if link.used_at is not None:
        raise HTTPException(status_code=410, detail="This connection link has already been used.")
    if link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This connection link has expired.")

    if not settings.ETSY_CLIENT_ID or not settings.ETSY_REDIRECT_URI:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Etsy OAuth is not configured.",
        )

    # Mark as used
    link.used_at = datetime.now(timezone.utc)
    db.commit()

    auth_data = etsy_oauth.get_authorization_url()
    _store_key = f"etsy_oauth_state:{auth_data['state']}"
    _store_val = json.dumps({
            "code_verifier": auth_data["code_verifier"],
            "user_id": link.created_by_user_id,
            "tenant_id": link.tenant_id,
            "shop_name": link.shop_name,
            "from_connect_link": True,
        })
    redis_client.setex(_store_key, 600, _store_val)

    return {"authorization_url": auth_data["auth_url"]}


@router.get("/etsy/connect", response_model=ConnectShopResponse, tags=["Shops"])
async def connect_etsy_shop(
    shop_name: str = Query(None, max_length=120),
    context: UserContext = Depends(require_permission(Permission.CONNECT_SHOP))
):
    """
    Step 1: Get Etsy authorization URL
    Requires: CONNECT_SHOP permission (Owner, Admin)

    Returns URL to redirect user to Etsy for authorization
    """
    tenant_id = context.tenant_id

    if not settings.ETSY_CLIENT_ID or not settings.ETSY_REDIRECT_URI:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Etsy OAuth is not configured. Set ETSY_CLIENT_ID and ETSY_REDIRECT_URI."
        )
    
    # Rate limit: max 10 OAuth start attempts per tenant per hour
    rl_key = rate_limit_key(tenant_id, 0, 'oauth_start')
    if not check_rate_limit(redis_client, rl_key, max_attempts=10, window_seconds=3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OAuth attempts. Please try again later."
        )
    
    auth_data = etsy_oauth.get_authorization_url()
    shop_name_clean = shop_name.strip() if shop_name else None

    # Store code_verifier in Redis with state as key (expires in 10 minutes)
    redis_client.setex(
        f"etsy_oauth_state:{auth_data['state']}",
        600,  # 10 minutes TTL
        json.dumps({
            "code_verifier": auth_data["code_verifier"],
            "user_id": context.user_id,
            "tenant_id": context.tenant_id,
            "shop_name": shop_name_clean
        })
    )

    return ConnectShopResponse(
        authorization_url=auth_data["auth_url"]
    )


@router.post("/etsy/callback", tags=["Shops"])
async def etsy_oauth_callback(
    request: OAuthCallbackRequest,
    context: UserContext = Depends(require_permission(Permission.CONNECT_SHOP)),
    db: Session = Depends(get_db)
):
    """
    Step 2: Handle OAuth callback from Etsy
    Requires: CONNECT_SHOP permission (Owner, Admin)

    Exchange authorization code for access token and save shop
    """
    try:
        # Retrieve code_verifier from Redis using state
        state_data_json = redis_client.get(f"etsy_oauth_state:{request.state}")
        if not state_data_json:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OAuth state. Please try connecting again."
            )

        state_data = json.loads(state_data_json)
        code_verifier = state_data.get("code_verifier")
        stored_user_id = state_data.get("user_id")
        stored_tenant_id = state_data.get("tenant_id")

        if stored_user_id != context.user_id or stored_tenant_id != context.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OAuth state does not match the current user. Please try again."
            )

        # Clean up Redis entry
        redis_client.delete(f"etsy_oauth_state:{request.state}")

        # Exchange code for tokens with PKCE verifier
        token_data = await etsy_oauth.exchange_code_for_token(request.code, code_verifier)

        # Get shop information
        shop_info = await etsy_oauth.get_shop_info(token_data["access_token"])
        preferred_name = state_data.get("shop_name") or shop_info.get("shop_name")
        
        # Check if shop already exists
        existing_shop = db.query(Shop).filter(
            Shop.etsy_shop_id == str(shop_info["shop_id"])
        ).first()
        
        if existing_shop:
            # Update existing shop
            shop = existing_shop
            shop.display_name = preferred_name
            shop.status = "connected"
        else:
            # Create new shop
            shop = Shop(
                tenant_id=context.tenant_id,
                etsy_shop_id=str(shop_info["shop_id"]),
                display_name=preferred_name,
                status="connected"
            )
            db.add(shop)
            db.flush()

        # Link shop to the connecting user
        membership = db.query(Membership).filter(
            Membership.user_id == context.user_id,
            Membership.tenant_id == context.tenant_id,
            Membership.invitation_status == 'accepted'
        ).first()
        if membership:
            allowed_shop_ids = membership.allowed_shop_ids or []
            if shop.id not in allowed_shop_ids:
                allowed_shop_ids.append(shop.id)
                membership.allowed_shop_ids = allowed_shop_ids
        
        # Use TokenManager to save encrypted tokens
        token_manager = TokenManager(db, redis_client)
        await token_manager.save_token(
            tenant_id=context.tenant_id,
            shop_id=shop.id,
            access_token=token_data["access_token"],
            refresh_token=token_data.get("refresh_token", ""),
            expires_in=token_data["expires_in"],
            provider="etsy",
            scopes=" ".join(EtsyOAuthService.SCOPES)
        )

        # Link shop to the connecting user (per-user shop access)
        membership = db.query(Membership).filter(
            Membership.user_id == context.user_id,
            Membership.tenant_id == context.tenant_id,
            Membership.invitation_status == 'accepted'
        ).first()
        if membership:
            allowed_shop_ids = membership.allowed_shop_ids or []
            if shop.id not in allowed_shop_ids:
                allowed_shop_ids.append(shop.id)
                membership.allowed_shop_ids = allowed_shop_ids

        db.commit()
        
        db.refresh(shop)
        
        return {
            "message": "Shop connected successfully",
            "shop": {
                "id": shop.id,
                "etsy_shop_id": shop.etsy_shop_id,
                "display_name": shop.display_name,
                "status": shop.status
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Failed to connect shop")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to connect shop. Please try again."
        )


@router.get("/", tags=["Shops"])
async def list_shops(
    context: UserContext = Depends(get_user_context),
    db: Session = Depends(get_db)
):
    """
    Get all shops for current user's tenant
    Filters by allowed shops based on role:
    - Owner/Admin: All shops in tenant (always; allowed_shop_ids can be stale)
    - Supplier/Creator/Viewer: Only allowed shop_ids
    """
    # Filter by tenant
    query = filter_by_tenant(db.query(Shop), context.tenant_id, Shop.tenant_id)

    is_owner_or_admin = context.role.lower() in ('owner', 'admin')

    if is_owner_or_admin:
        # Owner/Admin: always return all tenant shops (don't filter by allowed_shop_ids)
        # Backfill membership.allowed_shop_ids for consistency
        all_shop_ids = [row[0] for row in db.query(Shop.id).filter(Shop.tenant_id == context.tenant_id).all()]
        membership = db.query(Membership).filter(
            Membership.user_id == context.user_id,
            Membership.tenant_id == context.tenant_id,
            Membership.invitation_status == 'accepted'
        ).first()
        if membership and (not membership.allowed_shop_ids or set(membership.allowed_shop_ids) != set(all_shop_ids)):
            membership.allowed_shop_ids = all_shop_ids
            db.commit()
    else:
        # Supplier/Creator/Viewer: filter by allowed shop IDs
        allowed_shop_ids = context.allowed_shop_ids or []
        if allowed_shop_ids:
            query = query.filter(Shop.id.in_(allowed_shop_ids))
        else:
            query = query.filter(Shop.id == -1)

    shops = query.all()
    
    return {
        "shops": [
            {
                "id": shop.id,
                "etsy_shop_id": shop.etsy_shop_id,
                "display_name": shop.display_name,
                "status": shop.status,
                "created_at": shop.created_at.isoformat()
            }
            for shop in shops
        ]
    }


@router.patch("/{shop_id}", tags=["Shops"])
async def update_shop(
    shop_id: int,
    request: UpdateShopRequest,
    context: UserContext = Depends(require_permission(Permission.MANAGE_SHOP_SETTINGS)),
    db: Session = Depends(get_db)
):
    """
    Update shop display name.
    Requires: MANAGE_SHOP_SETTINGS permission (Owner, Admin)
    """
    ensure_shop_access(shop_id, context, db)
    shop = db.query(Shop).filter(
        Shop.id == shop_id,
        Shop.tenant_id == context.tenant_id
    ).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    shop.display_name = request.display_name.strip()
    shop.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(shop)

    return {
        "message": "Shop updated",
        "shop": {
            "id": shop.id,
            "etsy_shop_id": shop.etsy_shop_id,
            "display_name": shop.display_name,
            "status": shop.status,
            "created_at": shop.created_at.isoformat()
        }
    }


@router.post("/{shop_id}/refresh-token", tags=["Shops"])
async def refresh_shop_token(
    shop_id: int,
    context: UserContext = Depends(require_shop_access("shop_id")),
    db: Session = Depends(get_db)
):
    """
    Manually refresh OAuth token for a shop
    Requires: Shop access (Owner, Admin, or Creator/Viewer with shop access)
    
    Useful for testing or forcing a refresh
    """
    # Shop access already verified by require_shop_access
    shop = db.query(Shop).filter(
        Shop.id == shop_id,
        Shop.tenant_id == context.tenant_id,
        Shop.status == 'connected'
    ).first()
    
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found or not connected")
    
    # Rate limit: max 5 manual refresh attempts per shop per 10 minutes
    rl_key = rate_limit_key(context.tenant_id, shop_id, 'manual_refresh')
    if not check_rate_limit(redis_client, rl_key, max_attempts=5, window_seconds=600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many refresh attempts. Please wait a few minutes."
        )
    
    try:
        token_manager = TokenManager(db, redis_client)
        new_token = await token_manager.refresh_token(context.tenant_id, shop_id, provider='etsy')
        
        if not new_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to refresh token"
            )
        
        # Get updated token info
        oauth_token = db.query(OAuthToken).filter(
            OAuthToken.shop_id == shop_id,
            OAuthToken.provider == 'etsy'
        ).first()
        
        return {
            "message": "Token refreshed successfully",
            "expires_at": oauth_token.expires_at.isoformat(),
            "refresh_count": oauth_token.refresh_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Token refresh failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed. Please try again."
        )


@router.delete("/{shop_id}", tags=["Shops"])
async def disconnect_shop(
    shop_id: int,
    context: UserContext = Depends(require_permission(Permission.DISCONNECT_SHOP)),
    db: Session = Depends(get_db)
):
    """
    Disconnect an Etsy shop
    Requires: DISCONNECT_SHOP permission (Owner, Admin only)
    """
    # Verify shop access
    ensure_shop_access(shop_id, context, db)
    
    shop = db.query(Shop).filter(
        Shop.id == shop_id,
        Shop.tenant_id == context.tenant_id
    ).first()
    
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Revoke and delete tokens
    token_manager = TokenManager(db, redis_client)
    await token_manager.revoke_token(context.tenant_id, shop_id, provider='etsy')
    
    # Update shop status
    shop.status = "revoked"
    db.commit()
    
    return {"message": "Shop disconnected successfully"}


@router.delete("/{shop_id}/permanent", tags=["Shops"])
async def delete_shop_permanently(
    shop_id: int,
    context: UserContext = Depends(require_permission(Permission.DISCONNECT_SHOP)),
    db: Session = Depends(get_db)
):
    """
    Permanently delete an Etsy shop and ALL associated data.
    Requires: DISCONNECT_SHOP permission (Owner, Admin only)
    This action is irreversible.
    """
    if context.role.lower() not in ('owner', 'admin'):
        raise HTTPException(status_code=403, detail="Only owners and admins can permanently delete shops")

    ensure_shop_access(shop_id, context, db)

    shop = db.query(Shop).filter(
        Shop.id == shop_id,
        Shop.tenant_id == context.tenant_id
    ).first()

    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    # Revoke tokens first (if any remain)
    try:
        token_manager = TokenManager(db, redis_client)
        await token_manager.revoke_token(context.tenant_id, shop_id, provider='etsy')
    except Exception:
        pass  # Token may already be revoked

    # Delete the shop record — CASCADE constraints handle related rows
    shop_name = shop.display_name or shop.etsy_shop_id
    db.delete(shop)
    db.commit()

    return {"message": f"Shop '{shop_name}' and all associated data have been permanently deleted"}