"""
Manager for running IMAPIdleListener instances for all shops with IMAP
configured, and reloading them when configuration changes.
"""

import asyncio
import logging
import os
from typing import List, Dict, Any

import psycopg2
from psycopg2.extras import RealDictCursor
import redis.asyncio as aioredis
from base64 import b64decode
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .imap_listener import IMAPIdleListener
from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_database_url() -> str:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    return dsn


def load_imap_shops() -> List[Dict[str, Any]]:
    """
    Load all shops that have IMAP configuration.

    This uses a direct psycopg2 connection to the main Postgres database.
    """
    dsn = _get_database_url()
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, imap_host, imap_email, imap_password_enc
                FROM shops
                WHERE imap_host IS NOT NULL
                  AND imap_email IS NOT NULL
                  AND imap_password_enc IS NOT NULL
                """
            )
            rows = cur.fetchall()
            logger.info("IMAPManager: loaded %d shops with IMAP configured", len(rows))
            return rows
    finally:
        conn.close()


def decrypt_imap_password(enc_value: Any) -> str:
    """
    Decrypt IMAP password from imap_password_enc using AES-GCM.

    Stored format: nonce (12 bytes) + ciphertext_and_tag.
    Falls back to UTF-8 decoding if decryption fails.
    """
    if enc_value is None:
        return ""
    if isinstance(enc_value, memoryview):
        enc_value = enc_value.tobytes()

    if isinstance(enc_value, (bytes, bytearray)):
        key_b64 = settings.ENCRYPTION_KEY or ""
        if key_b64:
            try:
                key = b64decode(key_b64)
                if len(enc_value) > 12:
                    nonce = enc_value[:12]
                    ciphertext = enc_value[12:]
                    aesgcm = AESGCM(key)
                    decrypted = aesgcm.decrypt(nonce, ciphertext, None)
                    return decrypted.decode("utf-8")
            except Exception:
                logger.warning("IMAPManager: AES-GCM decrypt failed, falling back to utf-8", exc_info=True)

        try:
            return enc_value.decode("utf-8")
        except Exception:
            logger.warning("IMAPManager: could not decode imap_password_enc as utf-8, using repr")
            return repr(enc_value)

    return str(enc_value)


async def _start_listeners_for_current_shops() -> List[asyncio.Task]:
    shops = load_imap_shops()
    tasks: List[asyncio.Task] = []
    for shop in shops:
        password = decrypt_imap_password(shop.get("imap_password_enc"))
        listener = IMAPIdleListener(
            shop_id=shop["id"],
            imap_host=shop["imap_host"],
            email_addr=shop["imap_email"],
            password=password,
        )
        task = asyncio.create_task(listener.listen(), name=f"imap-listener-shop-{shop['id']}")
        tasks.append(task)
        logger.info("IMAPManager: started IMAP listener for shop_id=%s", shop["id"])
    return tasks


async def _wait_for_reload_signal(redis_url: str) -> None:
    """
    Subscribe to Redis channel 'imap:reload' and return when a message arrives.
    """
    redis = aioredis.from_url(redis_url)
    try:
        pubsub = redis.pubsub()
        await pubsub.subscribe("imap:reload")
        logger.info("IMAPManager: subscribed to Redis channel 'imap:reload'")
        async for message in pubsub.listen():
            if message is None:
                continue
            msg_type = message.get("type")
            if msg_type == "message":
                logger.info("IMAPManager: received reload signal from Redis")
                break
    finally:
        await redis.close()


async def run_manager() -> None:
    """
    Main entrypoint for the IMAP manager.

    - Starts listeners for all configured shops
    - Waits for a Redis 'imap:reload' message
    - On reload, cancels existing listeners and restarts them with fresh config
    """
    logging.basicConfig(level=logging.INFO)

    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    logger.info("IMAPManager: starting with REDIS_URL=%s", redis_url)

    while True:
        tasks: List[asyncio.Task] = await _start_listeners_for_current_shops()

        if not tasks:
            logger.warning("IMAPManager: no shops with IMAP configured; waiting for reload signal")

        # Wait for reload signal while listeners run
        try:
            await _wait_for_reload_signal(redis_url)
        except Exception:
            logger.exception("IMAPManager: error while waiting for reload signal")

        logger.info("IMAPManager: reloading listeners after Redis signal")

        # Cancel all running listener tasks
        for t in tasks:
            t.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


def main() -> None:
    asyncio.run(run_manager())


if __name__ == "__main__":
    main()

