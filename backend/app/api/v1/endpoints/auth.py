import uuid
from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database import get_db
from backend.app.models.sql_models import User
from backend.app.models.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    UserProfileResponse,
    AuthTokenResponse,
)
from backend.app.core.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    validate_password_strength,
)

router = APIRouter()

def serialize_user(user: User) -> UserProfileResponse:
    created_at_str = user.created_at.isoformat() if hasattr(user.created_at, "isoformat") else str(user.created_at)
    return UserProfileResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        avatar_letter=user.avatar_letter or (user.full_name[0].upper() if user.full_name else "U"),
        created_at=created_at_str,
    )

@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new sovereign workbench operator or researcher."""
    # Check password strength requirements
    is_valid, err_msg = validate_password_strength(req.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg
        )

    # Check if username exists
    res_user = await db.execute(select(User).where(User.username == req.username.strip().lower()))
    if res_user.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already registered."
        )

    # Check if email exists
    res_email = await db.execute(select(User).where(User.email == req.email.strip().lower()))
    if res_email.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered."
        )

    avatar_letter = req.avatar_letter
    if not avatar_letter:
        avatar_letter = req.full_name[0].upper() if req.full_name else req.username[0].upper()

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    hashed_pwd = hash_password(req.password)

    new_user = User(
        id=user_id,
        username=req.username.strip().lower(),
        email=req.email.strip().lower(),
        hashed_password=hashed_pwd,
        full_name=req.full_name.strip(),
        role=req.role or "AI Researcher",
        avatar_letter=avatar_letter[:1],
        created_at=datetime.utcnow()
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token(data={"sub": new_user.id, "username": new_user.username})
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=serialize_user(new_user)
    )

@router.post("/login", response_model=AuthTokenResponse)
async def login(req: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with username or email and password."""
    login_identifier = req.username.strip().lower()
    
    # Query user by username or email
    stmt = select(User).where(
        (User.username == login_identifier) | (User.email == login_identifier)
    )
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password. Please verify credentials."
        )

    token = create_access_token(data={"sub": user.id, "username": user.username})
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=serialize_user(user)
    )

@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve profile of the currently authenticated operator."""
    return serialize_user(current_user)

@router.post("/logout")
async def logout():
    """Sign out of sovereign enclave session."""
    return {"status": "success", "message": "Successfully logged out from sovereign enclave session."}

@router.get("/demo-users")
async def get_demo_users():
    """Retrieve pre-configured demo user credentials for instant testing."""
    return [
        {
            "username": "admin",
            "password": "Sovereign@2026",
            "full_name": "Lead AI Architect",
            "role": "Lead AI Architect",
            "avatar_letter": "A",
            "badge": "Full Enclave Admin"
        },
        {
            "username": "researcher",
            "password": "Sovereign@2026",
            "full_name": "Elena Rostova",
            "role": "Senior ML Researcher",
            "avatar_letter": "E",
            "badge": "Air-Gap Analyst"
        }
    ]
