import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/api'

interface InteractiveCodeBlockProps {
  code: string
  language?: string
}

interface ExecutionResult {
  exitCode: number
  stdout: string
  stderr: string
  executionTimeMs: number
  limitsExceeded: boolean
}

export const InteractiveCodeBlock: React.FC<InteractiveCodeBlockProps> = ({
  code,
  language = 'python',
}) => {
  const [copied, setCopied] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [isOutputExpanded, setIsOutputExpanded] = useState(true)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy', e)
    }
  }

  const handleRun = async () => {
    setIsRunning(true)
    setIsOutputExpanded(true)
    try {
      const res = await api.executeSandbox(code, language || 'python', 10)
      setResult({
        exitCode: res.exit_code,
        stdout: res.stdout || '',
        stderr: res.stderr || '',
        executionTimeMs: res.execution_time_ms || 0,
        limitsExceeded: res.limits_exceeded || false,
      })
    } catch (err: any) {
      setResult({
        exitCode: 1,
        stdout: '',
        stderr: err?.message || 'Sandbox execution request failed',
        executionTimeMs: 0,
        limitsExceeded: false,
      })
    } finally {
      setIsRunning(false)
    }
  }

  const displayLanguage = language ? language.toUpperCase() : 'CODE'
  const lines = code.split('\n')

  return (
    <div className="my-3 overflow-hidden rounded-[4px] border border-border bg-surface-1 shadow-sm font-mono text-xs">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-border/80 bg-surface-2/60 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent-primary/80" />
          <span className="font-mono text-[10px] font-semibold tracking-wider text-text-muted uppercase">
            {displayLanguage}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-surface-1"
          >
            <span>{copied ? '✓ Copied' : 'Copy'}</span>
          </button>

          <div className="h-3 w-[1px] bg-border/80" />

          {/* Run in Sandbox Button */}
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 rounded-[3px] border border-accent-primary/50 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin h-3 w-3 text-accent-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Running...</span>
              </>
            ) : (
              <>
                <span className="text-[10px]">▶</span>
                <span>Run in Sandbox</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Body */}
      <div className="overflow-x-auto p-3 text-[13px] leading-relaxed bg-[#141210]">
        <pre className="text-text-primary font-mono">
          {lines.map((line, idx) => (
            <div key={idx} className="flex">
              <span className="w-7 text-text-muted/40 select-none shrink-0 text-right pr-3 text-[11px]">
                {idx + 1}
              </span>
              <span className="text-text-body">{line || ' '}</span>
            </div>
          ))}
        </pre>
      </div>

      {/* Sandbox Live Execution Output Drawer */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="border-t border-border bg-[#0E0D0B]"
          >
            <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-1.5 bg-surface-2/40">
              <div className="flex items-center gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    result.exitCode === 0
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                      : 'bg-red-500/10 text-[#E54D2E] border border-red-500/30'
                  }`}
                >
                  {result.exitCode === 0 ? '✓ EXIT 0' : `✕ EXIT ${result.exitCode}`}
                </span>
                <span className="text-[10px] text-text-muted">
                  Enclave Execution: <span className="text-accent-primary">{result.executionTimeMs}ms</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOutputExpanded(!isOutputExpanded)}
                  className="text-[10px] text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {isOutputExpanded ? 'Collapse' : 'Expand'}
                </button>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="text-[11px] text-text-muted hover:text-accent-primary cursor-pointer ml-1"
                >
                  ×
                </button>
              </div>
            </div>

            {isOutputExpanded && (
              <div className="p-3 font-mono text-[12px] leading-relaxed max-h-56 overflow-y-auto">
                {result.stdout && (
                  <pre className="text-green-300/90 whitespace-pre-wrap">{result.stdout}</pre>
                )}
                {result.stderr && (
                  <pre className="text-red-400 whitespace-pre-wrap mt-1">{result.stderr}</pre>
                )}
                {!result.stdout && !result.stderr && (
                  <span className="text-text-muted italic">[Program executed with no console output]</span>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
