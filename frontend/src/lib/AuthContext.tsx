import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from './api'
import type { DemoUser } from './api'
import type { UserProfile } from './types'

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (payload: {
    username: string
    email: string
    password: string
    full_name: string
    role?: string
  }) => Promise<void>
  logout: () => void
  loginWithDemo: (demoUser: DemoUser) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sovereign_auth_token'))
  const [user, setUser] = useState<UserProfile | null>(() => {
    const cached = localStorage.getItem('sovereign_auth_user')
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch {
        return null
      }
    }
    // Default fallback initial operator if offline
    return {
      id: 'usr_admin_001',
      username: 'admin',
      email: 'admin@sovereign.local',
      name: 'Lead AI Architect',
      role: 'Lead AI Architect',
      avatarLetter: 'A',
    }
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Verify session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('sovereign_auth_token')
      if (storedToken) {
        try {
          const profile = await api.getCurrentUser()
          const dynamicInitial = profile.avatarLetter || profile.name?.trim().charAt(0).toUpperCase() || profile.username?.trim().charAt(0).toUpperCase() || 'M'
          const updatedProfile = { ...profile, avatarLetter: dynamicInitial }
          setUser(updatedProfile)
          localStorage.setItem('sovereign_auth_user', JSON.stringify(updatedProfile))
        } catch (err) {
          console.warn('Session verification failed or server offline, keeping local session:', err)
        }
      }
      setIsLoading(false)
    }

    initAuth()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password)
    const dynamicInitial = res.user.avatar_letter || res.user.full_name?.trim().charAt(0).toUpperCase() || res.user.username?.trim().charAt(0).toUpperCase() || 'M'
    const profile: UserProfile = {
      id: res.user.id,
      username: res.user.username,
      email: res.user.email,
      name: res.user.full_name || res.user.username,
      role: res.user.role || 'Lead AI Architect',
      avatarLetter: dynamicInitial,
    }
    setToken(res.access_token)
    setUser(profile)
    localStorage.setItem('sovereign_auth_user', JSON.stringify(profile))
  }, [])

  const register = useCallback(
    async (payload: {
      username: string
      email: string
      password: string
      full_name: string
      role?: string
    }) => {
      const res = await api.register(payload)
      const dynamicInitial = res.user.avatar_letter || res.user.full_name?.trim().charAt(0).toUpperCase() || res.user.username?.trim().charAt(0).toUpperCase() || 'M'
      const profile: UserProfile = {
        id: res.user.id,
        username: res.user.username,
        email: res.user.email,
        name: res.user.full_name || res.user.username,
        role: res.user.role || 'Lead AI Architect',
        avatarLetter: dynamicInitial,
      }
      setToken(res.access_token)
      setUser(profile)
      localStorage.setItem('sovereign_auth_user', JSON.stringify(profile))
    },
    []
  )

  const loginWithDemo = useCallback(
    async (demoUser: DemoUser) => {
      await login(demoUser.username, demoUser.password)
    },
    [login]
  )

  const logout = useCallback(() => {
    api.logout()
    localStorage.removeItem('sovereign_auth_user')
    setToken(null)
    setUser(null)
  }, [])

  const isAuthenticated = Boolean(user && token)

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        loginWithDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
