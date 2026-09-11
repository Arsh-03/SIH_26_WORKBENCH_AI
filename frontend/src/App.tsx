import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { WorkbenchProvider } from './lib/WorkbenchContext'
import { AppLayout } from './components/layout/AppLayout'
import { ChatPage } from './routes/ChatPage'
import { ChatsPage } from './routes/ChatsPage'
import { ProjectsPage } from './routes/ProjectsPage'
import { LibraryPage } from './routes/LibraryPage'
import { SettingsPage } from './routes/SettingsPage'
import { DevPreviewPage } from './routes/DevPreviewPage'
import { LoginPage } from './routes/LoginPage'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-accent-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
          <span className="font-mono text-xs tracking-wider uppercase text-text-muted">
            Initializing Sovereign Enclave...
          </span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkbenchProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
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
        </WorkbenchProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
