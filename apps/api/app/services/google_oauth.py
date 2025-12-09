"""
Google OAuth Service
Handles Google OAuth 2.0 authentication flow
"""
import httpx
import secrets
from typing import Dict, Optional
from datetime import datetime, timezone

from ..core.config import settings


class GoogleOAuthService:
    """Service for Google OAuth authentication"""
    
    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_REDIRECT_URI
        self.auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
        self.token_url = "https://oauth2.googleapis.com/token"
        self.userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
    
    def get_authorization_url(self, state: str, invitation_token: Optional[str] = None) -> str:
        """
        Generate Google OAuth authorization URL
        
        Args:
            state: Random state parameter for CSRF protection
            invitation_token: Optional invitation token to pass through OAuth flow
        
        Returns:
            Authorization URL to redirect user to
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "online",
            "prompt": "select_account"
        }
        
        # If invitation token provided, include it in state
        if invitation_token:
            params["state"] = f"{state}:{invitation_token}"
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{self.auth_url}?{query_string}"
    
    async def exchange_code_for_token(self, code: str) -> Dict:
        """
        Exchange authorization code for access token
        
        Args:
            code: Authorization code from Google
        
        Returns:
            Token response from Google
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def get_user_info(self, access_token: str) -> Dict:
        """
        Get user information from Google using access token
        
        Args:
            access_token: Google OAuth access token
        
        Returns:
            User information from Google
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()
    
    @staticmethod
    def generate_state() -> str:
        """Generate a random state parameter for CSRF protection"""
        return secrets.token_urlsafe(32)


# Global instance
google_oauth_service = GoogleOAuthService()
