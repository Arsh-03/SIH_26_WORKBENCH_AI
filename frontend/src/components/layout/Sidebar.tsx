import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
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
  mockRecentChats,
  mockUserProfile,
} from '../../lib/mockData'

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

/**
 * AmberUnderlineWrapper
 * Implements DESIGN.md Section 6:
 * "Sidebar/text links: amber underline draws left-to-right on hover (~150ms), retracts on hover-out. Never color-only hover."
 */
const AmberUnderlineWrapper: React.FC<{
  children: React.ReactNode
  className?: string
  active?: boolean
}> = ({ children, className = '', active = false }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <motion.span
        aria-hidden="true"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: active || isHovered ? 1 : 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{ originX: 0 }}
        className="absolute -bottom-0.5 left-0 right-0 h-[1px] bg-accent-primary pointer-events-none"
      />
    </div>
  )
}

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
  recentChats = mockRecentChats,
  activeNav,
  userProfile = mockUserProfile,
  onOpenCmdPalette,
  onNewChat,
  className = '',
}) => {
  const location = useLocation()

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

  return (
    <aside
      className={`relative flex h-screen w-[280px] shrink-0 select-none flex-col justify-between border-r border-border bg-surface-1 text-text-body font-body ${className}`}
    >
      <div className="flex h-full flex-col overflow-hidden">
        {/* Brand Header */}
        <div className="border-b border-border/80 px-5 py-4">
          <Link to="/" className="group block">
            <div className="flex items-baseline justify-between">
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
                  {item.count && (
                    <span
                      className={`font-mono text-[11px] transition-colors ${
                        isActive
                          ? 'text-accent-primary'
                          : 'text-text-muted group-hover:text-text-body'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
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
          {recentChats.length > 0 && (
            <section aria-labelledby="recents-heading">
              <span
                id="recents-heading"
                className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted"
              >
                RECENTS
              </span>
              <nav className="space-y-1">
                {recentChats.map((recent) => (
                  <Link
                    key={recent.id}
                    to={recent.path}
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
