import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ArtifactData, ArtifactVersion } from '../../lib/types'

export interface ArtifactPanelProps {
  artifact: ArtifactData
  onClose: () => void
  className?: string
}

type ArtifactTab = 'preview' | 'code' | 'terminal'

/**
 * ArtifactPanel Component
 * Follows DESIGN.md Section 4E & Section 6:
 * - Signature Artifact Materialization sequence (~550ms): border draw, surface fade, content fade-up with brief grain flicker
 * - Top bar: Fraunces title + amber badge, Preview/Code/Terminal switcher with sliding underline, Explain link, action tray, typographic ×
 * - Multi-file tabs: flat monospace tabs with sliding amber underline
 * - Live interactive preview of the rendered component
 * - Version rail: V.1, V.2, V.3 with diff inspection when selecting earlier versions
 */
export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  artifact,
  onClose,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<ArtifactTab>('preview')
  const [selectedFile, setSelectedFile] = useState(artifact.activeFile || artifact.files[0]?.name)
  const [selectedVersion, setSelectedVersion] = useState<string>('V.3')
  const [diffViewVersion, setDiffViewVersion] = useState<ArtifactVersion | null>(null)
  const [copied, setCopied] = useState(false)

  const currentFileContent =
    artifact.files.find((f) => f.name === selectedFile)?.content ||
    artifact.files[0]?.content ||
    ''

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentFileContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`relative flex h-full flex-col border-l border-border bg-surface-1 select-none overflow-hidden ${className}`}
    >
      {/* Signature Materialization Animated Hairline Left Border */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ originY: 0 }}
        className="absolute top-0 left-0 bottom-0 w-[1px] bg-accent-primary/60 pointer-events-none z-20"
      />

      {/* Top Bar: Title, Badge, Tab Switcher, Action Tray, Close Button */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-surface-1 px-5">
        {/* Left: Fraunces Title + Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="font-display text-base font-semibold text-text-primary truncate">
            {artifact.title}
          </h2>
          <span className="font-mono text-[9px] uppercase tracking-wider text-accent-primary border border-accent-primary/40 px-1.5 py-0.5 rounded-[2px] bg-surface-2 shrink-0">
            {artifact.badge}
          </span>
        </div>

        {/* Center: Underline-style Tab Switcher */}
        <nav aria-label="Artifact View" className="flex items-center gap-6">
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
                className={`relative py-4 text-xs font-medium capitalize transition-colors cursor-pointer ${
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

        {/* Right: Actions (Explain, Copy, Download, Close) */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <button
            type="button"
            className="italic text-text-muted hover:text-accent-primary transition-colors cursor-pointer hidden md:inline"
          >
            Explain
          </button>

          <div className="flex items-center gap-3 text-text-muted">
            <button
              type="button"
              onClick={handleCopyCode}
              className="hover:text-text-primary transition-colors cursor-pointer"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <span>·</span>
            <button
              type="button"
              className="hover:text-text-primary transition-colors cursor-pointer"
            >
              Export
            </button>
          </div>

          <div className="h-4 w-[1px] bg-border" />

          {/* Typographic × Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close artifact panel"
            className="font-display text-lg text-text-muted hover:text-accent-primary transition-colors leading-none cursor-pointer"
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
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute bottom-0 left-0 right-0 h-[1px] bg-accent-primary"
                  />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Main Panel Body */}
      <div className="flex-1 overflow-y-auto bg-background p-5">
        <AnimatePresence mode="wait">
          {/* Diff comparison against historical version */}
          {diffViewVersion ? (
            <motion.div
              key={`diff-${diffViewVersion.version}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="space-y-4 font-mono"
            >
              <div className="flex items-center justify-between rounded-[4px] border border-border bg-surface-1 p-3 text-xs">
                <div>
                  <span className="text-accent-primary font-semibold">
                    Comparing {diffViewVersion.version} against Current (V.3)
                  </span>
                  <p className="text-text-muted text-[11px] mt-0.5">
                    {diffViewVersion.diffSummary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVersion('V.3')
                    setDiffViewVersion(null)
                  }}
                  className="text-text-muted hover:text-text-primary text-[11px] underline"
                >
                  Return to Active
                </button>
              </div>

              <div className="rounded-[4px] border border-border bg-surface-1 p-4 text-xs text-text-body space-y-1">
                <div className="text-accent-secondary line-through">
                  - const rawData = synchronousFetch(endpoint)
                </div>
                <div className="text-accent-primary">
                  {'+ const { records, summary } = useMetrics() // Worker decoupled'}
                </div>
                <div className="text-text-muted">
                  &nbsp;&nbsp;{'return <TelemetryGrid records={records} />'}
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'preview' ? (
            /* Live Interactive Preview */
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="space-y-5"
            >
              {/* Telemetry Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-[4px] border border-border bg-surface-1 p-4 shadow-sm">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    P99 Latency
                  </span>
                  <div className="font-mono text-2xl font-bold text-text-primary mt-1">
                    14.2ms
                  </div>
                  <span className="font-mono text-[10px] text-accent-primary">
                    -14.2% vs prev window
                  </span>
                </div>

                <div className="rounded-[4px] border border-border bg-surface-1 p-4 shadow-sm">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    Throughput
                  </span>
                  <div className="font-mono text-2xl font-bold text-text-primary mt-1">
                    12,480 req/s
                  </div>
                  <span className="font-mono text-[10px] text-text-muted">
                    Sustained 60 FPS
                  </span>
                </div>

                <div className="rounded-[4px] border border-border bg-surface-1 p-4 shadow-sm">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    Error Rate
                  </span>
                  <div className="font-mono text-2xl font-bold text-text-primary mt-1">
                    0.012%
                  </div>
                  <span className="font-mono text-[10px] text-accent-primary">
                    Under 0.05% SLA
                  </span>
                </div>
              </div>

              {/* Data Grid Simulation */}
              <div className="rounded-[4px] border border-border bg-surface-1 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between border-b border-border bg-surface-2/40 px-4 py-2.5">
                  <span className="font-mono text-xs font-semibold text-text-primary">
                    Live Telemetry Event Feed (Virtualized)
                  </span>
                  <span className="font-mono text-[10px] text-accent-primary">
                    ● Streaming
                  </span>
                </div>

                <div className="divide-y divide-border/40 font-mono text-xs">
                  {[
                    { ep: '/api/v1/telemetry/aggregate', status: 200, latency: '8.4ms', time: '14:23:01' },
                    { ep: '/api/v1/auth/session-token', status: 200, latency: '12.1ms', time: '14:23:00' },
                    { ep: '/api/v1/graphql/resolvers', status: 200, latency: '15.6ms', time: '14:22:58' },
                    { ep: '/api/v1/stream/sse-events', status: 200, latency: '6.2ms', time: '14:22:55' },
                    { ep: '/api/v1/query/brin-range', status: 200, latency: '9.8ms', time: '14:22:52' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2 text-text-body">
                      <span className="truncate max-w-[240px] text-text-primary">{row.ep}</span>
                      <div className="flex items-center gap-4 shrink-0 text-text-muted text-[11px]">
                        <span className="text-accent-primary">{row.status}</span>
                        <span>{row.latency}</span>
                        <span>{row.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
              className="rounded-[4px] border border-border bg-surface-1 p-4 font-mono text-xs text-text-body whitespace-pre-wrap leading-relaxed"
            >
              <div className="flex items-center gap-2 pb-3 border-b border-border text-text-muted text-[11px]">
                <span className="h-2 w-2 rounded-full bg-accent-primary animate-pulse" />
                <span>LOCAL RUNNER (NODE 24 / VITE)</span>
              </div>
              <div className="pt-3 text-text-primary">
                {artifact.terminalOutput}
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
    </motion.div>
  )
}

export default ArtifactPanel
