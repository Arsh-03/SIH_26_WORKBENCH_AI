import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CommandPaletteItem, CommandCategory } from '../../lib/types'
import { mockCommandPaletteItems } from '../../lib/mockData'

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  items?: CommandPaletteItem[]
  onSelectItem?: (item: CommandPaletteItem) => void
}

const CATEGORIES: CommandCategory[] = ['CHATS', 'PROJECTS', 'COMMANDS']

/**
 * Command Palette (Quick Switcher) Component
 * Follows DESIGN.md Section 4F & Section 6:
 * - Centered Elevation 2 modal over dimmed-but-grain-visible backdrop
 * - Serif Fraunces input: "Jump to a chat, project, or command…"
 * - Results grouped under small-caps heads (CHATS / PROJECTS / COMMANDS)
 * - Selected row: thin amber left rule (border-l-[3px] border-accent-primary)
 * - Micro-interaction: modal scales 0.98→1 with opacity fade (~150ms, ease-out)
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  items = mockCommandPaletteItems,
  onSelectItem,
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter items based on query
  const filteredItems = items.filter((item) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle?.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    )
  })

  // Group filtered items by category
  const groupedItems = CATEGORIES.map((category) => ({
    category,
    items: filteredItems.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)

  // Flat list for index-based keyboard navigation
  const flatItems = groupedItems.flatMap((g) => g.items)

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Reset selectedIndex when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flatItems.length > 0) {
      const activeEl = listRef.current.querySelector('[data-active="true"]')
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, flatItems.length])

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flatItems.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % flatItems.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flatItems.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = flatItems[selectedIndex]
      if (selected) {
        handleSelect(selected)
      }
    }
  }

  const handleSelect = (item: CommandPaletteItem) => {
    if (onSelectItem) {
      onSelectItem(item)
    } else if (item.onSelect) {
      item.onSelect()
    }
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command Palette Quick Switcher"
          className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4"
          onKeyDown={handleKeyDown}
        >
          {/* Backdrop: dimmed but grain-visible (DESIGN.md Section 4F & 6) */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-background/75 backdrop-blur-[2px]"
          />

          {/* Modal Container: Elevation 2 Surface, Sharp 4px Radii */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-[620px] rounded-[4px] border border-border bg-surface-2 shadow-2xl overflow-hidden flex flex-col select-none"
          >
            {/* Header: Serif Fraunces Input */}
            <div className="flex items-center px-5 py-3.5 border-b border-border gap-3">
              <span className="font-mono text-sm text-text-muted select-none">⌘</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a chat, project, or command…"
                className="w-full bg-transparent border-none outline-none font-display text-[17px] text-text-primary placeholder:text-text-placeholder placeholder:italic focus:ring-0 leading-normal"
              />
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1 rounded-[2px] border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-text-muted hover:text-text-primary transition-colors uppercase"
              >
                ESC
              </button>
            </div>

            {/* Results Grouped by Category */}
            <div
              ref={listRef}
              className="max-h-[380px] overflow-y-auto py-2 divide-y divide-transparent"
            >
              {groupedItems.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-text-muted italic">
                  No matching chats, projects, or commands found.
                </div>
              ) : (
                groupedItems.map((group) => (
                  <div key={group.category} className="px-3 pt-2 pb-2">
                    <span className="font-mono text-[10px] font-semibold tracking-widest text-text-muted uppercase px-3 block mb-1.5">
                      {group.category}
                    </span>
                    <div className="space-y-[2px]">
                      {group.items.map((item) => {
                        const globalIndex = flatItems.indexOf(item)
                        const isSelected = globalIndex === selectedIndex

                        return (
                          <div
                            key={item.id}
                            data-active={isSelected}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors rounded-[2px] ${
                              isSelected
                                ? 'border-l-[3px] border-accent-primary bg-surface-1 text-text-primary pl-[9px]'
                                : 'border-l-[3px] border-transparent text-text-body hover:text-text-primary hover:bg-surface-1/50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <span
                                className={`font-body text-xs truncate ${
                                  isSelected
                                    ? 'text-text-primary font-medium'
                                    : 'text-text-body group-hover:text-text-primary'
                                }`}
                              >
                                {item.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {item.badge && (
                                <span className="font-mono text-[10px] uppercase tracking-wider text-accent-primary bg-surface-1 border border-accent-primary/30 px-1.5 py-0.5 rounded-[2px]">
                                  {item.badge}
                                </span>
                              )}
                              {item.subtitle && (
                                <span
                                  className={`font-mono text-[10px] tracking-wide ${
                                    isSelected
                                      ? 'text-accent-primary'
                                      : 'text-text-muted'
                                  }`}
                                >
                                  {item.subtitle}
                                </span>
                              )}
                              {item.shortcut && (
                                <kbd className="font-mono text-[10px] text-text-muted group-hover:text-text-body">
                                  {item.shortcut}
                                </kbd>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with keyboard hints */}
            <div className="px-5 py-2.5 border-t border-border bg-surface-1 flex items-center justify-between text-text-muted text-[10px] tracking-widest uppercase">
              <div className="flex items-center gap-3 font-mono">
                <div className="flex items-center gap-1">
                  <span className="text-text-body font-mono text-[11px]">↑↓</span>
                  <span>NAVIGATE</span>
                </div>
                <span className="text-border">·</span>
                <div className="flex items-center gap-1">
                  <span className="text-text-body font-mono text-[11px]">↵</span>
                  <span>SELECT</span>
                </div>
                <span className="text-border">·</span>
                <div className="flex items-center gap-1">
                  <span className="text-text-body font-mono text-[11px]">ESC</span>
                  <span>CLOSE</span>
                </div>
              </div>
              <div className="font-mono text-[10px] text-text-muted/80 tracking-wider">
                QUICK SWITCHER
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default CommandPalette
