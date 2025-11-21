"""
Shops API Endpoints - Etsy OAuth Integration
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.tenancy import Shop, OAuthToken
from app.services.etsy_oauth import etsy_oauth
from app.services.encryption import token_encryptor

router = APIRouter()


class ConnectShopResponse(BaseModel):
    auth_url: str
    state: str


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


@router.get("/etsy/connect", response_model=ConnectShopResponse, tags=["Shops"])
async def connect_etsy_shop(current_user = Depends(get_current_user)):
    """
    Step 1: Get Etsy authorization URL
    
    Returns URL to redirect user to Etsy for authorization
    """
    auth_data = etsy_oauth.get_authorization_url()
    
    return ConnectShopResponse(
        auth_url=auth_data["auth_url"],
        state=auth_data["state"]
    )


@router.post("/etsy/callback", tags=["Shops"])
async def etsy_oauth_callback(
    request: OAuthCallbackRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 2: Handle OAuth callback from Etsy
    
    Exchange authorization code for access token and save shop
    """
    try:
        # Exchange code for tokens
        token_data = await etsy_oauth.exchange_code_for_token(request.code)
        
        # Get shop information
        shop_info = await etsy_oauth.get_shop_info(token_data["access_token"])
        
        # Check if shop already exists
        existing_shop = db.query(Shop).filter(
            Shop.etsy_shop_id == str(shop_info["shop_id"])
        ).first()
        
        if existing_shop:
            # Update existing shop
            shop = existing_shop
            shop.display_name = shop_info.get("shop_name")
            shop.status = "connected"
        else:
            # Create new shop
            shop = Shop(
                tenant_id=int(current_user["tenant_id"]),
                etsy_shop_id=str(shop_info["shop_id"]),
                display_name=shop_info.get("shop_name"),
                status="connected"
            )
            db.add(shop)
            db.flush()
        
        # Calculate token expiry
        expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])
        
        # Encrypt tokens
        encrypted_access = token_encryptor.encrypt(token_data["access_token"])
        encrypted_refresh = token_encryptor.encrypt(token_data.get("refresh_token", ""))
        
        # Save or update OAuth tokens
        existing_token = db.query(OAuthToken).filter(
            OAuthToken.shop_id == shop.id,
            OAuthToken.provider == "etsy"
        ).first()
        
        if existing_token:
            existing_token.access_token = encrypted_access
            existing_token.refresh_token = encrypted_refresh
            existing_token.expires_at = expires_at
        else:
            oauth_token = OAuthToken(
                shop_id=shop.id,
                provider="etsy",
                access_token=encrypted_access,
                refresh_token=encrypted_refresh,
                expires_at=expires_at
            )
            db.add(oauth_token)
        
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
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect shop: {str(e)}"
        )


@router.get("/", tags=["Shops"])
async def list_shops(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all shops for current user's tenant
    """
    shops = db.query(Shop).filter(
        Shop.tenant_id == int(current_user["tenant_id"])
    ).all()
    
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


@router.delete("/{shop_id}", tags=["Shops"])
async def disconnect_shop(
    shop_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disconnect an Etsy shop
    """
    shop = db.query(Shop).filter(
        Shop.id == shop_id,
        Shop.tenant_id == int(current_user["tenant_id"])
    ).first()
    
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Update status instead of deleting
    shop.status = "revoked"
    db.commit()
    
    return {"message": "Shop disconnected successfully"}