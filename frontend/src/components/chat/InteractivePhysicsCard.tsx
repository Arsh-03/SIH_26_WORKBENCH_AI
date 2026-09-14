import React, { useState, useMemo } from 'react'
import katex from 'katex'
import { Activity, ShieldCheck, AlertOctagon, AlertTriangle, Copy, Check, ChevronDown, ChevronUp, Cpu } from 'lucide-react'

export interface PhysicsInputItem {
  name: string
  value: string
}

export interface PhysicsResultItem {
  name: string
  value: string
  highlight?: boolean
}

export interface PhysicsSpec {
  title?: string
  standard?: string
  equipment?: string
  status?: 'PASS' | 'WARNING' | 'FAIL' | string
  marginOfSafety?: number
  formulaLatex?: string
  inputs?: PhysicsInputItem[]
  results?: PhysicsResultItem[]
  safetyAssessment?: string
}

interface InteractivePhysicsCardProps {
  spec: PhysicsSpec
}

export const InteractivePhysicsCard: React.FC<InteractivePhysicsCardProps> = ({ spec }) => {
  const [copied, setCopied] = useState(false)
  const [showDetails, setShowDetails] = useState(true)

  const title = spec.title || 'ASME First-Principles Mechanical Calculation'
  const standard = spec.standard || 'ASME Section VIII, Division 1'
  const equipment = spec.equipment || 'Pressure Equipment'
  const status = (spec.status || 'PASS').toUpperCase()
  const margin = spec.marginOfSafety ?? 0
  const inputs = spec.inputs || []
  const results = spec.results || []
  const assessment = spec.safetyAssessment
  const formulaLatex = spec.formulaLatex

  // Render LaTeX math using KaTeX safely
  const renderedFormulaHtml = useMemo(() => {
    if (!formulaLatex) return null
    try {
      return katex.renderToString(formulaLatex, {
        displayMode: true,
        throwOnError: false
      })
    } catch {
      return null
    }
  }, [formulaLatex])

  const statusConfig = {
    PASS: {
      border: 'border-emerald-500/50',
      bg: 'bg-emerald-950/20',
      badge: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50',
      barColor: 'bg-emerald-500',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />
    },
    WARNING: {
      border: 'border-amber-500/50',
      bg: 'bg-amber-950/20',
      badge: 'bg-amber-900/40 text-amber-400 border-amber-700/50',
      barColor: 'bg-amber-500',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />
    },
    FAIL: {
      border: 'border-red-500/50',
      bg: 'bg-red-950/20',
      badge: 'bg-red-900/40 text-red-400 border-red-700/50',
      barColor: 'bg-red-500',
      icon: <AlertOctagon className="w-4 h-4 text-red-400" />
    }
  }[status] || {
    border: 'border-amber-500/50',
    bg: 'bg-amber-950/20',
    badge: 'bg-amber-900/40 text-amber-400 border-amber-700/50',
    barColor: 'bg-amber-500',
    icon: <Activity className="w-4 h-4 text-amber-400" />
  }

  const handleCopy = () => {
    const text = [
      `[${title} - ${standard}]`,
      `Equipment: ${equipment}`,
      `Status: ${status} | Margin of Safety: ${margin}%`,
      formulaLatex ? `Formula: ${formulaLatex}` : '',
      'Results:',
      ...results.map((r) => `  • ${r.name}: ${r.value}`),
      assessment ? `Assessment: ${assessment}` : ''
    ].filter(Boolean).join('\n')

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-4 w-full rounded-md border border-border/80 bg-surface-1 shadow-sm overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-surface-2/90 px-4 py-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1 rounded bg-accent-primary/10 border border-accent-primary/30">
            <Cpu className="w-4 h-4 text-accent-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-accent-primary font-bold">
                {title}
              </span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-1 border border-border/70 text-text-muted">
                {standard}
              </span>
              {equipment && (
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-1 border border-accent-primary/30 text-accent-primary">
                  {equipment}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono text-text-muted hover:text-text-primary hover:bg-surface-1 border border-transparent hover:border-border/60 transition-colors"
            title="Copy Calculation Specs"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-1 transition-colors"
            title={showDetails ? 'Collapse' : 'Expand'}
          >
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Compliance Status & Margin of Safety Gauge */}
        <div className={`p-3.5 rounded border ${statusConfig.border} ${statusConfig.bg} flex flex-col gap-2.5`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase px-2.5 py-1 rounded border font-semibold ${statusConfig.badge}`}>
                {statusConfig.icon}
                STATUS: {status}
              </span>
              <span className="font-mono text-xs text-text-muted">
                ASME Code Compliance
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-text-muted">Margin of Safety:</span>
              <span className="text-text-primary font-bold text-sm">{margin > 0 ? `+${margin}%` : `${margin}%`}</span>
            </div>
          </div>

          {/* Margin Gauge Bar */}
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden border border-border/40 relative">
              <div
                className={`h-full rounded-full ${statusConfig.barColor} transition-all duration-700`}
                style={{ width: `${Math.min(Math.max(margin + 50, 5), 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono text-text-muted">
              <span>-50% (CRITICAL BURST)</span>
              <span className="text-amber-400 font-semibold">0% (MIN ALLOWABLE)</span>
              <span>+50% (OPTIMAL SAFETY)</span>
            </div>
          </div>
        </div>

        {showDetails && (
          <>
            {/* Mathematical Formula Preview */}
            {renderedFormulaHtml ? (
              <div className="p-3 rounded bg-surface-2/60 border border-border/60 text-center overflow-x-auto">
                <div
                  className="inline-block text-text-primary text-sm py-1 px-2"
                  dangerouslySetInnerHTML={{ __html: renderedFormulaHtml }}
                />
              </div>
            ) : formulaLatex ? (
              <div className="p-2.5 rounded bg-surface-2/60 border border-border/60 font-mono text-xs text-accent-primary text-center">
                {formulaLatex}
              </div>
            ) : null}

            {/* Calculated Results Table */}
            {results.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-mono text-[10.5px] uppercase tracking-wide text-text-muted border-b border-border/40 pb-1">
                  CALCULATED DESIGN SPECIFICATIONS
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {results.map((r, rIdx) => (
                    <div
                      key={rIdx}
                      className={`p-2.5 rounded border transition-colors ${
                        r.highlight
                          ? 'bg-accent-primary/10 border-accent-primary/40 shadow-xs'
                          : 'bg-surface-2/60 border-border/60'
                      }`}
                    >
                      <div className="font-mono text-[10px] uppercase text-text-muted truncate">
                        {r.name}
                      </div>
                      <div
                        className={`font-mono text-[15px] font-semibold tracking-tight mt-0.5 ${
                          r.highlight ? 'text-accent-primary font-bold' : 'text-text-primary'
                        }`}
                      >
                        {r.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input Parameters */}
            {inputs.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-mono text-[10.5px] uppercase tracking-wide text-text-muted border-b border-border/40 pb-1">
                  OPERATING PARAMETERS & MATERIAL SPECS
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {inputs.map((inp, iIdx) => (
                    <div
                      key={iIdx}
                      className="flex items-center justify-between p-2 rounded bg-surface-2/40 border border-border/40"
                    >
                      <span className="text-text-muted truncate pr-2">{inp.name}</span>
                      <span className="font-mono text-text-primary font-medium text-[11px] whitespace-nowrap">
                        {inp.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Engineering Assessment Note */}
            {assessment && (
              <div className="flex items-start gap-2.5 p-3 rounded bg-[#1A1813] border border-border/80">
                <div className="p-1 rounded bg-surface-2 border border-border/60 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="space-y-0.5">
                  <span className="font-mono text-[10px] uppercase font-bold text-emerald-400 tracking-wide">
                    Engineering Safety Assessment
                  </span>
                  <p className="text-xs text-text-body leading-relaxed">
                    {assessment}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
