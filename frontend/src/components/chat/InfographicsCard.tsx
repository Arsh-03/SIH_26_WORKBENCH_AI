import React, { useState, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
} from 'chart.js'
import { Radar, PolarArea, Doughnut, Bar, Line } from 'react-chartjs-2'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Copy,
  Check,
  Flame,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// Register Chart.js elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  ChartTooltip,
  ChartLegend,
  Filler
)

export interface HeatmapData {
  title?: string
  xLabels: string[]
  yLabels: string[]
  values: number[][]
  valueLabel?: string
  minVal?: number
  maxVal?: number
  colorScale?: 'thermal' | 'amber' | 'severity' | 'emerald'
}

export interface KpiItem {
  id?: string
  label: string
  value: string | number
  unit?: string
  target?: string | number
  delta?: string
  deltaType?: 'positive' | 'negative' | 'neutral'
  status?: 'nominal' | 'warning' | 'critical'
  sparkline?: number[]
  description?: string
}

export interface ChartJsSpec {
  type: 'radar' | 'polarArea' | 'doughnut' | 'multi_axis' | 'bar' | 'line'
  title?: string
  description?: string
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
    yAxisID?: string
    fill?: boolean
  }>
}

export interface StaticFigureSpec {
  imageUrl?: string
  base64Data?: string
  caption?: string
  engine?: 'seaborn' | 'matplotlib' | 'pyplot'
  tableData?: Array<Record<string, any>>
}

export interface InfographicSpec {
  type?: 'infographic' | 'heatmap' | 'kpi' | 'chartjs' | 'figure' | 'composite'
  title?: string
  subtitle?: string
  kpis?: KpiItem[]
  heatmap?: HeatmapData
  chartjs?: ChartJsSpec
  figure?: StaticFigureSpec
  rawTable?: Array<Record<string, any>>
}

interface InfographicsCardProps {
  spec: InfographicSpec
  isExpanded?: boolean
}

// Darkroom Editorial Color Palette
const DARKROOM_COLORS = {
  bgDeep: '#181410',
  surface1: '#211B15',
  surface2: '#2A2219',
  border: '#3D3226',
  amber: '#D97A3F',
  emerald: '#10B981',
  safelightRed: '#B8443A',
  gold: '#E5A84B',
  cyan: '#38BDF8',
  violet: '#A78BFA',
  textPrimary: '#F5EFE6',
  textBody: '#D8CDBC',
  textMuted: '#9C8E78',
}

// Global Darkroom Chart.js Defaults
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: DARKROOM_COLORS.textBody,
        font: { family: 'General Sans, sans-serif', size: 11 },
        boxWidth: 12,
        padding: 14,
      },
    },
    tooltip: {
      backgroundColor: DARKROOM_COLORS.surface2,
      borderColor: DARKROOM_COLORS.amber,
      borderWidth: 1,
      titleColor: DARKROOM_COLORS.amber,
      bodyColor: DARKROOM_COLORS.textPrimary,
      padding: 10,
      cornerRadius: 4,
      titleFont: { family: 'Fraunces, serif', size: 12, weight: 'bold' as const },
      bodyFont: { family: 'General Sans, sans-serif', size: 11 },
    },
  },
}

export const InfographicsCard: React.FC<InfographicsCardProps> = ({ spec }) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'kpi' | 'table'>('visual')
  const [copied, setCopied] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number; val: number } | null>(null)
  const [showDetails, setShowDetails] = useState(true)

  const title = spec.title || spec.heatmap?.title || spec.chartjs?.title || 'Industrial Telemetry Infographics'
  const subtitle = spec.subtitle || spec.chartjs?.description || 'Extracted Engineering & Process Performance Analytics'

  const hasKpis = Boolean(spec.kpis && spec.kpis.length > 0)
  const hasHeatmap = Boolean(spec.heatmap && spec.heatmap.values && spec.heatmap.values.length > 0)
  const hasChartJs = Boolean(spec.chartjs && spec.chartjs.datasets && spec.chartjs.datasets.length > 0)
  const hasFigure = Boolean(spec.figure && (spec.figure.imageUrl || spec.figure.base64Data))
  const hasTable = Boolean(
    (spec.rawTable && spec.rawTable.length > 0) ||
    (spec.figure?.tableData && spec.figure.tableData.length > 0)
  )

  const tableData = spec.rawTable || spec.figure?.tableData || []

  // Copy JSON representation
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Export CSV
  const handleExportCsv = () => {
    if (!tableData || tableData.length === 0) return
    const keys = Object.keys(tableData[0])
    const rows = tableData.map((row) => keys.map((k) => `"${row[k] ?? ''}"`).join(','))
    const csvContent = [keys.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${title.replace(/\s+/g, '_').toLowerCase()}_data.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calculate Heatmap color
  const getHeatmapColor = (val: number, min: number, max: number, scale: string = 'thermal') => {
    if (max === min) return DARKROOM_COLORS.amber
    const norm = Math.max(0, Math.min(1, (val - min) / (max - min)))

    if (scale === 'severity') {
      // Emerald (nominal 0) -> Gold (mid 0.5) -> Safelight Red (critical 1.0)
      if (norm < 0.5) {
        const t = norm * 2
        return `rgba(16, 185, 129, ${0.35 + t * 0.55})` // emerald transition
      } else {
        const t = (norm - 0.5) * 2
        return `rgba(184, 68, 58, ${0.45 + t * 0.55})` // safelight red
      }
    }

    if (scale === 'emerald') {
      return `rgba(16, 185, 129, ${0.15 + norm * 0.8})`
    }

    // Default 'thermal' / 'amber': Warm Dark brown -> Rust Amber -> Bright Gold
    if (norm < 0.6) {
      const alpha = 0.2 + norm * 0.75
      return `rgba(217, 122, 63, ${alpha})`
    } else {
      const alpha = 0.5 + (norm - 0.6) * 1.2
      return `rgba(229, 168, 75, ${Math.min(1, alpha)})`
    }
  }

  // Mini SVG Sparkline generator for KPI items
  const renderSparkline = (points?: number[], status?: string) => {
    if (!points || points.length < 2) return null
    const min = Math.min(...points)
    const max = Math.max(...points)
    const range = max - min || 1
    const width = 80
    const height = 24

    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * width
      const y = height - ((p - min) / range) * (height - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    const strokeColor =
      status === 'critical'
        ? DARKROOM_COLORS.safelightRed
        : status === 'warning'
        ? DARKROOM_COLORS.gold
        : DARKROOM_COLORS.emerald

    return (
      <svg className="w-20 h-6 shrink-0 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={`grad-${status || 'norm'}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${height} ${coords.join(' ')} ${width},${height}`}
          fill={`url(#grad-${status || 'norm'})`}
        />
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords.join(' ')}
        />
      </svg>
    )
  }

  // Chart.js Configuration Preparation
  const chartJsOptions = useMemo(() => {
    if (!spec.chartjs) return chartDefaults

    if (spec.chartjs.type === 'radar') {
      return {
        ...chartDefaults,
        scales: {
          r: {
            angleLines: { color: 'rgba(61, 50, 38, 0.6)' },
            grid: { color: 'rgba(61, 50, 38, 0.6)' },
            pointLabels: {
              color: DARKROOM_COLORS.textBody,
              font: { family: 'General Sans, sans-serif', size: 10 },
            },
            ticks: {
              color: DARKROOM_COLORS.textMuted,
              backdropColor: 'transparent',
              font: { size: 9 },
            },
          },
        },
      }
    }

    if (spec.chartjs.type === 'multi_axis') {
      return {
        ...chartDefaults,
        scales: {
          x: {
            grid: { color: 'rgba(61, 50, 38, 0.4)' },
            ticks: { color: DARKROOM_COLORS.textMuted, font: { size: 10 } },
          },
          y: {
            type: 'linear' as const,
            display: true,
            position: 'left' as const,
            grid: { color: 'rgba(61, 50, 38, 0.4)' },
            ticks: { color: DARKROOM_COLORS.amber, font: { size: 10 } },
          },
          y1: {
            type: 'linear' as const,
            display: true,
            position: 'right' as const,
            grid: { drawOnChartArea: false },
            ticks: { color: DARKROOM_COLORS.cyan, font: { size: 10 } },
          },
        },
      }
    }

    return {
      ...chartDefaults,
      scales: {
        x: {
          grid: { color: 'rgba(61, 50, 38, 0.4)' },
          ticks: { color: DARKROOM_COLORS.textMuted, font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(61, 50, 38, 0.4)' },
          ticks: { color: DARKROOM_COLORS.textMuted, font: { size: 10 } },
        },
      },
    }
  }, [spec.chartjs])

  // Processed Chart.js Data
  const chartJsData = useMemo(() => {
    if (!spec.chartjs) return { labels: [], datasets: [] }
    return {
      labels: spec.chartjs.labels,
      datasets: spec.chartjs.datasets.map((ds, idx) => {
        const fallbackColor =
          idx === 0
            ? DARKROOM_COLORS.amber
            : idx === 1
            ? DARKROOM_COLORS.cyan
            : idx === 2
            ? DARKROOM_COLORS.emerald
            : DARKROOM_COLORS.gold

        return {
          ...ds,
          borderColor: ds.borderColor || fallbackColor,
          backgroundColor:
            ds.backgroundColor ||
            (spec.chartjs?.type === 'radar'
              ? `${fallbackColor}33`
              : spec.chartjs?.type === 'doughnut'
              ? [
                  DARKROOM_COLORS.amber,
                  DARKROOM_COLORS.emerald,
                  DARKROOM_COLORS.cyan,
                  DARKROOM_COLORS.gold,
                  DARKROOM_COLORS.violet,
                ]
              : `${fallbackColor}88`),
          borderWidth: ds.borderWidth ?? (spec.chartjs?.type === 'doughnut' ? 1 : 2),
        }
      }),
    }
  }, [spec.chartjs])

  return (
    <div className="my-4 w-full rounded-[4px] border border-border bg-[#181410] overflow-hidden shadow-md font-body">
      {/* Header Bar: Editorial Darkroom styling */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#211B15] border-b border-border gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 rounded bg-[#2A2219] border border-border text-accent-primary">
            <Activity className="h-4 w-4 text-accent-primary" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-display font-medium text-sm text-[#F5EFE6] truncate leading-tight">
              {title}
            </span>
            <span className="font-body text-[11px] text-[#9C8E78] truncate leading-tight">
              {subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* View Tab Switchers */}
          <div className="flex items-center bg-[#181410] rounded-[2px] p-0.5 border border-border/80">
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`px-2 py-0.5 font-mono text-[10.5px] rounded-[2px] transition-colors cursor-pointer ${
                activeTab === 'visual'
                  ? 'bg-accent-primary text-black font-semibold'
                  : 'text-[#9C8E78] hover:text-[#F5EFE6]'
              }`}
            >
              Visual
            </button>
            {hasKpis && (
              <button
                type="button"
                onClick={() => setActiveTab('kpi')}
                className={`px-2 py-0.5 font-mono text-[10.5px] rounded-[2px] transition-colors cursor-pointer ${
                  activeTab === 'kpi'
                    ? 'bg-accent-primary text-black font-semibold'
                    : 'text-[#9C8E78] hover:text-[#F5EFE6]'
                }`}
              >
                KPIs ({spec.kpis?.length})
              </button>
            )}
            {hasTable && (
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`px-2 py-0.5 font-mono text-[10.5px] rounded-[2px] transition-colors cursor-pointer ${
                  activeTab === 'table'
                    ? 'bg-accent-primary text-black font-semibold'
                    : 'text-[#9C8E78] hover:text-[#F5EFE6]'
                }`}
              >
                Data Table
              </button>
            )}
          </div>

          {/* Export / Action Tray */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy Spec JSON"
            className="p-1.5 rounded-[2px] text-[#9C8E78] hover:text-[#F5EFE6] hover:bg-[#2A2219] border border-transparent hover:border-border transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          {hasTable && (
            <button
              type="button"
              onClick={handleExportCsv}
              title="Download CSV"
              className="p-1.5 rounded-[2px] text-[#9C8E78] hover:text-[#F5EFE6] hover:bg-[#2A2219] border border-transparent hover:border-border transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="p-1.5 rounded-[2px] text-[#9C8E78] hover:text-[#F5EFE6] hover:bg-[#2A2219] transition-colors cursor-pointer"
          >
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="p-4 space-y-4">
          {/* TAB 1: VISUAL (Heatmap, Chart.js, or Static Matplotlib/Seaborn Figure) */}
          {activeTab === 'visual' && (
            <div className="space-y-4">
              {/* Heatmap Matrix Visualizer */}
              {hasHeatmap && spec.heatmap && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] font-semibold text-accent-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5" />
                      2D FOULING & ALARM INTENSITY MATRIX
                    </span>
                    <span className="font-mono text-[10px] text-[#9C8E78]">
                      {spec.heatmap.valueLabel || 'Intensity Index'}
                    </span>
                  </div>

                  {/* Matrix Container */}
                  <div className="overflow-x-auto pb-2 border border-border/80 rounded-[3px] bg-[#14100C] p-3">
                    <div className="inline-block min-w-full">
                      {/* Header Row (X Labels) */}
                      <div className="flex items-center gap-1.5 mb-1.5 pl-24">
                        {spec.heatmap.xLabels.map((lbl, xIdx) => (
                          <div
                            key={`x-${xIdx}`}
                            className="w-16 sm:w-20 text-center font-mono text-[10px] font-semibold text-[#D8CDBC] truncate"
                            title={lbl}
                          >
                            {lbl}
                          </div>
                        ))}
                      </div>

                      {/* Matrix Rows */}
                      {spec.heatmap.yLabels.map((yLbl, yIdx) => {
                        const rowVals = spec.heatmap?.values[yIdx] || []
                        const allVals = spec.heatmap?.values.flat() || [0]
                        const min = spec.heatmap?.minVal ?? Math.min(...allVals)
                        const max = spec.heatmap?.maxVal ?? Math.max(...allVals)

                        return (
                          <div key={`row-${yIdx}`} className="flex items-center gap-1.5 mb-1.5">
                            {/* Y Row Header */}
                            <div
                              className="w-24 shrink-0 font-mono text-[10.5px] text-[#9C8E78] truncate text-right pr-2 font-medium"
                              title={yLbl}
                            >
                              {yLbl}
                            </div>

                            {/* Row Cells */}
                            {rowVals.map((val, xIdx) => {
                              const bg = getHeatmapColor(val, min, max, spec.heatmap?.colorScale)
                              const isHovered = hoveredCell?.x === xIdx && hoveredCell?.y === yIdx

                              return (
                                <div
                                  key={`cell-${yIdx}-${xIdx}`}
                                  onMouseEnter={() => setHoveredCell({ x: xIdx, y: yIdx, val })}
                                  onMouseLeave={() => setHoveredCell(null)}
                                  style={{ backgroundColor: bg }}
                                  className={`w-16 sm:w-20 h-10 rounded-[2px] border flex flex-col items-center justify-center transition-all cursor-crosshair relative ${
                                    isHovered
                                      ? 'border-accent-primary scale-105 shadow-md z-10'
                                      : 'border-black/40 hover:border-accent-primary/80'
                                  }`}
                                >
                                  <span className="font-mono text-xs font-bold text-[#F5EFE6] drop-shadow-xs">
                                    {val.toFixed(1)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Heatmap Legend & Tooltip readout */}
                  <div className="flex flex-wrap items-center justify-between text-xs px-1 pt-1 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#9C8E78]">Gradient Scale:</span>
                      <div className="w-28 h-2 rounded-full bg-gradient-to-r from-[#D97A3F]/30 via-[#D97A3F] to-[#E5A84B] border border-border/80" />
                      <span className="font-mono text-[9px] text-[#9C8E78]">Min → Max</span>
                    </div>

                    {hoveredCell && spec.heatmap && (
                      <div className="font-mono text-[10.5px] text-accent-primary bg-[#211B15] px-2 py-0.5 rounded border border-border flex items-center gap-2 animate-in fade-in">
                        <span>
                          [{spec.heatmap.yLabels[hoveredCell.y]}] × [{spec.heatmap.xLabels[hoveredCell.x]}]:
                        </span>
                        <span className="font-bold text-[#F5EFE6]">{hoveredCell.val.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Chart.js Dynamic Canvas (Radar, Multi-Axis, Doughnut, etc.) */}
              {hasChartJs && spec.chartjs && (
                <div className="space-y-2">
                  <div className="h-72 w-full rounded-[3px] bg-[#14100C] border border-border/80 p-3">
                    {spec.chartjs.type === 'radar' && <Radar data={chartJsData} options={chartJsOptions as any} />}
                    {spec.chartjs.type === 'polarArea' && <PolarArea data={chartJsData} options={chartJsOptions as any} />}
                    {spec.chartjs.type === 'doughnut' && <Doughnut data={chartJsData} options={chartJsOptions as any} />}
                    {spec.chartjs.type === 'bar' && <Bar data={chartJsData} options={chartJsOptions as any} />}
                    {(spec.chartjs.type === 'line' || spec.chartjs.type === 'multi_axis') && (
                      <Line data={chartJsData} options={chartJsOptions as any} />
                    )}
                  </div>
                </div>
              )}

              {/* Static Figure Lightbox (Seaborn / Matplotlib Base64 or Image) */}
              {hasFigure && spec.figure && (
                <div className="space-y-2">
                  <div className="relative group rounded-[3px] border border-border bg-[#14100C] overflow-hidden">
                    <div className="p-2 flex items-center justify-between border-b border-border/60 bg-[#211B15] text-[10.5px] font-mono text-[#9C8E78]">
                      <span className="uppercase tracking-wider font-semibold text-accent-primary">
                        {spec.figure.engine?.toUpperCase() || 'PYTHON'} STATISTICAL FIGURE
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                          className="p-1 hover:text-[#F5EFE6] hover:bg-[#2A2219] rounded cursor-pointer"
                          title="Zoom In"
                        >
                          <ZoomIn className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                          className="p-1 hover:text-[#F5EFE6] hover:bg-[#2A2219] rounded cursor-pointer"
                          title="Zoom Out"
                        >
                          <ZoomOut className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomLevel(1)}
                          className="p-1 hover:text-[#F5EFE6] hover:bg-[#2A2219] rounded cursor-pointer"
                          title="Reset Zoom"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsLightboxOpen(true)}
                          className="p-1 hover:text-[#F5EFE6] hover:bg-[#2A2219] rounded cursor-pointer"
                          title="Fullscreen Lightbox"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="overflow-auto max-h-96 flex items-center justify-center p-4 bg-[#100C09]">
                      <img
                        src={spec.figure.imageUrl || spec.figure.base64Data}
                        alt={spec.figure.caption || 'Seaborn statistical plot'}
                        style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease-out' }}
                        className="max-w-full h-auto object-contain rounded-[2px] shadow-sm select-none"
                      />
                    </div>

                    {spec.figure.caption && (
                      <div className="px-3 py-2 bg-[#211B15] border-t border-border/60 text-xs font-body italic text-[#9C8E78]">
                        {spec.figure.caption}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXECUTIVE KPI STATS */}
          {activeTab === 'kpi' && hasKpis && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {spec.kpis?.map((kpi, idx) => {
                const isPositive = kpi.deltaType === 'positive' || (kpi.delta && kpi.delta.startsWith('+'))
                const isWarning = kpi.status === 'warning'
                const isCritical = kpi.status === 'critical'

                return (
                  <div
                    key={kpi.id || `kpi-${idx}`}
                    className="p-3.5 rounded-[3px] bg-[#14100C] border border-border/80 hover:border-accent-primary/60 transition-colors flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-body text-xs text-[#9C8E78] font-medium leading-tight">
                        {kpi.label}
                      </span>
                      {kpi.status && (
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            isCritical
                              ? 'bg-red-500 animate-pulse'
                              : isWarning
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                          title={`Status: ${kpi.status}`}
                        />
                      )}
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-2xl font-bold text-[#F5EFE6] tracking-tight">
                          {kpi.value}
                        </span>
                        {kpi.unit && (
                          <span className="font-mono text-xs text-[#9C8E78] font-medium">
                            {kpi.unit}
                          </span>
                        )}
                      </div>

                      {/* Mini SVG Sparkline */}
                      {renderSparkline(kpi.sparkline, kpi.status)}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                      {kpi.target ? (
                        <span className="font-mono text-[#9C8E78]">
                          Target: <span className="text-[#D8CDBC]">{kpi.target}</span>
                        </span>
                      ) : (
                        <span className="font-mono text-[#9C8E78]">Baseline Metric</span>
                      )}

                      {kpi.delta && (
                        <span
                          className={`font-mono font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-[2px] ${
                            isCritical
                              ? 'bg-red-950/60 text-red-400 border border-red-800/40'
                              : isPositive
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {kpi.delta}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* TAB 3: DATA TABLE */}
          {activeTab === 'table' && hasTable && (
            <div className="overflow-x-auto rounded-[3px] border border-border/80 bg-[#14100C]">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#211B15] text-[#9C8E78] uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    {Object.keys(tableData[0] || {}).map((col) => (
                      <th key={col} className="px-3.5 py-2 font-semibold">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-[#D8CDBC]">
                  {tableData.map((row, rIdx) => (
                    <tr key={`tr-${rIdx}`} className="hover:bg-[#2A2219]/60 transition-colors">
                      {Object.values(row).map((val: any, cIdx) => (
                        <td key={`td-${rIdx}-${cIdx}`} className="px-3.5 py-2 truncate max-w-[200px]">
                          {typeof val === 'number' ? val.toLocaleString() : String(val ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {isLightboxOpen && spec.figure && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex flex-col p-4 sm:p-8 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-border text-[#F5EFE6]">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent-primary" />
              <span className="font-display font-medium text-lg">{title}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="p-2 rounded bg-[#211B15] border border-border hover:border-accent-primary text-[#F5EFE6] cursor-pointer"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <img
              src={spec.figure.imageUrl || spec.figure.base64Data}
              alt="High resolution figure preview"
              className="max-h-full max-w-full object-contain rounded border border-border shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
