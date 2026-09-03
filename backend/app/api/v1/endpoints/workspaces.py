import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db
from backend.app.models.sql_models import Workspace
from backend.app.models.schemas import WorkspaceCreate, WorkspaceResponse
from backend.app.core.security import generate_id

router = APIRouter()

@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(payload: WorkspaceCreate, db: AsyncSession = Depends(get_db)):
    """Create a new industrial workspace."""
    ws_id = generate_id("ws")
    now = datetime.datetime.utcnow()
    workspace = Workspace(
        id=ws_id,
        name=payload.name,
        description=payload.description,
        created_at=now
    )
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        created_at=workspace.created_at.isoformat() + "Z"
    )

@router.get("", response_model=List[WorkspaceResponse])
async def list_workspaces(db: AsyncSession = Depends(get_db)):
    """List all sovereign workspaces."""
    res = await db.execute(select(Workspace).order_by(Workspace.created_at.desc()))
    workspaces = res.scalars().all()
    return [
        WorkspaceResponse(
            id=w.id,
            name=w.name,
            description=w.description,
            created_at=w.created_at.isoformat() + "Z" if w.created_at else ""
        )
        for w in workspaces
    ]

@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(workspace_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve workspace details by ID."""
    workspace = await db.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        created_at=workspace.created_at.isoformat() + "Z" if workspace.created_at else ""
    )
