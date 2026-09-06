/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ChatMessage, ArtifactData, ScopeFile, ChatSession } from './types'
import { mockChatSessions, mockArtifactData } from './mockData'
import { simulateModelResponse } from './simulateAi'

export interface ActiveToolsState {
  webSearch: boolean
  codeExecution: boolean
  deepResearch: boolean
}

export interface WorkbenchContextType {
  // Chat & Stream State
  messages: ChatMessage[]
  isStreaming: boolean
  currentThinking: {
    duration: string
    steps: string[]
  } | null
  sendMessage: (text: string) => Promise<void>
  stopStreaming: () => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>

  // Artifact State
  activeArtifact: ArtifactData | null
  isArtifactOpen: boolean
  openArtifact: (artifact: ArtifactData) => void
  closeArtifact: () => void
  toggleArtifactPanel: () => void

  // Scope Files State
  scopeFiles: ScopeFile[]
  removeScopeFile: (fileId: string) => void
  setScopeFiles: React.Dispatch<React.SetStateAction<ScopeFile[]>>

  // Tools State
  activeTools: ActiveToolsState
  toggleTool: (toolKey: keyof ActiveToolsState) => void

  // Session Navigation
  currentChatId: string | null
  loadChatSession: (chatId: string) => void
  resetToNewChat: () => void

  // Global Command Palette
  isCmdPaletteOpen: boolean
  setIsCmdPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const WorkbenchContext = createContext<WorkbenchContextType | null>(null)

export const WorkbenchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentThinking, setCurrentThinking] = useState<{ duration: string; steps: string[] } | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const [activeArtifact, setActiveArtifact] = useState<ArtifactData | null>(null)
  const [isArtifactOpen, setIsArtifactOpen] = useState(false)
  const [scopeFiles, setScopeFiles] = useState<ScopeFile[]>([])

  const [activeTools, setActiveTools] = useState<ActiveToolsState>({
    webSearch: true,
    codeExecution: true,
    deepResearch: false,
  })

  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false)

  // Toggle tool state
  const toggleTool = useCallback((toolKey: keyof ActiveToolsState) => {
    setActiveTools((prev) => ({
      ...prev,
      [toolKey]: !prev[toolKey],
    }))
  }, [])

  // Open artifact into Split View and populate scope file chips
  const openArtifact = useCallback((artifact: ArtifactData) => {
    setActiveArtifact(artifact)
    setIsArtifactOpen(true)
    const files = artifact.files?.map((f) => ({
      id: f.name,
      name: f.name,
    })) || [{ id: artifact.title, name: artifact.title }]
    setScopeFiles(files)
  }, [])

  // Close artifact panel and clear scope chips
  const closeArtifact = useCallback(() => {
    setIsArtifactOpen(false)
    setScopeFiles([])
  }, [])

  // Toggle Split View
  const toggleArtifactPanel = useCallback(() => {
    setIsArtifactOpen((prevOpen) => {
      if (prevOpen) {
        setScopeFiles([])
        return false
      } else {
        // Find existing or fallback artifact
        let targetArt = activeArtifact
        if (!targetArt) {
          const foundMsgWithArt = [...messages].reverse().find((m) => m.artifact)
          targetArt = foundMsgWithArt?.artifact || mockArtifactData
          setActiveArtifact(targetArt)
        }
        const files = targetArt.files?.map((f) => ({
          id: f.name,
          name: f.name,
        })) || [{ id: targetArt.title, name: targetArt.title }]
        setScopeFiles(files)
        return true
      }
    })
  }, [activeArtifact, messages])

  // Remove a scope file chip
  const removeScopeFile = useCallback((fileId: string) => {
    setScopeFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  // Load a chat session by ID
  const loadChatSession = useCallback((chatId: string) => {
    setCurrentChatId(chatId)
    const session: ChatSession | undefined = mockChatSessions.find((s) => s.id === chatId)
    if (session) {
      setMessages(session.messages)
      const lastArt = [...session.messages].reverse().find((m) => m.artifact)?.artifact
      if (lastArt) {
        setActiveArtifact(lastArt)
      }
    }
  }, [])

  // Reset to Zero State (New Chat)
  const resetToNewChat = useCallback(() => {
    setCurrentChatId(null)
    setMessages([])
    setActiveArtifact(null)
    setIsArtifactOpen(false)
    setScopeFiles([])
    setIsStreaming(false)
    setCurrentThinking(null)
  }, [])

  // Stop active streaming/generation
  const stopStreaming = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
    setIsStreaming(false)
    setCurrentThinking(null)
  }, [abortController])

  // Send message and simulate model response
  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, userMsg])
      setIsStreaming(true)
      setCurrentThinking({
        duration: 'Synthesizing reasoning sequence…',
        steps: [
          'Parsing AST dependencies and token scope...',
          'Analyzing data flow bottlenecks in render pipeline...',
          'Compiling responsive TypeScript artifacts with verification checks...',
        ],
      })

      const controller = new AbortController()
      setAbortController(controller)

      try {
        const response = await simulateModelResponse(text, {
          activeTools,
          scopeFiles: scopeFiles.map((s) => s.name),
        })

        if (!controller.signal.aborted) {
          const modelMsg: ChatMessage = {
            id: `model-${Date.now()}`,
            sender: 'model',
            text: response.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            thinkingDuration: response.thinkingDuration,
            thinkingSteps: response.thinkingSteps,
            artifact: response.artifact,
          }

          setMessages((prev) => [...prev, modelMsg])
        }
      } catch (err) {
        console.error('Simulated response error:', err)
      } finally {
        setIsStreaming(false)
        setCurrentThinking(null)
        setAbortController(null)
      }
    },
    [activeTools, scopeFiles]
  )

  // Listen for global ⌘K / Ctrl+K keyboard shortcut
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

  return (
    <WorkbenchContext.Provider
      value={{
        messages,
        isStreaming,
        currentThinking,
        sendMessage,
        stopStreaming,
        setMessages,
        activeArtifact,
        isArtifactOpen,
        openArtifact,
        closeArtifact,
        toggleArtifactPanel,
        scopeFiles,
        removeScopeFile,
        setScopeFiles,
        activeTools,
        toggleTool,
        currentChatId,
        loadChatSession,
        resetToNewChat,
        isCmdPaletteOpen,
        setIsCmdPaletteOpen,
      }}
    >
      {children}
    </WorkbenchContext.Provider>
  )
}

export const useWorkbench = (): WorkbenchContextType => {
  const context = useContext(WorkbenchContext)
  if (!context) {
    throw new Error('useWorkbench must be used within a WorkbenchProvider')
  }
  return context
}
