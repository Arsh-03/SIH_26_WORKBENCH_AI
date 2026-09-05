import React, { useState } from 'react'
import { motion } from 'framer-motion'
import type { ArtifactData } from '../../lib/types'

export interface ArtifactCardProps {
  artifact: ArtifactData
  onOpen: () => void
  isOpen?: boolean
  className?: string
}

/**
 * ArtifactCard Component
 * Follows DESIGN.md Section 4D & Section 6:
 * - Contact-sheet framed card, sharp 4px radius, hairline border
 * - Monospace filename title + italic caption subtext
 * - Inline diff preview: additions underlined amber, removals struck through in Safelight Red
 * - Amber text link "Open →" with brief outward 2px translateY lift on click
 */
export const ArtifactCard: React.FC<ArtifactCardProps> = ({
  artifact,
  onOpen,
  isOpen = false,
  className = '',
}) => {
  const [isDiffExpanded, setIsDiffExpanded] = useState(true)
  const [isLifting, setIsLifting] = useState(false)

  const handleOpenClick = () => {
    setIsLifting(true)
    setTimeout(() => {
      setIsLifting(false)
      onOpen()
    }, 120)
  }

  return (
    <motion.div
      animate={{
        y: isLifting ? -2 : 0,
        boxShadow: isLifting
          ? '0 6px 20px rgba(0, 0, 0, 0.5), 0 0 0 1px #D97A3F'
          : '0 2px 8px rgba(0, 0, 0, 0.35)',
      }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className={`relative my-3 max-w-2xl rounded-[4px] border border-border bg-surface-1 overflow-hidden select-none ${className}`}
    >
      {/* Contact-Sheet Top Bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface-2/40 px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-xs font-semibold text-text-primary truncate">
            {artifact.title}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-accent-primary bg-surface-1 border border-accent-primary/30 px-1.5 py-0.5 rounded-[2px] shrink-0">
            {artifact.badge}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {artifact.diffPreview && artifact.diffPreview.length > 0 && (
            <button
              type="button"
              onClick={() => setIsDiffExpanded((prev) => !prev)}
              className="font-mono text-[11px] text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              {isDiffExpanded ? 'Hide Diff' : 'Show Diff'}
            </button>
          )}

          {/* Action: Amber text link "Open →" */}
          <button
            type="button"
            onClick={handleOpenClick}
            className={`font-mono text-xs font-semibold text-accent-primary transition-all flex items-center gap-1 cursor-pointer hover:underline ${
              isOpen ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <span>{isOpen ? 'Viewing' : 'Open'}</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Subtext info */}
      <div className="px-4 py-2 text-xs italic text-text-muted border-b border-border/40 flex items-center justify-between bg-surface-1">
        <span>Click to inspect code, preview rendered component, or execute terminal checks.</span>
        <span className="font-mono text-[10px] text-text-muted/70 not-italic">
          {artifact.files?.length ?? 1} files
        </span>
      </div>

      {/* Inline Diff Preview */}
      {isDiffExpanded && artifact.diffPreview && artifact.diffPreview.length > 0 && (
        <div className="bg-background/95 p-3 font-mono text-[11px] leading-relaxed overflow-x-auto space-y-1">
          {artifact.diffPreview.map((line, idx) => {
            if (line.type === 'addition') {
              return (
                <div key={idx} className="flex items-start gap-2 text-text-primary">
                  <span className="text-accent-primary font-bold shrink-0">+</span>
                  <span className="underline decoration-accent-primary/80 underline-offset-2">
                    {line.content.replace(/^\+\s*/, '')}
                  </span>
                </div>
              )
            }
            if (line.type === 'deletion') {
              return (
                <div key={idx} className="flex items-start gap-2 text-accent-secondary opacity-75">
                  <span className="font-bold shrink-0">-</span>
                  <span className="line-through decoration-accent-secondary">
                    {line.content.replace(/^-\s*/, '')}
                  </span>
                </div>
              )
            }
            return (
              <div key={idx} className="flex items-start gap-2 text-text-muted">
                <span className="invisible shrink-0"> </span>
                <span>{line.content}</span>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

export default ArtifactCard
