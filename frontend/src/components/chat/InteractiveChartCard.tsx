import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  PieChart as PieChartIcon,
  Table as TableIcon,
  Check,
  Copy,
  Layers,
  MoreHorizontal,
  FileSpreadsheet,
  Image as ImageIcon,
  ArrowUpDown,
} from "lucide-react";

export interface ChartSeries {
  key: string;
  name: string;
  color?: string;
}

export type SupportedChartType = "line" | "bar" | "area" | "pie";

export interface ChartSpec {
  type?: SupportedChartType;
  allowedTypes?: SupportedChartType[];
  title?: string;
  description?: string;
  xAxisKey?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  series?: ChartSeries[];
  data: Array<Record<string, any>>;
}

interface InteractiveChartCardProps {
  spec: ChartSpec;
  isExpanded?: boolean;
}

// Analog Darkroom Warm Industrial Palette matching index.css
const PALETTE = [
  "#D97A3F", // Primary Amber / Copper
  "#10B981", // Emerald Green (Safety Thresholds / Verified)
  "#E5A84B", // Warm Gold
  "#B8443A", // Terracotta / Critical
  "#38BDF8", // Sky Cyan (Cool fluids / Water)
  "#A78BFA", // Soft Violet
  "#F59E0B", // Bright Amber
  "#06B6D4", // Teal
];

export const InteractiveChartCard: React.FC<InteractiveChartCardProps> = ({
  spec,
  isExpanded = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const initialType = (spec.type || "line").toLowerCase() as SupportedChartType;
  const [chartType, setChartType] = useState<SupportedChartType>(initialType);
  const [showTable, setShowTable] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc" | "none">("desc");

  // Filter only relevant chart types for this dataset
  const relevantTypes = useMemo<SupportedChartType[]>(() => {
    if (spec.allowedTypes && spec.allowedTypes.length > 0) {
      return spec.allowedTypes;
    }
    switch (initialType) {
      case "line":
        return ["line", "area"];
      case "area":
        return ["area", "line"];
      case "pie":
        return ["pie", "bar"];
      case "bar":
        // If data is single-row breakdown or composition, allow pie
        if (spec.data && spec.data.length === 1) {
          return ["bar", "pie"];
        }
        return ["bar"];
      default:
        return ["line", "area"];
    }
  }, [spec.allowedTypes, initialType, spec.data]);

  // If current chart type is not in relevant types, reset to initial
  useEffect(() => {
    if (!relevantTypes.includes(chartType)) {
      setChartType(relevantTypes[0] || "line");
    }
  }, [relevantTypes, chartType]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const xAxisKey = useMemo(() => {
    if (spec.xAxisKey) return spec.xAxisKey;
    if (!spec.data || spec.data.length === 0) return "category";
    const firstRow = spec.data[0];
    if ("name" in firstRow) return "name";
    const keys = Object.keys(firstRow);
    const candidate = keys.find((k) =>
      /^(temp|temperature|time|date|timestamp|hour|day|unit|category|x|step)/i.test(k)
    );
    return candidate || keys[0] || "category";
  }, [spec.xAxisKey, spec.data]);

  // Standard series list in stable, fixed order
  const rawSeriesList = useMemo(() => {
    if (spec.series && spec.series.length > 0) {
      return spec.series.map((s, idx) => ({
        ...s,
        color: s.color || PALETTE[idx % PALETTE.length],
      }));
    }
    if (spec.data && spec.data.length > 0) {
      const firstRow = spec.data[0];
      const keys = Object.keys(firstRow).filter(
        (k) =>
          k !== xAxisKey &&
          (typeof firstRow[k] === "number" ||
            (!isNaN(Number(firstRow[k])) && typeof firstRow[k] !== "boolean"))
      );
      return keys.map((k, idx) => ({
        key: k,
        name: k.replace(/_/g, " "),
        color: PALETTE[idx % PALETTE.length],
      }));
    }
    return [];
  }, [spec, xAxisKey]);

  // Track active/visible series or categories
  const [hiddenKeys, setHiddenKeys] = useState<Record<string, boolean>>({});

  const toggleKey = (key: string) => {
    setHiddenKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Detect whether data is a single-row wide breakdown (e.g. { Methane: 85, Ethane: 9, ... })
  const isSingleRowBreakdown = useMemo(() => {
    return Boolean(spec.data && spec.data.length === 1 && rawSeriesList.length > 1);
  }, [spec.data, rawSeriesList]);

  // Normalized categorical breakdown data (for clean Pie & single-category Bar charts)
  const categoricalData = useMemo(() => {
    let items: Array<{ name: string; key: string; value: number; color: string }> = [];

    if (isSingleRowBreakdown) {
      const row = spec.data[0];
      items = rawSeriesList.map((s, idx) => {
        const val = typeof row[s.key] === "number" ? row[s.key] : Number(row[s.key]) || 0;
        return {
          name: s.name || s.key,
          key: s.key,
          value: val,
          color: s.color || PALETTE[idx % PALETTE.length],
        };
      });
    } else if (spec.data && spec.data.length > 1 && (chartType === "pie" || rawSeriesList.length <= 1)) {
      const valKey = rawSeriesList[0]?.key || "value";
      items = spec.data.map((row, idx) => {
        const nameVal = String(row[xAxisKey] ?? row.name ?? row.component ?? row.category ?? `Item ${idx + 1}`);
        const numVal = typeof row[valKey] === "number" ? row[valKey] : Number(row[valKey]) || 0;
        return {
          name: nameVal,
          key: nameVal,
          value: numVal,
          color: PALETTE[idx % PALETTE.length],
        };
      });
    }

    // Apply sorting if requested
    if (items.length > 0) {
      if (sortOrder === "desc") {
        return [...items].sort((a, b) => b.value - a.value);
      } else if (sortOrder === "asc") {
        return [...items].sort((a, b) => a.value - b.value);
      }
    }
    return items;
  }, [isSingleRowBreakdown, spec.data, rawSeriesList, chartType, xAxisKey, sortOrder]);

  // For multi-row standard series (e.g. continuous curves), preserve fixed order
  const activeSeries = useMemo(() => {
    return rawSeriesList.filter((s) => !hiddenKeys[s.key]);
  }, [rawSeriesList, hiddenKeys]);

  // Filtered categorical items for Breakdown charts
  const visibleCategoricalData = useMemo(() => {
    return categoricalData.filter((item) => !hiddenKeys[item.key]);
  }, [categoricalData, hiddenKeys]);

  // Standard multi-row data with optional sorting
  const multiRowData = useMemo(() => {
    if (!spec.data || isSingleRowBreakdown) return spec.data;
    if (chartType === "bar" && rawSeriesList.length === 1) {
      const k = rawSeriesList[0].key;
      if (sortOrder === "desc") {
        return [...spec.data].sort((a, b) => (b[k] ?? 0) - (a[k] ?? 0));
      } else if (sortOrder === "asc") {
        return [...spec.data].sort((a, b) => (a[k] ?? 0) - (b[k] ?? 0));
      }
    }
    return spec.data;
  }, [spec.data, isSingleRowBreakdown, chartType, rawSeriesList, sortOrder]);

  const cleanFileBase = (spec.title || "chart")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_");

  // Copy Spec JSON
  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowMenu(false);
  };

  // Export Data to CSV
  const handleExportCSV = () => {
    if (!spec.data || spec.data.length === 0) return;
    let csvContent = "";

    if (isSingleRowBreakdown || (chartType === "pie" && categoricalData.length > 0)) {
      csvContent = ["Component,Share / Value", ...categoricalData.map((c) => `"${c.name}",${c.value}`)].join("\n");
    } else {
      const headers = [spec.xAxisLabel || xAxisKey, ...rawSeriesList.map((s) => s.name || s.key)];
      const rows = spec.data.map((row) => [
        `"${String(row[xAxisKey] ?? "").replace(/"/g, '""')}"`,
        ...rawSeriesList.map((s) => (row[s.key] !== undefined ? row[s.key] : "")),
      ]);
      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${cleanFileBase}_data.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  // Download Chart directly as PNG image
  const handleDownloadPNG = () => {
    if (!containerRef.current) return;
    const svgElement = containerRef.current.querySelector("svg");
    if (!svgElement) return;

    try {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      const svgBounds = svgElement.getBoundingClientRect();
      const width = (svgBounds.width || 800) * 2;
      const height = (svgBounds.height || 400) * 2;

      canvas.width = width;
      canvas.height = height;

      img.onload = () => {
        if (!ctx) return;
        ctx.fillStyle = "#181410";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const a = document.createElement("a");
        a.download = `${cleanFileBase}.png`;
        a.href = canvas.toDataURL("image/png");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    } catch (err) {
      console.error("Error generating PNG from chart:", err);
    }
    setShowMenu(false);
  };

  // Custom Darkroom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-[#211B15] border border-[#3D3226] p-2.5 rounded-[3px] shadow-2xl text-xs z-50 min-w-[170px]">
        <div className="font-semibold text-[#F5EFE6] mb-1.5 pb-1 border-b border-[#3D3226] flex items-center justify-between">
          <span>{label || payload[0]?.name}</span>
          <span className="text-[10px] text-[#D97A3F] font-mono">TELEMETRY</span>
        </div>
        <div className="space-y-1">
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-[#D8CDBC]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill || entry.color }} />
                {entry.name || entry.dataKey}:
              </span>
              <span className="font-mono font-bold text-[#F5EFE6]">
                {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
                {entry.unit ? ` ${entry.unit}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render Category / Series Chips
  const filterChips = useMemo(() => {
    if (isSingleRowBreakdown || (chartType === "pie" && categoricalData.length > 0)) {
      return categoricalData.map((item) => {
        const isHidden = hiddenKeys[item.key];
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => toggleKey(item.key)}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] border text-[10.5px] transition-all cursor-pointer ${
              isHidden
                ? "bg-surface-2/40 border-border/40 text-text-muted/50 line-through"
                : "bg-surface-2 border-border/80 text-text-primary hover:border-accent-primary/60"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: isHidden ? "#6B5F4E" : item.color }}
            />
            <span>{item.name}</span>
            <span className="font-mono text-[9.5px] text-text-muted">({item.value})</span>
          </button>
        );
      });
    }

    if (rawSeriesList.length > 1) {
      return rawSeriesList.map((s) => {
        const isHidden = hiddenKeys[s.key];
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => toggleKey(s.key)}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] border text-[10.5px] transition-all cursor-pointer ${
              isHidden
                ? "bg-surface-2/40 border-border/40 text-text-muted/50 line-through"
                : "bg-surface-2 border-border/80 text-text-primary hover:border-accent-primary/60"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: isHidden ? "#6B5F4E" : s.color }}
            />
            <span>{s.name}</span>
          </button>
        );
      });
    }

    return null;
  }, [isSingleRowBreakdown, chartType, categoricalData, rawSeriesList, hiddenKeys]);

  return (
    <div
      ref={containerRef}
      className={`my-3.5 w-full rounded-[4px] border border-border/80 bg-surface-1/40 overflow-hidden shadow-2xs transition-all ${
        isExpanded ? "h-full flex flex-col" : ""
      }`}
    >
      {/* Seamless Clean Header */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-2.5 border-b border-border/60 bg-surface-1/60 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
          <h4 className="font-display text-[13.5px] font-semibold text-text-primary tracking-tight">
            {spec.title || "Visual Analytics"}
          </h4>
          <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-surface-2 text-accent-primary border border-border/80 font-bold">
            DYNAMIC
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Relevant Chart Type Switchers */}
          {relevantTypes.length > 1 && !showTable && (
            <div className="flex items-center gap-0.5 bg-surface-2/90 p-0.5 rounded-[3px] border border-border/80">
              {relevantTypes.includes("line") && (
                <button
                  type="button"
                  onClick={() => setChartType("line")}
                  className={`px-2 py-0.5 rounded-[2px] font-mono text-[10.5px] flex items-center gap-1 transition-all cursor-pointer ${
                    chartType === "line"
                      ? "bg-accent-primary text-black font-bold shadow-2xs"
                      : "text-text-muted hover:text-text-primary hover:bg-surface-1/60"
                  }`}
                  title="Line Curve"
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>Line</span>
                </button>
              )}

              {relevantTypes.includes("area") && (
                <button
                  type="button"
                  onClick={() => setChartType("area")}
                  className={`px-2 py-0.5 rounded-[2px] font-mono text-[10.5px] flex items-center gap-1 transition-all cursor-pointer ${
                    chartType === "area"
                      ? "bg-accent-primary text-black font-bold shadow-2xs"
                      : "text-text-muted hover:text-text-primary hover:bg-surface-1/60"
                  }`}
                  title="Area Trend"
                >
                  <Layers className="w-3 h-3" />
                  <span>Area</span>
                </button>
              )}

              {relevantTypes.includes("bar") && (
                <button
                  type="button"
                  onClick={() => setChartType("bar")}
                  className={`px-2 py-0.5 rounded-[2px] font-mono text-[10.5px] flex items-center gap-1 transition-all cursor-pointer ${
                    chartType === "bar"
                      ? "bg-accent-primary text-black font-bold shadow-2xs"
                      : "text-text-muted hover:text-text-primary hover:bg-surface-1/60"
                  }`}
                  title="Bar Comparison"
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>Bar</span>
                </button>
              )}

              {relevantTypes.includes("pie") && (
                <button
                  type="button"
                  onClick={() => setChartType("pie")}
                  className={`px-2 py-0.5 rounded-[2px] font-mono text-[10.5px] flex items-center gap-1 transition-all cursor-pointer ${
                    chartType === "pie"
                      ? "bg-accent-primary text-black font-bold shadow-2xs"
                      : "text-text-muted hover:text-text-primary hover:bg-surface-1/60"
                  }`}
                  title="Pie Breakdown"
                >
                  <PieChartIcon className="w-3 h-3" />
                  <span>Pie</span>
                </button>
              )}
            </div>
          )}

          {/* Sort Order Toggle (for Bar and Breakdown charts) */}
          {(isSingleRowBreakdown || chartType === "bar" || chartType === "pie") && !showTable && (
            <button
              type="button"
              onClick={() => {
                setSortOrder((prev) => (prev === "desc" ? "asc" : prev === "asc" ? "none" : "desc"));
              }}
              className="px-2 py-1 rounded-[3px] font-mono text-[10.5px] flex items-center gap-1 bg-surface-2/80 text-text-muted hover:text-text-primary border border-border/80 transition-all cursor-pointer"
              title={`Sorting: ${sortOrder === "desc" ? "Highest First (Desc)" : sortOrder === "asc" ? "Lowest First (Asc)" : "Default"}`}
            >
              <ArrowUpDown className="w-3 h-3" />
              <span className="hidden sm:inline">
                {sortOrder === "desc" ? "Desc ↓" : sortOrder === "asc" ? "Asc ↑" : "Sort"}
              </span>
            </button>
          )}

          {/* Data Table Toggle */}
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className={`px-2 py-1 rounded-[3px] font-mono text-[10.5px] flex items-center gap-1 transition-all border cursor-pointer ${
              showTable
                ? "bg-accent-primary/20 text-accent-primary border-accent-primary/60 font-bold"
                : "bg-surface-2/80 text-text-muted border-border/80 hover:text-text-primary hover:border-border"
            }`}
            title="Inspect Data Table"
          >
            <TableIcon className="w-3 h-3" />
            <span className="hidden sm:inline">{showTable ? "Chart" : "Data"}</span>
          </button>

          {/* Three-Dots Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-[3px] bg-surface-2/80 text-text-muted hover:text-text-primary border border-border/80 hover:border-border transition-all cursor-pointer"
              title="Chart Actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-[4px] border border-border bg-[#211B15] shadow-xl p-1 z-50 font-mono text-[11px] space-y-0.5 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={handleDownloadPNG}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[2px] text-text-primary hover:bg-surface-2 hover:text-accent-primary transition-colors text-left cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-accent-primary" />
                  <span>Download (PNG)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[2px] text-text-primary hover:bg-surface-2 hover:text-accent-primary transition-colors text-left cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export CSV (Excel)</span>
                </button>

                <div className="h-[1px] bg-border/60 my-1" />

                <button
                  type="button"
                  onClick={handleCopyJSON}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[2px] text-text-muted hover:bg-surface-2 hover:text-text-primary transition-colors text-left cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copied ? "Copied JSON!" : "Copy Spec JSON"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Series / Category Filter Chips */}
      {filterChips && !showTable && (
        <div className="flex flex-wrap items-center gap-2 px-3.5 py-1.5 border-b border-border/40 bg-surface-1/20 font-mono text-[10.5px]">
          <span className="text-text-muted font-semibold uppercase tracking-wider text-[9.5px]">Series:</span>
          {filterChips}
        </div>
      )}

      {/* Main Visual Canvas Area */}
      <div
        className={`p-3.5 w-full ${isExpanded ? "h-[460px]" : "h-[290px] sm:h-[320px]"}`}
        style={{ minHeight: isExpanded ? 460 : 290 }}
      >
        {showTable ? (
          <div className="h-full overflow-auto rounded-[3px] border border-border/80 bg-surface-1/70 p-2">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-border/80 bg-surface-2/80">
                  <th className="p-2 font-semibold text-text-primary uppercase text-[10.5px]">
                    {isSingleRowBreakdown ? "Component" : spec.xAxisLabel || xAxisKey}
                  </th>
                  {isSingleRowBreakdown ? (
                    <th className="p-2 font-semibold text-text-primary uppercase text-[10.5px]">
                      Share / Value
                    </th>
                  ) : (
                    rawSeriesList.map((s) => (
                      <th key={s.key} className="p-2 font-semibold text-text-primary uppercase text-[10.5px]">
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {isSingleRowBreakdown
                  ? categoricalData.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="border-b border-border/40 hover:bg-surface-2/40 transition-colors text-[11.5px]"
                      >
                        <td className="p-2 text-text-primary font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: row.color }} />
                          {row.name}
                        </td>
                        <td className="p-2 text-text-body font-bold">{row.value}</td>
                      </tr>
                    ))
                  : spec.data.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="border-b border-border/40 hover:bg-surface-2/40 transition-colors text-[11.5px]"
                      >
                        <td className="p-2 text-text-primary font-medium">
                          {String(row[xAxisKey] ?? "")}
                        </td>
                        {rawSeriesList.map((s) => (
                          <td key={s.key} className="p-2 text-text-body">
                            {row[s.key] !== undefined ? String(row[s.key]) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        ) : chartType === "pie" ? (
          /* Pie / Donut Chart with proper multiple slices */
          <ResponsiveContainer width="100%" height="100%" minHeight={isExpanded ? 460 : 290}>
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={32}
                formatter={(val) => <span className="font-mono text-[11px] text-[#D8CDBC]">{val}</span>}
              />
              <Pie
                data={visibleCategoricalData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={isExpanded ? 115 : 95}
                innerRadius={isExpanded ? 55 : 45}
                paddingAngle={3}
                stroke="#181410"
                strokeWidth={2}
              >
                {visibleCategoricalData.map((entry) => (
                  <Cell key={`cell-${entry.key}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : chartType === "bar" && isSingleRowBreakdown ? (
          /* Single-Row Breakdown formatted as Clean Categorical Bar Chart */
          <ResponsiveContainer width="100%" height="100%" minHeight={isExpanded ? 460 : 290}>
            <BarChart data={visibleCategoricalData} margin={{ top: 12, right: 15, left: -5, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3D3226" opacity={0.5} />
              <XAxis
                dataKey="name"
                stroke="#6B5F4E"
                tick={{ fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }}
              />
              <YAxis
                stroke="#6B5F4E"
                tick={{ fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }}
                label={
                  spec.yAxisLabel
                    ? { value: spec.yAxisLabel, angle: -90, position: "insideLeft", fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }
                    : undefined
                }
              />
              {/* Subtle amber glow hover cursor - NO white box! */}
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(217, 122, 63, 0.08)" }} />
              <Bar dataKey="value" name={spec.title || "Value"} radius={[3, 3, 0, 0]} maxBarSize={48}>
                {visibleCategoricalData.map((entry) => (
                  <Cell key={`bar-${entry.key}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : chartType === "bar" ? (
          /* Standard Multi-Row Bar Chart */
          <ResponsiveContainer width="100%" height="100%" minHeight={isExpanded ? 460 : 290}>
            <BarChart data={multiRowData} margin={{ top: 12, right: 15, left: -5, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3D3226" opacity={0.5} />
              <XAxis
                dataKey={xAxisKey}
                stroke="#6B5F4E"
                tick={{ fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }}
                label={
                  spec.xAxisLabel
                    ? { value: spec.xAxisLabel, position: "insideBottom", offset: -5, fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }
                    : undefined
                }
              />
              <YAxis
                stroke="#6B5F4E"
                tick={{ fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }}
                label={
                  spec.yAxisLabel
                    ? { value: spec.yAxisLabel, angle: -90, position: "insideLeft", fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }
                    : undefined
                }
              />
              {/* Subtle amber glow hover cursor - NO white box! */}
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(217, 122, 63, 0.08)" }} />
              <Legend
                verticalAlign="top"
                align="right"
                height={28}
                formatter={(val) => <span className="font-mono text-[10.5px] text-[#D8CDBC]">{val}</span>}
              />
              {activeSeries.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.name}
                  fill={s.color}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={40}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : chartType === "area" ? (
          /* Area Chart */
          <ResponsiveContainer width="100%" height="100%" minHeight={isExpanded ? 460 : 290}>
            <AreaChart data={multiRowData} margin={{ top: 12, right: 15, left: -5, bottom: 10 }}>
              <defs>
                {rawSeriesList.map((s) => (
                  <linearGradient key={`grad-${s.key}`} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3D3226" opacity={0.5} />
              <XAxis
                dataKey={xAxisKey}
                stroke="#6B5F4E"
                tick={{ fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }}
                label={
                  spec.xAxisLabel
                    ? { value: spec.xAxisLabel, position: "insideBottom", offset: -5, fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }
                    : undefined
                }
              />
              <YAxis
                stroke="#6B5F4E"
                tick={{ fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }}
                label={
                  spec.yAxisLabel
                    ? { value: spec.yAxisLabel, angle: -90, position: "insideLeft", fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }
                    : undefined
                }
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#D97A3F", strokeWidth: 1, strokeDasharray: "3 3" }} />
              <Legend
                verticalAlign="top"
                align="right"
                height={28}
                formatter={(val) => <span className="font-mono text-[10.5px] text-[#D8CDBC]">{val}</span>}
              />
              {activeSeries.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#grad-${s.key})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          /* Line Chart */
          <ResponsiveContainer width="100%" height="100%" minHeight={isExpanded ? 460 : 290}>
            <LineChart data={multiRowData} margin={{ top: 12, right: 15, left: -5, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3D3226" opacity={0.5} />
              <XAxis
                dataKey={xAxisKey}
                stroke="#6B5F4E"
                tick={{ fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }}
                label={
                  spec.xAxisLabel
                    ? { value: spec.xAxisLabel, position: "insideBottom", offset: -5, fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }
                    : undefined
                }
              />
              <YAxis
                stroke="#6B5F4E"
                tick={{ fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }}
                label={
                  spec.yAxisLabel
                    ? { value: spec.yAxisLabel, angle: -90, position: "insideLeft", fill: "#9C8E78", fontSize: 10.5, fontFamily: "JetBrains Mono" }
                    : undefined
                }
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#D97A3F", strokeWidth: 1, strokeDasharray: "3 3" }} />
              <Legend
                verticalAlign="top"
                align="right"
                height={28}
                formatter={(val) => <span className="font-mono text-[10.5px] text-[#D8CDBC]">{val}</span>}
              />
              {activeSeries.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 3.5, strokeWidth: 1.5, fill: "#181410" }}
                  activeDot={{ r: 5.5, stroke: s.color, strokeWidth: 2, fill: "#F5EFE6" }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
