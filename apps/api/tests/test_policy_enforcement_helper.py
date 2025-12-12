"""
Helper function for creating test products with proper field mapping
"""
from app.models.listings import Product


def create_test_product(db, tenant_id, title, description, price, quantity, tags=None, sku=None, source="manual"):
    """Helper to create a product with proper _raw field mapping"""
    product = Product(
        tenant_id=tenant_id,
        sku=sku,
        title_raw=title,
        description_raw=description,
        price=price,
        quantity=quantity,
        tags_raw=tags or [],
        source=source
    )
    # Set computed properties for policy checking
    product.title = title
    product.description = description
    product.tags = tags or []
    
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

