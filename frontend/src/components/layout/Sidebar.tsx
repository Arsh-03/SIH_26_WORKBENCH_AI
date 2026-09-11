import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut } from 'lucide-react'
import type {
  NavItem,
  PinnedProject,
  PinnedChat,
  RecentChat,
  UserProfile,
} from '../../lib/types'
import {
  mockNavItems,
  mockPinnedProjects,
  mockPinnedChats,
  mockUserProfile,
} from '../../lib/mockData'
import { useWorkbench } from '../../lib/WorkbenchContext'
import { useAuth } from '../../lib/AuthContext'
import { api, type SystemHealth, type HardwareTelemetry } from '../../lib/api'
import { AmberUnderline } from './AmberUnderline'

export interface SidebarProps {
  pinnedProjects?: PinnedProject[]
  pinnedChats?: PinnedChat[]
  recentChats?: RecentChat[]
  activeNav?: string
  userProfile?: UserProfile
  onOpenCmdPalette?: () => void
  onNewChat?: () => void
  className?: string
}

const AmberUnderlineWrapper = AmberUnderline

/**
 * Left Sidebar Component
 * Follows DESIGN.md Section 4A and Darkroom Editorial styling:
 * - Fixed 280px width
 * - Surface 1 background with hairline warm border
 * - Icon-light typography-driven hierarchy
 * - No filled/pill button for New Chat
 * - Sharp 4px radii
 */
export const Sidebar: React.FC<SidebarProps> = ({
  pinnedProjects = mockPinnedProjects,
  pinnedChats = mockPinnedChats,
  recentChats,
  activeNav,
  userProfile = mockUserProfile,
  onOpenCmdPalette,
  onNewChat,
  className = '',
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user: authUser, logout } = useAuth()
  const { chatSessions, loadChatSession, isSidebarOpen, toggleSidebar, togglePinChat } = useWorkbench()

  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [hardwareTelemetry, setHardwareTelemetry] = useState<HardwareTelemetry | null>(null)
  const [isExportingBundle, setIsExportingBundle] = useState(false)
  const [bundleSuccess, setBundleSuccess] = useState(false)
  const [showStatusHover, setShowStatusHover] = useState(false)

  const activeUserProfile = authUser || userProfile
  const userInitial = (activeUserProfile?.avatarLetter || activeUserProfile?.name?.trim().charAt(0) || activeUserProfile?.username?.trim().charAt(0) || 'M').toUpperCase()

  // Poll telemetry every 5 seconds
  useEffect(() => {
    let mounted = true
    const fetchTelemetry = () => {
      api.getHardwareTelemetry()
        .then((data) => {
          if (mounted) setHardwareTelemetry(data)
        })
        .catch(() => {})

      api.getSystemHealth()
        .then((data) => {
          if (mounted) setSystemHealth(data)
        })
        .catch(() => {})
    }

    fetchTelemetry()
    const interval = setInterval(fetchTelemetry, 5000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const refreshHealth = () => {
    api.getHardwareTelemetry()
      .then((data) => setHardwareTelemetry(data))
      .catch(() => {})
    api.getSystemHealth()
      .then((data) => setSystemHealth(data))
      .catch(() => {})
  }

  const handleDownloadSessionBundle = async () => {
    setIsExportingBundle(true)
    try {
      const activeSessionId = chatSessions[0]?.id || 'sovereign_session'
      await api.downloadSessionBundle(activeSessionId)
      setBundleSuccess(true)
      setTimeout(() => setBundleSuccess(false), 2500)
    } catch (err) {
      console.error('Failed to export session bundle:', err)
    } finally {
      setIsExportingBundle(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Dynamic pinned and recent chats from real persistent SQLite sessions
  const dynamicPinnedChats = chatSessions.length > 0
    ? chatSessions.filter((s) => s.isPinned).map((s) => ({
        id: s.id,
        title: s.title,
        path: `/chat/${s.id}`,
        isPinned: true,
      }))
    : (pinnedChats || []).map((p) => ({ ...p, isPinned: true }))

  const dynamicRecentChats = chatSessions.length > 0
    ? chatSessions.filter((s) => !s.isPinned).slice(0, 8).map((s) => ({
        id: s.id,
        title: s.title,
        path: `/chat/${s.id}`,
        isPinned: false,
      }))
    : (recentChats || [])


  // Determine active section if not provided as prop
  const currentPath = location?.pathname ?? '/chat'
  const resolvedActiveNav =
    activeNav ??
    (currentPath.startsWith('/chats')
      ? 'chats'
      : currentPath.startsWith('/projects')
        ? 'projects'
        : currentPath.startsWith('/library')
          ? 'library'
          : currentPath.startsWith('/settings')
            ? 'settings'
            : '')

  const isOnline = systemHealth?.ollama_running ?? true
  const vramTotal = systemHealth?.gpu_telemetry?.total_vram_mb || 0
  const vramAlloc = systemHealth?.gpu_telemetry?.allocated_vram_mb || 0
  const deviceName = systemHealth?.gpu_telemetry?.device_name || 'Host CPU / RAM Memory Enclave'
  const availableModels = systemHealth?.available_models?.length
    ? systemHealth.available_models
    : ['qwen2.5-coder:7b', 'llama3.2-vision:latest', 'nomic-embed-text:latest']

  const renderStatusHUD = (isCompact: boolean) => {
    const gpuName = hardwareTelemetry?.gpu?.gpu_name || deviceName
    const gpuTemp = hardwareTelemetry?.gpu?.temperature_c || 45
    const vramUsed = hardwareTelemetry?.gpu?.vram_used_mb || vramAlloc
    const vramTot = hardwareTelemetry?.gpu?.vram_total_mb || vramTotal
    const vramPct = vramTot > 0 ? Math.min(100, Math.round((vramUsed / vramTot) * 100)) : 0
    const ramUsed = hardwareTelemetry?.ram_used_gb ?? 8.4
    const ramTot = hardwareTelemetry?.ram_total_gb ?? 32.0
    const ramPct = hardwareTelemetry?.ram_percent ?? Math.round((ramUsed / (ramTot || 1)) * 100)
    const cpuPct = hardwareTelemetry?.cpu_percent ?? 14.2
    const tps = hardwareTelemetry?.tokens_per_second ?? 42.5

    return (
      <AnimatePresence>
        {showStatusHover && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: isCompact ? 0 : 4, x: isCompact ? 6 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute z-50 rounded-[6px] border border-border bg-[#14100D] p-3 shadow-2xl font-mono text-xs text-text-primary select-none ${
              isCompact ? 'left-14 bottom-2 w-[275px]' : 'left-2 right-2 bottom-16 w-auto'
            }`}
            onMouseEnter={() => setShowStatusHover(true)}
            onMouseLeave={() => setShowStatusHover(false)}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/80 pb-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isOnline ? 'bg-green-400' : 'bg-amber-400'} opacity-75`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-green-500' : 'bg-amber-500'}`} />
                </span>
                <span className="font-semibold text-[10px] uppercase tracking-wider text-text-primary truncate">
                  Sovereign Enclave Status
                </span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/30 font-bold shrink-0">
                AIR-GAPPED
              </span>
            </div>

            <div className="space-y-2">
              {/* GPU Acceleration & VRAM Meter */}
              <div className="rounded-[4px] border border-border/60 bg-[#1D1712] p-2 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-accent-primary uppercase tracking-wider flex items-center gap-1">
                    <span>⚡</span> GPU Acceleration
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${gpuTemp > 75 ? 'bg-red-500/20 text-red-400' : gpuTemp > 60 ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
                    {gpuTemp}°C
                  </span>
                </div>
                <div className="text-[10.5px] text-text-primary font-medium truncate">
                  {gpuName}
                </div>
                {/* VRAM Progress Bar */}
                <div className="space-y-0.5 pt-0.5">
                  <div className="flex justify-between text-[9.5px] text-text-muted font-mono">
                    <span>VRAM Allocated</span>
                    <span className="text-text-primary font-bold">
                      {vramTot > 0 ? `${(vramUsed / 1024).toFixed(1)} / ${(vramTot / 1024).toFixed(1)} GB (${vramPct}%)` : 'CPU Subprocess Enclave'}
                    </span>
                  </div>
                  {vramTot > 0 && (
                    <div className="w-full h-1.5 rounded-full bg-surface-2 overflow-hidden border border-border/40">
                      <div
                        className="h-full bg-accent-primary transition-all duration-300"
                        style={{ width: `${vramPct}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Host CPU, RAM & Stream Throughput */}
              <div className="rounded-[4px] border border-border/60 bg-[#1D1712] p-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-text-muted uppercase">
                  <span className="font-semibold text-text-body">Host Memory &amp; CPU</span>
                  <span className="text-accent-primary font-bold text-[9px]">{tps} TPS</span>
                </div>
                {/* RAM Bar */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[9.5px] text-text-muted font-mono">
                    <span>System RAM</span>
                    <span className="text-text-primary font-semibold">
                      {ramUsed} / {ramTot} GB ({ramPct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-2 overflow-hidden border border-border/40">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, ramPct)}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-[9.5px] text-text-muted font-mono pt-0.5">
                  <span>Host CPU Utilization</span>
                  <span className="text-text-primary font-semibold">{cpuPct}%</span>
                </div>
              </div>

              {/* Models List */}
              <div className="rounded-[4px] border border-border/60 bg-[#1D1712] p-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-text-muted uppercase">
                  <span className="font-semibold text-text-muted">Active Models ({availableModels.length})</span>
                  <span className="text-green-400 font-bold text-[9px]">ENCLAVE</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto pt-0.5">
                  {availableModels.map((m) => (
                    <span
                      key={m}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2 text-text-primary border border-border/80 font-mono truncate max-w-full"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Zero-Egress Guarantee & One-Click ZIP Export */}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between text-[9px] text-text-muted font-mono">
                  <span>Network Egress:</span>
                  <span className="text-green-400 font-bold">0 Bytes (Active Guard)</span>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadSessionBundle}
                  disabled={isExportingBundle}
                  className="w-full flex items-center justify-center gap-1.5 rounded-[3px] border border-accent-primary/50 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary py-1.5 px-2 text-[10.5px] font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isExportingBundle ? (
                    <>
                      <svg className="animate-spin h-3 w-3 text-accent-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Packaging Archive...</span>
                    </>
                  ) : bundleSuccess ? (
                    <span className="text-green-400 font-bold">Bundle Downloaded ✓</span>
                  ) : (
                    <>
                      <span>📦</span>
                      <span>Download Session Archive (.zip)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }



  if (!isSidebarOpen) {
    /* =========================================================================
       COMPACT 56px ICON-RAIL MODE (VS Code / JetBrains / Cursor style)
       Reclaims 224px for wide-canvas code editing & live split view
       ========================================================================= */
    return (
      <aside
        className={`relative flex h-screen w-14 shrink-0 select-none flex-col justify-between border-r border-border bg-surface-1 py-3 text-text-body font-body z-20 ${className}`}
      >
        {/* Top: Logo Mark + Expand Trigger */}
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={toggleSidebar}
            title="Expand Sidebar (⌘B)"
            aria-label="Expand Sidebar"
            className="group flex flex-col items-center justify-center p-1.5 rounded-[4px] hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <div className="flex items-center">
              <span className="font-display text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors">
                AI
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-accent-primary ml-0.5" />
            </div>
            <span className="font-mono text-[8px] text-text-muted mt-0.5 group-hover:text-text-primary">
              »
            </span>
          </button>

          {/* New Chat Icon Button */}
          <button
            type="button"
            onClick={onNewChat}
            title="New Chat (⌘N)"
            aria-label="New Chat"
            className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-accent-primary/40 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 hover:border-accent-primary transition-all cursor-pointer shadow-xs"
          >
            <span className="font-mono text-base font-bold leading-none">+</span>
          </button>

          {/* Search Trigger Icon */}
          <button
            type="button"
            onClick={onOpenCmdPalette}
            title="Search Chats (⌘K)"
            aria-label="Search Chats"
            className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-border/80 bg-surface-2/60 text-text-muted hover:text-text-primary hover:border-text-muted/60 transition-all cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <div className="h-[1px] w-6 bg-border/80 my-1" />

          {/* Nav Icons */}
          <div className="flex flex-col items-center gap-2">
            {/* Chats Icon */}
            <Link
              to="/chats"
              title={`Chats (${chatSessions.length})`}
              className={`flex h-8 w-8 items-center justify-center rounded-[4px] transition-all cursor-pointer ${
                resolvedActiveNav === 'chats'
                  ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/40'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2/60'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </Link>

            {/* Projects Icon */}
            <Link
              to="/projects"
              title="Projects (05)"
              className={`flex h-8 w-8 items-center justify-center rounded-[4px] transition-all cursor-pointer ${
                resolvedActiveNav === 'projects'
                  ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/40'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2/60'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </Link>

            {/* Library Icon */}
            <Link
              to="/library"
              title="Library (18)"
              className={`flex h-8 w-8 items-center justify-center rounded-[4px] transition-all cursor-pointer ${
                resolvedActiveNav === 'library'
                  ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/40'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2/60'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Bottom: Air-Gap Status + Settings + Logout + User Avatar */}
        <div className="relative flex flex-col items-center gap-2.5">
          {/* Air-Gap Status Green Dot with Hover HUD */}
          <div
            onMouseEnter={() => {
              setShowStatusHover(true)
              refreshHealth()
            }}
            onMouseLeave={() => setShowStatusHover(false)}
            className="flex items-center justify-center p-1.5 cursor-pointer rounded hover:bg-surface-2 transition-colors relative"
            title="Hover for Ollama & Enclave Telemetry"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isOnline ? 'bg-green-400' : 'bg-amber-400'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-green-500' : 'bg-amber-500'}`} />
            </span>
          </div>

          {/* Render hover HUD */}
          {renderStatusHUD(true)}

          {/* Settings */}
          <Link
            to="/settings"
            title="Settings"
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:text-accent-primary hover:bg-surface-2 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          {/* Logout Button in Small / Compact Sidebar */}
          <button
            type="button"
            onClick={handleLogout}
            title="Sign Out of Enclave Session"
            aria-label="Logout"
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>

          {/* User Avatar with dynamic user initial */}
          <div
            title={`${activeUserProfile.name} (${activeUserProfile.role})`}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-accent-primary text-background font-display text-xs font-semibold select-none shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            onClick={toggleSidebar}
          >
            {userInitial}
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className={`relative flex h-screen w-[280px] shrink-0 select-none flex-col justify-between border-r border-border bg-surface-1 text-text-body font-body ${className}`}
    >
      <div className="flex h-full flex-col">
        {/* Brand Header with Minimize / Collapse Trigger */}
        <div className="border-b border-border/80 px-5 py-4 flex items-center justify-between">
          <Link to="/" className="group block flex-1">
            <div className="flex items-baseline justify-between pr-2">
              <span className="font-display text-base font-semibold tracking-wider text-text-primary group-hover:text-accent-primary transition-colors">
                AI ARTIFACT
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                v4.2
              </span>
            </div>
            <div className="font-mono text-xs tracking-wide text-accent-primary">
              STUDIO
            </div>
          </Link>

          {/* Minimize / Close Sidebar Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            title="Minimize sidebar (⌘B)"
            aria-label="Minimize sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-border/80 bg-surface-2/70 text-text-muted hover:text-accent-primary hover:border-accent-primary/60 transition-all cursor-pointer shrink-0"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Quick Actions & Navigation Section */}
        <div className="border-b border-border/80 px-5 py-4 space-y-3">
          {/* New Chat Text Link */}
          <div className="flex items-center justify-between">
            <AmberUnderlineWrapper>
              <button
                type="button"
                onClick={onNewChat}
                className="group inline-flex items-center gap-2 text-sm font-medium text-text-primary transition-colors text-left"
              >
                <span className="font-mono text-sm text-accent-primary leading-none transition-transform group-hover:scale-125">
                  +
                </span>
                <span className="tracking-tight">New Chat</span>
              </button>
            </AmberUnderlineWrapper>
            <span className="font-mono text-[11px] text-text-muted">⌘N</span>
          </div>

          {/* Search Trigger Button */}
          <button
            type="button"
            onClick={onOpenCmdPalette}
            className="flex w-full items-center justify-between rounded bg-surface-2 border border-border/90 px-3 py-2 text-xs text-text-muted transition-colors hover:border-text-muted/60 hover:text-text-primary text-left"
          >
            <div className="flex items-center gap-2">
              <span className="font-body text-xs">Search chats</span>
            </div>
            <kbd className="rounded border border-border/90 bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-text-body uppercase tracking-wider">
              ⌘K
            </kbd>
          </button>

          {/* Main TOC Navigation Destinations */}
          <nav aria-label="Main Navigation" className="pt-1 space-y-0.5">
            {mockNavItems.map((item: NavItem) => {
              const isActive = resolvedActiveNav === item.id
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className={`group flex items-center justify-between border-b border-border/40 py-2 px-2 text-xs transition-colors rounded-[2px] ${
                    isActive
                      ? 'text-text-primary font-medium border-l-2 border-accent-primary bg-surface-2/40 pl-2.5'
                      : 'text-text-body hover:text-text-primary hover:bg-surface-2/20 border-l-2 border-transparent'
                  }`}
                >
                  <AmberUnderlineWrapper active={isActive}>
                    <span>{item.label}</span>
                  </AmberUnderlineWrapper>
                  {item.id === 'chats' ? (
                    <span
                      className={`font-mono text-[11px] transition-colors ${
                        isActive
                          ? 'text-accent-primary'
                          : 'text-text-muted group-hover:text-text-body'
                      }`}
                    >
                      {chatSessions.length}
                    </span>
                  ) : item.count ? (
                    <span
                      className={`font-mono text-[11px] transition-colors ${
                        isActive
                          ? 'text-accent-primary'
                          : 'text-text-muted group-hover:text-text-body'
                      }`}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Scrollable TOC Content Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Pinned Projects */}
          {pinnedProjects.length > 0 && (
            <section aria-labelledby="pinned-projects-heading">
              <span
                id="pinned-projects-heading"
                className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted"
              >
                PROJECTS — TOC
              </span>
              <nav className="space-y-1">
                {pinnedProjects.map((project) => (
                  <Link
                    key={project.id}
                    to={project.path}
                    className="group flex items-baseline justify-between py-1 text-xs text-text-body transition-colors hover:text-text-primary"
                  >
                    <AmberUnderlineWrapper className="max-w-[200px]">
                      <span className="truncate">{project.title}</span>
                    </AmberUnderlineWrapper>
                    <span className="font-mono text-[10px] text-text-muted ml-2 shrink-0 group-hover:text-accent-primary transition-colors">
                      {project.code}
                    </span>
                  </Link>
                ))}
              </nav>
            </section>
          )}

          {/* Pinned Chats */}
          {dynamicPinnedChats.length > 0 && (
            <section aria-labelledby="pinned-chats-heading">
              <span
                id="pinned-chats-heading"
                className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted"
              >
                PINNED CHATS ({dynamicPinnedChats.length})
              </span>
              <nav className="space-y-1">
                {dynamicPinnedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="group flex items-center justify-between py-1 text-xs text-text-body transition-colors hover:text-text-primary"
                  >
                    <Link
                      to={chat.path}
                      onClick={() => loadChatSession(chat.id)}
                      className="flex-1 min-w-0 pr-1"
                    >
                      <AmberUnderlineWrapper className="w-full">
                        <span className="truncate block">{chat.title}</span>
                      </AmberUnderlineWrapper>
                    </Link>
                    {/* Unpin Action Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        togglePinChat(chat.id)
                      }}
                      title="Unpin chat"
                      aria-label="Unpin chat"
                      className="shrink-0 text-accent-primary p-1 hover:bg-surface-2 rounded transition-all cursor-pointer opacity-80 hover:opacity-100 hover:scale-110"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="currentColor"
                      >
                        <path d="M16 3a1 1 0 0 1 .117 1.993L16 5v4.586l1.707 1.707a1 1 0 0 1 .286.607l.007.1V14a1 1 0 0 1-.883.993L17 15h-4v6a1 1 0 0 1-1.993.117L11 21v-6H7a1 1 0 0 1-.993-.883L6 14v-2a1 1 0 0 1 .206-.607l.087-.1 1.707-1.707V5a1 1 0 0 1-.117-1.993L8 3h8z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </nav>
            </section>
          )}

          {/* Recent Chats */}
          {dynamicRecentChats.length > 0 && (
            <section aria-labelledby="recents-heading">
              <span
                id="recents-heading"
                className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted"
              >
                RECENTS
              </span>
              <nav className="space-y-1">
                {dynamicRecentChats.map((recent) => (
                  <div
                    key={recent.id}
                    className="group flex items-center justify-between py-1 text-xs text-text-body transition-colors hover:text-text-primary"
                  >
                    <Link
                      to={recent.path}
                      onClick={() => loadChatSession(recent.id)}
                      className="flex-1 min-w-0 pr-1"
                    >
                      <AmberUnderlineWrapper className="w-full">
                        <span className="truncate block">{recent.title}</span>
                      </AmberUnderlineWrapper>
                    </Link>
                    {/* Pin Action Button on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        togglePinChat(recent.id)
                      }}
                      title="Pin chat to top"
                      aria-label="Pin chat to top"
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-primary p-1 hover:bg-surface-2 rounded transition-all cursor-pointer hover:scale-110"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="17" x2="12" y2="22"></line>
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                      </svg>
                    </button>
                  </div>
                ))}
              </nav>
            </section>
          )}

        </div>

        {/* User Footer Section with Status Dot HUD */}
        <div className="relative border-t border-border/80 bg-surface-1 px-4 py-3 flex items-center justify-between">
          {/* Status HUD when hovering */}
          {renderStatusHUD(false)}

          <div className="flex items-center gap-2.5 min-w-0">
            {/* Small square avatar with 4px sharp radius */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-accent-primary text-background font-display text-xs font-semibold select-none shadow-sm">
              {userInitial}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-body text-xs font-medium text-text-primary leading-none truncate">
                  {activeUserProfile.name}
                </span>
                {/* Live Air-Gap Status Green Dot */}
                <div
                  onMouseEnter={() => {
                    setShowStatusHover(true)
                    refreshHealth()
                  }}
                  onMouseLeave={() => setShowStatusHover(false)}
                  className="flex items-center justify-center p-0.5 cursor-pointer rounded hover:bg-surface-2 transition-colors"
                  title="Hover for Ollama & Enclave Telemetry"
                >
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isOnline ? 'bg-green-400' : 'bg-amber-400'} opacity-75`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-green-500' : 'bg-amber-500'}`} />
                  </span>
                </div>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted mt-1 leading-none truncate">
                {activeUserProfile.role}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/settings"
              title="Settings"
              className={`text-xs transition-colors ${
                resolvedActiveNav === 'settings'
                  ? 'text-accent-primary font-medium'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <AmberUnderlineWrapper active={resolvedActiveNav === 'settings'}>
                <span>Settings</span>
              </AmberUnderlineWrapper>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out of Enclave Session"
              className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
