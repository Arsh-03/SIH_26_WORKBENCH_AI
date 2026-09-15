/**
 * settings.ts
 * Centralized settings configuration, type definitions, persistence, and DOM effect handlers.
 */

export const SETTINGS_STORAGE_KEY = 'workbench_settings_config_v1'

export interface WorkbenchSettings {
  // 1. General
  language: string
  defaultWorkspace: string
  startupBehavior: 'resume' | 'new_chat' | 'projects'
  audioChimeOnCompletion: boolean
  desktopNotifications: boolean
  streamingAlert: boolean

  // 2. Personalization
  responseStyle: 'professional' | 'concise' | 'detailed' | 'technical'
  customInstructions: string
  preferStructuredResponses: boolean
  includeSourceReferences: boolean
  showAgentActivity: boolean
  preferConciseAnswers: boolean
  defaultArtifactView: 'preview' | 'code' | 'split'
  defaultSplitRatio: '50/50' | '40/60' | '60/40' | '70/30'

  // 3. AI & Models
  defaultEngine: string
  reasoningModel: string
  visionModel: string
  embeddingModel: string
  temperature: number
  reasoningEffort: 'high' | 'medium' | 'low'

  // 4. Appearance
  theme: 'dark' | 'dim' | 'system'
  workbenchAccent: string
  filmGrainEnabled: boolean
  density: 'comfortable' | 'compact'

  // 5. Security & Privacy
  zeroEgress: boolean
  auditLogging: boolean
  sandboxExecution: boolean
  localVoiceTranscription: boolean

  // 6. Data & Storage
  dataRetention: 'indefinite' | '30days' | 'ephemeral'
  autoSaveArtifacts: boolean

  // 7. Audio
  audioInputDevice: string
  localWhisperModel: string
  voiceInputMode: 'push_to_talk' | 'vad'
  noiseSuppression: boolean
  voiceFeedbackChime: boolean

  // 8. Developer
  mcpEndpoint: string
  mcpProjectId: string
  telemetryStreaming: boolean
  verboseLangGraphLogging: boolean
  sandboxMemoryLimitMb: number
  sandboxTimeoutSeconds: number
}

export const DEFAULT_SETTINGS: WorkbenchSettings = {
  language: 'English (US)',
  defaultWorkspace: 'default_workspace',
  startupBehavior: 'resume',
  audioChimeOnCompletion: true,
  desktopNotifications: true,
  streamingAlert: true,

  responseStyle: 'professional',
  customInstructions: 'Prefer concise, modular TypeScript code with strict typing. Cite internal document references when answering engineering queries.',
  preferStructuredResponses: true,
  includeSourceReferences: true,
  showAgentActivity: true,
  preferConciseAnswers: false,
  defaultArtifactView: 'preview',
  defaultSplitRatio: '50/50',

  defaultEngine: 'llama3.1:8b (Sovereign Reasoning)',
  reasoningModel: 'llama3.1:8b (Primary Orchestrator)',
  visionModel: 'qwen2-vl:7b-instruct-q4_K_M (Local OCR & Diagrams)',
  embeddingModel: 'bge-m3 (Dense 1024-dim Local RAG)',
  temperature: 0.2,
  reasoningEffort: 'high',

  theme: 'dark',
  workbenchAccent: '#D97A3F',
  filmGrainEnabled: true,
  density: 'comfortable',

  zeroEgress: true,
  auditLogging: true,
  sandboxExecution: true,
  localVoiceTranscription: true,

  dataRetention: 'indefinite',
  autoSaveArtifacts: true,

  audioInputDevice: 'default',
  localWhisperModel: 'openai/whisper-large-v3-turbo (Local Core)',
  voiceInputMode: 'push_to_talk',
  noiseSuppression: true,
  voiceFeedbackChime: true,

  mcpEndpoint: 'ws://127.0.0.1:8000/api/v1/mcp',
  mcpProjectId: 'sovereign-workbench-core',
  telemetryStreaming: true,
  verboseLangGraphLogging: false,
  sandboxMemoryLimitMb: 512,
  sandboxTimeoutSeconds: 15,
}

export function getLanguageCode(language: string): string {
  switch (language) {
    case 'English (UK)':
      return 'en-GB'
    case 'Deutsch':
      return 'de'
    case 'Français':
      return 'fr'
    case 'Español':
      return 'es'
    case '日本語':
      return 'ja'
    case 'English (US)':
    default:
      return 'en-US'
  }
}

export function loadSavedSettings(): WorkbenchSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch (e) {
    console.error('Failed to load settings from localStorage:', e)
  }
  return DEFAULT_SETTINGS
}

export function saveSettings(settings: WorkbenchSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    applySettingsDomEffects(settings)
    window.dispatchEvent(new CustomEvent('workbench_settings_updated', { detail: settings }))
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

export function applySettingsDomEffects(settings: WorkbenchSettings): void {
  try {
    // 1. Set language on html tag
    document.documentElement.lang = getLanguageCode(settings.language)

    // 2. Set density attribute
    document.documentElement.setAttribute('data-density', settings.density)

    // 3. Set accent color CSS variable
    if (settings.workbenchAccent) {
      document.documentElement.style.setProperty('--color-accent-primary', settings.workbenchAccent)
    }
  } catch (e) {
    console.warn('Failed to apply settings DOM effects:', e)
  }
}
