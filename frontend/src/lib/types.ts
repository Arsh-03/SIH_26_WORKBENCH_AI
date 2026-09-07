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
  files: ArtifactFile[]
  versions: ArtifactVersion[]
  diffPreview: DiffLine[]
  terminalOutput: string
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'model'
  text: string
  timestamp: string
  thinkingDuration?: string
  thinkingSteps?: string[]
  artifact?: ArtifactData
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
