from typing import Any, Dict

from app.models.listings import Order


def derive_payment_status(order: Order) -> str:
    """
    Best-effort payment status derived from Etsy status fields.
    """
    etsy_status = (order.etsy_status or "").lower()
    if etsy_status == "refunded" or order.status == "refunded":
        return "refunded"
    if etsy_status in {"paid", "completed"}:
        return "paid"
    if order.status == "cancelled":
        return "failed"
    return "pending"


def build_shipping_address(order: Order) -> Dict[str, Any]:
    """
    Combine shipping fields into a single response object.
    """
    if not any(
        [
            order.shipping_name,
            order.shipping_first_line,
            order.shipping_second_line,
            order.shipping_city,
            order.shipping_state,
            order.shipping_zip,
            order.shipping_country,
            order.shipping_country_iso,
        ]
    ):
        return {}

    return {
        "name": order.shipping_name,
        "address1": order.shipping_first_line,
        "address2": order.shipping_second_line,
        "city": order.shipping_city,
        "state": order.shipping_state,
        "zip": order.shipping_zip,
        "country": order.shipping_country or order.shipping_country_iso,
        "country_iso": order.shipping_country_iso,
    }
