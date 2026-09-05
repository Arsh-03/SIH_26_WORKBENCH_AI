import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ChatPage } from './routes/ChatPage'
import { ChatsPage } from './routes/ChatsPage'
import { ProjectsPage } from './routes/ProjectsPage'
import { LibraryPage } from './routes/LibraryPage'
import { SettingsPage } from './routes/SettingsPage'
import { DevPreviewPage } from './routes/DevPreviewPage'

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ChatPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:id" element={<ChatPage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dev-preview" element={<DevPreviewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
