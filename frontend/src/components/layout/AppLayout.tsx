import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { FilmGrain } from './FilmGrain'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { useWorkbench } from '../../lib/WorkbenchContext'

/**
 * AppLayout
 * Persistent layout wrapper housing the film-grain overlay,
 * the Sidebar navigation, global Command Palette (⌘K), and outlet for active routes.
 */
export const AppLayout: React.FC = () => {
  const { isCmdPaletteOpen, setIsCmdPaletteOpen, resetToNewChat } = useWorkbench()
  const navigate = useNavigate()

  const handleNewChat = () => {
    resetToNewChat()
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
