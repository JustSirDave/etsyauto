"""
Team Management Endpoints
Manage tenant memberships, roles, and invitations
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List
from datetime import datetime, timezone, timedelta
import secrets

from ...core.database import get_db
from ...models.tenancy import User, Tenant, Membership
from ...models.notifications import Notification, NotificationType
from ..dependencies import get_current_user, require_role
from ...core.security import hash_password
from ...services.email_service import email_service

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


class AcceptInvitationRequest(BaseModel):
    token: str
    password: str | None = None  # Only required for new users


class MemberResponse(BaseModel):
    id: int
    user_id: int
    email: str
    name: str
    role: str
    invitation_status: str  # pending, accepted, rejected
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
            invitation_status=membership.invitation_status,
            joined_at=user.created_at.isoformat() if user.created_at else "",
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

    # Get current user details for invitation email
    inviter = db.query(User).filter(User.id == int(current_user["sub"])).first()
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()

    # Generate invitation token (valid for 7 days)
    invitation_token = secrets.token_urlsafe(32)
    invitation_expires = datetime.now(timezone.utc) + timedelta(days=7)

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email.lower()).first()

    if existing_user:
        # Check if already a member
        existing_membership = db.query(Membership).filter(
            Membership.user_id == existing_user.id,
            Membership.tenant_id == tenant_id
        ).first()

        if existing_membership:
            # Check if invitation is pending
            if existing_membership.invitation_status == 'pending':
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="User has a pending invitation. Please wait for them to accept."
                )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this organization"
            )

        # Add existing user to tenant with pending invitation
        membership = Membership(
            user_id=existing_user.id,
            tenant_id=tenant_id,
            role=request.role,
            invitation_status='pending',
            invitation_token=invitation_token,
            invitation_token_expires=invitation_expires,
            invited_at=datetime.now(timezone.utc)
        )
        db.add(membership)
        db.commit()

        # Send invitation email
        email_sent = email_service.send_team_invitation(
            to_email=existing_user.email,
            to_name=existing_user.name or request.name,
            inviter_name=inviter.name or inviter.email,
            organization_name=tenant.name,
            role=request.role,
            invitation_token=invitation_token
        )

        return {
            "message": "Invitation sent to existing user",
            "user_id": existing_user.id,
            "email": existing_user.email,
            "role": request.role,
            "status": "pending",
            "email_sent": email_sent
        }

    else:
        # Create new user (without password - they'll set it when accepting invitation)
        new_user = User(
            email=request.email.lower(),
            name=request.name,
            password_hash=None,  # Will be set when user accepts invitation
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_user)
        db.flush()  # Get user ID

        # Add membership with pending invitation
        membership = Membership(
            user_id=new_user.id,
            tenant_id=tenant_id,
            role=request.role,
            invitation_status='pending',
            invitation_token=invitation_token,
            invitation_token_expires=invitation_expires,
            invited_at=datetime.now(timezone.utc)
        )
        db.add(membership)
        db.commit()

        # Send invitation email
        email_sent = email_service.send_team_invitation(
            to_email=new_user.email,
            to_name=new_user.name,
            inviter_name=inviter.name or inviter.email,
            organization_name=tenant.name,
            role=request.role,
            invitation_token=invitation_token
        )

        return {
            "message": "Invitation sent to new user",
            "user_id": new_user.id,
            "email": new_user.email,
            "role": request.role,
            "status": "pending",
            "email_sent": email_sent,
            "note": "User will create their account when accepting the invitation"
        }


@router.post("/invitations/accept")
async def accept_invitation(
    request: AcceptInvitationRequest,
    db: Session = Depends(get_db)
):
    """
    Accept a team invitation
    Available to: anyone with a valid invitation token

    For new users, a password must be provided.
    For existing users, password is optional.
    """
    # Find membership by invitation token
    membership = db.query(Membership).filter(
        Membership.invitation_token == request.token,
        Membership.invitation_status == 'pending'
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation token"
        )

    # Check if invitation has expired
    if membership.invitation_token_expires and membership.invitation_token_expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invitation has expired"
        )

    # Get user
    user = db.query(User).filter(User.id == membership.user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # If user doesn't have a password (new user), require password in request
    if not user.password_hash:
        if not request.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is required for new users"
            )

        # Set password for new user
        user.password_hash = hash_password(request.password)
        user.email_verified = True  # Auto-verify email for invited users

    # Update membership status
    membership.invitation_status = 'accepted'
    membership.accepted_at = datetime.now(timezone.utc)
    membership.invitation_token = None  # Clear token after use
    membership.invitation_token_expires = None

    db.commit()

    # Get tenant info for response
    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()

    # Create notifications for all owners and admins
    # Get all owners and admins in the tenant
    owner_admin_memberships = db.query(Membership).filter(
        Membership.tenant_id == membership.tenant_id,
        Membership.role.in_(['owner', 'admin']),
        Membership.invitation_status == 'accepted'
    ).all()

    # Create a notification for each owner/admin
    for admin_membership in owner_admin_memberships:
        notification = Notification(
            user_id=admin_membership.user_id,
            tenant_id=membership.tenant_id,
            type=NotificationType.TEAM,
            title="New Team Member",
            message=f"{user.name or user.email} has accepted the invitation and joined your team as {membership.role}.",
            action_url="/settings?tab=team",
            action_label="View Team",
            read=False,
            created_at=datetime.now(timezone.utc)
        )
        db.add(notification)

    db.commit()

    return {
        "message": "Invitation accepted successfully",
        "user_id": user.id,
        "email": user.email,
        "tenant_id": tenant.id,
        "tenant_name": tenant.name,
        "role": membership.role
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
