import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { SuggestionCardData } from '../lib/types'
import { mockSuggestionCards } from '../lib/mockData'
import { useWorkbench } from '../lib/WorkbenchContext'
import { InputBar } from '../components/chat/InputBar'
import { MessageBlock } from '../components/chat/MessageBlock'
import { ThinkingIndicator } from '../components/chat/ThinkingIndicator'
import { ArtifactPanel } from '../components/artifact/ArtifactPanel'

/**
 * ChatPage Component
 * Merges Zero State, Active Chat, and Split View into a single unified route.
 * Follows DESIGN.md Section 5:
 * - Zero State: No messages yet → Fraunces greeting, 4 suggestion cards, input bar
 * - Active Chat: Messages exist, no artifact open → full-width stream, input pinned to bottom
 * - Split View: Messages exist AND artifact open → 46% chat / 54% artifact panel
 */
export const ChatPage: React.FC = () => {
  const { id: routeChatId } = useParams<{ id?: string }>()
  const {
    messages,
    sendMessage,
    isStreaming,
    currentThinking,
    stopStreaming,
    activeArtifact,
    isArtifactOpen,
    openArtifact,
    closeArtifact,
    loadChatSession,
  } = useWorkbench()

  const [isCollapsingCards, setIsCollapsingCards] = useState(false)
  const [splitPercent, setSplitPercent] = useState<number>(46)
  const [isDragging, setIsDragging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Drag resizer logic for fluid split adjusting
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100
      // Clamp between 20% and 80% for balanced usability
      const clamped = Math.min(Math.max(newPercent, 20), 80)
      setSplitPercent(clamped)
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
      }
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging])

  // Load chat session if route param is present
  useEffect(() => {
    if (routeChatId) {
      loadChatSession(routeChatId)
    }
  }, [routeChatId, loadChatSession])

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isStreaming])

  // Handle user sending a prompt
  const handleSendMessage = (text: string) => {
    if (messages.length === 0) {
      // Trigger Zero State → Active Chat stagger-collapse last-to-first (DESIGN.md Section 6: ~40ms stagger)
      setIsCollapsingCards(true)
      setTimeout(() => {
        setIsCollapsingCards(false)
        sendMessage(text)
      }, 280)
    } else {
      sendMessage(text)
    }
  }

  // Handle clicking a suggestion card in Zero State
  const handleSelectSuggestion = (card: SuggestionCardData) => {
    setIsCollapsingCards(true)

    // DESIGN.md Section 6: Zero State → Active Chat card stagger-collapse (~40ms stagger last-to-first)
    setTimeout(() => {
      setIsCollapsingCards(false)
      sendMessage(card.prompt)
    }, 280)
  }

  const hasMessages = messages.length > 0

  return (
    <div ref={containerRef} className="relative flex h-full w-full overflow-hidden bg-background">
      {/* 
        Chat Pane:
        - Full width when in Zero State or Active Chat without artifact
        - Resizable width when in Split View (default 46%, user draggable)
      */}
      <motion.div
        animate={{
          width: isArtifactOpen ? `${splitPercent}%` : '100%',
        }}
        transition={
          isDragging
            ? { duration: 0 }
            : {
                type: 'spring',
                stiffness: 260,
                damping: 28,
                mass: 0.9,
              }
        }
        className="relative flex h-full flex-col overflow-hidden min-w-[300px]"
      >
        {!hasMessages ? (
          /* =================================================================
             SCREEN 1: ZERO STATE (Welcome)
             Follows DESIGN.md Screen 1 & Section 5:
             - Fraunces header ("Welcome back, Rashmi")
             - Italic caption subheader
             - 4 index-card suggestion cards in an asymmetric grid
             - Input anchored at bottom
             ================================================================= */
          <div className="flex flex-1 flex-col justify-between px-6 py-8 overflow-y-auto">
            {/* Centered Welcome Hero */}
            <div className="my-auto w-full max-w-4xl mx-auto space-y-8">
              <div className="text-center space-y-2">
                <h1 className="font-display text-4xl font-medium tracking-tight text-text-primary">
                  Welcome back, Rashmi
                </h1>
                <p className="font-display text-base italic text-text-muted">
                  What would you like to build or explore today?
                </p>
              </div>

              {/* 4 Suggestion Cards (Stagger-collapse last-to-first) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <AnimatePresence>
                  {!isCollapsingCards &&
                    mockSuggestionCards.map((card, index) => (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          scale: 0.95,
                          y: 8,
                          transition: {
                            duration: 0.15,
                            delay: (mockSuggestionCards.length - 1 - index) * 0.04, // 40ms stagger last-to-first
                            ease: 'easeOut',
                          },
                        }}
                        transition={{ duration: 0.2, delay: index * 0.05, ease: 'easeOut' }}
                        onClick={() => handleSelectSuggestion(card)}
                        className="group flex flex-col justify-between rounded-[4px] border border-border bg-surface-1 p-4 shadow-sm hover:bg-surface-2/70 hover:border-accent-primary/60 transition-all cursor-pointer min-h-[190px]"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[10px] font-semibold text-accent-primary tracking-wider">
                              {card.categoryCode}
                            </span>
                            <span className="h-1.5 w-1.5 rounded-full bg-border group-hover:bg-accent-primary transition-colors" />
                          </div>
                          <h3 className="font-display text-sm font-medium text-text-primary leading-snug group-hover:text-text-primary">
                            {card.title}
                          </h3>
                          <p className="font-body text-xs text-text-muted mt-2 leading-relaxed line-clamp-3">
                            {card.description}
                          </p>
                        </div>

                        <div className="pt-4 flex items-center justify-between font-mono text-[10px] text-text-muted group-hover:text-accent-primary transition-colors">
                          <span className="uppercase tracking-wider">{card.actionLabel}</span>
                          <span className="text-xs transition-transform group-hover:translate-x-0.5">
                            →
                          </span>
                        </div>
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Zero State Input Bar */}
            <div className="w-full pt-4 pb-2">
              <InputBar
                onSendMessage={handleSendMessage}
                isStreaming={isStreaming}
                onStopStreaming={stopStreaming}
              />
            </div>
          </div>
        ) : (
          /* =================================================================
             SCREEN 2 & 3: ACTIVE CHAT STREAM (Message Feed)
             Follows DESIGN.md Screen 2 & Screen 3:
             - User prompts: Elevation 1 rectangles, right-aligned, hairline borders
             - Model responses: thinking indicator, General Sans body text (leading 1.65)
             - Inline Artifact Cards with diff previews and "Open →" lift
             - Bottom pinned input bar
             ================================================================= */
          <div className="flex flex-1 flex-col h-full overflow-hidden">
            {/* Scrollable Message Feed */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="w-full max-w-3xl mx-auto space-y-6">
                {messages.map((msg) => (
                  <MessageBlock
                    key={msg.id}
                    message={msg}
                    onOpenArtifact={openArtifact}
                    isArtifactOpen={isArtifactOpen}
                  />
                ))}

                {/* Simulated live ThinkingIndicator during model generation */}
                {isStreaming && (
                  <div className="flex flex-col items-start w-full max-w-3xl my-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-accent-primary font-semibold">
                        AI ASSISTANT
                      </span>
                      <span className="font-mono text-[10px] text-text-muted/60">
                        Synthesizing response…
                      </span>
                    </div>
                    <ThinkingIndicator
                      duration={currentThinking?.duration || 'Synthesizing reasoning sequence…'}
                      steps={
                        currentThinking?.steps || [
                          'Parsing AST dependencies and token scope...',
                          'Analyzing data flow bottlenecks in render pipeline...',
                          'Emitting verified TypeScript implementation and artifacts...',
                        ]
                      }
                      defaultExpanded={true}
                    />
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Pinned Input Bar */}
            <div className="border-t border-border/60 bg-background/95 px-6 py-3 shrink-0 backdrop-blur-sm">
              <InputBar
                onSendMessage={handleSendMessage}
                isStreaming={isStreaming}
                onStopStreaming={stopStreaming}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* 
        Interactive Draggable Split Resizer (Visible in Split View)
        - Drag horizontally to expand or shrink the split panes
        - Double-click to reset to default 46% / 54% ratio
      */}
      {isArtifactOpen && activeArtifact && (
        <div
          role="separator"
          aria-label="Resize Split View"
          onMouseDown={() => setIsDragging(true)}
          onDoubleClick={() => setSplitPercent(46)}
          title="Drag to resize split panes · Double-click to reset"
          className={`relative z-30 flex h-full w-2.5 -mx-1.5 cursor-col-resize items-center justify-center transition-colors group select-none ${
            isDragging ? 'bg-accent-primary/20' : 'hover:bg-accent-primary/20'
          }`}
        >
          {/* Subtle line */}
          <div
            className={`h-full w-[1px] transition-colors ${
              isDragging ? 'bg-accent-primary shadow-[0_0_8px_rgba(217,122,63,0.7)]' : 'bg-border group-hover:bg-accent-primary/80'
            }`}
          />
          {/* Centered Grab Handle Pill with dots */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all ${
              isDragging
                ? 'bg-accent-primary scale-y-125 shadow-sm'
                : 'bg-border/80 group-hover:bg-accent-primary'
            }`}
          >
            <span className="w-0.5 h-0.5 rounded-full bg-surface-1" />
            <span className="w-0.5 h-0.5 rounded-full bg-surface-1" />
            <span className="w-0.5 h-0.5 rounded-full bg-surface-1" />
          </div>
        </div>
      )}

      {/* 
        Artifact Right Pane: Resizable width in Split View (default 54%)
        Collapsible via close button, asymmetric on purpose (DESIGN.md Section 1)
      */}
      <AnimatePresence>
        {isArtifactOpen && activeArtifact && (
          <motion.div
            initial={{ width: '0%', opacity: 0 }}
            animate={{ width: `${100 - splitPercent}%`, opacity: 1 }}
            exit={{ width: '0%', opacity: 0 }}
            transition={
              isDragging
                ? { duration: 0 }
                : {
                    type: 'spring',
                    stiffness: 260,
                    damping: 28,
                    mass: 0.9,
                  }
            }
            className="relative h-full flex flex-col overflow-hidden min-w-[320px]"
          >
            <ArtifactPanel
              artifact={activeArtifact}
              onClose={closeArtifact}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ChatPage
