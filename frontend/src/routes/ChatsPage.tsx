import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockChatSessions } from '../lib/mockData'
import type { ChatSession } from '../lib/types'

/**
 * ChatsPage Route
 * Follows DESIGN.md Screen 4 (Chats Overview):
 * - Fraunces header ("Chats") + italic subheader
 * - Filter/search bar (small-caps, no filled box)
 * - TOC-style list: chat title (serif), one-line italic preview, small-caps metadata, hairline rules, pin glyph
 * - Amber left-rule on hover/active
 * - Clicking a row navigates to /chat/:chatId with messages loaded
 */
export const ChatsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'pinned' | 'recent'>('all')
  const navigate = useNavigate()

  const filteredChats = mockChatSessions.filter((chat) => {
    const matchesQuery =
      !searchQuery.trim() ||
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.preview.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesQuery) return false

    if (filterType === 'pinned') return chat.isPinned
    if (filterType === 'recent') return !chat.isPinned
    return true
  })

  const handleSelectChat = (chat: ChatSession) => {
    navigate(`/chat/${chat.id}`)
  }

  return (
    <div className="flex-1 px-8 py-8 overflow-y-auto max-w-5xl mx-auto w-full space-y-6 select-none">
      {/* Editorial Header */}
      <div className="border-b border-border/80 pb-5 space-y-1.5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-medium tracking-tight text-text-primary">
            Chats
          </h1>
          <span className="font-mono text-xs text-text-muted">
            {mockChatSessions.length} total sessions
          </span>
        </div>
        <p className="font-display text-sm italic text-text-muted">
          Active engineering sessions, architectural refactors, and artifact discussions.
        </p>
      </div>

      {/* Filter / Search Bar (small-caps, hairline borders, no filled box) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-border/60 pb-3">
        {/* Search Input */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
            SEARCH:
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by title or prompt preview…"
            className="flex-1 bg-transparent border-b border-border/80 px-2 py-1 font-body text-xs text-text-primary placeholder:italic placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none transition-colors"
          />
        </div>

        {/* Filter Switcher */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {(['all', 'pinned', 'recent'] as const).map((filter) => {
            const isActive = filterType === filter
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setFilterType(filter)}
                className={`px-2.5 py-1 uppercase tracking-wider rounded-[2px] transition-colors cursor-pointer text-[11px] ${
                  isActive
                    ? 'border-b-2 border-accent-primary text-text-primary font-bold bg-surface-1'
                    : 'text-text-muted hover:text-text-body hover:bg-surface-1/40'
                }`}
              >
                {filter}
              </button>
            )
          })}
        </div>
      </div>

      {/* TOC-Style Chat Row List (DESIGN.md Screen 4) */}
      <div className="divide-y divide-border/60 border-t border-b border-border/60">
        {filteredChats.length === 0 ? (
          <div className="py-12 text-center text-xs italic text-text-muted">
            No matching chats found for &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => handleSelectChat(chat)}
              className="group flex items-start justify-between py-3.5 px-4 cursor-pointer transition-colors border-l-[3px] border-transparent hover:border-accent-primary hover:bg-surface-1/60 rounded-[2px]"
            >
              <div className="space-y-1 min-w-0 pr-4 flex-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-display text-base font-medium text-text-primary group-hover:text-accent-primary transition-colors truncate">
                    {chat.title}
                  </h2>
                  {chat.isPinned && (
                    <span
                      aria-label="Pinned Chat"
                      className="text-accent-primary text-xs shrink-0 select-none"
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
                  )}
                </div>

                <p className="font-body text-xs italic text-text-muted line-clamp-1 leading-relaxed">
                  {chat.preview}
                </p>
              </div>

              {/* Metadata columns */}
              <div className="flex items-center gap-4 shrink-0 font-mono text-[11px] text-text-muted">
                <span className="hidden sm:inline bg-surface-2 px-1.5 py-0.5 rounded-[2px] border border-border/80 uppercase text-[10px]">
                  {chat.model}
                </span>
                <span className="hidden md:inline">
                  {chat.messageCount} msgs
                </span>
                <span className="text-text-body/80">{chat.timestamp}</span>
                <span className="text-accent-primary font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ChatsPage
