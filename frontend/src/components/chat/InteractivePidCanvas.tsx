import React, { useState, useMemo, useRef, useDeferredValue } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Flame,
  ShieldAlert,
  Gauge,
  Activity,
  Sliders,
  X,
  Zap,
  Radio,
} from 'lucide-react'

export interface PidParameterMap {
  [key: string]: string | number
}

export interface PidNode {
  id: string
  tag: string
  name: string
  type: 'boiler' | 'vessel' | 'valve' | 'relief_valve' | 'exchanger' | 'pump' | 'column' | string
  x: number
  y: number
  parameters?: PidParameterMap
  status?: 'nominal' | 'warning' | 'critical' | string
}

export interface PidPipe {
  from: string
  to: string
  label?: string
  fluid?: string
  state?: 'hot' | 'normal' | 'cold' | string
}

export interface PidSpec {
  title?: string
  unit?: string
  system?: string
  operatingPressureBar?: number
  operatingTempC?: number
  nodes: PidNode[]
  pipes: PidPipe[]
  safetyAdvisory?: string
}

interface InteractivePidCanvasProps {
  spec: PidSpec
  isExpanded?: boolean
  onSelectEquipment?: (equipmentTag: string) => void
}

export const InteractivePidCanvas: React.FC<InteractivePidCanvasProps> = ({
  spec,
  isExpanded = false,
  onSelectEquipment
}) => {
  const [zoom, setZoom] = useState(1.0)
  const [selectedNode, setSelectedNode] = useState<PidNode | null>(null)
  const [showSliders, setShowSliders] = useState(true)
  const [showEnvelope, setShowEnvelope] = useState(true)
  const [rawSimTemp, setRawSimTemp] = useState<number>(spec.operatingTempC || 480.0)
  const [rawSimPress, setRawSimPress] = useState<number>(spec.operatingPressureBar || 25.0)

  // React 19 useDeferredValue decouples rapid UI slider thumbs from heavy physics recalculation
  const simTemp = useDeferredValue(rawSimTemp)
  const simPress = useDeferredValue(rawSimPress)

  const handleApplyPreset = (temp: number, press: number) => {
    setRawSimTemp(temp)
    setRawSimPress(press)
  }

  const svgRef = useRef<SVGSVGElement>(null)

  const title = spec.title || 'P&ID Process Schematic Canvas'
  const unit = spec.unit || 'MRPL Refinery Process Block'
  const system = spec.system || 'Steam & Hydrocarbon Network'

  // Dynamic digital twin calculation for effective MAWP and equipment status
  const simCalculations = useMemo(() => {
    // SOP-401 linear degradation: MAWP_eff = 160 * (1 - 0.0015 * (T - 350))
    const baseMawp = 160.0
    const tempDegradationFactor = Math.max(0.4, 1.0 - 0.0015 * Math.max(0, simTemp - 350))
    const effMawp = Number((baseMawp * tempDegradationFactor).toFixed(1))

    // Wall thickness required at simPress (ASME VIII UG-27)
    // t = (P * R) / (S * E - 0.6P) + CA
    const R_mm = 1200.0
    const S_mpa = Math.max(50.0, 118.0 - 0.22 * Math.max(0, simTemp - 350)) // thermal allowable stress drop
    const P_mpa = simPress * 0.1
    const t_min = Number(((P_mpa * R_mm) / (S_mpa * 1.0 - 0.6 * P_mpa) + 3.0).toFixed(2))

    // Larson-Miller creep life estimation (hours)
    const T_K = simTemp + 273.15
    const log_tr = (20500.0 / T_K) - 20.0
    const creepHours = Math.max(10, Math.min(250000, Math.round(Math.pow(10, log_tr))))

    // Operating margin
    const boilerStressRatio = simPress / effMawp
    let boilerStatus: 'nominal' | 'warning' | 'critical' = 'nominal'
    if (boilerStressRatio > 0.85 || simTemp >= 495) boilerStatus = 'critical'
    else if (boilerStressRatio > 0.70 || simTemp >= 460) boilerStatus = 'warning'

    let prvStatus: 'nominal' | 'warning' | 'critical' = 'nominal'
    if (simPress >= 28.0 || simTemp >= 485) prvStatus = 'critical'
    else if (simPress >= 25.0 || simTemp >= 450) prvStatus = 'warning'

    let exchangerStatus: 'nominal' | 'warning' | 'critical' = 'nominal'
    if (creepHours < 2000) exchangerStatus = 'critical'
    else if (creepHours < 10000) exchangerStatus = 'warning'

    return {
      effMawp,
      t_min,
      creepHours,
      boilerStatus,
      prvStatus,
      exchangerStatus
    }
  }, [simTemp, simPress])

  // Map nodes with dynamic status overrides from simulator
  const activeNodes = useMemo(() => {
    return (spec.nodes || []).map((node) => {
      const copy = { ...node, parameters: { ...(node.parameters || {}) } }
      if (node.id === 'B-401' || node.type === 'boiler') {
        copy.status = simCalculations.boilerStatus
        copy.parameters['Simulated Temp'] = `${simTemp}°C`
        copy.parameters['Effective MAWP'] = `${simCalculations.effMawp} bar`
      } else if (node.id === 'PRV-102' || node.type === 'relief_valve') {
        copy.status = simCalculations.prvStatus
        copy.parameters['Relief State'] = simCalculations.prvStatus === 'critical' ? 'ACTIVE RELIEF TO FLARE' : 'Standby / Sealed'
      } else if (node.id === 'E-101' || node.type === 'exchanger') {
        copy.status = simCalculations.exchangerStatus
        copy.parameters['Estimated Creep Life'] = `${simCalculations.creepHours.toLocaleString()} hrs`
      } else if (node.id === 'V-102' || node.type === 'vessel') {
        copy.parameters['Required Wall Thickness'] = `${simCalculations.t_min} mm`
      }
      return copy
    })
  }, [spec.nodes, simCalculations, simTemp])

  // Coordinate lookup for drawing connection pipes
  const nodeMap = useMemo(() => {
    const map = new Map<string, PidNode>()
    activeNodes.forEach((n) => map.set(n.id, n))
    return map
  }, [activeNodes])

  const handleExportSvg = () => {
    if (!svgRef.current) return
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const renderEquipmentSymbol = (node: PidNode) => {
    const isSelected = selectedNode?.id === node.id
    const statusColor = {
      nominal: '#10B981', // Emerald
      warning: '#F59E0B', // Amber
      critical: '#EF4444' // Red
    }[node.status || 'nominal'] || '#D97A3F'

    return (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        onClick={() => {
          setSelectedNode(node)
          if (onSelectEquipment) onSelectEquipment(node.tag)
        }}
        className="cursor-pointer group transition-all duration-300"
      >
        {/* Pulsing selection aura */}
        {isSelected && (
          <circle r="36" fill="none" stroke={statusColor} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" className="animate-spin" style={{ animationDuration: '8s' }} />
        )}

        {/* Outer Glow Halo */}
        <circle r="28" fill="#1D1712" stroke={statusColor} strokeWidth={isSelected ? '2.5' : '1.5'} filter="drop-shadow(0 2px 6px rgba(0,0,0,0.6))" />

        {/* Symbol by Equipment Type */}
        {node.type === 'boiler' && (
          <g transform="translate(-12, -12) scale(1)">
            {/* Furnace chamber & burner flame */}
            <rect x="2" y="4" width="20" height="18" rx="2" fill="#2A1E14" stroke={statusColor} strokeWidth="1.2" />
            <path d="M12 7c-2 3-4 4.5-4 7a4 4 0 0 0 8 0c0-2.5-2-4-4-7z" fill={statusColor} opacity="0.9" />
            <line x1="4" y1="2" x2="4" y2="4" stroke={statusColor} strokeWidth="1.5" />
            <line x1="20" y1="2" x2="20" y2="4" stroke={statusColor} strokeWidth="1.5" />
          </g>
        )}

        {node.type === 'relief_valve' && (
          <g transform="translate(-10, -10)">
            {/* Safety Relief Valve Nozzle & Spring Angle Body */}
            <polygon points="2,16 18,16 10,8" fill="#2A1E14" stroke={statusColor} strokeWidth="1.2" />
            <polygon points="10,8 10,2 14,2" fill="none" stroke={statusColor} strokeWidth="1.5" />
            <circle cx="10" cy="2" r="2.5" fill={statusColor} />
            <line x1="10" y1="16" x2="10" y2="20" stroke={statusColor} strokeWidth="1.5" />
          </g>
        )}

        {node.type === 'vessel' && (
          <g transform="translate(-11, -13)">
            {/* Vertical Cylindrical Pressure Vessel with Dished Heads */}
            <rect x="2" y="5" width="18" height="16" fill="#2A1E14" stroke={statusColor} strokeWidth="1.2" />
            <path d="M2 5a9 4 0 0 1 18 0" fill="#2A1E14" stroke={statusColor} strokeWidth="1.2" />
            <path d="M2 21a9 4 0 0 0 18 0" fill="#2A1E14" stroke={statusColor} strokeWidth="1.2" />
            {/* Liquid level indicator line */}
            <line x1="5" y1="15" x2="17" y2="15" stroke={statusColor} strokeWidth="1" strokeDasharray="2 1" />
          </g>
        )}

        {node.type === 'exchanger' && (
          <g transform="translate(-12, -12)">
            {/* Shell and Tube Exchanger with Baffle Tubes */}
            <circle cx="12" cy="12" r="11" fill="#2A1E14" stroke={statusColor} strokeWidth="1.2" />
            <path d="M4 8 Q 12 16, 20 8" fill="none" stroke={statusColor} strokeWidth="1.2" />
            <path d="M4 16 Q 12 8, 20 16" fill="none" stroke={statusColor} strokeWidth="1.2" />
          </g>
        )}

        {node.type === 'pump' && (
          <g transform="translate(-12, -12)">
            {/* Centrifugal Pump Volute */}
            <circle cx="12" cy="12" r="10" fill="#2A1E14" stroke={statusColor} strokeWidth="1.2" />
            <polygon points="12,2 22,2 17,12" fill={statusColor} opacity="0.85" />
          </g>
        )}

        {/* Tag Label Box below symbol */}
        <rect x="-28" y="32" width="56" height="16" rx="2" fill="#14100C" stroke={statusColor} strokeWidth="0.8" />
        <text x="0" y="43" textAnchor="middle" fill="#F3EADF" fontSize="9" fontFamily="monospace" fontWeight="bold">
          {node.tag}
        </text>
      </g>
    )
  }

  const renderPipe = (pipe: PidPipe, idx: number) => {
    const fromNode = nodeMap.get(pipe.from)
    const toNode = nodeMap.get(pipe.to)
    if (!fromNode || !toNode) return null

    const dx = toNode.x - fromNode.x
    const dy = toNode.y - fromNode.y

    // Orthogonal or smooth curved routing
    let pathD = ''
    if (Math.abs(dy) < 10) {
      pathD = `M ${fromNode.x + 28} ${fromNode.y} L ${toNode.x - 28} ${toNode.y}`
    } else if (Math.abs(dx) < 10) {
      pathD = `M ${fromNode.x} ${fromNode.y + 28} L ${toNode.x} ${toNode.y - 28}`
    } else {
      // Orthogonal elbow
      const midX = fromNode.x + dx * 0.5
      pathD = `M ${fromNode.x + 28} ${fromNode.y} L ${midX} ${fromNode.y} L ${midX} ${toNode.y} L ${toNode.x - 28} ${toNode.y}`
    }

    const strokeColor = pipe.state === 'hot' ? '#D97A3F' : pipe.state === 'cold' ? '#10B981' : '#38BDF8'

    return (
      <g key={`pipe-${idx}`} className="group">
        {/* Glow pipeline trace */}
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" opacity="0.85" strokeLinecap="round" />
        {/* Flow pulses */}
        <path d={pathD} fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.4" strokeDasharray="6 12" className="animate-dash" />

        {/* Stream label banner */}
        {pipe.label && (
          <text
            x={(fromNode.x + toNode.x) / 2}
            y={(fromNode.y + toNode.y) / 2 - 8}
            textAnchor="middle"
            fill="#C9B8A3"
            fontSize="8.5"
            fontFamily="monospace"
            className="select-none pointer-events-none"
          >
            {pipe.label}
          </text>
        )}
      </g>
    )
  }

  return (
    <div className="my-4 w-full rounded-md border border-border/80 bg-surface-1 shadow-sm overflow-hidden transition-all">
      {/* Schematic Top Bar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-surface-2/90 px-4 py-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-accent-primary/10 border border-accent-primary/30">
            <Gauge className="w-4 h-4 text-accent-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] uppercase tracking-wider text-accent-primary font-bold">
                {title}
              </span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-1 border border-border/70 text-text-muted">
                {unit}
              </span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-1 border border-border/70 text-text-muted">
                {system}
              </span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-1 border border-accent-primary/30 text-accent-primary">
                ISA-5.1 · P&ID
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowSliders(!showSliders)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
              showSliders
                ? 'bg-accent-primary/20 text-accent-primary border-accent-primary/50'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-1 border-transparent'
            }`}
            title="Toggle Live Simulation Sliders"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Digital Twin</span>
          </button>

          <div className="h-4 w-px bg-border/60 mx-1" />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-1"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-1"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1.0)}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-1"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleExportSvg}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono text-text-muted hover:text-text-primary hover:bg-surface-1 transition-colors"
            title="Export Schematic as SVG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      {/* Live Digital Twin Parameter Sliders & ASME Operating Envelope Drawer */}
      {showSliders && (
        <div className="bg-[#16120D] border-b border-border/80 p-3.5 space-y-3 font-mono text-xs select-none">
          {/* Preset Scenarios Header Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-bold text-accent-primary tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-accent-primary" />
                SIMULATION PRESETS:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(350, 22.0)}
                  className={`px-2 py-0.5 rounded-[2px] border text-[10px] transition-colors cursor-pointer ${
                    rawSimTemp === 350 && rawSimPress === 22.0
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-surface-2/60 border-border/60 text-text-muted hover:text-text-primary hover:border-emerald-500/50'
                  }`}
                >
                  Nominal Baseline (350°C / 22b)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(465, 26.5)}
                  className={`px-2 py-0.5 rounded-[2px] border text-[10px] transition-colors cursor-pointer ${
                    rawSimTemp === 465 && rawSimPress === 26.5
                      ? 'bg-amber-950/80 border-amber-500 text-amber-300 font-bold'
                      : 'bg-surface-2/60 border-border/60 text-text-muted hover:text-text-primary hover:border-amber-500/50'
                  }`}
                >
                  Superheater High-Load (465°C / 26.5b)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(510, 32.0)}
                  className={`px-2 py-0.5 rounded-[2px] border text-[10px] transition-colors cursor-pointer ${
                    rawSimTemp === 510 && rawSimPress === 32.0
                      ? 'bg-red-950/80 border-red-500 text-red-300 font-bold'
                      : 'bg-surface-2/60 border-border/60 text-text-muted hover:text-text-primary hover:border-red-500/50'
                  }`}
                >
                  Emergency Overpressure Trip (510°C / 32b)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEnvelope(!showEnvelope)}
              className="text-[10px] text-text-muted hover:text-accent-primary flex items-center gap-1 cursor-pointer"
            >
              <span>{showEnvelope ? 'Hide' : 'Show'} ASME Envelope</span>
            </button>
          </div>

          {/* Equipment Focus / Bi-Directional Binding Banner */}
          {selectedNode && (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-[2px] bg-accent-primary/10 border border-accent-primary/40 text-[11px]">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-accent-primary animate-pulse" />
                <span className="text-text-muted uppercase text-[10px]">BOUND EQUIPMENT:</span>
                <span className="font-bold text-accent-primary">{selectedNode.tag}</span>
                <span className="text-text-primary truncate">({selectedNode.name})</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                    selectedNode.status === 'critical'
                      ? 'bg-red-950 text-red-400 border border-red-800'
                      : selectedNode.status === 'warning'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}
                >
                  {selectedNode.status?.toUpperCase() || 'NOMINAL'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-[10px] text-text-muted hover:text-text-primary underline cursor-pointer"
              >
                Clear Binding
              </button>
            </div>
          )}

          {/* Grid Layout: Controls + ASME Operating Envelope Chart */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {/* Column 1 & 2: Real-time 60fps Sliders */}
            <div className="md:col-span-2 space-y-3">
              {/* Temperature Slider */}
              <div className="space-y-1.5 p-2.5 rounded bg-surface-2/40 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-accent-primary" />
                    Furnace / Steam Temp (T)
                  </span>
                  <span className="text-accent-primary font-bold text-sm">{rawSimTemp}°C</span>
                </div>
                <input
                  type="range"
                  min="320"
                  max="530"
                  step="2"
                  value={rawSimTemp}
                  onChange={(e) => setRawSimTemp(Number(e.target.value))}
                  className="w-full accent-[#D97A3F] cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-text-muted">
                  <span>320°C (Idle)</span>
                  <span className="text-emerald-400">350°C (SOP-401 Normal)</span>
                  <span className="text-amber-400">460°C (Creep Warning)</span>
                  <span className="text-red-400 font-semibold">500°C+ (Trip)</span>
                </div>
              </div>

              {/* Pressure Slider */}
              <div className="space-y-1.5 p-2.5 rounded bg-surface-2/40 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    Header Operating Pressure (P)
                  </span>
                  <span className="text-sky-400 font-bold text-sm">{rawSimPress.toFixed(1)} bar</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="36"
                  step="0.2"
                  value={rawSimPress}
                  onChange={(e) => setRawSimPress(Number(e.target.value))}
                  className="w-full accent-[#38BDF8] cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-text-muted">
                  <span>12 bar (Turndown)</span>
                  <span>22 bar (Nominal)</span>
                  <span className="text-amber-400">26.5 bar (MAWP Warning)</span>
                  <span className="text-red-400 font-semibold">28+ bar (PRV-102 Flare)</span>
                </div>
              </div>

              {/* Real-time Recomputed Metrics Strip */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded bg-surface-1 border border-border/60">
                  <span className="text-[9px] text-text-muted block">EFFECTIVE MAWP</span>
                  <span className="text-sm font-bold text-text-primary">{simCalculations.effMawp} bar</span>
                </div>
                <div className="p-2 rounded bg-surface-1 border border-border/60">
                  <span className="text-[9px] text-text-muted block">REQ. WALL THICKNESS</span>
                  <span className="text-sm font-bold text-accent-primary">{simCalculations.t_min} mm</span>
                </div>
                <div className="p-2 rounded bg-surface-1 border border-border/60">
                  <span className="text-[9px] text-text-muted block">CREEP LIFE ESTIMATE</span>
                  <span
                    className={`text-sm font-bold ${
                      simCalculations.creepHours < 2000
                        ? 'text-red-400'
                        : simCalculations.creepHours < 10000
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {simCalculations.creepHours.toLocaleString()} hrs
                  </span>
                </div>
              </div>
            </div>

            {/* Column 3: ASME Section VIII Operating Envelope Chart */}
            {showEnvelope && (
              <div className="p-2.5 rounded bg-[#110D0A] border border-border/80 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between text-[10px] text-text-muted border-b border-border/40 pb-1 mb-1">
                  <span className="font-bold text-accent-primary uppercase tracking-wider">
                    ASME VIII OPERATING ENVELOPE
                  </span>
                  <span
                    className={`font-bold ${
                      simCalculations.boilerStatus === 'critical'
                        ? 'text-red-400 animate-pulse'
                        : simCalculations.boilerStatus === 'warning'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {simCalculations.boilerStatus.toUpperCase()}
                  </span>
                </div>

                {/* SVG 2D Coordinate Map */}
                <div className="relative w-full h-32 flex items-center justify-center">
                  <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
                    {/* Background Grids */}
                    <rect x="25" y="10" width="165" height="85" fill="#18130E" stroke="#3D3226" strokeWidth="0.8" />
                    
                    {/* Safe Operating Zone (Emerald Polygon) */}
                    <polygon
                      points="25,95 25,35 125,48 125,95"
                      fill="rgba(16, 185, 129, 0.18)"
                      stroke="rgba(16, 185, 129, 0.4)"
                      strokeWidth="0.8"
                    />

                    {/* Warning / Thermal Creep Zone (Amber Polygon) */}
                    <polygon
                      points="125,95 125,48 165,60 165,95"
                      fill="rgba(245, 158, 11, 0.2)"
                      stroke="rgba(245, 158, 11, 0.5)"
                      strokeWidth="0.8"
                    />

                    {/* Overpressure / Trip Zone (Red Polygon above boundary) */}
                    <polygon
                      points="25,35 125,48 165,60 190,70 190,10 25,10"
                      fill="rgba(239, 68, 68, 0.18)"
                      stroke="rgba(239, 68, 68, 0.5)"
                      strokeWidth="0.8"
                      strokeDasharray="2 2"
                    />

                    {/* ASME MAWP Boundary Line */}
                    <path
                      d="M 25 35 L 125 48 L 165 60 L 190 70"
                      fill="none"
                      stroke="#B8443A"
                      strokeWidth="1.5"
                    />

                    {/* X-Axis Ticks (300°C to 530°C) */}
                    <text x="25" y="104" fill="#9C8E78" fontSize="7" textAnchor="middle">300°C</text>
                    <text x="125" y="104" fill="#9C8E78" fontSize="7" textAnchor="middle">450°C</text>
                    <text x="190" y="104" fill="#9C8E78" fontSize="7" textAnchor="middle">530°C</text>

                    {/* Y-Axis Ticks (10 bar to 36 bar) */}
                    <text x="20" y="97" fill="#9C8E78" fontSize="7" textAnchor="end">12b</text>
                    <text x="20" y="55" fill="#9C8E78" fontSize="7" textAnchor="end">24b</text>
                    <text x="20" y="15" fill="#9C8E78" fontSize="7" textAnchor="end">36b</text>

                    {/* Dynamic Operating Coordinate Dot */}
                    {(() => {
                      // Map simTemp (300-530) to X (25-190)
                      const clampedT = Math.max(300, Math.min(530, simTemp))
                      const dotX = 25 + ((clampedT - 300) / 230) * 165

                      // Map simPress (12-36) to Y (95-10)
                      const clampedP = Math.max(12, Math.min(36, simPress))
                      const dotY = 95 - ((clampedP - 12) / 24) * 85

                      const dotColor =
                        simCalculations.boilerStatus === 'critical'
                          ? '#EF4444'
                          : simCalculations.boilerStatus === 'warning'
                          ? '#F59E0B'
                          : '#10B981'

                      return (
                        <g>
                          {/* Crosshair guidelines */}
                          <line x1="25" y1={dotY} x2={dotX} y2={dotY} stroke={dotColor} strokeWidth="0.75" strokeDasharray="2 2" opacity="0.6" />
                          <line x1={dotX} y1="95" x2={dotX} y2={dotY} stroke={dotColor} strokeWidth="0.75" strokeDasharray="2 2" opacity="0.6" />

                          {/* Pulsing Aura */}
                          <circle cx={dotX} cy={dotY} r="7" fill={dotColor} opacity="0.25" className="animate-ping" />
                          {/* Main Operating Point Dot */}
                          <circle cx={dotX} cy={dotY} r="3.5" fill={dotColor} stroke="#F5EFE6" strokeWidth="1" />
                        </g>
                      )
                    })()}
                  </svg>
                </div>

                <div className="flex items-center justify-between text-[9px] text-text-muted mt-1 px-1">
                  <span>X: Temperature (°C)</span>
                  <span className="text-accent-primary font-bold">Dot: ({simTemp}°C, {simPress.toFixed(1)}b)</span>
                  <span>Y: Pressure (bar)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main SVG Schematic Canvas */}
      <div className={`relative w-full overflow-hidden bg-[#120E0A] flex items-center justify-center p-2 ${isExpanded ? 'min-h-[520px]' : 'min-h-[380px]'}`}>
        {/* Ambient Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(rgba(217, 122, 63, 0.25) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />

        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}>
          <svg
            ref={svgRef}
            viewBox="0 0 720 360"
            width="720"
            height="360"
            className="select-none"
          >
            {/* Pipelines (Drawn beneath nodes) */}
            {(spec.pipes || []).map((pipe, idx) => renderPipe(pipe, idx))}

            {/* Equipment Nodes */}
            {activeNodes.map((node) => renderEquipmentSymbol(node))}
          </svg>
        </div>

        {/* Selected Equipment Node Flyout Panel */}
        {selectedNode && (
          <div className="absolute top-3 right-3 w-72 rounded-md border border-accent-primary/40 bg-[#1B1510]/95 backdrop-blur-md shadow-lg p-3 space-y-2.5 z-20 transition-all text-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-accent-primary">
                  {selectedNode.tag}
                </span>
                <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-surface-1 border border-border text-text-muted">
                  {selectedNode.type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-surface-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <h4 className="font-title text-[13px] font-semibold text-text-primary">
                {selectedNode.name}
              </h4>
              <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px]">
                <span className="text-text-muted">Status:</span>
                <span
                  className={
                    selectedNode.status === 'critical'
                      ? 'text-red-400 font-bold'
                      : selectedNode.status === 'warning'
                      ? 'text-amber-400 font-bold'
                      : 'text-emerald-400 font-bold'
                  }
                >
                  {selectedNode.status?.toUpperCase() || 'NOMINAL'}
                </span>
              </div>
            </div>

            {/* Parameter Specs List */}
            {selectedNode.parameters && (
              <div className="space-y-1 pt-1 font-mono text-[11px] border-t border-border/40">
                {Object.entries(selectedNode.parameters).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-text-muted">
                    <span className="truncate pr-2">{key}:</span>
                    <span className="text-text-primary font-medium whitespace-nowrap">{String(val)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-2 rounded bg-surface-2/70 border border-border/60 text-[10.5px] text-text-muted leading-relaxed">
              <span className="text-accent-primary font-semibold">Compliance Note: </span>
              Inspected under ASME Section VIII & SOP-401 air-gap compliance schedule.
            </div>
          </div>
        )}
      </div>

      {/* Safety Advisory Banner */}
      {spec.safetyAdvisory && (
        <div className="flex items-start gap-2.5 p-3 bg-[#1A140F] border-t border-border/60 text-xs">
          <div className="p-1 rounded bg-amber-500/10 border border-amber-500/30 mt-0.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="space-y-0.5 font-mono">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
              Safety Advisory & Piping Integrity
            </span>
            <p className="text-[11.5px] text-text-body leading-relaxed font-body">
              {spec.safetyAdvisory}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
