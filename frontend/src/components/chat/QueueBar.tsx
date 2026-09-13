import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkbench } from '../../lib/WorkbenchContext'

export const QueueBar: React.FC = () => {
  const {
    queuedMessages,
    isQueuePausedForHITL,
    removeFromQueue,
    clearQueue,
    resumeQueue,
  } = useWorkbench()

  if (queuedMessages.length === 0) {
    return null
  }

  return (
    <div className="w-full mb-2.5 rounded-[4px] border border-accent-primary/30 bg-[#16120E]/95 p-2.5 shadow-sm backdrop-blur-md transition-all">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Queue Stack Icon */}
          <div className="flex items-center justify-center h-4 w-4 rounded-[2px] bg-accent-primary/20 text-accent-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="16" y2="18" />
            </svg>
          </div>

          <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-text-primary">
            Message Queue
          </span>

          <span className="font-mono text-[9.5px] px-1.5 py-0.5 rounded-[2px] bg-accent-primary/20 text-accent-primary font-bold border border-accent-primary/40">
            {queuedMessages.length} {queuedMessages.length === 1 ? 'prompt' : 'prompts'}
          </span>

          {/* HITL Suspended / Paused Pill */}
          {isQueuePausedForHITL && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[#382310] border border-amber-500/50 shadow-2xs animate-pulse">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400"></span>
              </span>
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-amber-300 font-bold">
                PAUSED · AWAITING HUMAN DECISION
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isQueuePausedForHITL && (
            <button
              type="button"
              onClick={resumeQueue}
              className="font-mono text-[10px] font-semibold text-accent-primary bg-accent-primary/15 hover:bg-accent-primary hover:text-black px-2 py-0.5 rounded border border-accent-primary/40 transition-all cursor-pointer shadow-2xs flex items-center gap-1"
              title="Dispatch next queued message immediately without waiting for option selection"
            >
              <span>Resume Queue</span>
              <span>→</span>
            </button>
          )}

          <button
            type="button"
            onClick={clearQueue}
            className="font-mono text-[10px] text-text-muted hover:text-red-400 transition-colors px-1.5 py-0.5 cursor-pointer"
            title="Clear all queued messages"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Horizontal List of Queued Messages */}
      <div className="flex items-center gap-2 pt-2 overflow-x-auto scrollbar-thin scrollbar-thumb-surface-2 pb-0.5">
        <AnimatePresence initial={false}>
          {queuedMessages.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.92, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: -4 }}
              transition={{ duration: 0.16 }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] border text-xs max-w-[280px] shrink-0 transition-all shadow-2xs ${
                index === 0 && !isQueuePausedForHITL
                  ? 'bg-accent-primary/10 border-accent-primary/50 text-text-primary'
                  : 'bg-surface-2/90 border-border/80 text-text-muted'
              }`}
            >
              {/* Order Badge */}
              <span
                className={`font-mono text-[9.5px] font-bold px-1.5 py-0.2 rounded-[2px] shrink-0 ${
                  index === 0 && !isQueuePausedForHITL
                    ? 'bg-accent-primary text-black'
                    : 'bg-surface-1 text-text-muted border border-border/70'
                }`}
              >
                #{index + 1}
              </span>

              {/* Message Preview Text */}
              <span
                className="font-body text-[12px] truncate max-w-[160px] text-text-primary font-medium"
                title={item.text}
              >
                {item.text}
              </span>

              {/* Timestamp */}
              <span className="font-mono text-[9px] text-text-muted shrink-0">
                {item.timestamp}
              </span>

              {/* Remove Single Item Button */}
              <button
                type="button"
                onClick={() => removeFromQueue(item.id)}
                className="flex items-center justify-center h-4 w-4 rounded hover:bg-red-500/20 hover:text-red-400 text-text-muted transition-colors shrink-0 ml-auto cursor-pointer"
                title="Remove prompt from queue"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="11"
                  height="11"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default QueueBar
