import React, { useState } from 'react'
import { CommandPalette } from '../components/layout/CommandPalette'
import { mockCommandPaletteItems } from '../lib/mockData'
import type { CommandPaletteItem } from '../lib/types'

export const DevPreviewPage: React.FC = () => {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [lastSelected, setLastSelected] = useState<string | null>(null)

  const handleSelectItem = (item: CommandPaletteItem) => {
    setLastSelected(`${item.category}: ${item.title}`)
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-8 max-w-5xl">
      {/* Editorial Header */}
      <div className="space-y-2 border-b border-border/80 pb-5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-accent-primary bg-surface-1 border border-accent-primary/30 px-2 py-0.5 rounded-[2px]">
            DEV PREVIEW
          </span>
          <span className="font-mono text-xs text-text-muted">
            Isolation Testbed
          </span>
        </div>
        <h1 className="font-display text-3xl font-semibold text-text-primary">
          Darkroom Editorial Layout Inspection
        </h1>
        <p className="font-body text-sm text-text-muted max-w-2xl">
          Visual testbench for the <strong className="text-text-primary">Sidebar</strong> and{' '}
          <strong className="text-text-primary">Command Palette</strong> components fetched from
          Stitch project &ldquo;AI Artifact Studio Darkroom&rdquo;.
        </p>
      </div>

      {/* Interactive Controls & Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-[4px] border border-border bg-surface-1 p-5 space-y-4">
          <h2 className="font-display text-lg text-text-primary">Command Palette Trigger</h2>
          <p className="font-body text-xs text-text-body">
            Press <kbd className="font-mono bg-surface-2 border border-border px-1.5 py-0.5 rounded text-[11px] text-text-primary">⌘K</kbd> / <kbd className="font-mono bg-surface-2 border border-border px-1.5 py-0.5 rounded text-[11px] text-text-primary">Ctrl+K</kbd> anywhere or click below to verify the scale-in micro-interaction (0.98→1, 150ms) and keyboard navigation.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPaletteOpen(true)}
              className="inline-flex items-center gap-2 rounded-[2px] bg-accent-primary px-4 py-2 font-body text-xs font-semibold text-background shadow-sm hover:brightness-110 transition-all cursor-pointer"
            >
              Open Command Palette (⌘K)
            </button>
            {lastSelected && (
              <span className="font-mono text-[11px] text-text-muted truncate max-w-xs">
                Selected: <span className="text-accent-primary">{lastSelected}</span>
              </span>
            )}
          </div>
        </div>

        <div className="rounded-[4px] border border-border bg-surface-1 p-5 space-y-3">
          <h2 className="font-display text-lg text-text-primary">Design Token Adherence</h2>
          <dl className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="space-y-1">
              <dt className="text-text-muted uppercase text-[10px]">Background</dt>
              <dd className="text-text-primary flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-[2px] bg-background border border-border inline-block" />
                #181410
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-text-muted uppercase text-[10px]">Surface Elevation 1</dt>
              <dd className="text-text-primary flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-[2px] bg-surface-1 border border-border inline-block" />
                #211B15
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-text-muted uppercase text-[10px]">Surface Elevation 2</dt>
              <dd className="text-text-primary flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-[2px] bg-surface-2 border border-border inline-block" />
                #2A2219
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-text-muted uppercase text-[10px]">Darkroom Amber</dt>
              <dd className="text-text-primary flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-[2px] bg-accent-primary inline-block" />
                #D97A3F
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Component Specification Checkpoints */}
      <div className="rounded-[4px] border border-border bg-surface-1 p-6 space-y-4">
        <h2 className="font-display text-lg text-text-primary">Specification Verification Matrix</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-body text-text-body">
          <div className="space-y-2 border-l-2 border-accent-primary pl-3">
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-text-primary font-semibold">Sidebar (280px fixed)</h3>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>Header with Fraunces &ldquo;AI ARTIFACT STUDIO v4.2&rdquo; brand</li>
              <li>Text-link &ldquo;+ New Chat&rdquo; with animated amber underline (no filled button)</li>
              <li>TOC navigation: Chats (24), Projects (05), Library (18)</li>
              <li>PROJECTS — TOC numbered list (01–05)</li>
              <li>PINNED CHATS with darkroom amber pin glyph</li>
              <li>RECENTS single-line truncated sessions</li>
              <li>Square avatar (4px radius) + &ldquo;Settings&rdquo; text link</li>
            </ul>
          </div>
          <div className="space-y-2 border-l-2 border-accent-primary pl-3">
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-text-primary font-semibold">Command Palette (Controlled)</h3>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>Dimmed backdrop (75% opacity) preserving film-grain texture</li>
              <li>Elevation 2 surface (#2A2219) with sharp 4px border radius</li>
              <li>Framer Motion scale-in micro-interaction (0.98→1, 150ms)</li>
              <li>Serif input: &ldquo;Jump to a chat, project, or command…&rdquo;</li>
              <li>Categorized items: CHATS, PROJECTS, COMMANDS</li>
              <li>Active item indicator: 3px amber left border rule</li>
              <li>Full arrow-key navigation (↑/↓), Enter selection, Escape close</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Standalone preview of Command Palette */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        items={mockCommandPaletteItems}
        onSelectItem={handleSelectItem}
      />
    </div>
  )
}

export default DevPreviewPage
