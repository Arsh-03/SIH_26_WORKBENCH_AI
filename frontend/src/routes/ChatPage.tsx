import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatMessage, ArtifactData, SuggestionCardData } from '../lib/types'
import {
  mockSuggestionCards,
  mockInitialMessages,
  mockArtifactData,
  mockChatSessions,
} from '../lib/mockData'
import { InputBar } from '../components/chat/InputBar'
import { MessageBlock } from '../components/chat/MessageBlock'
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeArtifact, setActiveArtifact] = useState<ArtifactData | null>(null)
  const [isArtifactOpen, setIsArtifactOpen] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCollapsingCards, setIsCollapsingCards] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load chat session if route param is present
  useEffect(() => {
    if (routeChatId) {
      const found = mockChatSessions.find((s) => s.id === routeChatId)
      if (found) {
        setMessages(found.messages)
        const art = found.messages.find((m) => m.artifact)?.artifact
        if (art) {
          setActiveArtifact(art)
        }
      }
    }
  }, [routeChatId])

  // Listen for global "New Chat" event from Sidebar
  useEffect(() => {
    const handleResetToZero = () => {
      setMessages([])
      setActiveArtifact(null)
      setIsArtifactOpen(false)
      setIsStreaming(false)
      setIsCollapsingCards(false)
    }

    window.addEventListener('workbench:new-chat', handleResetToZero)
    return () => window.removeEventListener('workbench:new-chat', handleResetToZero)
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isStreaming])

  // Handle user sending a prompt
  const handleSendMessage = (text: string) => {
    const newUserMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    // Transition from Zero State to Active Chat
    setIsCollapsingCards(true)
    setTimeout(() => {
      setMessages((prev) => [...prev, newUserMsg])
      setIsStreaming(true)

      // Simulate model streaming response with thinking and artifact
      setTimeout(() => {
        const newModelMsg: ChatMessage = {
          id: `model-${Date.now()}`,
          sender: 'model',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          thinkingDuration: 'Thought for 4 seconds',
          thinkingSteps: [
            'Inspected input dependencies and syntax requirements...',
            'Decoupled synchronous event handling to preserve 60 FPS scroll...',
            'Emitted verified TypeScript implementation and compiled artifacts.',
          ],
          text: `I have analyzed your request: "${text}".\n\nHere is the updated implementation with optimized virtualized data streams, telemetry metrics, and unit test suites.`,
          artifact: {
            ...mockArtifactData,
            title: text.includes('Rate Limiter')
              ? 'RateLimiter.ts'
              : text.includes('Postgres')
                ? '001_brin_migration.sql'
                : mockArtifactData.title,
          },
        }

        setMessages((prev) => [...prev, newModelMsg])
        setIsStreaming(false)
      }, 1400)
    }, 180)
  }

  // Handle clicking a suggestion card in Zero State
  const handleSelectSuggestion = (card: SuggestionCardData) => {
    setIsCollapsingCards(true)

    // DESIGN.md Section 6: Zero State → Active Chat card stagger-collapse (~40ms stagger)
    setTimeout(() => {
      if (card.id === 'card-1') {
        // Load the full sample conversation with EnhancedDashboard.tsx
        setMessages(mockInitialMessages)
      } else {
        handleSendMessage(card.prompt)
      }
    }, 200)
  }

  const handleOpenArtifact = (artifact: ArtifactData) => {
    setActiveArtifact(artifact)
    setIsArtifactOpen(true)
  }

  const handleCloseArtifact = () => {
    setIsArtifactOpen(false)
  }

  const hasMessages = messages.length > 0

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-background">
      {/* 
        Chat Pane:
        - Full width when in Zero State or Active Chat without artifact
        - 46% width when in Split View (DESIGN.md Section 1 & Section 5)
      */}
      <motion.div
        animate={{
          width: isArtifactOpen ? '46%' : '100%',
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 32,
          mass: 0.9,
          // Spring overshoot under 2% per DESIGN.md Section 6
        }}
        className="relative flex h-full flex-col overflow-hidden min-w-[360px]"
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
                          },
                        }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
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
                    onOpenArtifact={handleOpenArtifact}
                    isArtifactOpen={isArtifactOpen}
                  />
                ))}

                {/* Streaming pulse indicator */}
                {isStreaming && (
                  <div className="flex items-center gap-2 font-mono text-xs italic text-accent-primary py-2">
                    <span className="h-2 w-2 rounded-full bg-accent-primary animate-pulse" />
                    <span>Halide-V4 synthesizing code artifacts…</span>
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
                onStopStreaming={() => setIsStreaming(false)}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* 
        Artifact Right Pane: 54% width in Split View
        Collapsible via close button, asymmetric on purpose (DESIGN.md Section 1)
      */}
      <AnimatePresence>
        {isArtifactOpen && activeArtifact && (
          <motion.div
            initial={{ width: '0%', opacity: 0 }}
            animate={{ width: '54%', opacity: 1 }}
            exit={{ width: '0%', opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 32,
              mass: 0.9,
            }}
            className="relative h-full flex flex-col overflow-hidden"
          >
            <ArtifactPanel
              artifact={activeArtifact}
              onClose={handleCloseArtifact}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ChatPage
