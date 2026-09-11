/**
 * Sovereign AI Workbench - API & WebSocket Integration Client
 * Connects the Frontend Darkroom Studio to the FastAPI Sovereign Gateway and AI Engine.
 */
import type { ChatSession, ChatMessage, UserProfile } from './types'

export interface SystemHealth {
  gateway_status?: string
  status?: string
  timestamp?: string
  ollama_endpoint?: string
  ollama_running?: boolean
  available_models?: string[]
  network_isolation?: {
    air_gap_active: boolean
    external_interfaces_active: boolean
    bytes_sent_external: number
  }
  gpu_telemetry?: {
    device_name: string
    total_vram_mb: number
    allocated_vram_mb: number
    free_vram_mb: number
  }
  loaded_models?: Array<{
    name: string
    role: string
    engine: string
    status: string
  }>
}

export interface HardwareTelemetry {
  cpu_percent: number
  ram_used_gb: number
  ram_total_gb: number
  ram_percent: number
  gpu: {
    available: boolean
    gpu_name: string
    vram_used_mb: number
    vram_total_mb: number
    vram_free_mb: number
    temperature_c: number
    utilization_pct: number
    driver_version?: string
  }
  tokens_per_second: number
  network_isolation: {
    air_gap_active: boolean
    external_interfaces_active: boolean
    bytes_sent_external: number
  }
  air_gap_status: string
}


export interface DocumentCompilePayload {
  title: string
  content: string
  format: 'pdf' | 'docx' | 'latex' | 'html' | 'all'
  author_name?: string
  author_title?: string
  citations?: Array<{
    document_id: string
    chunk_id?: string
    page_number?: number
    snippet: string
  }>
}

export interface DocumentCompileResult {
  title: string
  format: string
  filename?: string
  download_url?: string
  file_path?: string
  formats?: Record<string, any>
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
  event: 'thought' | 'tool_call' | 'tool_result' | 'partial_token' | 'final_answer' | 'error' | 'token'
  step?: number
  content?: string
  token?: string
  tool_name?: string
  tool_call_id?: string
  parameters?: Record<string, any>
  output?: Record<string, any>
  artifact?: any
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
    model_used?: string
    model_capability?: string
    routing_reason?: string
  }
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: {
    id: string
    username: string
    email: string
    full_name: string
    role: string
    avatar_letter: string
    created_at: string
  }
}

export interface DemoUser {
  username: string
  password: string
  full_name: string
  role: string
  avatar_letter: string
  badge: string
}

const API_BASE = '/api/v1'

function getAuthToken(): string | null {
  return localStorage.getItem('sovereign_auth_token')
}

function getAuthHeaders(includeContentType = true): HeadersInit {
  const headers: Record<string, string> = {}
  if (includeContentType) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export const api = {
  // ==========================================
  // Authentication Endpoints
  // ==========================================
  async login(username: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Authentication failed. Please check credentials.')
    }
    const data = await res.json()
    if (data.access_token) {
      localStorage.setItem('sovereign_auth_token', data.access_token)
    }
    return data
  },

  async register(payload: {
    username: string
    email: string
    password: string
    full_name: string
    role?: string
    avatar_letter?: string
  }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Registration failed. Please try a different username or email.')
    }
    const data = await res.json()
    if (data.access_token) {
      localStorage.setItem('sovereign_auth_token', data.access_token)
    }
    return data
  },

  async getCurrentUser(): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('Session expired or unauthorized')
    const u = await res.json()
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      name: u.full_name,
      role: u.role,
      avatarLetter: u.avatar_letter,
    }
  },

  async getDemoUsers(): Promise<DemoUser[]> {
    const res = await fetch(`${API_BASE}/auth/demo-users`)
    if (!res.ok) return []
    return res.json()
  },

  logout(): void {
    localStorage.removeItem('sovereign_auth_token')
  },

  // ==========================================
  // Chat Persistence & History Endpoints
  // ==========================================
  async getChatSessions(): Promise<ChatSession[]> {
    const res = await fetch(`${API_BASE}/chats`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to load chats: ${res.statusText}`)
    const summaries = await res.json()
    return summaries.map((s: any) => ({
      id: s.id,
      title: s.title,
      preview: s.preview,
      timestamp: s.timestamp,
      model: s.model,
      isPinned: s.isPinned,
      messageCount: s.messageCount,
      path: s.path,
      messages: [],
    }))
  },

  async getChatSession(sessionId: string): Promise<ChatSession> {
    const res = await fetch(`${API_BASE}/chats/${sessionId}`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to load chat ${sessionId}: ${res.statusText}`)
    const data = await res.json()
    return {
      id: data.id,
      title: data.title,
      preview: data.preview,
      timestamp: data.timestamp,
      model: data.model,
      isPinned: data.isPinned,
      messageCount: data.messageCount,
      path: data.path,
      messages: data.messages || [],
    }
  },

  async createChatSession(payload: {
    id?: string
    title: string
    preview?: string
    model?: string
    is_pinned?: boolean
    workspace_id?: string
  }): Promise<ChatSession> {
    const res = await fetch(`${API_BASE}/chats`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Create chat failed: ${res.statusText}`)
    const data = await res.json()
    return {
      id: data.id,
      title: data.title,
      preview: data.preview,
      timestamp: data.timestamp,
      model: data.model,
      isPinned: data.isPinned,
      messageCount: data.messageCount,
      path: data.path,
      messages: data.messages || [],
    }
  },

  async updateChatSession(
    sessionId: string,
    payload: { title?: string; is_pinned?: boolean; preview?: string }
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/chats/${sessionId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Update chat failed: ${res.statusText}`)
    return res.json()
  },

  async deleteChatSession(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/chats/${sessionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`Delete chat failed: ${res.statusText}`)
    return res.json()
  },

  async saveChatMessage(sessionId: string, message: ChatMessage): Promise<ChatMessage> {
    const res = await fetch(`${API_BASE}/chats/${sessionId}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        id: message.id,
        sender: message.sender,
        text: message.text,
        timestamp: message.timestamp,
        modelUsed: message.modelUsed,
        modelCapability: message.modelCapability,
        routingReason: message.routingReason,
        thinkingDuration: message.thinkingDuration,
        thinkingSteps: message.thinkingSteps,
        artifact: message.artifact,
      }),
    })
    if (!res.ok) throw new Error(`Save message failed: ${res.statusText}`)
    return res.json()
  },

  // ==========================================
  // Workspaces & Documents
  // ==========================================
  async getSystemHealth(): Promise<SystemHealth> {
    const res = await fetch(`${API_BASE}/system/health`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`)
    return res.json()
  },

  async getWorkspaces(): Promise<WorkspaceItem[]> {
    const res = await fetch(`${API_BASE}/workspaces`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`Fetch workspaces failed: ${res.statusText}`)
    return res.json()
  },

  async createWorkspace(name: string, description: string = ''): Promise<WorkspaceItem> {
    const res = await fetch(`${API_BASE}/workspaces`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, description }),
    })
    if (!res.ok) throw new Error(`Create workspace failed: ${res.statusText}`)
    return res.json()
  },

  async getDocuments(workspaceId: string): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/documents`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`Fetch documents failed: ${res.statusText}`)
    return res.json()
  },

  async uploadDocument(workspaceId: string, file: File): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/documents/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })
    if (!res.ok) throw new Error(`Upload document failed: ${res.statusText}`)
    return res.json()
  },

  async executeSandbox(code: string, language: string = 'python', timeoutSeconds: number = 10, stdin?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/sandbox/execute`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code, language, timeout_seconds: timeoutSeconds, stdin }),
    })
    if (!res.ok) throw new Error(`Sandbox execution failed: ${res.statusText}`)
    return res.json()
  },

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

  async transcribeAudio(audioBlob: Blob, filename: string = 'recording.webm'): Promise<{ text: string }> {
    const formData = new FormData()
    formData.append('file', audioBlob, filename)
    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${API_BASE}/audio/transcribe`, {
      method: 'POST',
      headers,
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Audio transcription failed: ${res.statusText}`)
    }
    return res.json()
  },

  // ==========================================
  // Document Compilers & Telemetry Endpoints
  // ==========================================
  async getHardwareTelemetry(): Promise<HardwareTelemetry> {
    const res = await fetch(`${API_BASE}/system/telemetry`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`Telemetry fetch failed: ${res.statusText}`)
    return res.json()
  },

  async compileDocument(payload: DocumentCompilePayload): Promise<DocumentCompileResult> {
    const res = await fetch(`${API_BASE}/artifacts/compile`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Document compilation failed: ${res.statusText}`)
    }
    return res.json()
  },

  async downloadSessionBundle(sessionId: string): Promise<void> {
    const url = `${API_BASE}/artifacts/export-bundle/${sessionId}?direct_download=true`
    const a = document.createElement('a')
    a.href = url
    a.download = `Session_Bundle_${sessionId.slice(0, 8)}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  },

  async getDocumentPresets(): Promise<any> {
    const res = await fetch(`${API_BASE}/artifacts/presets`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`Fetch presets failed: ${res.statusText}`)
    return res.json()
  },
}

