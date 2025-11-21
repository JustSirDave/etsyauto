"""
Celery Tasks for OAuth Token Management
Handles automatic token refresh before expiry
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any

from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.tenancy import OAuthToken, Shop
from app.services.etsy_client import EtsyClient, EtsyAPIError
from app.services.encryption import token_encryptor

logger = logging.getLogger(__name__)


@celery_app.task(name="app.worker.tasks.token_tasks.refresh_expiring_tokens")
def refresh_expiring_tokens() -> Dict[str, Any]:
    """
    Periodic task to refresh OAuth tokens that are about to expire.

    Runs every hour and refreshes tokens expiring in the next 24 hours.

    Returns:
        dict: Summary of refresh operations
    """
    db = SessionLocal()

    try:
        # Find tokens expiring in the next 24 hours
        threshold = datetime.utcnow() + timedelta(hours=24)

        expiring_tokens = (
            db.query(OAuthToken)
            .filter(
                OAuthToken.provider == "etsy",
                OAuthToken.expires_at <= threshold,
                OAuthToken.expires_at > datetime.utcnow()  # Not already expired
            )
            .all()
        )

        results = {
            "checked": len(expiring_tokens),
            "refreshed": 0,
            "failed": 0,
            "errors": []
        }

        logger.info(f"Found {len(expiring_tokens)} tokens expiring within 24 hours")

        for token in expiring_tokens:
            try:
                # Decrypt refresh token
                refresh_token = token_encryptor.decrypt(token.refresh_token)

                # Create Etsy client and refresh token
                etsy_client = EtsyClient(db)
                new_token_data = await etsy_client.refresh_access_token(refresh_token)

                # Encrypt new tokens
                encrypted_access = token_encryptor.encrypt(new_token_data["access_token"])

                # Update token in database
                token.access_token = encrypted_access

                if "refresh_token" in new_token_data:
                    # Some providers issue new refresh tokens
                    encrypted_refresh = token_encryptor.encrypt(new_token_data["refresh_token"])
                    token.refresh_token = encrypted_refresh

                token.expires_at = datetime.utcnow() + timedelta(
                    seconds=new_token_data.get("expires_in", 3600)
                )

                db.commit()

                results["refreshed"] += 1
                logger.info(f"Refreshed token for shop {token.shop_id}")

            except EtsyAPIError as e:
                results["failed"] += 1
                results["errors"].append({
                    "shop_id": token.shop_id,
                    "error": str(e)
                })
                logger.error(f"Failed to refresh token for shop {token.shop_id}: {e}")

                # Mark shop as having connection issues
                shop = db.query(Shop).filter(Shop.id == token.shop_id).first()
                if shop:
                    shop.status = "token_refresh_failed"
                    db.commit()

            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "shop_id": token.shop_id,
                    "error": str(e)
                })
                logger.exception(f"Unexpected error refreshing token for shop {token.shop_id}: {e}")

        logger.info(
            f"Token refresh complete: {results['refreshed']} refreshed, "
            f"{results['failed']} failed out of {results['checked']} checked"
        )

        return results

    finally:
        db.close()


@celery_app.task(name="app.worker.tasks.token_tasks.refresh_token_for_shop")
def refresh_token_for_shop(shop_id: int) -> Dict[str, Any]:
    """
    Manually refresh OAuth token for a specific shop.

    Args:
        shop_id: ID of the shop

    Returns:
        dict: Result of refresh operation
    """
    db = SessionLocal()

    try:
        # Find the shop's token
        token = (
            db.query(OAuthToken)
            .filter(
                OAuthToken.shop_id == shop_id,
                OAuthToken.provider == "etsy"
            )
            .first()
        )

        if not token:
            return {
                "success": False,
                "shop_id": shop_id,
                "error": "No OAuth token found for shop"
            }

        # Decrypt refresh token
        refresh_token = token_encryptor.decrypt(token.refresh_token)

        # Create Etsy client and refresh token
        etsy_client = EtsyClient(db)
        new_token_data = await etsy_client.refresh_access_token(refresh_token)

        # Encrypt new tokens
        encrypted_access = token_encryptor.encrypt(new_token_data["access_token"])

        # Update token in database
        token.access_token = encrypted_access

        if "refresh_token" in new_token_data:
            encrypted_refresh = token_encryptor.encrypt(new_token_data["refresh_token"])
            token.refresh_token = encrypted_refresh

        token.expires_at = datetime.utcnow() + timedelta(
            seconds=new_token_data.get("expires_in", 3600)
        )

        db.commit()

        # Update shop status if needed
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if shop and shop.status == "token_refresh_failed":
            shop.status = "connected"
            db.commit()

        logger.info(f"Successfully refreshed token for shop {shop_id}")

        return {
            "success": True,
            "shop_id": shop_id,
            "expires_at": token.expires_at.isoformat()
        }

    except EtsyAPIError as e:
        logger.error(f"Failed to refresh token for shop {shop_id}: {e}")
        return {
            "success": False,
            "shop_id": shop_id,
            "error": str(e)
        }

    except Exception as e:
        logger.exception(f"Unexpected error refreshing token for shop {shop_id}: {e}")
        return {
            "success": False,
            "shop_id": shop_id,
            "error": str(e)
        }

    finally:
        db.close()
