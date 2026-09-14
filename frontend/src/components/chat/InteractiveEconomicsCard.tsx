import React, { useState } from 'react'
import { DollarSign, TrendingDown, AlertTriangle, CheckCircle2, ShieldAlert, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

export interface EconomicsMetric {
  label: string
  value: string
  detail?: string
}

export interface CostBreakdownItem {
  item: string
  cost: string
  percentage?: number
}

export interface EconomicsSpec {
  title?: string
  facility?: string
  currency?: string
  headlineMetric?: {
    label: string
    value: string
    severity?: 'critical' | 'warning' | 'optimal' | string
  }
  metrics?: EconomicsMetric[]
  costBreakdown?: CostBreakdownItem[]
  tacticalRecommendation?: string
}

interface InteractiveEconomicsCardProps {
  spec: EconomicsSpec
}

export const InteractiveEconomicsCard: React.FC<InteractiveEconomicsCardProps> = ({ spec }) => {
  const [copied, setCopied] = useState(false)
  const [showDetails, setShowDetails] = useState(true)

  const title = spec.title || 'Operational Financial Impact Assessment'
  const facility = spec.facility || 'MRPL Refinery Operations'
  const headline = spec.headlineMetric
  const metrics = spec.metrics || []
  const breakdown = spec.costBreakdown || []
  const recommendation = spec.tacticalRecommendation

  const severity = (headline?.severity || 'warning').toLowerCase()
  const severityColors = {
    critical: {
      border: 'border-red-500/50',
      bg: 'bg-red-950/20',
      badge: 'bg-red-900/40 text-red-400 border-red-700/50',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
      icon: <ShieldAlert className="w-4 h-4 text-red-400" />
    },
    warning: {
      border: 'border-amber-500/50',
      bg: 'bg-amber-950/20',
      badge: 'bg-amber-900/40 text-amber-400 border-amber-700/50',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />
    },
    optimal: {
      border: 'border-emerald-500/50',
      bg: 'bg-emerald-950/20',
      badge: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />
    }
  }[severity] || {
    border: 'border-amber-500/50',
    bg: 'bg-amber-950/20',
    badge: 'bg-amber-900/40 text-amber-400 border-amber-700/50',
    glow: '',
    icon: <DollarSign className="w-4 h-4 text-amber-400" />
  }

  const handleCopySummary = () => {
    const text = [
      `[${title} - ${facility}]`,
      headline ? `${headline.label}: ${headline.value}` : '',
      ...metrics.map((m) => `• ${m.label}: ${m.value}${m.detail ? ` (${m.detail})` : ''}`),
      recommendation ? `Recommendation: ${recommendation}` : ''
    ].filter(Boolean).join('\n')

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`my-4 w-full rounded-md border border-border/80 bg-surface-1 shadow-sm overflow-hidden transition-all ${severityColors.glow}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-surface-2/90 px-4 py-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1 rounded bg-accent-primary/10 border border-accent-primary/30">
            <DollarSign className="w-4 h-4 text-accent-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-accent-primary font-bold">
                {title}
              </span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-1 border border-border/70 text-text-muted">
                {facility}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono text-text-muted hover:text-text-primary hover:bg-surface-1 border border-transparent hover:border-border/60 transition-colors"
            title="Copy Financial Assessment"
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
        {/* Headline Hero Banner */}
        {headline && (
          <div className={`flex items-center justify-between p-3.5 rounded border ${severityColors.border} ${severityColors.bg} flex-wrap gap-3`}>
            <div className="space-y-0.5">
              <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
                {headline.label}
              </span>
              <div className="font-mono text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
                {headline.value}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase px-2.5 py-1 rounded border font-semibold ${severityColors.badge}`}>
                {severityColors.icon}
                {headline.severity || 'IMPACT'}
              </span>
            </div>
          </div>
        )}

        {showDetails && (
          <>
            {/* Supporting Metrics Grid */}
            {metrics.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {metrics.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded bg-surface-2/60 border border-border/60 space-y-1 hover:border-border transition-colors"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-muted truncate">
                      {m.label}
                    </div>
                    <div className="font-mono text-[15px] font-semibold text-text-primary">
                      {m.value}
                    </div>
                    {m.detail && (
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        {m.detail}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Cost Breakdown Progress Bars */}
            {breakdown.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-text-muted border-b border-border/40 pb-1">
                  <span>OPERATIONAL COST DRIVERS</span>
                  <span>CONTRIBUTION %</span>
                </div>

                <div className="space-y-2">
                  {breakdown.map((item, bIdx) => {
                    const pct = item.percentage ?? 0
                    return (
                      <div key={bIdx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-primary font-medium">{item.item}</span>
                          <span className="font-mono text-text-muted text-[11px]">
                            {item.cost} <span className="text-accent-primary font-semibold">({pct}%)</span>
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-2 overflow-hidden border border-border/40">
                          <div
                            className="h-full rounded-full bg-accent-primary transition-all duration-500"
                            style={{ width: `${Math.min(Math.max(pct, 2), 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tactical Engineering Recommendation */}
            {recommendation && (
              <div className="flex items-start gap-2.5 p-3 rounded bg-[#1B1612] border border-accent-primary/30">
                <div className="p-1 rounded bg-accent-primary/10 border border-accent-primary/20 mt-0.5">
                  <TrendingDown className="w-3.5 h-3.5 text-accent-primary" />
                </div>
                <div className="space-y-0.5">
                  <span className="font-mono text-[10px] uppercase font-bold text-accent-primary tracking-wide">
                    Operational Mitigation Action
                  </span>
                  <p className="text-xs text-text-body leading-relaxed">
                    {recommendation}
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
