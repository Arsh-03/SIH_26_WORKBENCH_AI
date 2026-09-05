import React, { useState } from 'react'

export const SettingsPage: React.FC = () => {
  const [model, setModel] = useState('Halide-V4 (Pro Reasoning)')
  const [temperature, setTemperature] = useState(0.2)
  const [reasoningEffort, setReasoningEffort] = useState<'high' | 'medium' | 'low'>('high')
  const [filmGrainEnabled, setFilmGrainEnabled] = useState(true)
  const [autoSaveArtifacts, setAutoSaveArtifacts] = useState(true)
  const [telemetryStreaming, setTelemetryStreaming] = useState(true)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleSave = () => {
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  return (
    <div className="flex-1 px-8 py-8 overflow-y-auto max-w-4xl mx-auto w-full space-y-8 select-none">
      {/* Editorial Header */}
      <div className="border-b border-border/80 pb-5 space-y-1.5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-medium tracking-tight text-text-primary">
            Settings
          </h1>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-[2px] bg-accent-primary px-4 py-1.5 font-body text-xs font-semibold text-background hover:brightness-110 transition-all cursor-pointer shadow-sm"
          >
            {savedSuccess ? 'Saved ✓' : 'Save Preferences'}
          </button>
        </div>
        <p className="font-display text-sm italic text-text-muted">
          System preferences, darkroom calibration, model defaults, and API connections.
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Section 1: Model Calibration */}
        <section className="rounded-[4px] border border-border bg-surface-1 p-5 space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="font-display text-lg font-medium text-text-primary">
              Model Calibration & Reasoning
            </h2>
            <p className="font-body text-xs text-text-muted mt-0.5">
              Configure underlying inference defaults and reasoning deliberation intensity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-body">
            <div className="space-y-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-text-body block">
                Default Inference Engine
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-[2px] border border-border bg-surface-2 px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none"
              >
                <option>Halide-V4 (Pro Reasoning)</option>
                <option>Halide-V3 (Standard Coding)</option>
                <option>Halide-Light (Ultra-low Latency)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[11px] uppercase tracking-wider text-text-body">
                  Temperature
                </label>
                <span className="font-mono text-accent-primary">{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-accent-primary cursor-pointer mt-2"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="font-mono text-[11px] uppercase tracking-wider text-text-body block">
              Reasoning Effort Deliberation
            </label>
            <div className="flex items-center gap-3">
              {(['high', 'medium', 'low'] as const).map((effort) => (
                <button
                  key={effort}
                  type="button"
                  onClick={() => setReasoningEffort(effort)}
                  className={`px-3 py-1.5 rounded-[2px] font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                    reasoningEffort === effort
                      ? 'bg-surface-2 text-accent-primary border border-accent-primary font-semibold'
                      : 'border border-border bg-surface-1 text-text-muted hover:text-text-primary'
                  }`}
                >
                  {effort}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2: Darkroom Aesthetics */}
        <section className="rounded-[4px] border border-border bg-surface-1 p-5 space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="font-display text-lg font-medium text-text-primary">
              Darkroom Visual Calibration
            </h2>
            <p className="font-body text-xs text-text-muted mt-0.5">
              Manage film-grain noise texture, contrast profiles, and baseline typography rhythm.
            </p>
          </div>

          <div className="space-y-3 text-xs font-body">
            <div className="flex items-center justify-between py-2 border-b border-border/40">
              <div>
                <span className="font-medium text-text-primary block">
                  Analog Film-Grain Overlay
                </span>
                <span className="text-text-muted text-[11px]">
                  Fixed SVG screen-blend noise filter (3.5% opacity) across workspace
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFilmGrainEnabled((p) => !p)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  filmGrainEnabled ? 'bg-accent-primary justify-end' : 'bg-surface-2 justify-start border border-border'
                }`}
              >
                <div className="bg-background w-4 h-4 rounded-full shadow-sm" />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium text-text-primary block">
                  Primary Theme Accent
                </span>
                <span className="text-text-muted text-[11px]">
                  Darkroom Amber (#D97A3F) · Kept strictly under 10% screen distribution
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-text-primary">
                <span className="w-3.5 h-3.5 rounded-[2px] bg-accent-primary inline-block" />
                #D97A3F
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Developer Environment */}
        <section className="rounded-[4px] border border-border bg-surface-1 p-5 space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="font-display text-lg font-medium text-text-primary">
              Developer Environment & Tools
            </h2>
            <p className="font-body text-xs text-text-muted mt-0.5">
              Code execution policies, workspace telemetry, and local artifacts persistence.
            </p>
          </div>

          <div className="space-y-3 text-xs font-body">
            <div className="flex items-center justify-between py-2 border-b border-border/40">
              <div>
                <span className="font-medium text-text-primary block">
                  Auto-Save Generated Artifacts
                </span>
                <span className="text-text-muted text-[11px]">
                  Write incremental versions directly to local storage cache
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAutoSaveArtifacts((p) => !p)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  autoSaveArtifacts ? 'bg-accent-primary justify-end' : 'bg-surface-2 justify-start border border-border'
                }`}
              >
                <div className="bg-background w-4 h-4 rounded-full shadow-sm" />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium text-text-primary block">
                  Live Virtualized Telemetry Stream
                </span>
                <span className="text-text-muted text-[11px]">
                  Keep live performance metrics active on Preview tabs
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTelemetryStreaming((p) => !p)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  telemetryStreaming ? 'bg-accent-primary justify-end' : 'bg-surface-2 justify-start border border-border'
                }`}
              >
                <div className="bg-background w-4 h-4 rounded-full shadow-sm" />
              </button>
            </div>
          </div>
        </section>

        {/* Section 4: MCP & Integrations */}
        <section className="rounded-[4px] border border-border bg-surface-1 p-5 space-y-3 font-mono text-xs">
          <div className="border-b border-border/60 pb-2 flex items-center justify-between">
            <span className="uppercase tracking-widest text-text-primary font-semibold text-[11px]">
              STITCH MCP INTEGRATION
            </span>
            <span className="text-accent-primary text-[10px] bg-surface-2 px-2 py-0.5 rounded-[2px] border border-accent-primary/30">
              ● CONNECTED
            </span>
          </div>

          <p className="font-body text-xs text-text-muted leading-relaxed">
            Connected to Stitch Remote Protocol endpoint at <code className="text-text-primary bg-surface-2 px-1 py-0.5 rounded">https://stitch.googleapis.com/mcp</code>. Project ID: <code className="text-accent-primary">projects/12582686884709768980</code>.
          </p>
        </section>
      </div>
    </div>
  )
}

export default SettingsPage
