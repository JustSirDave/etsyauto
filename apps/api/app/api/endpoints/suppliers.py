"""
Supplier Profile Endpoints
Manage supplier profile details for manual fulfillment
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from sqlalchemy.orm import Session

from app.api.dependencies import get_user_context, UserContext, require_permission
from app.core.database import get_db
from app.core.rbac import Permission
from app.models.tenancy import SupplierProfile

router = APIRouter()


class SupplierProfileRequest(BaseModel):
    shop_id: Optional[int] = None
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None


class SupplierProfileResponse(BaseModel):
    id: int
    tenant_id: int
    user_id: int
    shop_id: Optional[int]
    company_name: Optional[str]
    contact_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address_line1: Optional[str]
    address_line2: Optional[str]
    city: Optional[str]
    state: Optional[str]
    postal_code: Optional[str]
    country: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


@router.get("/me", response_model=Optional[SupplierProfileResponse])
async def get_my_profile(
    context: UserContext = Depends(get_user_context),
    db: Session = Depends(get_db),
):
    if context.role.lower() != "supplier":
        raise HTTPException(status_code=403, detail="Supplier profile is only available to supplier accounts")

    profile = db.query(SupplierProfile).filter(
        SupplierProfile.tenant_id == context.tenant_id,
        SupplierProfile.user_id == context.user_id,
    ).first()
    return profile


@router.put("/me", response_model=SupplierProfileResponse)
async def upsert_my_profile(
    request: SupplierProfileRequest,
    context: UserContext = Depends(get_user_context),
    db: Session = Depends(get_db),
):
    if context.role.lower() != "supplier":
        raise HTTPException(status_code=403, detail="Supplier profile is only available to supplier accounts")

    profile = db.query(SupplierProfile).filter(
        SupplierProfile.tenant_id == context.tenant_id,
        SupplierProfile.user_id == context.user_id,
    ).first()

    if not profile:
        profile = SupplierProfile(
            tenant_id=context.tenant_id,
            user_id=context.user_id,
            shop_id=request.shop_id,
        )
        db.add(profile)

    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)

    db.commit()
    db.refresh(profile)
    return profile


@router.get("/", response_model=List[SupplierProfileResponse])
async def list_suppliers(
    context: UserContext = Depends(require_permission(Permission.MANAGE_TEAM)),
    db: Session = Depends(get_db),
):
    profiles = db.query(SupplierProfile).filter(
        SupplierProfile.tenant_id == context.tenant_id
    ).all()
    return profiles
