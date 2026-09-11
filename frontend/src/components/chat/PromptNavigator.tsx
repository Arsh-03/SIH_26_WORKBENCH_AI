import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatMessage } from '../../lib/types'

export interface PromptNavigatorProps {
  messages: ChatMessage[]
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

export const PromptNavigator: React.FC<PromptNavigatorProps> = ({
  messages,
  scrollContainerRef
}) => {
  const userMessages = messages.filter((m) => m.sender === 'user')
  const [activePromptId, setActivePromptId] = useState<string | null>(null)
  const [hoveredPromptId, setHoveredPromptId] = useState<string | null>(null)

  // Scroll active prompt detection via scroll listener
  useEffect(() => {
    if (userMessages.length === 0) return

    const container = scrollContainerRef?.current
    if (!container) return

    const handleScroll = () => {
      // 1. If scrolled near the bottom of the feed, highlight the latest prompt
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 80
      if (isAtBottom) {
        setActivePromptId(userMessages[userMessages.length - 1].id)
        return
      }

      // 2. Otherwise find the latest prompt scrolled to or above the reading threshold
      const containerRect = container.getBoundingClientRect()
      const readingLine = containerRect.top + 220

      let activeId = userMessages[0]?.id || null
      for (let i = 0; i < userMessages.length; i++) {
        const msg = userMessages[i]
        const el = document.getElementById(`msg-${msg.id}`)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= readingLine) {
            activeId = msg.id
          }
        }
      }

      if (activeId) {
        setActivePromptId(activeId)
      }
    }

    handleScroll()
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [userMessages, scrollContainerRef])

  // Automatically update active prompt when new user messages arrive
  useEffect(() => {
    if (userMessages.length > 0) {
      setActivePromptId(userMessages[userMessages.length - 1].id)
    }
  }, [userMessages.length])

  const scrollToPrompt = useCallback((promptId: string) => {
    const el = document.getElementById(`msg-${promptId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActivePromptId(promptId)
    }
  }, [])

  if (userMessages.length < 2) {
    return null
  }

  return (
    <div
      className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end pointer-events-auto select-none"
      aria-label="Prompt Navigation Track"
    >
      <div className="flex flex-col items-center gap-1.5 p-1.5 rounded-full bg-surface-1/85 hover:bg-surface-1/95 border border-border/70 backdrop-blur-md shadow-xl transition-all">
        {userMessages.map((msg, idx) => {
          const isActive = activePromptId === msg.id
          const isHovered = hoveredPromptId === msg.id
          const previewText = msg.text.replace(/\s+/g, ' ').trim()
          const truncatedPreview =
            previewText.length > 70 ? `${previewText.slice(0, 67)}…` : previewText

          return (
            <div
              key={msg.id}
              className="relative flex items-center justify-end group py-0.5"
              onMouseEnter={() => setHoveredPromptId(msg.id)}
              onMouseLeave={() => setHoveredPromptId(null)}
            >
              {/* Tooltip Card (Positioned to the left of the horizontal notch) */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: 8, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 8, scale: 0.95 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none z-50 flex items-center"
                  >
                    <div className="max-w-[280px] min-w-[180px] p-2.5 rounded-md bg-surface-1 border border-border/90 text-text-primary shadow-2xl backdrop-blur-md">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-accent-primary font-bold">
                          Prompt #{idx + 1}
                        </span>
                        {msg.timestamp && (
                          <span className="font-mono text-[9px] text-text-muted">
                            {msg.timestamp}
                          </span>
                        )}
                      </div>
                      <p className="font-body text-xs text-text-primary leading-snug line-clamp-2">
                        {truncatedPreview}
                      </p>
                    </div>
                    {/* Small arrow tick pointing right */}
                    <div className="w-1.5 h-1.5 bg-surface-1 border-r border-t border-border/90 rotate-45 -ml-1" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Horizontal Line / Notch Button */}
              <button
                type="button"
                onClick={() => scrollToPrompt(msg.id)}
                title={`Jump to Prompt #${idx + 1}: ${previewText.slice(0, 30)}...`}
                className="group relative flex items-center justify-center p-1 rounded-sm cursor-pointer focus:outline-none"
              >
                <div
                  className={`rounded-full transition-all duration-200 ease-out ${
                    isActive
                      ? 'w-5 h-[3px] bg-accent-primary shadow-[0_0_8px_rgba(217,122,63,0.85)] scale-105'
                      : 'w-3 h-[2px] bg-border/80 hover:w-5 hover:h-[2.5px] hover:bg-accent-primary/80 hover:shadow-[0_0_5px_rgba(217,122,63,0.5)]'
                  }`}
                />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PromptNavigator
