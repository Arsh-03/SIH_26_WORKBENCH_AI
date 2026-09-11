import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy,
  Check,
  Play,
  Terminal,
  RotateCcw,
  Sliders,
  Send,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useWorkbench } from '../../lib/WorkbenchContext'
import {
  useShikiHighlighting,
  detectInteractiveInputs,
  type ShikiToken,
} from './SyntaxHighlighter'

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
  inputUsed?: string
}

export const InteractiveCodeBlock: React.FC<InteractiveCodeBlockProps> = ({
  code,
  language = 'python',
}) => {
  const { updateArtifactTerminal } = useWorkbench()
  const [copied, setCopied] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [isOutputExpanded, setIsOutputExpanded] = useState(true)

  // Shiki TextMate syntax token highlighting
  const { tokenLines } = useShikiHighlighting(code, language)

  // Interactive standard input state
  const detectedPrompts = useMemo(() => detectInteractiveInputs(code, language), [code, language])
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  const [customStdin, setCustomStdin] = useState<string>('')
  const [showInputModal, setShowInputModal] = useState<boolean>(detectedPrompts.length > 0)
  const [useCustomStdinMode, setUseCustomStdinMode] = useState<boolean>(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy', e)
    }
  }

  const prepareStdinPayload = (): string => {
    if (useCustomStdinMode || detectedPrompts.length === 0) {
      return customStdin
    }
    // Collect detected input values in sequential order
    const collected = detectedPrompts.map((p) => inputValues[p.id] || '').join('\n')
    return collected + (collected ? '\n' : '')
  }

  const promptCommand = language === 'c' ? '$ gcc main.c -o main.out && ./main.out' : language === 'cpp' ? '$ g++ main.cpp -o main.out && ./main.out' : language === 'java' ? '$ java Main' : language === 'javascript' || language === 'typescript' ? '$ node script.js' : '$ python3 script.py'

  const formatInteractiveOutput = (stdout: string, inputUsed?: string): string => {
    if (!inputUsed || !stdout) return stdout
    const inputs = inputUsed.split('\n')
    const promptRegex = /([^\n]*?[:\?]\s*)/g
    let match: RegExpExecArray | null
    let inputIdx = 0
    let result = ''

    const matches: Array<{ text: string; index: number; end: number }> = []
    while ((match = promptRegex.exec(stdout)) !== null) {
      if (match[0].trim().length > 0) {
        matches.push({
          text: match[0],
          index: match.index,
          end: match.index + match[0].length,
        })
      }
    }

    if (matches.length > 0 && inputs.length > 0) {
      let currentPos = 0
      for (let i = 0; i < matches.length && inputIdx < inputs.length; i++) {
        const m = matches[i]
        result += stdout.substring(currentPos, m.end)
        const userVal = inputs[inputIdx] !== undefined ? inputs[inputIdx] : ''
        const nextChar = stdout[m.end]
        if (nextChar === '\n') {
          result += userVal
        } else {
          result += `${userVal}\n`
        }
        currentPos = m.end
        inputIdx++
      }
      result += stdout.substring(currentPos)
      return result
    }

    return stdout
  }

  const handleRun = async (overrideStdin?: string) => {
    // If the code requires input and user hasn't opened input panel yet, open it first for user convenience
    if (detectedPrompts.length > 0 && !showInputModal && overrideStdin === undefined) {
      setShowInputModal(true)
      return
    }

    setIsRunning(true)
    setIsOutputExpanded(true)
    const stdinPayload = overrideStdin !== undefined ? overrideStdin : prepareStdinPayload()

    try {
      const res = await api.executeSandbox(code, language || 'python', 10, stdinPayload)
      const formatted = formatInteractiveOutput(res.stdout || '', stdinPayload)
      setResult({
        exitCode: res.exit_code,
        stdout: res.stdout || '',
        stderr: res.stderr || '',
        executionTimeMs: res.execution_time_ms || 0,
        limitsExceeded: res.limits_exceeded || false,
        inputUsed: stdinPayload,
      })
      updateArtifactTerminal(formatted, res.exit_code, res.execution_time_ms, promptCommand)
    } catch (err: any) {
      const errMsg = err?.message || 'Sandbox execution request failed'
      setResult({
        exitCode: 1,
        stdout: '',
        stderr: errMsg,
        executionTimeMs: 0,
        limitsExceeded: false,
        inputUsed: stdinPayload,
      })
      updateArtifactTerminal(`Execution error: ${errMsg}`, 1, 0, promptCommand)
    } finally {
      setIsRunning(false)
    }
  }

  const displayLanguage = language ? language.toUpperCase() : 'PYTHON'
  const lines = code.split('\n')

  return (
    <div className="my-4 overflow-hidden rounded-[6px] border border-border bg-[#181512] shadow-md font-mono text-xs">
      {/* Code Header Bar with VS Code Dark Style */}
      <div className="flex items-center justify-between border-b border-border/80 bg-[#211B15] px-4 py-2 select-none">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]/90 inline-block border border-black/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]/90 inline-block border border-black/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F]/90 inline-block border border-black/20" />
          </div>
          <span className="font-mono text-[11px] font-semibold tracking-wider text-text-muted uppercase ml-1">
            {displayLanguage}
          </span>
          {detectedPrompts.length > 0 && (
            <span className="inline-flex items-center gap-1 font-mono text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-accent-primary border border-amber-500/30 font-medium">
              <Sliders className="h-2.5 w-2.5" />
              Interactive Input ({detectedPrompts.length})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Interactive Input Panel */}
          {detectedPrompts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowInputModal((p) => !p)}
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors cursor-pointer ${
                showInputModal
                  ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
              title="Configure Interactive Standard Inputs"
            >
              <Sliders className="h-3 w-3" />
              <span>Inputs {showInputModal ? '▲' : '▼'}</span>
            </button>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition-colors cursor-pointer px-2 py-1 rounded hover:bg-surface-2"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>

          <div className="h-3 w-[1px] bg-border/80" />

          {/* Run in Sandbox Button */}
          <button
            type="button"
            onClick={() => handleRun()}
            disabled={isRunning}
            className="flex items-center gap-1.5 rounded-[4px] border border-accent-primary/60 bg-accent-primary/15 hover:bg-accent-primary/25 text-accent-primary px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isRunning ? (
              <>
                <svg
                  className="animate-spin h-3 w-3 text-accent-primary"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3 fill-accent-primary text-accent-primary" />
                <span>Run in Sandbox</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Input Prompt Panel */}
      <AnimatePresence>
        {showInputModal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="border-b border-border bg-[#1D1712] p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-accent-primary font-mono text-[11px] font-semibold uppercase tracking-wider">
                <Sliders className="h-3.5 w-3.5" />
                <span>Interactive Program Inputs</span>
              </div>
              <button
                type="button"
                onClick={() => setUseCustomStdinMode(!useCustomStdinMode)}
                className="text-[10px] text-text-muted hover:text-text-primary underline cursor-pointer"
              >
                {useCustomStdinMode ? 'Switch to Guided Prompt Fields' : 'Switch to Raw STDIN'}
              </button>
            </div>

            {!useCustomStdinMode && detectedPrompts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {detectedPrompts.map((prompt, idx) => (
                  <div key={prompt.id} className="space-y-1">
                    <label className="block text-[11px] text-accent-primary font-mono font-medium truncate">
                      {idx + 1}. {prompt.label}
                    </label>
                    <input
                      type="text"
                      value={inputValues[prompt.id] || ''}
                      onChange={(e) =>
                        setInputValues((prev) => ({
                          ...prev,
                          [prompt.id]: e.target.value,
                        }))
                      }
                      placeholder={prompt.placeholder || `Enter value for: ${prompt.label}`}
                      className="w-full rounded-[3px] border border-border bg-surface-2/80 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary font-mono"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-[11px] text-text-body font-mono font-medium">
                  Standard Input Stream (Raw STDIN - Newline Separated):
                </label>
                <textarea
                  rows={2}
                  value={customStdin}
                  onChange={(e) => setCustomStdin(e.target.value)}
                  placeholder="Enter inputs to pass line-by-line (e.g. 10 20 30 or Alice\n25)"
                  className="w-full rounded-[3px] border border-border bg-surface-2/80 p-2 text-xs text-text-primary placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary font-mono"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleRun()}
                disabled={isRunning}
                className="flex items-center gap-1.5 rounded-[3px] bg-accent-primary px-3 py-1.5 text-xs font-semibold text-background hover:bg-accent-primary/90 transition-all cursor-pointer shadow-sm"
              >
                <Send className="h-3 w-3" />
                <span>Submit & Run</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VS Code Dark+ / Tokyo Night Multi-Color Highlighted Code Body via Shiki */}
      <div className="overflow-x-auto p-4 text-[13px] leading-[1.65] bg-[#120F0D]">
        <pre className="text-text-primary font-mono">
          {(tokenLines || (lines.map((l): ShikiToken[] => [{ content: l || ' ' }]))).map((lineTokens, idx) => (
            <div key={idx} className="flex hover:bg-white/[0.03] rounded-[2px] transition-colors">
              <span className="w-8 text-text-muted/35 select-none shrink-0 text-right pr-3.5 text-[11px] font-mono">
                {idx + 1}
              </span>
              <span className="flex-1 font-mono">
                {lineTokens.map((token, tIdx) => (
                  <span
                    key={tIdx}
                    style={{
                      color: token.color,
                      fontStyle: token.fontStyle === 1 ? 'italic' : undefined,
                      fontWeight: token.fontStyle === 2 ? 600 : undefined,
                    }}
                  >
                    {token.content}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </pre>
      </div>

      {/* Sandbox Live Execution Output Drawer (Integrated Terminal Style) */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="border-t border-border bg-[#0C0A09]"
          >
            <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-1.5 bg-[#17130F]">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-accent-primary" />
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    result.exitCode === 0
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}
                >
                  {result.exitCode === 0 ? '✓ PROCESS TERMINATED (EXIT 0)' : `✕ ERROR (EXIT ${result.exitCode})`}
                </span>
                <span className="text-[10px] text-text-muted font-mono">
                  Enclave Execution: <span className="text-accent-primary">{result.executionTimeMs}ms</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRun()}
                  disabled={isRunning}
                  className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-primary cursor-pointer px-1.5 py-0.5 rounded hover:bg-surface-2"
                  title="Re-run program"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Re-run</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOutputExpanded(!isOutputExpanded)}
                  className="text-[10px] text-text-muted hover:text-text-primary cursor-pointer px-1 py-0.5"
                >
                  {isOutputExpanded ? 'Collapse' : 'Expand'}
                </button>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="text-[12px] text-text-muted hover:text-accent-primary cursor-pointer ml-1"
                  title="Close console"
                >
                  ×
                </button>
              </div>
            </div>

            {isOutputExpanded && (
              <div className="p-3.5 font-mono text-[12px] leading-relaxed max-h-64 overflow-y-auto space-y-2">
                <div className="text-text-muted/60 text-[11px] pb-1 border-b border-border/20">
                  <span className="text-accent-primary/90">{promptCommand}</span>
                </div>
                {result.stdout && (
                  <pre className="text-emerald-300/90 whitespace-pre-wrap font-mono">
                    {formatInteractiveOutput(result.stdout, result.inputUsed)}
                  </pre>
                )}
                {result.stderr && (
                  <pre className="text-red-400 whitespace-pre-wrap font-mono mt-1">{result.stderr}</pre>
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

export default InteractiveCodeBlock
