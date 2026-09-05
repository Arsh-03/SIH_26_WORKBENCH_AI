import React from 'react'
import type { ChatMessage, ArtifactData } from '../../lib/types'
import { ThinkingIndicator } from './ThinkingIndicator'
import { ArtifactCard } from './ArtifactCard'

export interface MessageBlockProps {
  message: ChatMessage
  onOpenArtifact: (artifact: ArtifactData) => void
  isArtifactOpen?: boolean
  className?: string
}

/**
 * MessageBlock Component
 * Follows DESIGN.md Screen 2 & Section 4:
 * - User prompt: flat rectangle on Elevation 1 (#211B15), right-aligned, hairline top rule, not a chat bubble
 * - Model response: caption-style thinking indicator, General Sans body text (leading 1.65), inline artifact card
 */
export const MessageBlock: React.FC<MessageBlockProps> = ({
  message,
  onOpenArtifact,
  isArtifactOpen = false,
  className = '',
}) => {
  const isUser = message.sender === 'user'

  if (isUser) {
    return (
      <div className={`flex justify-end my-4 ${className}`}>
        {/* User Prompt: flat rectangle on Elevation 1 with hairline border */}
        <div className="max-w-2xl rounded-[4px] border-t border-r border-l border-b border-border bg-surface-1 px-5 py-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              USER PROMPT
            </span>
            <span className="font-mono text-[10px] text-text-muted/60">
              {message.timestamp}
            </span>
          </div>
          <p className="font-body text-[14px] leading-relaxed text-text-primary whitespace-pre-wrap">
            {message.text}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-start w-full max-w-3xl my-5 space-y-3 ${className}`}>
      {/* Model Response Header */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-accent-primary font-semibold">
          AI ASSISTANT
        </span>
        <span className="font-mono text-[10px] text-text-muted/60">
          {message.timestamp}
        </span>
      </div>

      {/* Thinking Indicator if steps exist */}
      {message.thinkingDuration && (
        <ThinkingIndicator
          duration={message.thinkingDuration}
          steps={message.thinkingSteps}
        />
      )}

      {/* Model Body Text: General Sans, line-height 1.65 */}
      <div className="font-body text-[15px] leading-[1.65] text-text-body whitespace-pre-wrap pl-0.5">
        {message.text}
      </div>

      {/* Inline Artifact Card */}
      {message.artifact && (
        <ArtifactCard
          artifact={message.artifact}
          onOpen={() => onOpenArtifact(message.artifact!)}
          isOpen={isArtifactOpen}
        />
      )}
    </div>
  )
}

export default MessageBlock
