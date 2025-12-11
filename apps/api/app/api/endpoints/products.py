"""
Products API Endpoints
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import io
import json

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.api.dependencies import (
    get_user_context, 
    UserContext, 
    require_permission,
    require_any_permission
)
from app.core.rbac import Permission
from app.core.query_helpers import filter_by_tenant, ensure_tenant_access
from app.models.tenancy import User
from app.models.listings import Product, AIGeneration
from app.schemas.products import (
    ProductImportRequest, 
    ProductImportBatchRequest,
    ProductResponse,
    AIGenerationRequest,
    AIGenerationResponse
)
from app.services.ai_generation_service import AIGenerationService
from app.services.ai_providers import AIProviderType

router = APIRouter()


@router.post("/import", tags=["Products"])
async def import_product(
    request: ProductImportRequest,
    context: UserContext = Depends(require_permission(Permission.CREATE_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    Import a single product manually
    Requires: CREATE_PRODUCT permission (Owner, Admin, Creator)
    """
    product = Product(
        tenant_id=context.tenant_id,
        sku=request.sku,
        title_raw=request.title_raw,
        description_raw=request.description_raw,
        tags_raw=request.tags_raw,
        images=request.images,
        variants=request.variants,
        price=request.price,
        quantity=request.quantity,
        source='manual'
    )
    
    db.add(product)
    db.commit()
    db.refresh(product)
    
    return {
        "message": "Product imported successfully",
        "product_id": product.id
    }


@router.post("/import/batch", tags=["Products"])
async def import_batch(
    request: ProductImportBatchRequest,
    context: UserContext = Depends(require_permission(Permission.CREATE_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    Import multiple products at once
    Requires: CREATE_PRODUCT permission (Owner, Admin, Creator)
    """
    batch_id = request.batch_id or f"batch_{int(datetime.now(timezone.utc).timestamp())}"
    
    products = []
    for item in request.products:
        product = Product(
            tenant_id=context.tenant_id,
            sku=item.sku,
            title_raw=item.title_raw,
            description_raw=item.description_raw,
            tags_raw=item.tags_raw,
            images=item.images,
            variants=item.variants,
            price=item.price,
            quantity=item.quantity,
            source='json',
            ingest_batch_id=batch_id
        )
        products.append(product)
    
    db.add_all(products)
    db.commit()
    
    return {
        "message": f"Imported {len(products)} products",
        "batch_id": batch_id,
        "count": len(products)
    }


@router.post("/import/csv", tags=["Products"])
async def import_csv(
    file: UploadFile = File(...),
    context: UserContext = Depends(require_permission(Permission.CREATE_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    Import products from CSV file
    
    CSV Format (expected columns):
    sku,title,description,price,quantity
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV")
    
    # Read CSV
    contents = await file.read()
    csv_text = contents.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(csv_text))
    
    batch_id = f"csv_{int(datetime.now(timezone.utc).timestamp())}"
    products = []
    
    for row in csv_reader:
        # Parse tags (pipe-separated, optional)
        tags = row.get('tags', '').split('|') if row.get('tags') else []
        
        # Parse images (pipe-separated URLs, optional)
        images = row.get('images', '').split('|') if row.get('images') else []
        
        # Parse price (convert to cents)
        price = None
        if row.get('price'):
            try:
                price = int(float(row['price']) * 100)
            except:
                pass
        
        # Parse quantity
        quantity = None
        if row.get('quantity'):
            try:
                quantity = int(row['quantity'])
            except:
                pass
        
        product = Product(
            tenant_id=context.tenant_id,
            sku=row.get('sku'),
            title_raw=row.get('title', ''),
            description_raw=row.get('description', ''),
            tags_raw=tags,
            images=images,
            price=price,
            quantity=quantity,
            supplier_name=row.get('supplier'),
            supplier_product_id=row.get('supplier_product_id'),
            source='csv',
            ingest_batch_id=batch_id
        )
        products.append(product)
    
    db.add_all(products)
    db.commit()
    
    return {
        "message": f"Imported {len(products)} products from CSV",
        "batch_id": batch_id,
        "count": len(products)
    }


@router.get("/", tags=["Products"])
async def list_products(
    skip: int = 0,
    limit: int = 50,
    batch_id: Optional[str] = None,
    context: UserContext = Depends(require_permission(Permission.READ_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    List all products for current tenant
    Requires: READ_PRODUCT permission (all roles)
    """
    # Automatically filter by tenant
    query = filter_by_tenant(
        db.query(Product),
        context.tenant_id,
        Product.tenant_id
    )
    
    if batch_id:
        query = query.filter(Product.ingest_batch_id == batch_id)
    
    total = query.count()
    products = query.offset(skip).limit(limit).all()
    
    return {
        "products": [
            {
                "id": p.id,
                "title_raw": p.title_raw,
                "description_raw": p.description_raw,
                "tags_raw": p.tags_raw,
                "images": p.images,
                "price": p.price,
                "supplier_name": p.supplier_name,
                "source": p.source,
                "batch_id": p.ingest_batch_id,
                "created_at": p.created_at.isoformat()
            }
            for p in products
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{product_id}", tags=["Products"])
async def get_product(
    product_id: int,
    context: UserContext = Depends(require_permission(Permission.READ_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    Get single product details
    Requires: READ_PRODUCT permission (all roles)
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == context.tenant_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Ensure tenant access (defense in depth)
    ensure_tenant_access(product.tenant_id, context)
    
    return {
        "id": product.id,
        "title_raw": product.title_raw,
        "description_raw": product.description_raw,
        "tags_raw": product.tags_raw,
        "images": product.images,
        "variants": product.variants,
        "price": product.price,
        "supplier_name": product.supplier_name,
        "supplier_product_id": product.supplier_product_id,
        "source": product.source,
        "batch_id": product.ingest_batch_id,
        "created_at": product.created_at.isoformat()
    }


@router.post("/{product_id}/generate", tags=["Products"])
async def generate_ai_content(
    product_id: int,
    request: AIGenerationRequest,
    context: UserContext = Depends(require_permission(Permission.GENERATE_CONTENT)),
    db: Session = Depends(get_db)
):
    """
    Generate AI content for a product
    Requires: GENERATE_CONTENT permission (Owner, Admin, Creator)
    """
    # Get product
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == context.tenant_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Ensure tenant access (defense in depth)
    ensure_tenant_access(product.tenant_id, context)
    
    # Build product info string
    product_info = f"{product.title_raw or ''}"
    if product.description_raw:
        product_info += f"\n{product.description_raw}"
    if product.tags_raw:
        tags_str = ", ".join(product.tags_raw) if isinstance(product.tags_raw, list) else str(product.tags_raw)
        product_info += f"\nTags: {tags_str}"
    
    # Use new AI Generation Service with integrated policy checking
    try:
        service = AIGenerationService(db)
        
        # Determine provider (default to OpenAI)
        provider_type = AIProviderType.OPENAI
        if hasattr(request, 'provider') and request.provider:
            provider_type = AIProviderType(request.provider)
        
        # Generate with automatic policy check
        generation, needs_review = await service.generate_with_policy_check(
            product_id=product.id,
            tenant_id=context.tenant_id,
            product_info=product_info,
            title_raw=product.title_raw,
            description_raw=product.description_raw,
            tags_raw=product.tags_raw if isinstance(product.tags_raw, list) else None,
            style=request.style or "friendly",
            tone=request.tone or "professional",
            provider_type=provider_type,
            model=request.model
        )
        
        return {
            "ai_generation_id": generation.id,
            "title": generation.title,
            "description": generation.description,
            "tags": generation.tags,
            "policy_status": generation.policy_status,
            "policy_flags": generation.policy_flags,
            "needs_review": needs_review,
            "provider": generation.provider,
            "tokens_used": generation.tokens_used,
            "generation_time_ms": generation.generation_time_ms,
            "cost": {
                "tokens": generation.cost_tokens or generation.tokens_used or 0,
                "usd_cents": generation.cost_usd_cents or 0
            },
            "message": "⚠️ Content needs manual review due to policy violations. Visit /ai-review to review." if needs_review else "✅ Content generated successfully and passed policy checks"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI generation failed: {str(e)}"
        )


@router.put("/{product_id}", tags=["Products"])
async def update_product(
    product_id: int,
    request: ProductImportRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing product
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == int(current_user["tenant_id"])
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update fields
    product.title_raw = request.title_raw
    product.description_raw = request.description_raw
    product.tags_raw = request.tags_raw
    product.images = request.images
    product.variants = request.variants
    product.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(product)
    
    return {
        "message": "Product updated successfully",
        "product_id": product.id
    }


@router.delete("/{product_id}", tags=["Products"])
async def delete_product(
    product_id: int,
    context: UserContext = Depends(require_permission(Permission.DELETE_PRODUCT)),
    db: Session = Depends(get_db)
):
    """
    Delete a product
    Requires: DELETE_PRODUCT permission (Owner, Admin only)
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == context.tenant_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Ensure tenant access (defense in depth)
    ensure_tenant_access(product.tenant_id, context)
    
    db.delete(product)
    db.commit()
    
    return {"message": "Product deleted successfully"}