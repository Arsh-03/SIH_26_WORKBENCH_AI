import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkbench } from '../../lib/WorkbenchContext'

export interface InputBarProps {
  onSendMessage?: (text: string) => void
  isStreaming?: boolean
  onStopStreaming?: () => void
  className?: string
  placeholder?: string
}

interface SlashCommand {
  command: string
  label: string
  description: string
}

const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/explain', label: 'Explain Code', description: 'Break down architecture and logic' },
  { command: '/refactor', label: 'Refactor Module', description: 'Decouple rendering, improve performance' },
  { command: '/test', label: 'Generate Tests', description: 'Unit & integration test coverage' },
  { command: '/fix', label: 'Fix Bug', description: 'Diagnose and repair exception traces' },
]

export const InputBar: React.FC<InputBarProps> = ({
  onSendMessage,
  isStreaming: propIsStreaming,
  onStopStreaming: propOnStopStreaming,
  className = '',
  placeholder = 'Ask a question, propose an edit, or type / for commands…',
}) => {
  const {
    scopeFiles,
    removeScopeFile,
    activeTools,
    toggleTool,
    isStreaming: ctxIsStreaming,
    stopStreaming: ctxStopStreaming,
    sendMessage: ctxSendMessage,
  } = useWorkbench()

  const isStreaming = propIsStreaming ?? ctxIsStreaming
  const onStopStreaming = propOnStopStreaming ?? ctxStopStreaming

  const [inputText, setInputText] = useState('')
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false)
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const [isSendFlashing, setIsSendFlashing] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }, [inputText])

  // Filter slash commands based on typed query after '/'
  const filteredSlashCommands = SLASH_COMMANDS.filter((cmd) => {
    if (!slashQuery) return true
    const q = slashQuery.toLowerCase()
    return (
      cmd.command.slice(1).toLowerCase().includes(q) ||
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q)
    )
  })

  // Detect slash commands and track typed query
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputText(val)

    if (val.startsWith('/')) {
      const spaceIdx = val.indexOf(' ')
      if (spaceIdx === -1) {
        // Still typing command name, e.g. "/exp"
        const query = val.slice(1)
        setSlashQuery(query)
        setIsSlashMenuOpen(true)
        setSlashSelectedIndex(0)
        return
      }
    }
    setIsSlashMenuOpen(false)
  }

  // Insert selected slash command and focus input
  const handleSelectSlash = (cmd: SlashCommand) => {
    setInputText(`${cmd.command} `)
    setIsSlashMenuOpen(false)
    setSlashQuery('')
    textareaRef.current?.focus()
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isStreaming) {
      onStopStreaming?.()
      return
    }

    if (!inputText.trim()) return

    // Trigger amber flash + scale micro-interaction (DESIGN.md Section 6)
    setIsSendFlashing(true)
    setTimeout(() => setIsSendFlashing(false), 120)

    const textToSend = inputText.trim()
    setInputText('')
    setIsSlashMenuOpen(false)
    setSlashQuery('')

    if (onSendMessage) {
      onSendMessage(textToSend)
    } else {
      ctxSendMessage(textToSend)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle slash menu navigation
    if (isSlashMenuOpen && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashSelectedIndex((prev) => (prev + 1) % filteredSlashCommands.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashSelectedIndex(
          (prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length
        )
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selected = filteredSlashCommands[slashSelectedIndex]
        if (selected) {
          handleSelectSlash(selected)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsSlashMenuOpen(false)
        return
      }
    }

    // Normal Enter to submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Close attachment popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsAttachmentOpen(false)
      }
    }

    if (isAttachmentOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isAttachmentOpen])

  return (
    <div className={`relative w-full max-w-4xl mx-auto select-none ${className}`}>
      {/* Context Indicator Strip (DESIGN.md Section 4B): Reflects real open artifact files */}
      <AnimatePresence>
        {scopeFiles.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] text-text-muted">
            <span className="uppercase tracking-widest text-text-muted/80 font-semibold">
              IN SCOPE:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {scopeFiles.map((file) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, scale: 0.8, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: 'auto' }}
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    width: 0,
                    paddingLeft: 0,
                    paddingRight: 0,
                    marginLeft: 0,
                    marginRight: 0,
                  }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="inline-flex items-center gap-1.5 rounded-[2px] border border-border/80 bg-surface-1 px-2 py-0.5 text-text-body overflow-hidden whitespace-nowrap"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-primary shrink-0" />
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeScopeFile(file.id)}
                    className="ml-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer text-xs leading-none"
                    aria-label={`Remove ${file.name} from scope`}
                  >
                    ×
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Tool & Attachment Popover */}
      <AnimatePresence>
        {isAttachmentOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-full left-4 mb-2 w-72 rounded-[4px] border border-border bg-surface-2 p-2 shadow-2xl z-30 space-y-1"
          >
            <div className="px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border/60">
              ATTACHMENTS & TOOLS
            </div>

            <button
              type="button"
              className="w-full text-left px-2.5 py-1.5 text-xs text-text-body hover:text-text-primary rounded-[2px] transition-colors border-l-2 border-transparent hover:border-accent-primary cursor-pointer"
            >
              + Add photos & files
            </button>

            <div className="pt-1 border-t border-border/40">
              <span className="px-2.5 py-1 block font-mono text-[9px] uppercase tracking-wider text-text-muted">
                ACTIVE TOOLS
              </span>

              {/* Tool Toggle: Web Search */}
              <button
                type="button"
                onClick={() => toggleTool('webSearch')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-text-body hover:text-text-primary rounded-[2px] transition-colors border-l-2 border-transparent hover:border-accent-primary cursor-pointer"
              >
                <span>Web search</span>
                {activeTools.webSearch && (
                  <span className="font-mono text-xs text-accent-primary font-bold">✓</span>
                )}
              </button>

              {/* Tool Toggle: Code Execution */}
              <button
                type="button"
                onClick={() => toggleTool('codeExecution')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-text-body hover:text-text-primary rounded-[2px] transition-colors border-l-2 border-transparent hover:border-accent-primary cursor-pointer"
              >
                <span>Code execution</span>
                {activeTools.codeExecution && (
                  <span className="font-mono text-xs text-accent-primary font-bold">✓</span>
                )}
              </button>

              {/* Tool Toggle: Deep Research */}
              <button
                type="button"
                onClick={() => toggleTool('deepResearch')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-text-body hover:text-text-primary rounded-[2px] transition-colors border-l-2 border-transparent hover:border-accent-primary cursor-pointer"
              >
                <span>Deep research</span>
                {activeTools.deepResearch && (
                  <span className="font-mono text-xs text-accent-primary font-bold">✓</span>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slash Command Dropdown */}
      <AnimatePresence>
        {isSlashMenuOpen && filteredSlashCommands.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute bottom-full left-6 mb-2 w-80 rounded-[4px] border border-border bg-surface-2 p-1.5 shadow-xl z-30 space-y-0.5"
          >
            <div className="flex items-center justify-between px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted border-b border-border/40">
              <span>COMMANDS</span>
              {slashQuery && (
                <span className="text-accent-primary">matching &ldquo;{slashQuery}&rdquo;</span>
              )}
            </div>
            {filteredSlashCommands.map((cmd, idx) => {
              const isSelected = idx === slashSelectedIndex
              return (
                <button
                  key={cmd.command}
                  type="button"
                  onClick={() => handleSelectSlash(cmd)}
                  onMouseEnter={() => setSlashSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-[2px] transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-l-2 border-accent-primary bg-surface-1 text-text-primary'
                      : 'border-l-2 border-transparent hover:bg-surface-1/50 text-text-body'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-xs font-semibold text-text-primary">
                      {cmd.command}
                    </span>
                    <span className="font-body text-[11px] text-text-muted">
                      {cmd.description}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-accent-primary">↵</span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Elevation 2 Input Container with 1px offset shadow */}
      <div className="relative flex flex-col rounded-[4px] border border-border bg-surface-2 shadow-[0_4px_0_#110E0A] transition-all">
        {/* Model Indicator Strip */}
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-primary" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-primary">
              PRO REASONING · HALIDE-V4
            </span>
          </div>
          <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
            {isStreaming ? 'Synthesizing…' : 'Ready'}
          </span>
        </div>

        {/* Text Input Area */}
        <div className="px-4 py-3">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full resize-none bg-transparent font-display text-[15px] text-text-primary placeholder:italic placeholder:text-text-placeholder focus:outline-none leading-relaxed"
          />
        </div>

        {/* Bottom Tray: Actions & Send Button */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-text-muted">
            {/* Paperclip Button for Attachments */}
            <button
              type="button"
              onClick={() => setIsAttachmentOpen((p) => !p)}
              className={`flex h-7 w-7 items-center justify-center rounded-[2px] transition-colors cursor-pointer ${
                isAttachmentOpen
                  ? 'bg-surface-1 text-accent-primary border border-accent-primary/40'
                  : 'hover:bg-surface-1 hover:text-text-primary'
              }`}
              title="Tool & Attachment Menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            {/* Mic / Audio Input Icon */}
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-[2px] transition-colors hover:bg-surface-1 hover:text-text-primary cursor-pointer"
              title="Voice Input"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </button>
          </div>

          {/* Send Button: Solid Darkroom Amber Square with morph-to-stop */}
          <motion.button
            type="button"
            onClick={() => handleSubmit()}
            animate={{
              scale: isSendFlashing ? 0.94 : 1,
              filter: isSendFlashing ? 'brightness(1.3)' : 'brightness(1)',
              backgroundColor: isSendFlashing ? '#F5A66B' : '#D97A3F',
            }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            disabled={!inputText.trim() && !isStreaming}
            className={`relative flex h-8 w-8 items-center justify-center rounded-[2px] bg-accent-primary text-background font-bold transition-opacity cursor-pointer ${
              !inputText.trim() && !isStreaming ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-110'
            }`}
            title={isStreaming ? 'Stop generation' : 'Send message (Enter)'}
          >
            <div className="relative flex items-center justify-center w-4 h-4">
              {/* Morphing Stem / Stop Square */}
              <motion.span
                initial={false}
                animate={
                  isStreaming
                    ? {
                        width: 10,
                        height: 10,
                        borderRadius: 1.5,
                        y: 0,
                      }
                    : {
                        width: 2.5,
                        height: 12,
                        borderRadius: 1,
                        y: 1,
                      }
                }
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="absolute bg-background pointer-events-none"
              />
              {/* Morphing Arrowhead / Chevron */}
              <motion.span
                initial={false}
                animate={
                  isStreaming
                    ? {
                        width: 0,
                        height: 0,
                        scale: 0,
                        opacity: 0,
                        y: 0,
                      }
                    : {
                        width: 7,
                        height: 7,
                        scale: 1,
                        opacity: 1,
                        y: -2.5,
                      }
                }
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute border-t-[2.5px] border-l-[2.5px] border-background rotate-45 pointer-events-none"
              />
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  )
}

export default InputBar
