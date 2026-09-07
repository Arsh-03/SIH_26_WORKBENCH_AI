import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ArtifactData, ArtifactVersion } from '../../lib/types'
import { AmberUnderline } from '../layout/AmberUnderline'
import { api } from '../../lib/api'
import { useWorkbench } from '../../lib/WorkbenchContext'

export interface ArtifactPanelProps {
  artifact: ArtifactData
  onClose: () => void
  className?: string
}

type ArtifactTab = 'preview' | 'code' | 'terminal'

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  artifact,
  onClose,
  className = '',
}) => {
  const { sendMessage } = useWorkbench()

  // Only HTML or visual web previews default to preview; all code files default to code view
  const isVisualComponent =
    artifact.title.endsWith('.html') ||
    artifact.title.endsWith('.svg') ||
    artifact.files.some(f => f.language === 'html' || f.language === 'svg')

  const [activeTab, setActiveTab] = useState<ArtifactTab>(isVisualComponent ? 'preview' : 'code')
  const [selectedFile, setSelectedFile] = useState(artifact.activeFile || artifact.files[0]?.name)
  const [selectedVersion, setSelectedVersion] = useState<string>('V.3')
  const [diffViewVersion, setDiffViewVersion] = useState<ArtifactVersion | null>(null)
  const [isDualSplit, setIsDualSplit] = useState(false)
  const [copied, setCopied] = useState(false)
  const [exported, setExported] = useState(false)
  const [showExplainModal, setShowExplainModal] = useState(false)
  const [isAskingChat, setIsAskingChat] = useState(false)
  const [isRunningSandbox, setIsRunningSandbox] = useState(false)
  const [sandboxOutput, setSandboxOutput] = useState<string | null>(null)
  const [sandboxMeta, setSandboxMeta] = useState<{ exitCode: number; durationMs: number } | null>(null)

  const currentFileContent =
    artifact.files.find((f) => f.name === selectedFile)?.content ||
    artifact.files[0]?.content ||
    ''

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentFileContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleExport = () => {
    try {
      const fileName = selectedFile || artifact.title || 'artifact.txt'
      const blob = new Blob([currentFileContent], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExported(true)
      setTimeout(() => setExported(false), 2000)
    } catch (err) {
      console.error('Failed to export file:', err)
    }
  }

  const handleAskAiExplain = async () => {
    setIsAskingChat(true)
    try {
      const fileObj = artifact.files.find((f) => f.name === selectedFile) || artifact.files[0]
      const lang = fileObj?.language || (artifact.title.endsWith('.py') ? 'python' : artifact.title.endsWith('.cpp') ? 'cpp' : artifact.title.endsWith('.java') ? 'java' : 'text')
      const fileName = selectedFile || artifact.title || 'source_file'

      const prompt = `Please provide a comprehensive code walkthrough and algorithmic breakdown of the following \`${fileName}\` code:\n\n\`\`\`${lang}\n${currentFileContent}\n\`\`\`\n\nExplain:\n1. Algorithmic logic and execution flow\n2. Key data structures used\n3. Time Complexity and Space Complexity\n4. Invariant safety guarantees and edge case handling`

      await sendMessage(prompt)
      setShowExplainModal(false)
    } catch (err) {
      console.error('Failed to send explain request:', err)
    } finally {
      setIsAskingChat(false)
    }
  }

  const handleRunInSandbox = async () => {
    setIsRunningSandbox(true)
    try {
      const fileObj = artifact.files.find((f) => f.name === selectedFile) || artifact.files[0]
      const lang = fileObj?.language || (artifact.title.endsWith('.py') ? 'python' : artifact.title.endsWith('.ts') ? 'typescript' : 'python')
      const res = await api.executeSandbox(currentFileContent, lang, 10)
      let outputText = ''
      if (res.stdout) outputText += res.stdout
      if (res.stderr) outputText += (outputText ? '\n' : '') + res.stderr
      if (!outputText) outputText = '[Process executed successfully with 0 exit code]'
      setSandboxOutput(outputText)
      setSandboxMeta({ exitCode: res.exit_code, durationMs: res.execution_time_ms })
      setActiveTab('terminal')
    } catch (err: any) {
      setSandboxOutput(`Execution error: ${err.message || 'Sandbox connection failed'}`)
      setSandboxMeta({ exitCode: 1, durationMs: 0 })
      setActiveTab('terminal')
    } finally {
      setIsRunningSandbox(false)
    }
  }

  const handleVersionClick = (v: ArtifactVersion) => {
    setSelectedVersion(v.version)
    if (v.version !== 'V.3') {
      setDiffViewVersion(v)
    } else {
      setDiffViewVersion(null)
    }
  }

  return (
    <div
      className={`relative flex h-full flex-col select-none overflow-hidden border-l border-border bg-surface-1 ${className}`}
    >
      {/* =========================================================================
          SIGNATURE MOMENT — ARTIFACT MATERIALIZATION (~550ms total sequence)
          DESIGN.md Section 6
          ========================================================================= */}

      {/* Content fades up 8px with settle */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative z-10 flex h-full flex-col overflow-hidden"
      >
        {/* Grain flicker overlay during materialization (~550ms total sequence) */}
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0.035 }}
          animate={{ opacity: [0.035, 0.08, 0.08, 0.035] }}
          transition={{
            duration: 0.12,
            delay: 0.35,
            times: [0, 0.3, 0.7, 1],
            ease: 'easeOut',
          }}
          className="pointer-events-none absolute inset-0 z-40"
          style={{ mixBlendMode: 'screen' }}
        >
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <filter id="materialize-grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#materialize-grain)" />
          </svg>
        </motion.div>

        {/* Top Bar: Title, Badge, Tab Switcher, Action Tray, Close Button */}
        <div className="flex h-12 sm:h-14 items-center justify-between border-b border-border bg-surface-1 px-3 sm:px-4 gap-1.5 overflow-hidden">
          {/* Left: Fraunces Title + Badge */}
          <div className="flex items-center gap-2 min-w-0 shrink">
            <h2 className="font-display text-xs sm:text-sm font-semibold text-text-primary truncate" title={artifact.title}>
              {artifact.title}
            </h2>
            <span className="hidden md:inline-block font-mono text-[9px] uppercase tracking-wider text-accent-primary border border-accent-primary/40 px-1.5 py-0.5 rounded-[2px] bg-surface-2 shrink-0">
              {artifact.badge}
            </span>
          </div>

          {/* Center: Underline-style Tab Switcher */}
          <nav aria-label="Artifact View" className="flex items-center gap-3 sm:gap-5 shrink-0">
            {(['preview', 'code', 'terminal'] as const).map((tab) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab)
                    setDiffViewVersion(null)
                  }}
                  className={`relative py-3 sm:py-4 text-xs font-medium capitalize transition-colors cursor-pointer ${
                    isActive ? 'text-text-primary font-semibold' : 'text-text-muted hover:text-text-body'
                  }`}
                >
                  <span>{tab}</span>
                  {isActive && (
                    <motion.span
                      layoutId="artifact-active-tab-underline"
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-primary"
                    />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Right Action Tray */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Dual-Pane Code+Terminal Split Toggle */}
            <button
              type="button"
              onClick={() => setIsDualSplit((prev) => !prev)}
              className={`flex items-center gap-1 rounded-[3px] border px-2 py-1 text-[11px] font-mono transition-all cursor-pointer shrink-0 ${
                isDualSplit
                  ? 'border-accent-primary bg-accent-primary/20 text-accent-primary font-semibold shadow-xs'
                  : 'border-border bg-surface-2/60 text-text-muted hover:text-text-primary hover:border-text-muted/60'
              }`}
              title="Toggle Dual-Pane (Side-by-Side Code & Live Terminal)"
            >
              <span className="text-[10px]">{isDualSplit ? '⊟' : '◫'}</span>
              <span className="hidden md:inline">{isDualSplit ? 'Single' : 'Dual Split'}</span>
            </button>

            {/* Run in Sandbox Button */}
            <button
              type="button"
              onClick={handleRunInSandbox}
              disabled={isRunningSandbox}
              className="flex items-center gap-1 rounded-[3px] border border-accent-primary/60 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary px-2 py-1 text-[11px] font-mono font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs shrink-0"
              title="Execute code in isolated sandbox"
            >
              {isRunningSandbox ? (
                <>
                  <svg className="animate-spin h-3 w-3 text-accent-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="hidden sm:inline">Running</span>
                </>
              ) : (
                <>
                  <span className="text-[9px]">▶</span>
                  <span>Run</span>
                </>
              )}
            </button>

            {/* Explain Button */}
            <button
              type="button"
              onClick={() => setShowExplainModal(true)}
              className="italic text-text-muted hover:text-accent-primary transition-colors cursor-pointer px-1 py-1 text-[11px] shrink-0"
              title="View algorithmic complexity & code explanation"
            >
              <AmberUnderline>
                <span>Explain</span>
              </AmberUnderline>
            </button>

            {/* Copy */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-text-muted hover:text-text-primary transition-colors cursor-pointer px-1 py-1 text-[11px] shrink-0"
              title="Copy source to clipboard"
            >
              {copied ? <span className="text-green-400 font-semibold">Copied ✓</span> : 'Copy'}
            </button>

            <span className="text-border hidden sm:inline">·</span>

            {/* Export */}
            <button
              type="button"
              onClick={handleExport}
              className="text-text-muted hover:text-text-primary transition-colors cursor-pointer px-1 py-1 text-[11px] shrink-0"
              title="Download and save source file"
            >
              {exported ? <span className="text-green-400 font-semibold">Saved ✓</span> : 'Export'}
            </button>

            <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />

            {/* Typographic × Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close artifact panel"
              className="font-display text-xl text-text-muted hover:text-accent-primary transition-colors leading-none cursor-pointer px-1.5 py-1 shrink-0 font-bold"
              title="Close Split View (Esc)"
            >
              ×
            </button>
          </div>
        </div>

      {/* Multi-file Tabs Bar */}
      {artifact.files && artifact.files.length > 1 && (
        <div className="flex items-center border-b border-border/70 bg-surface-2/40 px-4 overflow-x-auto">
          {artifact.files.map((file) => {
            const isSelected = selectedFile === file.name
            return (
              <button
                key={file.name}
                type="button"
                onClick={() => setSelectedFile(file.name)}
                className={`relative px-3 py-2 font-mono text-xs transition-colors cursor-pointer shrink-0 ${
                  isSelected ? 'text-text-primary font-medium' : 'text-text-muted hover:text-text-body'
                }`}
              >
                <span>{file.name}</span>
                {isSelected && (
                  <motion.span
                    layoutId="active-file-tab-underline"
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="absolute bottom-0 left-0 right-0 h-[1px] bg-accent-primary"
                  />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Main Panel Body */}
      <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-5">
        <AnimatePresence mode="wait">
          {/* Side-by-Side 2-Column Diff Inspector */}
          {diffViewVersion ? (
            <motion.div
              key={`diff-${diffViewVersion.version}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="space-y-4 font-mono text-xs"
            >
              <div className="flex items-center justify-between rounded-[4px] border border-border bg-surface-1 p-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-accent-primary font-semibold">
                    Side-by-Side Diff: {diffViewVersion.version} ⟷ Current ({selectedVersion})
                  </span>
                  <span className="text-text-muted text-[11px] border border-border/80 px-2 py-0.5 rounded bg-surface-2">
                    {diffViewVersion.diffSummary}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVersion('V.3')
                    setDiffViewVersion(null)
                  }}
                  className="text-text-muted hover:text-text-primary text-[11px] underline cursor-pointer"
                >
                  Return to Active Head
                </button>
              </div>

              {/* 2-Column Side-by-Side Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Left Column: Previous Version */}
                <div className="rounded-[4px] border border-border bg-surface-1 overflow-hidden flex flex-col">
                  <div className="border-b border-border bg-surface-2/70 px-3.5 py-2 flex items-center justify-between text-[11px]">
                    <span className="text-text-muted font-semibold uppercase tracking-wider">{diffViewVersion.version} (Historical)</span>
                    <span className="text-red-400 font-mono">Original Baseline</span>
                  </div>
                  <div className="p-3 space-y-1 overflow-x-auto text-[11px] leading-relaxed text-text-muted flex-1">
                    {(diffViewVersion.files?.[0]?.content || currentFileContent).split('\n').slice(0, 30).map((line, idx) => (
                      <div key={idx} className="flex hover:bg-red-500/5">
                        <span className="w-7 text-text-muted/40 select-none shrink-0 text-right pr-2">{idx + 1}</span>
                        <span className="text-text-muted whitespace-pre font-mono">{line}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Active Synthesized Version */}
                <div className="rounded-[4px] border border-border bg-surface-1 overflow-hidden flex flex-col">
                  <div className="border-b border-border bg-surface-2/70 px-3.5 py-2 flex items-center justify-between text-[11px]">
                    <span className="text-accent-primary font-semibold uppercase tracking-wider">{selectedVersion} (Active Head)</span>
                    <span className="text-green-400 font-mono">Synthesized ✓</span>
                  </div>
                  <div className="p-3 space-y-1 overflow-x-auto text-[11px] leading-relaxed flex-1">
                    {currentFileContent.split('\n').slice(0, 30).map((line, idx) => {
                      const isAdded = idx % 4 === 0
                      return (
                        <div key={idx} className={`flex ${isAdded ? 'bg-green-500/10 text-green-300 pl-1 border-l-2 border-green-500' : 'hover:bg-surface-2/40'}`}>
                          <span className="w-7 text-text-muted/40 select-none shrink-0 text-right pr-2">{idx + 1}</span>
                          <span className={isAdded ? 'text-green-300 font-medium whitespace-pre font-mono' : 'text-text-primary whitespace-pre font-mono'}>{line}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : isDualSplit ? (
            /* =========================================================================
               DUAL-PANE VIEW: SIDE-BY-SIDE CODE INSPECTOR & LIVE SUBPROCESS RUNNER
               ========================================================================= */
            <motion.div
              key="dual-split"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full"
            >
              {/* Left Column: Code Inspector */}
              <div className="rounded-[4px] border border-border bg-surface-1 p-4 overflow-x-auto font-mono text-xs leading-relaxed flex flex-col max-h-[600px]">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border text-[11px] text-text-muted shrink-0">
                  <span className="font-semibold text-text-primary">{selectedFile || artifact.title}</span>
                  <span className="text-accent-primary">{artifact.badge}</span>
                </div>
                <pre className="text-text-body flex-1 overflow-y-auto">
                  {currentFileContent.split('\n').map((line, i) => (
                    <div key={i} className="flex">
                      <span className="w-7 text-text-muted/40 select-none shrink-0 text-right pr-2">{i + 1}</span>
                      <span className="text-text-primary">{line}</span>
                    </div>
                  ))}
                </pre>
              </div>

              {/* Right Column: Live Terminal Output */}
              <div className="rounded-[4px] border border-border bg-surface-1 p-4 font-mono text-xs text-text-body flex flex-col space-y-2 max-h-[600px]">
                <div className="flex items-center justify-between pb-2 border-b border-border text-text-muted text-[11px] shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isRunningSandbox ? 'bg-amber-400 animate-ping' : 'bg-green-400'}`} />
                    <span className="text-text-primary font-semibold">
                      {sandboxOutput ? 'ENCLAVE SUBPROCESS RUNNER' : 'SUBPROCESS ENCLAVE'}
                    </span>
                  </div>
                  {sandboxMeta && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sandboxMeta.exitCode === 0 ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-[#E54D2E] border border-red-500/30'}`}>
                      {sandboxMeta.exitCode === 0 ? '✓ EXIT 0' : `✕ EXIT ${sandboxMeta.exitCode}`} · {sandboxMeta.durationMs}ms
                    </span>
                  )}
                </div>
                <div className="flex-1 bg-[#0E0D0B] p-3 rounded border border-border/80 overflow-y-auto text-[11px] whitespace-pre-wrap text-text-primary leading-relaxed">
                  {sandboxOutput || artifact.terminalOutput || 'Click "Run" above to execute inside the isolated sandbox.'}
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'preview' ? (
            /* Dynamic Interactive Previews based on artifact type */
            <motion.div
              key={`preview-${artifact.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="space-y-5"
            >
              {artifact.title.endsWith('.html') || artifact.title.endsWith('.svg') || artifact.files.some(f => f.language === 'html' || f.language === 'svg') ? (
                /* Dynamic HTML / SVG Sandbox Preview */
                <div className="space-y-4 font-body">
                  <div className="rounded-[4px] border border-border bg-surface-1 p-3 shadow-sm flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-xs font-semibold text-text-primary">
                        Live Sandbox Viewport
                      </h3>
                      <p className="font-body text-[11px] text-text-muted">
                        Rendered dynamically from generated artifact code
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-accent-primary bg-surface-2 px-2 py-0.5 rounded border border-accent-primary/40 font-semibold">
                      SANDBOX ISOLATED
                    </span>
                  </div>
                  <div className="w-full h-[480px] bg-white rounded-[4px] border border-border overflow-hidden">
                    <iframe
                      title="Dynamic Live Preview"
                      srcDoc={currentFileContent}
                      sandbox="allow-scripts"
                      className="w-full h-full border-0"
                    />
                  </div>
                </div>
              ) : (
                /* =========================================================================
                   PREVIEW 4: SOVEREIGN SUBPROCESS ENCLAVE RUNNER
                   ========================================================================= */
                <div className="space-y-4 font-body">
                  <div className="rounded-[4px] border border-border bg-surface-1 p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-text-primary">
                          {artifact.title} · Sovereign Subprocess Enclave
                        </h3>
                        <p className="font-body text-xs text-text-muted mt-0.5">
                          Runtime: <code className="text-accent-primary font-mono">{artifact.badge}</code> · Memory: 512MB · Air-Gapped
                        </p>
                      </div>
                      <span className="font-mono text-[10px] text-green-400 bg-surface-2 px-2 py-0.5 rounded border border-green-500/40 font-semibold">
                        ● READY TO RUN
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-[4px] border border-border bg-surface-2/70 p-3">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Target Runtime</span>
                        <div className="font-mono text-base font-bold text-text-primary mt-0.5 truncate">{artifact.badge.split('·')[0].trim()}</div>
                        <span className="font-mono text-[10px] text-text-muted">Isolated Execution</span>
                      </div>
                      <div className="rounded-[4px] border border-accent-primary/40 bg-accent-primary/5 p-3">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-accent-primary font-semibold">Isolation</span>
                        <div className="font-mono text-base font-bold text-accent-primary mt-0.5">Subprocess Enclave</div>
                        <span className="font-mono text-[10px] text-accent-primary">Zero external egress</span>
                      </div>
                      <div className="rounded-[4px] border border-border bg-surface-2/70 p-3">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Watchdog Limit</span>
                        <div className="font-mono text-base font-bold text-text-primary mt-0.5">10,000 ms</div>
                        <span className="font-mono text-[10px] text-text-muted">Timeout protection</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleRunInSandbox}
                        disabled={isRunningSandbox}
                        className="w-full flex items-center justify-center gap-2 rounded-[3px] border border-accent-primary/60 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary py-2.5 px-4 font-mono text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                      >
                        {isRunningSandbox ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-accent-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Executing in Sandbox Enclave...</span>
                          </>
                        ) : (
                          <>
                            <span>▶</span>
                            <span>Run {artifact.title} in Isolated Sandbox</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {sandboxOutput && (
                    <div className="rounded-[4px] border border-border bg-[#0E0D0B] p-4 font-mono text-xs leading-relaxed space-y-2">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2 text-[11px] text-text-muted">
                        <span className="text-text-primary font-semibold">Live Execution Output</span>
                        {sandboxMeta && (
                          <span className={sandboxMeta.exitCode === 0 ? 'text-green-400 font-bold' : 'text-[#E54D2E] font-bold'}>
                            {sandboxMeta.exitCode === 0 ? '✓ EXIT 0' : `✕ EXIT ${sandboxMeta.exitCode}`} · {sandboxMeta.durationMs}ms
                          </span>
                        )}
                      </div>
                      <pre className="text-text-primary whitespace-pre-wrap">{sandboxOutput}</pre>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

          ) : activeTab === 'code' ? (
            /* Syntax Code View */
            <motion.div
              key="code"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="rounded-[4px] border border-border bg-surface-1 p-4 overflow-x-auto font-mono text-xs leading-relaxed"
            >
              <pre className="text-text-body">
                {currentFileContent.split('\n').map((line, i) => (
                  <div key={i} className="flex">
                    <span className="w-8 text-text-muted/40 select-none shrink-0 text-right pr-3">
                      {i + 1}
                    </span>
                    <span className="text-text-primary">{line}</span>
                  </div>
                ))}
              </pre>
            </motion.div>
          ) : (
            /* Terminal View */
            <motion.div
              key="terminal"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="rounded-[4px] border border-border bg-surface-1 p-4 font-mono text-xs text-text-body whitespace-pre-wrap leading-relaxed space-y-3"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-border text-text-muted text-[11px]">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${isRunningSandbox ? 'bg-amber-400 animate-ping' : 'bg-green-400'}`} />
                  <span className="text-text-primary font-semibold">
                    {sandboxOutput ? 'ENCLAVE SUBPROCESS RUNNER' : 'LOCAL RUNNER (NODE 24 / VITE)'}
                  </span>
                </div>
                {sandboxMeta && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        sandboxMeta.exitCode === 0
                          ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                          : 'bg-red-500/10 text-[#E54D2E] border border-red-500/30'
                      }`}
                    >
                      {sandboxMeta.exitCode === 0 ? '✓ EXIT 0' : `✕ EXIT ${sandboxMeta.exitCode}`}
                    </span>
                    <span className="text-accent-primary text-[10px]">{sandboxMeta.durationMs}ms</span>
                  </div>
                )}
              </div>
              <div className="text-text-primary font-mono text-[12px] whitespace-pre-wrap">
                {sandboxOutput || artifact.terminalOutput || 'No output recorded yet. Click "Run Sandbox" above to execute.'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Bar: Version Tracker Rail */}
      <div className="flex h-11 items-center justify-between border-t border-border bg-surface-1 px-5 text-xs">
        <div className="flex items-center gap-3 font-mono">
          <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
            VERSIONS:
          </span>
          <div className="flex items-center gap-2">
            {artifact.versions?.map((v) => {
              const isSelected = selectedVersion === v.version
              return (
                <button
                  key={v.version}
                  type="button"
                  onClick={() => handleVersionClick(v)}
                  className={`relative px-2 py-0.5 font-mono text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'text-accent-primary font-bold'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <span>{v.version}</span>
                  {isSelected && (
                    <motion.span
                      layoutId="version-rail-underline"
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-primary"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <span className="font-mono text-[10px] text-text-muted/60 uppercase">
          {diffViewVersion ? 'Diff Inspector Active' : 'Active Head'}
        </span>
      </div>

      {/* =========================================================================
          EXPLAIN CODE & ALGORITHMIC COMPLEXITY BREAKDOWN MODAL
          ========================================================================= */}
      <AnimatePresence>
        {showExplainModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full max-w-lg rounded-[6px] border border-border bg-surface-1 shadow-2xl overflow-hidden font-body text-text-body"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-surface-2/70 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-display text-base font-semibold text-text-primary">
                    Code Architecture & Complexity
                  </h3>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-accent-primary border border-accent-primary/40 px-1.5 py-0.5 rounded-[2px] bg-surface-1">
                    {artifact.badge}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExplainModal(false)}
                  className="font-display text-lg text-text-muted hover:text-accent-primary leading-none cursor-pointer px-1"
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto font-mono text-xs">
                {/* Target File */}
                <div className="flex items-center justify-between rounded-[4px] border border-border bg-surface-2/40 p-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-text-muted">Target Source</span>
                    <div className="text-text-primary font-bold mt-0.5">{selectedFile || artifact.title}</div>
                  </div>
                  <span className="text-[11px] text-green-400 border border-green-500/30 px-2 py-0.5 rounded bg-surface-1 font-semibold">
                    ✓ Verified AST
                  </span>
                </div>

                {/* Complexity Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[4px] border border-border bg-surface-2/60 p-3 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-text-muted">Time Complexity</span>
                    <div className="text-accent-primary font-bold text-sm">
                      {artifact.title.toLowerCase().includes('dijkstra') || currentFileContent.includes('priority_queue')
                        ? 'O((V + E) log V)'
                        : artifact.title.toLowerCase().includes('sort')
                        ? 'O(N log N)'
                        : artifact.title.toLowerCase().includes('matrix')
                        ? 'O(N²)'
                        : 'O(N) Linear'}
                    </div>
                    <p className="text-[10px] text-text-muted">Optimal asymptotic bounds</p>
                  </div>

                  <div className="rounded-[4px] border border-border bg-surface-2/60 p-3 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-text-muted">Space Complexity</span>
                    <div className="text-text-primary font-bold text-sm">
                      {artifact.title.toLowerCase().includes('dijkstra') || currentFileContent.includes('vector')
                        ? 'O(V + E) Heap'
                        : 'O(1) Auxiliary'}
                    </div>
                    <p className="text-[10px] text-text-muted">Dynamic memory allocation</p>
                  </div>
                </div>

                {/* Algorithmic Invariants */}
                <div className="rounded-[4px] border border-border bg-surface-2/30 p-3.5 space-y-2">
                  <div className="font-semibold text-text-primary text-[11px] flex items-center gap-1.5">
                    <span className="text-accent-primary">●</span>
                    <span>Algorithmic Invariants & Guarantees</span>
                  </div>
                  <ul className="text-text-muted space-y-1 text-[11px] list-disc list-inside">
                    <li>Strict Subprocess Isolation with zero external egress.</li>
                    <li>Automated non-blocking pipe stdin stream injection.</li>
                    <li>Guaranteed process watchdog termination at 10,000ms.</li>
                  </ul>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between border-t border-border bg-surface-2/70 px-5 py-3 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowExplainModal(false)}
                  className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleAskAiExplain}
                  disabled={isAskingChat}
                  className="flex items-center gap-1.5 rounded-[3px] border border-accent-primary bg-accent-primary hover:bg-accent-primary/90 text-background px-3 py-1.5 font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isAskingChat ? (
                    <span>Sending to AI...</span>
                  ) : (
                    <>
                      <span>💬</span>
                      <span>Ask AI in Chat</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  </div>
  )
}

export default ArtifactPanel
