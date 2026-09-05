# AI Artifact Studio — Agent Guide

## What this project is
A general-purpose AI coding/chat assistant (Claude/ChatGPT-style), being built for Smart India Hackathon, with a custom "Darkroom Editorial" visual identity. See `DESIGN.md` for the full design system, component specs, screen definitions, and motion/animation rules — read it before generating or modifying any UI.

## Stack
- React + Vite + TypeScript
- Tailwind CSS
- shadcn/ui
- framer-motion (for all animation — see DESIGN.md Section 6)
- react-router-dom

## Folder structure
```
src/
  components/
    layout/     → Sidebar, CommandPalette, GrainOverlay (shared across all routes)
    chat/       → InputBar, MessageBlock, ThinkingIndicator, ArtifactCard, ToolPopover
    artifact/   → ArtifactPanel, FileTabs, VersionRail
  routes/       → ChatPage, ChatsPage, ProjectsPage, LibraryPage, SettingsPage
  lib/          → design tokens, shared types, mock data
```

## Key architectural rule
Zero State, Active Chat, and Split View are **one route** (`ChatPage`), not three separate pages — they're conditional states of the same component based on message count and whether the artifact panel is open. Do not create separate route files for these three.

Sidebar and CommandPalette are persistent, shared components rendered once at the layout level — never duplicate their markup per-route.

## Design rules (see DESIGN.md for full detail)
- Colors, type, radii, spacing: defined as CSS variables — use the tokens, never hardcode hex values or arbitrary Tailwind classes that bypass them.
- Icon-light UI: typography (small caps labels, italic captions, serif headers) carries hierarchy — don't add icons where a text link or label would do the job per DESIGN.md.
- Amber accent (`#D97A3F`) stays rare — under ~5-10% of any screen. If a change is adding more amber than that, stop and reconsider.
- Sharp 4px radii by default; only the floating Tool & Attachment popover and Command Palette get a small softening exception.
- All sample/demo content (project names, chat examples, artifact filenames) must read as genuine software development work — never photography/darkroom-literal content. The aesthetic is a skin; the product is a coding assistant.
- No invented decorative status text or badges that don't map to a real feature.

## Build order
1. Design tokens + folder scaffold
2. Shared components (Sidebar, CommandPalette, GrainOverlay)
3. Routes with mock data (ChatPage first, then Chats/Projects/Library/Settings)
4. Routing wired in App.tsx
5. Animation pass (framer-motion, per DESIGN.md Section 6) — after structure is stable, not alongside it
6. Backend/API integration
