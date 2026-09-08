import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
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
 * Normalizes unparsed LaTeX delimiters (e.g. \[...\], \(...\), or bracketed formulas)
 * into standard markdown math syntax ($$...$$ and $...$).
 */
const preprocessMathText = (rawText: string): string => {
  if (!rawText) return ''
  let formatted = rawText.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`)
  formatted = formatted.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`)
  // Transform bracketed equation lines e.g. [ F = 0.6 + \frac{0.4}{...} ]
  formatted = formatted.replace(/(?:^|\n)\s*\[\s*([A-Za-z0-9_\\\+\-\*\/\^\(\)\{\}\=\s,.]+)\s*\]\s*(?=\n|$)/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`)
  return formatted
}

/**
 * MessageBlock Component
 * Follows DESIGN.md Screen 2 & Section 4:
 * - User prompt: flat rectangle on Elevation 1 (#211B15), right-aligned, hairline top rule, not a chat bubble
 * - Model response: caption-style thinking indicator, General Sans body text (leading 1.65), markdown & KaTeX math formatting, inline artifact card
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

  const processedText = preprocessMathText(message.text)

  return (
    <div className={`flex flex-col items-start w-full max-w-3xl my-5 space-y-3 ${className}`}>
      {/* Model Response Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-widest text-accent-primary font-semibold">
          AI ASSISTANT
        </span>

        {/* Active Dynamic Model Tag Badge */}
        {message.modelUsed && (
          <div
            title={message.routingReason ? `Routed by Dynamic Model Router: ${message.routingReason}` : `Active Model: ${message.modelUsed}`}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] bg-surface-2/90 text-text-primary border border-border/80 px-2 py-0.5 rounded-[3px] shadow-2xs group hover:border-accent-primary/50 transition-colors cursor-help"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-primary"></span>
            </span>
            <span className="font-medium tracking-tight text-accent-primary">{message.modelUsed}</span>
            {message.modelCapability && (
              <span className="text-[9px] uppercase tracking-wider text-text-muted/80 border-l border-border/60 pl-1.5">
                {message.modelCapability}
              </span>
            )}
          </div>
        )}

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

      {/* Model Body Text: General Sans, line-height 1.65 with Markdown Parsing & KaTeX Math */}
      <div className="font-body text-[15px] leading-[1.7] text-text-body pl-0.5 space-y-2.5 w-full">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
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
          {processedText}
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
