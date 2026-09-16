import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Keyboard,
  X,
  RotateCcw,
  Edit2,
  Check,
  AlertCircle,
} from 'lucide-react'
import {
  formatKeyComboDisplay,
  eventToKeyCombo,
} from '../../lib/keybindings'
import { useWorkbench } from '../../lib/WorkbenchContext'

export interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { keybindings, updateKeybinding, resetKeybindings } = useWorkbench()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [recordedCombo, setRecordedCombo] = useState<string | null>(null)
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | 'navigation' | 'workbench' | 'general'>('all')
  const recordingRef = useRef<HTMLDivElement>(null)

  // Listen for key recording when editing a shortcut
  useEffect(() => {
    if (!editingId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Allow cancelling with bare Escape if no modifiers
      if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setEditingId(null)
        setRecordedCombo(null)
        setConflictWarning(null)
        return
      }

      const combo = eventToKeyCombo(e)
      if (combo) {
        setRecordedCombo(combo)

        // Check for collision with existing keybinding
        const existing = keybindings.find(
          (k) => k.id !== editingId && k.currentKey.toLowerCase() === combo.toLowerCase()
        )
        if (existing) {
          setConflictWarning(`Conflicts with "${existing.name}"`)
        } else {
          setConflictWarning(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [editingId, keybindings])

  // Save the recorded keybinding
  const handleSaveEdit = (id: string) => {
    if (recordedCombo) {
      updateKeybinding(id, recordedCombo)
    }
    setEditingId(null)
    setRecordedCombo(null)
    setConflictWarning(null)
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingId(null)
    setRecordedCombo(null)
    setConflictWarning(null)
  }

  // Filter items
  const filteredList = keybindings.filter((item) => {
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.currentKey.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = activeCategory === 'all' || item.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-70 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full max-w-xl rounded-md border border-border/90 bg-surface-1 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-surface-2/70">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-accent-primary/10 border border-accent-primary/30 text-accent-primary">
                  <Keyboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-text-primary flex items-center gap-2">
                    Keyboard Shortcuts & Keybindings
                    <span className="font-mono text-[10px] font-normal px-1.5 py-0.2 rounded bg-surface-1 border border-border/60 text-text-muted">
                      Configurable
                    </span>
                  </h3>
                  <p className="font-body text-[11px] text-text-muted">
                    Click <span className="text-accent-primary font-mono font-medium">Edit</span> on any keybind to assign custom keystrokes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Controls Bar: Filter & Category Tabs */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2.5 border-b border-border/50 bg-surface-1/50">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Filter keybindings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-[3px] border border-border bg-surface-2 px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
                {(['all', 'navigation', 'workbench', 'general'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono capitalize transition-colors cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-accent-primary text-background font-semibold shadow-xs'
                        : 'text-text-muted hover:text-text-body hover:bg-surface-2'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Shortcuts List */}
            <div className="p-3 sm:p-4 overflow-y-auto divide-y divide-border/40 space-y-1">
              {filteredList.length === 0 ? (
                <div className="py-8 text-center text-text-muted text-xs">
                  No keybindings found matching "{searchQuery}"
                </div>
              ) : (
                filteredList.map((item) => {
                  const isEditing = editingId === item.id
                  const isCustom = item.currentKey !== item.defaultKey

                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 px-2 rounded-[3px] transition-colors ${
                        isEditing
                          ? 'bg-accent-primary/5 border border-accent-primary/40'
                          : 'hover:bg-surface-2/40'
                      }`}
                    >
                      {/* Description / Action info */}
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-body text-xs font-medium text-text-primary block truncate">
                            {item.name}
                          </span>
                          {isCustom && (
                            <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                              MODIFIED
                            </span>
                          )}
                        </div>
                        <span className="font-body text-[11px] text-text-muted block truncate mt-0.5">
                          {item.description}
                        </span>
                      </div>

                      {/* Key Combo & Edit action */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {isEditing ? (
                          <div ref={recordingRef} className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded border border-accent-primary bg-background shadow-xs">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-primary"></span>
                              </span>
                              <span className="font-mono text-xs font-bold text-accent-primary min-w-16 text-center">
                                {recordedCombo
                                  ? formatKeyComboDisplay(recordedCombo)
                                  : 'Press keys...'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSaveEdit(item.id)}
                              disabled={!recordedCombo}
                              className="rounded px-2 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-body text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                              title="Save keybind"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="rounded px-2 py-1 bg-surface-2 hover:bg-surface-3 border border-border text-text-muted hover:text-text-primary font-body text-xs cursor-pointer transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <kbd className="inline-flex items-center justify-center font-mono text-[11px] font-semibold text-text-primary bg-surface-2 border border-border/80 px-2 py-0.5 rounded shadow-2xs min-w-12 text-center">
                              {formatKeyComboDisplay(item.currentKey)}
                            </kbd>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id)
                                setRecordedCombo(null)
                                setConflictWarning(null)
                              }}
                              className="flex items-center gap-1 rounded-[3px] border border-border/80 bg-surface-2 hover:bg-surface-3 px-2 py-0.5 font-body text-xs text-text-body hover:text-accent-primary hover:border-accent-primary/50 transition-all cursor-pointer shadow-2xs"
                              title="Edit keybinding"
                            >
                              <Edit2 className="w-3 h-3 text-text-muted group-hover:text-accent-primary" />
                              <span>Edit</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Conflict Alert below row if present */}
                      {isEditing && conflictWarning && (
                        <div className="w-full mt-1.5 flex items-center gap-1.5 text-amber-400 font-mono text-[10px] bg-amber-950/30 border border-amber-500/30 px-2 py-1 rounded">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{conflictWarning}</span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/80 px-4 py-2.5 bg-surface-2/60">
              <button
                type="button"
                onClick={resetKeybindings}
                className="flex items-center gap-1.5 rounded-[2px] border border-border bg-surface-1 px-2.5 py-1 font-body text-xs text-text-muted hover:text-text-primary hover:border-border/90 transition-colors cursor-pointer"
                title="Restore original workbench keybindings"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-[2px] bg-accent-primary px-4 py-1 font-body text-xs font-semibold text-background hover:brightness-110 transition-all cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
