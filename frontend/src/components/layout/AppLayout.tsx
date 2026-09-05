import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { FilmGrain } from './FilmGrain'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'

/**
 * AppLayout
 * Persistent layout wrapper housing the film-grain overlay,
 * the Sidebar navigation, global Command Palette (⌘K), and outlet for active routes.
 */
export const AppLayout: React.FC = () => {
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false)
  const navigate = useNavigate()

  // Global ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCmdPaletteOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleNewChat = () => {
    window.dispatchEvent(new CustomEvent('workbench:new-chat'))
    navigate('/')
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background text-text-body font-body antialiased selection:bg-accent-primary/20 selection:text-text-primary">
      {/* Analog film-grain overlay across entire viewport */}
      <FilmGrain />

      {/* Persistent Left Sidebar */}
      <Sidebar
        onOpenCmdPalette={() => setIsCmdPaletteOpen(true)}
        onNewChat={handleNewChat}
      />

      {/* Global Command Palette modal */}
      <CommandPalette
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
      />

      {/* Main content area */}
      <main className="relative z-10 flex flex-1 flex-col overflow-y-auto bg-background">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
