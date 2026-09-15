/**
 * Keybindings Manager for Sovereign AI Workbench
 * Supports Mac (⌘/Cmd) and Windows/Linux (Ctrl) modifiers, custom user overrides,
 * collision detection, and localStorage persistence.
 */

export interface KeybindingItem {
  id: string
  name: string
  description: string
  category: 'navigation' | 'workbench' | 'general'
  defaultKey: string // Canonical format e.g. "mod+k", "mod+b", "mod+n", "mod+e", "mod+,", "mod+/", "escape"
  currentKey: string
  editable: boolean
}

export const STORAGE_KEYBINDINGS_KEY = 'workbench_custom_keybindings_v2'

export const DEFAULT_KEYBINDINGS: KeybindingItem[] = [
  {
    id: 'open_palette',
    name: 'Open Command Palette',
    description: 'Quick search chats, projects, commands, and tools',
    category: 'navigation',
    defaultKey: 'mod+k',
    currentKey: 'mod+k',
    editable: true,
  },
  {
    id: 'toggle_settings',
    name: 'Open Settings',
    description: 'Open workbench configuration & preferences modal',
    category: 'general',
    defaultKey: 'mod+,',
    currentKey: 'mod+,',
    editable: true,
  },
  {
    id: 'toggle_sidebar',
    name: 'Toggle Left Sidebar',
    description: 'Expand or collapse navigation sidebar',
    category: 'navigation',
    defaultKey: 'mod+b',
    currentKey: 'mod+b',
    editable: true,
  },
  {
    id: 'new_chat',
    name: 'Create New Chat',
    description: 'Reset to zero state and start a clean chat session',
    category: 'workbench',
    defaultKey: 'mod+n',
    currentKey: 'mod+n',
    editable: true,
  },
  {
    id: 'toggle_artifact',
    name: 'Toggle Artifact Studio',
    description: 'Open or close split-view code, charts, and document studio',
    category: 'workbench',
    defaultKey: 'mod+e',
    currentKey: 'mod+e',
    editable: true,
  },
  {
    id: 'open_shortcuts',
    name: 'Keyboard Shortcuts Reference',
    description: 'View and edit all workbench keybindings',
    category: 'general',
    defaultKey: 'mod+/',
    currentKey: 'mod+/',
    editable: true,
  },
  {
    id: 'close_modals',
    name: 'Close Active Modals',
    description: 'Dismiss palettes, settings modal, or studio overlay',
    category: 'general',
    defaultKey: 'escape',
    currentKey: 'escape',
    editable: true,
  },
]

export const isMacPlatform = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return (
    navigator.platform?.toUpperCase().includes('MAC') ||
    navigator.userAgent?.toUpperCase().includes('MAC') ||
    false
  )
}

/**
 * Formats a canonical key combo (e.g. "mod+k") into a human-readable display string
 * Mac: ⌘K, ⌥S, ⇧P
 * Windows/Linux: Ctrl+K, Alt+S, Shift+P
 */
export const formatKeyComboDisplay = (combo: string): string => {
  if (!combo) return ''
  const isMac = isMacPlatform()
  const parts = combo.toLowerCase().split('+').map((p) => p.trim())

  if (isMac) {
    return parts
      .map((part) => {
        if (part === 'mod' || part === 'meta' || part === 'cmd') return '⌘'
        if (part === 'ctrl') return '⌃'
        if (part === 'alt') return '⌥'
        if (part === 'shift') return '⇧'
        if (part === 'escape' || part === 'esc') return 'Esc'
        if (part === 'enter' || part === 'return') return '↵'
        if (part === 'space') return 'Space'
        if (part === 'slash' || part === '/') return '/'
        if (part === 'comma' || part === ',') return ','
        return part.toUpperCase()
      })
      .join('')
  }

  // Windows / Linux format: Ctrl+K, Ctrl+Shift+P, etc.
  const formattedParts: string[] = []
  parts.forEach((part) => {
    if (part === 'mod' || part === 'ctrl') formattedParts.push('Ctrl')
    else if (part === 'alt') formattedParts.push('Alt')
    else if (part === 'shift') formattedParts.push('Shift')
    else if (part === 'meta' || part === 'cmd') formattedParts.push('Win')
    else if (part === 'escape' || part === 'esc') formattedParts.push('Esc')
    else if (part === 'enter' || part === 'return') formattedParts.push('Enter')
    else if (part === 'space') formattedParts.push('Space')
    else if (part === 'slash' || part === '/') formattedParts.push('/')
    else if (part === 'comma' || part === ',') formattedParts.push(',')
    else formattedParts.push(part.toUpperCase())
  })
  return formattedParts.join('+')
}

/**
 * Helper to get the formatted keybinding display for an ID from keybindings list
 */
export const getKeybindingDisplay = (keybindings: KeybindingItem[] | undefined, id: string, fallback?: string): string => {
  if (!keybindings || keybindings.length === 0) {
    const def = DEFAULT_KEYBINDINGS.find((k) => k.id === id)
    return def ? formatKeyComboDisplay(def.currentKey) : (fallback || '')
  }
  const found = keybindings.find((k) => k.id === id)
  if (found) {
    return formatKeyComboDisplay(found.currentKey)
  }
  const def = DEFAULT_KEYBINDINGS.find((k) => k.id === id)
  return def ? formatKeyComboDisplay(def.currentKey) : (fallback || '')
}

/**
 * Loads custom keybindings from localStorage, falling back to defaults.
 */
export const loadSavedKeybindings = (): KeybindingItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYBINDINGS_KEY)
    if (raw) {
      const overrides: Record<string, string> = JSON.parse(raw)
      return DEFAULT_KEYBINDINGS.map((item) => ({
        ...item,
        currentKey: overrides[item.id] || item.defaultKey,
      }))
    }
  } catch (err) {
    console.warn('Failed to load saved keybindings from localStorage:', err)
  }
  return DEFAULT_KEYBINDINGS
}

/**
 * Saves current keybindings overrides into localStorage.
 */
export const saveKeybindingOverrides = (items: KeybindingItem[]): void => {
  try {
    const overrides: Record<string, string> = {}
    items.forEach((it) => {
      if (it.currentKey !== it.defaultKey) {
        overrides[it.id] = it.currentKey
      }
    })
    localStorage.setItem(STORAGE_KEYBINDINGS_KEY, JSON.stringify(overrides))
  } catch (err) {
    console.warn('Failed to save keybindings to localStorage:', err)
  }
}

/**
 * Matches a native KeyboardEvent against a canonical key combo (e.g. "mod+k", "escape", "ctrl+shift+p").
 */
export const matchEventToKeybinding = (e: KeyboardEvent, combo: string): boolean => {
  if (!combo) return false
  const parts = combo.toLowerCase().split('+').map((p) => p.trim())

  const needsMod = parts.includes('mod')
  const needsCtrl = parts.includes('ctrl')
  const needsAlt = parts.includes('alt')
  const needsShift = parts.includes('shift')
  const needsMeta = parts.includes('meta') || parts.includes('cmd')

  const hasMod = e.ctrlKey || e.metaKey

  // Modifier presence verification
  if (needsMod && !hasMod) return false
  if (needsCtrl && !e.ctrlKey) return false
  if (needsAlt && !e.altKey) return false
  if (needsShift && !e.shiftKey) return false
  if (needsMeta && !e.metaKey) return false

  // Modifier absence verification
  if (!needsAlt && e.altKey) return false
  if (!needsCtrl && !needsMod && e.ctrlKey) return false
  if (!needsMeta && !needsMod && e.metaKey) return false

  // Find the primary base key
  const baseKey = parts.find(
    (p) => !['mod', 'ctrl', 'alt', 'shift', 'meta', 'cmd'].includes(p)
  )

  if (!baseKey) return false

  const pressedKey = (e.key || '').toLowerCase()
  const pressedCode = (e.code || '').toLowerCase()

  // Base key matching
  if (baseKey === 'escape' || baseKey === 'esc') {
    return pressedKey === 'escape' || pressedCode === 'escape'
  }

  if (baseKey === 'enter' || baseKey === 'return') {
    return pressedKey === 'enter' || pressedCode === 'enter' || pressedCode === 'numpadenter'
  }

  if (baseKey === 'space') {
    return pressedKey === ' ' || pressedKey === 'space' || pressedCode === 'space'
  }

  if (baseKey === '/' || baseKey === 'slash') {
    return (
      pressedKey === '/' ||
      pressedKey === '?' ||
      pressedCode === 'slash' ||
      pressedCode === 'numpaddivide'
    )
  }

  if (baseKey === ',' || baseKey === 'comma') {
    return pressedKey === ',' || pressedKey === '<' || pressedCode === 'comma'
  }

  if (baseKey === '.' || baseKey === 'period') {
    return pressedKey === '.' || pressedKey === '>' || pressedCode === 'period'
  }

  if (baseKey === '\\' || baseKey === 'backslash') {
    return pressedKey === '\\' || pressedKey === '|' || pressedCode === 'backslash'
  }

  if (baseKey === '`' || baseKey === 'backquote') {
    return pressedKey === '`' || pressedKey === '~' || pressedCode === 'backquote'
  }

  // If combo doesn't require shift, but shift is held on alphanumeric keys, reject (e.g. Ctrl+Shift+N vs Ctrl+N)
  if (!needsShift && e.shiftKey) {
    // Only reject if it's not a punctuation key
    if (/^[a-z0-9]$/.test(baseKey)) {
      return false
    }
  }

  return (
    pressedKey === baseKey ||
    pressedCode === `key${baseKey}` ||
    pressedCode === `digit${baseKey}` ||
    pressedCode === `numpad${baseKey}`
  )
}

/**
 * Converts a KeyboardEvent during recording into a canonical combo string.
 * Returns null if only modifier keys were pressed.
 */
export const eventToKeyCombo = (e: KeyboardEvent): string | null => {
  const isModifierKey = ['Control', 'Shift', 'Alt', 'Meta', 'CapsLock'].includes(e.key)
  if (isModifierKey) return null

  const parts: string[] = []

  // Check modifiers
  if (e.ctrlKey || e.metaKey) {
    parts.push('mod')
  }
  if (e.altKey) {
    parts.push('alt')
  }
  if (e.shiftKey) {
    parts.push('shift')
  }

  let keyPart = (e.key || '').toLowerCase()

  if (keyPart === 'escape') keyPart = 'escape'
  else if (keyPart === 'enter') keyPart = 'enter'
  else if (keyPart === ' ') keyPart = 'space'
  else if (keyPart === '/' || keyPart === '?') keyPart = '/'
  else if (keyPart === ',' || keyPart === '<') keyPart = ','
  else if (keyPart === '.' || keyPart === '>') keyPart = '.'
  else if (keyPart === '\\' || keyPart === '|') keyPart = '\\'
  else if (keyPart === '`' || keyPart === '~') keyPart = '`'
  else if (e.code.startsWith('Key')) {
    keyPart = e.code.replace('Key', '').toLowerCase()
  } else if (e.code.startsWith('Digit')) {
    keyPart = e.code.replace('Digit', '').toLowerCase()
  } else if (e.code.startsWith('Numpad')) {
    keyPart = e.code.replace('Numpad', '').toLowerCase()
  }

  parts.push(keyPart)
  return parts.join('+')
}
