import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockDetailedProjects } from '../lib/mockData'
import type { ProjectItem } from '../lib/types'

export const ProjectsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const filteredProjects = mockDetailedProjects.filter((project) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      project.title.toLowerCase().includes(q) ||
      project.description.toLowerCase().includes(q) ||
      project.tags.some((t) => t.toLowerCase().includes(q))
    )
  })

  const handleOpenProject = (_project: ProjectItem) => {
    // Navigate to chat or project session
    navigate('/chat/auth-middleware')
  }

  return (
    <div className="flex-1 px-8 py-8 overflow-y-auto max-w-5xl mx-auto w-full space-y-6 select-none">
      {/* Editorial Header */}
      <div className="border-b border-border/80 pb-5 space-y-1.5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-medium tracking-tight text-text-primary">
            Projects
          </h1>
          <span className="font-mono text-xs text-text-muted">
            {mockDetailedProjects.length} active initiatives
          </span>
        </div>
        <p className="font-display text-sm italic text-text-muted">
          Active engineering initiatives, architecture specs, and artifact design systems.
        </p>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
            SEARCH:
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter projects by title, tag, or description…"
            className="flex-1 bg-transparent border-b border-border/80 px-2 py-1 font-body text-xs text-text-primary placeholder:italic placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none transition-colors"
          />
        </div>

        <span className="font-mono text-[11px] text-text-muted">
          Showing {filteredProjects.length} projects
        </span>
      </div>

      {/* Projects Grid / TOC List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            onClick={() => handleOpenProject(project)}
            className="group flex flex-col justify-between rounded-[4px] border border-border bg-surface-1 p-5 shadow-sm hover:border-accent-primary/60 hover:bg-surface-2/60 transition-all cursor-pointer space-y-4"
          >
            <div>
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono text-xs font-semibold text-accent-primary tracking-wider">
                  TOC {project.code}
                </span>
                <span className="font-mono text-[10px] text-text-muted">
                  Active {project.lastActive}
                </span>
              </div>

              <h2 className="font-display text-lg font-medium text-text-primary group-hover:text-accent-primary transition-colors">
                {project.title}
              </h2>

              <p className="font-body text-xs text-text-muted mt-2 leading-relaxed">
                {project.description}
              </p>
            </div>

            <div className="pt-3 border-t border-border/50 flex items-center justify-between">
              {/* Tags */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[9px] uppercase tracking-wider text-text-muted bg-surface-2 px-1.5 py-0.5 rounded-[2px] border border-border/80"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 font-mono text-[11px] text-text-muted shrink-0">
                <span>{project.filesCount} files</span>
                <span>·</span>
                <span className="text-text-body">{project.artifactsCount} artifacts</span>
                <span className="text-accent-primary text-xs transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProjectsPage
