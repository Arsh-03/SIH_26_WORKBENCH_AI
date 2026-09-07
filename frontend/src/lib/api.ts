/**
 * Sovereign AI Workbench - API & WebSocket Integration Client
 * Connects the Frontend Darkroom Studio to the FastAPI Sovereign Gateway and AI Engine.
 */

export interface SystemHealth {
  status: string
  ollama_connected: boolean
  models_loaded: string[]
  air_gap_enforced: boolean
  gpu_memory_used_mb: number
  cpu_percent: number
  active_sessions: number
  timestamp: string
}

export interface WorkspaceItem {
  id: string
  name: string
  description?: string
  created_at?: string
  updated_at?: string
}

export interface DocumentItem {
  id: string
  filename: string
  status: 'PENDING' | 'INDEXED' | 'FAILED'
  page_count: number
  chunk_count: number
  created_at?: string
}

export interface AgentStreamFrame {
  event: 'thought' | 'tool_call' | 'tool_result' | 'partial_token' | 'final_answer' | 'error'
  step?: number
  content?: string
  tool_name?: string
  tool_call_id?: string
  parameters?: Record<string, any>
  output?: Record<string, any>
  citations?: Array<{
    document_id: string
    chunk_id: string
    page_number?: number
    snippet: string
  }>
  metrics?: {
    total_tokens?: number
    execution_time_ms?: number
    air_gap_intact?: boolean
  }
}

const API_BASE = '/api/v1'

export const api = {
  /**
   * System telemetry & health check
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const res = await fetch(`${API_BASE}/system/health`)
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`)
    return res.json()
  },

  /**
   * List workspaces
   */
  async getWorkspaces(): Promise<WorkspaceItem[]> {
    const res = await fetch(`${API_BASE}/workspaces`)
    if (!res.ok) throw new Error(`Fetch workspaces failed: ${res.statusText}`)
    return res.json()
  },

  /**
   * Create a new workspace
   */
  async createWorkspace(name: string, description: string = ''): Promise<WorkspaceItem> {
    const res = await fetch(`${API_BASE}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    if (!res.ok) throw new Error(`Create workspace failed: ${res.statusText}`)
    return res.json()
  },

  /**
   * List documents in workspace
   */
  async getDocuments(workspaceId: string): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/documents`)
    if (!res.ok) throw new Error(`Fetch documents failed: ${res.statusText}`)
    return res.json()
  },

  /**
   * Upload document to workspace
   */
  async uploadDocument(workspaceId: string, file: File): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/documents/upload`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error(`Upload document failed: ${res.statusText}`)
    return res.json()
  },

  /**
   * Run isolated code in sandbox
   */
  async executeSandbox(code: string, language: string = 'python', timeoutSeconds: number = 10): Promise<any> {
    const res = await fetch(`${API_BASE}/sandbox/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language, timeout_seconds: timeoutSeconds }),
    })
    if (!res.ok) throw new Error(`Sandbox execution failed: ${res.statusText}`)
    return res.json()
  },

  /**
   * Connect and stream agent reasoning over WebSocket
   */
  connectAgentStream(
    sessionId: string,
    requestPayload: {
      workspace_id: string
      prompt: string
      active_document_ids?: string[]
      allowed_tools?: string[]
      temperature?: number
    },
    onFrame: (frame: AgentStreamFrame) => void,
    onError?: (error: any) => void,
    onClose?: () => void
  ): { ws: WebSocket; abort: () => void } {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/v1/agents/ws/${sessionId}`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      ws.send(JSON.stringify(requestPayload))
    }

    ws.onmessage = (event) => {
      try {
        const frame: AgentStreamFrame = JSON.parse(event.data)
        onFrame(frame)
      } catch (err) {
        console.error('Failed to parse WS frame:', err)
      }
    }

    ws.onerror = (err) => {
      if (onError) onError(err)
    }

    ws.onclose = () => {
      if (onClose) onClose()
    }

    return {
      ws,
      abort: () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close()
        }
      },
    }
  },

  /**
   * Transcribe recorded audio file/blob via backend Whisper service
   */
  async transcribeAudio(audioBlob: Blob, filename: string = 'recording.webm'): Promise<{ text: string }> {
    const formData = new FormData()
    formData.append('file', audioBlob, filename)
    const res = await fetch(`${API_BASE}/audio/transcribe`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Audio transcription failed: ${res.statusText}`)
    }
    return res.json()
  },
}

