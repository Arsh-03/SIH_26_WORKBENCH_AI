import React from 'react'
import { Link, useLocation } from 'react-router-dom'
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
  const { chatSessions, loadChatSession, isSidebarOpen, toggleSidebar } = useWorkbench()

  // Dynamic recent chats from real persistent sessions
  const dynamicRecentChats = recentChats || chatSessions.slice(0, 7).map((s) => ({
    id: s.id,
    title: s.title,
    path: `/chat/${s.id}`,
  }))

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

        {/* Bottom: Air-Gap Status + Settings + User Avatar */}
        <div className="flex flex-col items-center gap-3">
          {/* Air-Gap Status Green Dot */}
          <div
            title="Sovereign Subprocess Sandbox Enclave Active (Zero Egress)"
            className="flex items-center justify-center p-1 cursor-pointer"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </div>

          {/* Settings */}
          <Link
            to="/settings"
            title="Settings"
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:text-accent-primary transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          {/* User Avatar */}
          <div
            title={`${userProfile.name} (${userProfile.role})`}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-accent-primary text-background font-display text-xs font-semibold select-none shadow-sm cursor-pointer"
            onClick={toggleSidebar}
          >
            {userProfile.avatarLetter}
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className={`relative flex h-screen w-[280px] shrink-0 select-none flex-col justify-between border-r border-border bg-surface-1 text-text-body font-body ${className}`}
    >
      <div className="flex h-full flex-col overflow-hidden">
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
          {pinnedChats.length > 0 && (
            <section aria-labelledby="pinned-chats-heading">
              <span
                id="pinned-chats-heading"
                className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted"
              >
                PINNED CHATS
              </span>
              <nav className="space-y-1">
                {pinnedChats.map((chat) => (
                  <Link
                    key={chat.id}
                    to={chat.path}
                    onClick={() => loadChatSession(chat.id)}
                    className="group flex items-center justify-between py-1 text-xs text-text-body transition-colors hover:text-text-primary"
                  >
                    <AmberUnderlineWrapper className="max-w-[210px]">
                      <span className="truncate">{chat.title}</span>
                    </AmberUnderlineWrapper>
                    {/* Amber Pin Glyph */}
                    <span
                      aria-label="Pinned"
                      className="shrink-0 text-accent-primary text-[13px] leading-none select-none pl-1 transition-transform group-hover:-translate-y-0.5"
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
                    </span>
                  </Link>
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
                  <Link
                    key={recent.id}
                    to={recent.path}
                    onClick={() => loadChatSession(recent.id)}
                    className="group block py-1 text-xs text-text-body transition-colors hover:text-text-primary"
                  >
                    <AmberUnderlineWrapper className="w-full">
                      <span className="truncate">{recent.title}</span>
                    </AmberUnderlineWrapper>
                  </Link>
                ))}
              </nav>
            </section>
          )}
        </div>

        {/* User Footer Section */}
        <div className="border-t border-border/80 bg-surface-1 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Small square avatar with 4px sharp radius */}
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-accent-primary text-background font-display text-xs font-semibold select-none shadow-sm">
              {userProfile.avatarLetter}
            </div>
            <div className="flex flex-col">
              <span className="font-body text-xs font-medium text-text-primary leading-none">
                {userProfile.name}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted mt-1 leading-none">
                {userProfile.role}
              </span>
            </div>
          </div>

          <Link
            to="/settings"
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
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
