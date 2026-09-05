import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface ThinkingIndicatorProps {
  duration?: string
  steps?: string[]
  defaultExpanded?: boolean
  className?: string
}

/**
 * ThinkingIndicator Component
 * Follows DESIGN.md Section 4C & Section 6:
 * - Caption-style italic meta text ("Thought for 6 seconds")
 * - Single amber dot with uneven rhythm pulse
 * - Expandable Elevation 1 panel with thin left amber rule and monospace reasoning text
 */
export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  duration = 'Thought for 6 seconds',
  steps = [
    'Parsing AST dependencies and token scope...',
    'Analyzing data flow bottlenecks in render pipeline...',
    'Generating optimized memoized virtualized tree...',
  ],
  defaultExpanded = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className={`select-none ${className}`}>
      {/* Header Caption */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="group inline-flex items-center gap-2 font-mono text-xs italic text-text-muted hover:text-text-primary transition-colors cursor-pointer py-1"
      >
        {/* Pulsing Darkroom Amber Dot (DESIGN.md Section 6: uneven rhythm) */}
        <motion.span
          animate={{
            scale: [1, 1.25, 0.9, 1.15, 1],
            opacity: [0.8, 1, 0.7, 1, 0.8],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: 'easeInOut',
            times: [0, 0.25, 0.55, 0.8, 1],
          }}
          className="h-1.5 w-1.5 rounded-full bg-accent-primary shrink-0"
        />
        <span>{duration}</span>
        <span className="font-mono text-[10px] text-text-muted/60 not-italic group-hover:text-accent-primary transition-colors">
          {isExpanded ? '[ collapse ]' : '[ expand ]'}
        </span>
      </button>

      {/* Expandable Elevation-1 Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden mt-1.5 mb-3"
          >
            <div className="rounded-[2px] border-l-2 border-accent-primary bg-surface-1 py-2.5 px-3.5 space-y-1.5">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-accent-primary uppercase block">
                REASONING SEQUENCE
              </span>
              <div className="space-y-1 font-mono text-xs text-text-muted leading-relaxed">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-accent-primary/60 shrink-0">›</span>
                    <span className="text-text-body/90">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ThinkingIndicator
