export interface NavItem {
  id: string
  label: string
  to: string
  count?: number | string
}

export interface PinnedProject {
  id: string
  code: string
  title: string
  path: string
}

export interface PinnedChat {
  id: string
  title: string
  path: string
  timestamp?: string
  isPinned?: boolean
}

export interface RecentChat {
  id: string
  title: string
  path: string
  timestamp?: string
}

export interface UserProfile {
  id?: string
  username?: string
  email?: string
  name: string
  role: string
  avatarLetter: string
}

export type CommandCategory = 'CHATS' | 'PROJECTS' | 'COMMANDS'

export interface CommandPaletteItem {
  id: string
  title: string
  subtitle?: string
  category: CommandCategory
  shortcut?: string
  badge?: string
  active?: boolean
  path?: string
  onSelect?: () => void
}

export interface SuggestionCardData {
  id: string
  categoryCode: string
  title: string
  description: string
  prompt: string
  actionLabel: string
}

export interface QueuedMessage {
  id: string
  text: string
  timestamp: string
}

export interface ScopeFile {
  id: string
  name: string
}

export interface ArtifactFile {
  name: string
  language: string
  content: string
}

export interface DiffLine {
  type: 'addition' | 'deletion' | 'context'
  content: string
  lineNumber?: number
}

export interface ArtifactVersion {
  version: string
  label: string
  timestamp: string
  diffSummary: string
  files: ArtifactFile[]
}

export interface ArtifactData {
  id: string
  title: string
  badge: string
  activeFile: string
  download_url?: string
  files: ArtifactFile[]
  versions?: ArtifactVersion[]
  diffPreview?: DiffLine[]
  terminalOutput?: string
  terminalExitCode?: number
  terminalDurationMs?: number
  terminalCommand?: string
  chartSpec?: any
  visionData?: VisionData
}

export interface BoundingBoxElement {
  element_id: string
  label: string
  tag_code?: string | null
  bounding_box_2d: [number, number, number, number]
  confidence: number
  category?: 'equipment' | 'valve' | 'sensor' | 'table' | 'text' | string
}

export interface VisionData {
  image_url?: string
  image_dimensions?: { width: number; height: number }
  detected_elements: BoundingBoxElement[]
  model?: string
  processing_time_ms?: number
}

export interface ChatCitationItem {
  document_id: string
  chunk_id?: string
  page_number?: number
  snippet: string
  content?: string
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'model'
  text: string
  timestamp: string
  modelUsed?: string
  modelCapability?: string
  routingReason?: string
  thinkingDuration?: string
  thinkingSteps?: string[]
  citations?: ChatCitationItem[]
  artifact?: ArtifactData
  mcpApproval?: McpApprovalRequest
  hitlApproval?: HitlApprovalRequest
}

export interface HitlApprovalRequest {
  approval_id: string
  operation_type: string
  severity: 'CRITICAL' | 'WARNING' | 'ELEVATED' | string
  target_equipment: string
  proposed_parameter: string
  standard_reference: string
  advisory: string
  requires_signoff: boolean
  status?: 'pending' | 'approved' | 'rejected'
}

export type McpServerId = 'smtp_mcp' | 'alert_mcp' | 'historian_mcp'

export interface McpApprovalRequest {
  toolCallId: string
  server: McpServerId | string
  tool: string
  description: string
  parameters: Record<string, unknown>
  securityLevel: 'standard' | 'elevated' | 'critical'
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'rejected' | 'cancelled'
  expiresAt?: string
  failureReason?: string
}

export interface ChatSession {
  id: string
  title: string
  preview: string
  timestamp: string
  isPinned?: boolean
  messageCount: number
  model: string
  path?: string
  messages: ChatMessage[]
}

export interface ProjectItem {
  id: string
  code: string
  title: string
  description: string
  filesCount: number
  artifactsCount: number
  lastActive: string
  tags: string[]
}

export interface LibraryItem {
  id: string
  title: string
  badge: string
  category: 'Components' | 'Schemas' | 'APIs' | 'Migrations'
  description: string
  language: string
  filesCount: number
  updatedAt: string
  artifact: ArtifactData
}
