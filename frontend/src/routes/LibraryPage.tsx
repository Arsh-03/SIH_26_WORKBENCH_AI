import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockLibraryItems } from '../lib/mockData'
import type { LibraryItem } from '../lib/types'

export const LibraryPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const categories = ['All', 'Components', 'Schemas', 'APIs', 'Migrations']

  const filteredItems = mockLibraryItems.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory
    const matchesQuery =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.badge.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesCategory && matchesQuery
  })

  const handleOpenArtifact = (_item: LibraryItem) => {
    navigate('/chat/auth-middleware')
  }

  return (
    <div className="flex-1 px-8 py-8 overflow-y-auto max-w-5xl mx-auto w-full space-y-6 select-none">
      {/* Editorial Header */}
      <div className="border-b border-border/80 pb-5 space-y-1.5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-medium tracking-tight text-text-primary">
            Library
          </h1>
          <span className="font-mono text-xs text-text-muted">
            {mockLibraryItems.length} curated artifacts
          </span>
        </div>
        <p className="font-display text-sm italic text-text-muted">
          Reusable code components, schemas, database migrations, and architectural artifacts.
        </p>
      </div>

      {/* Category Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-border/60 pb-3">
        {/* Category Pills */}
        <div className="flex items-center gap-2 font-mono text-xs overflow-x-auto">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 uppercase tracking-wider rounded-[2px] transition-colors cursor-pointer text-[11px] shrink-0 ${
                  isActive
                    ? 'border-b-2 border-accent-primary text-text-primary font-bold bg-surface-1'
                    : 'text-text-muted hover:text-text-body hover:bg-surface-1/40'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
            SEARCH:
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter artifacts…"
            className="w-48 bg-transparent border-b border-border/80 px-2 py-1 font-body text-xs text-text-primary placeholder:italic placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Reusable Contact-Sheet Card Grid (DESIGN.md 4D & Library Specs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => handleOpenArtifact(item)}
            className="group flex flex-col justify-between rounded-[4px] border border-border bg-surface-1 overflow-hidden shadow-sm hover:border-accent-primary/60 hover:bg-surface-2/60 transition-all cursor-pointer"
          >
            {/* Contact-Sheet Header Bar */}
            <div className="flex items-center justify-between border-b border-border bg-surface-2/40 px-4 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-xs font-semibold text-text-primary group-hover:text-accent-primary transition-colors truncate">
                  {item.title}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-accent-primary border border-accent-primary/40 px-1.5 py-0.5 rounded-[2px] bg-surface-1 shrink-0">
                  {item.badge}
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {item.language}
              </span>
            </div>

            {/* Body */}
            <div className="p-4 space-y-2 flex-1">
              <p className="font-body text-xs text-text-muted leading-relaxed">
                {item.description}
              </p>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between font-mono text-[11px] text-text-muted bg-surface-1/60">
              <div className="flex items-center gap-3">
                <span>{item.filesCount} {item.filesCount > 1 ? 'files' : 'file'}</span>
                <span>·</span>
                <span>{item.updatedAt}</span>
              </div>

              <span className="text-accent-primary font-semibold text-xs flex items-center gap-1 group-hover:underline">
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LibraryPage
