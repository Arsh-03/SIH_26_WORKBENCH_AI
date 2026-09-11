import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WorkbenchProvider } from './lib/WorkbenchContext'
import { AppLayout } from './components/layout/AppLayout'
import { ChatPage } from './routes/ChatPage'
import { ChatsPage } from './routes/ChatsPage'
import { ProjectsPage } from './routes/ProjectsPage'
import { LibraryPage } from './routes/LibraryPage'
import { DevPreviewPage } from './routes/DevPreviewPage'
import { useWorkbench } from './lib/WorkbenchContext'

const SettingsRouteRedirect: React.FC = () => {
  const { openSettings } = useWorkbench()
  React.useEffect(() => {
    openSettings()
  }, [openSettings])
  return <Navigate to="/" replace />
}

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <WorkbenchProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<ChatPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:id" element={<ChatPage />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/settings" element={<SettingsRouteRedirect />} />
            <Route path="/dev-preview" element={<DevPreviewPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </WorkbenchProvider>
    </BrowserRouter>
  )
}

export default App
