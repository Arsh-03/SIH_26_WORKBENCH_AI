import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FilmGrain } from './FilmGrain'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { SettingsPage } from '../../routes/SettingsPage'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import { useWorkbench } from '../../lib/WorkbenchContext'

/**
 * AppLayout
 * Persistent layout wrapper housing the film-grain overlay,
 * the Sidebar navigation, global Command Palette (⌘K), Settings Modal (⌘,), Keyboard Shortcuts (⌘/), and outlet for active routes.
 */
export const AppLayout: React.FC = () => {
  const {
    isCmdPaletteOpen,
    setIsCmdPaletteOpen,
    isSettingsOpen,
    closeSettings,
    isShortcutsOpen,
    closeShortcuts,
    resetToNewChat,
    isSidebarOpen,
  } = useWorkbench()
  const navigate = useNavigate()

  const handleNewChat = () => {
    resetToNewChat()
    navigate('/')
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background text-text-body font-body antialiased selection:bg-accent-primary/20 selection:text-text-primary">
      {/* Analog film-grain overlay across entire viewport */}
      <FilmGrain />

      {/* Collapsible Left Sidebar with Spring Animation (280px Full <-> 56px Icon Rail) */}
      <motion.div
        animate={{ width: isSidebarOpen ? 280 : 56 }}
        transition={{
          type: 'spring',
          stiffness: 280,
          damping: 28,
          mass: 0.9,
        }}
        className="h-full shrink-0 overflow-hidden"
      >
        <Sidebar
          onOpenCmdPalette={() => setIsCmdPaletteOpen(true)}
          onNewChat={handleNewChat}
        />
      </motion.div>

      {/* Global Command Palette modal */}
      <CommandPalette
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
      />

      {/* Settings Modal Overlay on top of Workbench */}
      <SettingsPage
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        isModal={true}
      />

      {/* Global Keyboard Shortcuts Reference & Config Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={closeShortcuts}
      />

      {/* Main content area */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
