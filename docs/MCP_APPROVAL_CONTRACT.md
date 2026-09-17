# MCP Approval Contract

All real-world MCP actions remain inside the local enclave and require an explicit operator decision.

## WebSocket Approval Envelope

The frontend sends this JSON object on the active agent WebSocket:

```json
{
  "action": "mcp_approval",
  "tool_call_id": "call_abc123",
  "approved": true,
  "tool_name": "alert_mcp.dispatch_alarm",
  "server": "alert_mcp",
  "parameters": {
    "target": "duty-engineer",
    "message": "Pressure alarm requires review"
  }
}
```

The envelope also includes the local bearer token fields used by the gateway for permission validation. The gateway responds with `mcp_approval_status` and one of `approved`, `rejected`, `cancelled`, or `failed`.

## Execution Result Envelope

The local MCP adapter reports completion using:

```json
{
  "action": "mcp_execution_result",
  "tool_call_id": "call_abc123",
  "completed": true,
  "failure_reason": null
}
```

No approval is valid after its expiry time. Decisions and execution outcomes are persisted in the local `mcp_approval_audits` table.
