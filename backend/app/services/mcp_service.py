"""Local MCP registry, health probing, permission checks, and approval lifecycle."""

import datetime
import json
import os
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.sql_models import McpApprovalAudit, User

MCP_CATALOG: Dict[str, Dict[str, Any]] = {
    "smtp_mcp": {
        "display_name": "SMTP MCP",
        "description": "Local on-premise mail dispatcher",
        "capabilities": ["send_shift_report", "send_engineering_email"],
        "permissions": ["mcp.approve", "mcp.smtp.send"],
        "permission": "mcp.smtp.send",
        "env": "SMTP_MCP_ENDPOINT",
    },
    "alert_mcp": {
        "display_name": "Alert MCP",
        "description": "Serial GSM modem and plant pager dispatcher",
        "capabilities": ["page_duty_engineer", "dispatch_alarm"],
        "permissions": ["mcp.approve", "mcp.alert.dispatch"],
        "permission": "mcp.alert.dispatch",
        "env": "ALERT_MCP_ENDPOINT",
    },
    "historian_mcp": {
        "display_name": "Historian MCP",
        "description": "Local SCADA SQLite, InfluxDB, and Parquet reader",
        "capabilities": ["query_historian", "read_unit_snapshot"],
        "permissions": ["mcp.approve", "mcp.historian.read"],
        "permission": "mcp.historian.read",
        "env": "HISTORIAN_MCP_ENDPOINT",
    },
}


def _utc_now() -> datetime.datetime:
    return datetime.datetime.utcnow()


def server_health(server_id: Optional[str] = None) -> List[Dict[str, Any]]:
    checked = _utc_now().isoformat() + "Z"
    result = []
    catalog = MCP_CATALOG.items()
    if server_id:
        catalog = [(server_id, MCP_CATALOG[server_id])]

    for current_server_id, config in catalog:
        endpoint = os.environ.get(config["env"])
        version = os.environ.get(f"{current_server_id.upper()}_VERSION") or "unknown"
        is_online = bool(endpoint)
        result.append({
            "server_id": current_server_id,
            "display_name": config["display_name"],
            "status": "online" if is_online else "offline",
            "heartbeat_at": checked if is_online else None,
            "version": version if is_online else version,
            "capabilities": config["capabilities"],
            "permissions": config["permissions"],
            "failure_reason": None if is_online else f"{config['env']} is not configured in the local enclave",
            "zero_egress": True,
        })
    return result


def has_permission(user: Optional[User], server: str) -> bool:
    if not user:
        return False
    role = (user.role or "").lower()
    return "lead" in role or "admin" in role or "operator" in role or "engineer" in role


async def create_approval(
    db: AsyncSession,
    *,
    tool_call_id: str,
    session_id: Optional[str],
    user_id: Optional[str],
    server: str,
    tool_name: str,
    parameters: Dict[str, Any],
    security_level: str = "standard",
    ttl_seconds: int = 300,
) -> McpApprovalAudit:
    approval = McpApprovalAudit(
        id=f"mcp_approval_{uuid.uuid4().hex[:16]}",
        tool_call_id=tool_call_id,
        session_id=session_id,
        user_id=user_id,
        server=server,
        tool_name=tool_name,
        parameters=json.dumps(parameters, default=str),
        status="pending",
        security_level=security_level,
        permission_required=MCP_CATALOG.get(server, {}).get("permission", "mcp.approve"),
        expires_at=_utc_now() + datetime.timedelta(seconds=ttl_seconds),
    )
    db.add(approval)
    await db.commit()
    await db.refresh(approval)
    return approval


async def decide_approval(
    db: AsyncSession,
    approval: McpApprovalAudit,
    *,
    approved: bool,
    user: Optional[User],
) -> McpApprovalAudit:
    now = _utc_now()
    if approval.status not in {"pending", "approved", "rejected", "cancelled", "completed", "failed", "executing"}:
        approval.status = "pending"

    if approval.status != "pending":
        return approval

    if approval.expires_at <= now:
        approval.status = "cancelled"
        approval.failure_reason = "Approval request expired"
        approval.decided_at = now
        await db.commit()
        await db.refresh(approval)
        return approval

    if not has_permission(user, approval.server):
        approval.status = "rejected"
        approval.failure_reason = "User does not have permission to approve MCP actions"
        approval.decided_at = now
        await db.commit()
        await db.refresh(approval)
        return approval

    approval.status = "approved" if approved else "rejected"
    approval.failure_reason = None if approved else "Rejected by operator"
    approval.decided_at = now
    await db.commit()
    await db.refresh(approval)
    return approval


async def get_approval(db: AsyncSession, tool_call_id: str) -> Optional[McpApprovalAudit]:
    result = await db.execute(select(McpApprovalAudit).where(McpApprovalAudit.tool_call_id == tool_call_id))
    return result.scalars().first()


async def record_execution_result(
    db: AsyncSession,
    approval: McpApprovalAudit,
    *,
    completed: bool,
    failure_reason: Optional[str] = None,
) -> McpApprovalAudit:
    now = _utc_now()
    if approval.status == "cancelled" and approval.expires_at <= now:
        approval.failure_reason = approval.failure_reason or "Approval request expired"
        approval.completed_at = now
        await db.commit()
        await db.refresh(approval)
        return approval

    if approval.status not in {"approved", "executing"}:
        approval.status = "failed"
        approval.failure_reason = approval.failure_reason or "Execution blocked: approval was not active"
        approval.completed_at = now
        await db.commit()
        await db.refresh(approval)
        return approval

    approval.status = "completed" if completed else "failed"
    approval.failure_reason = failure_reason or (None if completed else "MCP execution failed")
    approval.completed_at = now
    await db.commit()
    await db.refresh(approval)
    return approval