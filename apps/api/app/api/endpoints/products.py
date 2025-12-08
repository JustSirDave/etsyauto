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
from app.models.tenancy import User
from app.models.listings import Product, AIGeneration
from app.schemas.products import (
    ProductImportRequest, 
    ProductImportBatchRequest,
    ProductResponse,
    AIGenerationRequest,
    AIGenerationResponse
)
from app.services.ai_generator import ai_generator
from app.services.policy_checker import policy_checker

router = APIRouter()


@router.post("/import", tags=["Products"])
async def import_product(
    request: ProductImportRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Import a single product manually
    """
    product = Product(
        tenant_id=int(current_user["tenant_id"]),
        title_raw=request.title_raw,
        description_raw=request.description_raw,
        tags_raw=request.tags_raw,
        images=request.images,
        variants=request.variants,
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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Import multiple products at once
    """
    batch_id = request.batch_id or f"batch_{int(datetime.now(timezone.utc).timestamp())}"
    
    products = []
    for item in request.products:
        product = Product(
            tenant_id=int(current_user["tenant_id"]),
            title_raw=item.title_raw,
            description_raw=item.description_raw,
            tags_raw=item.tags_raw,
            images=item.images,
            variants=item.variants,
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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Import products from CSV file
    
    CSV Format:
    title,description,tags,images,price,supplier
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
        # Parse tags (pipe-separated)
        tags = row.get('tags', '').split('|') if row.get('tags') else []
        
        # Parse images (pipe-separated URLs)
        images = row.get('images', '').split('|') if row.get('images') else []
        
        # Parse price (convert to cents)
        price = None
        if row.get('price'):
            try:
                price = int(float(row['price']) * 100)
            except:
                pass
        
        product = Product(
            tenant_id=int(current_user["tenant_id"]),
            title_raw=row.get('title', ''),
            description_raw=row.get('description', ''),
            tags_raw=tags,
            images=images,
            price=price,
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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all products for current tenant
    """
    query = db.query(Product).filter(
        Product.tenant_id == int(current_user["tenant_id"])
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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get single product details
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == int(current_user["tenant_id"])
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate AI content for a product
    """
    # Get product
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == int(current_user["tenant_id"])
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Generate AI content
    try:
        ai_result = await ai_generator.generate_content(
            title=product.title_raw or "",
            description=product.description_raw or "",
            style=request.style,
            tone=request.tone
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI generation failed: {str(e)}"
        )
    
    # Check policy compliance
    policy_result = policy_checker.check_compliance(
        title=ai_result["title"],
        description=ai_result["description"],
        tags=ai_result["tags"]
    )
    
    # Save AI generation
    ai_gen = AIGeneration(
        tenant_id=int(current_user["tenant_id"]),
        product_id=product.id,
        model=request.model,
        title=ai_result["title"],
        description=ai_result["description"],
        tags=ai_result["tags"],
        policy_flags=policy_result,
        status='ok' if policy_result["compliant"] else 'flagged',
        cost_tokens=ai_result["tokens"],
        cost_usd_cents=ai_result["cost_usd_cents"]
    )
    
    db.add(ai_gen)
    db.commit()
    db.refresh(ai_gen)
    
    return {
        "ai_generation_id": ai_gen.id,
        "title": ai_gen.title,
        "description": ai_gen.description,
        "tags": ai_gen.tags,
        "policy_flags": ai_gen.policy_flags,
        "cost": {
            "tokens": ai_gen.cost_tokens,
            "usd_cents": ai_gen.cost_usd_cents
        }
    }


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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a product
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == int(current_user["tenant_id"])
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(product)
    db.commit()
    
    return {"message": "Product deleted successfully"}