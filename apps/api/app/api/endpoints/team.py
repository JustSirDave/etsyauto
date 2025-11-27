"""
Team Management Endpoints
Manage tenant memberships, roles, and invitations
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List
from datetime import datetime

from ...core.database import get_db
from ...models.tenancy import User, Tenant, Membership
from ..dependencies import get_current_user, require_role
from ...core.security import hash_password

router = APIRouter()


# Request/Response Models
class InviteMemberRequest(BaseModel):
    email: EmailStr
    name: str
    role: str  # owner, admin, creator, viewer

    class Config:
        json_schema_extra = {
            "example": {
                "email": "teammate@example.com",
                "name": "John Doe",
                "role": "creator"
            }
        }


class UpdateRoleRequest(BaseModel):
    role: str


class MemberResponse(BaseModel):
    id: int
    user_id: int
    email: str
    name: str
    role: str
    joined_at: str
    last_login: str | None

    class Config:
        from_attributes = True


# Endpoints

@router.get("/members", response_model=List[MemberResponse])
async def list_team_members(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all team members in the current tenant
    Available to: all authenticated users
    """
    tenant_id = int(current_user["tenant_id"])

    # Get all memberships for this tenant with user info
    memberships = (
        db.query(Membership, User)
        .join(User, Membership.user_id == User.id)
        .filter(Membership.tenant_id == tenant_id)
        .filter(User.deleted_at == None)
        .all()
    )

    result = []
    for membership, user in memberships:
        result.append(MemberResponse(
            id=membership.id,
            user_id=user.id,
            email=user.email,
            name=user.name or "No name",
            role=membership.role,
            joined_at=membership.created_at.isoformat() if membership.created_at else "",
            last_login=user.last_login_at.isoformat() if user.last_login_at else None
        ))

    return result


@router.post("/members/invite", status_code=status.HTTP_201_CREATED)
async def invite_team_member(
    request: InviteMemberRequest,
    current_user = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Invite a new team member to the tenant
    Available to: owner, admin

    If user exists with this email, adds them to tenant
    If user doesn't exist, creates new user account
    """
    tenant_id = int(current_user["tenant_id"])

    # Validate role
    valid_roles = ["owner", "admin", "creator", "viewer"]
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email.lower()).first()

    if existing_user:
        # Check if already a member
        existing_membership = db.query(Membership).filter(
            Membership.user_id == existing_user.id,
            Membership.tenant_id == tenant_id
        ).first()

        if existing_membership:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this organization"
            )

        # Add existing user to tenant
        membership = Membership(
            user_id=existing_user.id,
            tenant_id=tenant_id,
            role=request.role,
            created_at=datetime.utcnow()
        )
        db.add(membership)
        db.commit()

        return {
            "message": "Existing user added to organization",
            "user_id": existing_user.id,
            "email": existing_user.email,
            "role": request.role
        }

    else:
        # Create new user (without password - they'll set it on first login)
        new_user = User(
            email=request.email.lower(),
            name=request.name,
            password_hash=None,  # Will be set when user accepts invitation
            created_at=datetime.utcnow()
        )
        db.add(new_user)
        db.flush()  # Get user ID

        # Add membership
        membership = Membership(
            user_id=new_user.id,
            tenant_id=tenant_id,
            role=request.role,
            created_at=datetime.utcnow()
        )
        db.add(membership)
        db.commit()

        return {
            "message": "New user created and invited to organization",
            "user_id": new_user.id,
            "email": new_user.email,
            "role": request.role,
            "note": "User will need to set password on first login"
        }


@router.patch("/members/{user_id}/role")
async def update_member_role(
    user_id: int,
    request: UpdateRoleRequest,
    current_user = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Update a team member's role
    Available to: owner, admin

    Restrictions:
    - Cannot change your own role
    - Only owners can promote to owner
    - Admins cannot demote owners
    """
    tenant_id = int(current_user["tenant_id"])
    current_user_id = int(current_user["sub"])
    current_user_role = current_user["role"]

    # Validate role
    valid_roles = ["owner", "admin", "creator", "viewer"]
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )

    # Cannot change your own role
    if user_id == current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own role"
        )

    # Get target membership
    membership = db.query(Membership).filter(
        Membership.user_id == user_id,
        Membership.tenant_id == tenant_id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this organization"
        )

    # Only owners can promote to owner
    if request.role == "owner" and current_user_role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can promote members to owner"
        )

    # Admins cannot demote owners
    if membership.role == "owner" and current_user_role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can change the role of other owners"
        )

    # Update role
    old_role = membership.role
    membership.role = request.role
    membership.updated_at = datetime.utcnow()
    db.commit()

    return {
        "message": "Role updated successfully",
        "user_id": user_id,
        "old_role": old_role,
        "new_role": request.role
    }


@router.delete("/members/{user_id}")
async def remove_team_member(
    user_id: int,
    current_user = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Remove a team member from the tenant
    Available to: owner, admin

    Restrictions:
    - Cannot remove yourself
    - Admins cannot remove owners
    - Must have at least one owner remaining
    """
    tenant_id = int(current_user["tenant_id"])
    current_user_id = int(current_user["sub"])
    current_user_role = current_user["role"]

    # Cannot remove yourself
    if user_id == current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot remove yourself from the organization"
        )

    # Get target membership
    membership = db.query(Membership).filter(
        Membership.user_id == user_id,
        Membership.tenant_id == tenant_id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this organization"
        )

    # Admins cannot remove owners
    if membership.role == "owner" and current_user_role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can remove other owners"
        )

    # Check if this is the last owner
    if membership.role == "owner":
        owner_count = db.query(Membership).filter(
            Membership.tenant_id == tenant_id,
            Membership.role == "owner"
        ).count()

        if owner_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner. Promote another member to owner first."
            )

    # Remove membership
    db.delete(membership)
    db.commit()

    return {
        "message": "Member removed from organization successfully",
        "user_id": user_id
    }


@router.get("/me/role")
async def get_my_role(
    current_user = Depends(get_current_user)
):
    """
    Get current user's role and permissions
    Available to: all authenticated users
    """
    return {
        "user_id": int(current_user["sub"]),
        "tenant_id": int(current_user["tenant_id"]),
        "role": current_user["role"],
        "permissions": {
            "can_invite_members": current_user["role"] in ["owner", "admin"],
            "can_manage_roles": current_user["role"] in ["owner", "admin"],
            "can_remove_members": current_user["role"] in ["owner", "admin"],
            "can_manage_settings": current_user["role"] in ["owner", "admin"],
            "can_create_products": current_user["role"] in ["owner", "admin", "creator"],
            "can_generate_ai": current_user["role"] in ["owner", "admin", "creator"],
            "can_publish_listings": current_user["role"] in ["owner", "admin", "creator"],
            "is_owner": current_user["role"] == "owner",
        }
    }
