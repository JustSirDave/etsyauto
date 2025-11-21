"""
Token Encryption Service
Encrypts/decrypts OAuth tokens using AES-GCM
"""
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
import os
import base64


class TokenEncryption:
    """Encrypt and decrypt OAuth tokens"""

    def __init__(self, encryption_key: str = None):
        """
        Initialize with encryption key
        If no key provided, generates one (should use from env in production)
        """
        if encryption_key:
            self.key = base64.b64decode(encryption_key)
        else:
            # Generate a random 32-byte key for development
            self.key = AESGCM.generate_key(bit_length=256)

        self.aesgcm = AESGCM(self.key)

    def encrypt(self, token: str) -> bytes:
        """
        Encrypt a token string

        Args:
            token: Plain text token

        Returns:
            Encrypted token as bytes
        """
        if not token:
            return b''

        nonce = os.urandom(12)  # 96-bit nonce
        token_bytes = token.encode('utf-8')
        encrypted = self.aesgcm.encrypt(nonce, token_bytes, None)

        # Return nonce + encrypted data
        return nonce + encrypted

    def decrypt(self, encrypted_token: bytes) -> str:
        """
        Decrypt a token

        Args:
            encrypted_token: Encrypted token bytes

        Returns:
            Plain text token string
        """
        if not encrypted_token:
            return ''

        # Extract nonce and encrypted data
        nonce = encrypted_token[:12]
        encrypted_data = encrypted_token[12:]

        decrypted = self.aesgcm.decrypt(nonce, encrypted_data, None)
        return decrypted.decode('utf-8')


# Global instance (uses random key for dev - should use env var in production)
token_encryptor = TokenEncryption()