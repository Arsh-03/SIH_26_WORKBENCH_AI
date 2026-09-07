import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { ChatMessage, ArtifactData } from '../../lib/types'
import { ThinkingIndicator } from './ThinkingIndicator'
import { ArtifactCard } from './ArtifactCard'
import { InteractiveCodeBlock } from './InteractiveCodeBlock'

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
 * - Model response: caption-style thinking indicator, General Sans body text (leading 1.65), markdown formatting, inline artifact card
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

      {/* Model Body Text: General Sans, line-height 1.65 with Markdown Parsing */}
      <div className="font-body text-[15px] leading-[1.7] text-text-body pl-0.5 space-y-2.5 w-full">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-2 leading-[1.7] text-text-body">{children}</p>,
            strong: ({ children }) => (
              <strong className="font-semibold text-text-primary tracking-tight">
                {children}
              </strong>
            ),
            h1: ({ children }) => (
              <h1 className="font-title text-[18px] font-semibold text-text-primary mt-3 mb-1.5 border-b border-border/40 pb-1">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="font-title text-[16px] font-semibold text-text-primary mt-3 mb-1">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="font-title text-[15px] font-medium text-accent-primary mt-2 mb-1">
                {children}
              </h3>
            ),
            ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 text-text-body">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-text-body">{children}</ol>,
            li: ({ children }) => <li className="pl-0.5">{children}</li>,
            code: ({ className, children }: any) => {
              const match = /language-(\w+)/.exec(className || '')
              const content = String(children).replace(/\n$/, '')
              const isMultiline = content.includes('\n')
              if (match || isMultiline) {
                return (
                  <InteractiveCodeBlock
                    code={content}
                    language={match ? match[1] : 'python'}
                  />
                )
              }
              return (
                <code className="font-mono text-[13px] bg-surface-2 text-accent-primary px-1.5 py-0.5 rounded border border-border/50">
                  {children}
                </code>
              )
            },
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-accent-primary/60 pl-3 py-1 my-2 text-text-muted bg-surface-1/40 rounded-r text-[14px]">
                {children}
              </blockquote>
            ),
          }}
        >
          {message.text}
        </ReactMarkdown>
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
