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

const STORAGE_KEY = 'workbench_chat_sessions'

function loadSavedSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.error('Failed to load chat sessions from localStorage:', e)
  }
  return mockChatSessions
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch (e) {
    console.error('Failed to save chat sessions to localStorage:', e)
  }
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

  // Session Navigation & Persistence
  chatSessions: ChatSession[]
  currentChatId: string | null
  loadChatSession: (chatId: string) => void
  resetToNewChat: () => void
  deleteChatSession: (chatId: string) => void

  // Global Command Palette
  isCmdPaletteOpen: boolean
  setIsCmdPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Settings Modal Overlay State
  isSettingsOpen: boolean
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>
  openSettings: () => void
  closeSettings: () => void
  toggleSettings: () => void

  // Sidebar Open/Close State
  isSidebarOpen: boolean
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
  toggleSidebar: () => void
}

const WorkbenchContext = createContext<WorkbenchContextType | null>(null)

export const WorkbenchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(loadSavedSessions)
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

  const [currentChatId, setCurrentChatId] = useState<string | null>(() => `chat_${Date.now()}`)
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  const toggleSettings = useCallback(() => {
    setIsSettingsOpen((prev) => !prev)
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  // Keyboard shortcut ⌘B / Ctrl+B to toggle sidebar, ⌘, / Ctrl+, for Settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        toggleSettings()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar, toggleSettings])

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
    const session = chatSessions.find((s) => s.id === chatId)
    if (session) {
      setMessages(session.messages || [])
      const lastArt = [...(session.messages || [])].reverse().find((m) => m.artifact)?.artifact
      if (lastArt) {
        setActiveArtifact(lastArt)
      } else {
        setActiveArtifact(null)
      }
    }
  }, [chatSessions])

  // Reset to Zero State (New Chat)
  const resetToNewChat = useCallback(() => {
    const newChatId = `chat_${Date.now()}`
    setCurrentChatId(newChatId)
    setMessages([])
    setActiveArtifact(null)
    setIsArtifactOpen(false)
    setScopeFiles([])
    setIsStreaming(false)
    setCurrentThinking(null)
  }, [])

  // Delete a chat session
  const deleteChatSession = useCallback((chatId: string) => {
    setChatSessions((prev) => {
      const updated = prev.filter((s) => s.id !== chatId)
      saveSessions(updated)
      return updated
    })
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

  // Send message with live Backend WebSocket streaming + simulation fallback
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
          'Connecting to sovereign AI agent graph...',
          'Analyzing prompt scope and parameters...',
        ],
      })

      const sessionId = currentChatId || `sess_${Date.now()}`
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/v1/agents/ws/${sessionId}`

      let wsActive = false
      const liveSteps: string[] = []
      let receivedFinalAnswer = false

      try {
        const persistExchange = (finalMessages: ChatMessage[]) => {
          setChatSessions((prev) => {
            const existingIdx = prev.findIndex((s) => s.id === sessionId)
            const title = text.length > 38 ? text.slice(0, 38) + '…' : text
            const lastMsg = finalMessages[finalMessages.length - 1]
            const preview = lastMsg?.text ? (lastMsg.text.length > 80 ? lastMsg.text.slice(0, 80) + '…' : lastMsg.text) : 'Conversation active'
            const timestamp = 'Just now'

            let updated: ChatSession[]
            if (existingIdx >= 0) {
              const current = prev[existingIdx]
              const updatedSession: ChatSession = {
                ...current,
                preview,
                timestamp,
                messageCount: finalMessages.length,
                messages: finalMessages,
              }
              updated = [updatedSession, ...prev.filter((_, idx) => idx !== existingIdx)]
            } else {
              const newSession: ChatSession = {
                id: sessionId,
                title,
                preview,
                timestamp,
                model: 'llama3.1:8b',
                messageCount: finalMessages.length,
                isPinned: false,
                path: `/chat/${sessionId}`,
                messages: finalMessages,
              }
              updated = [newSession, ...prev]
            }
            saveSessions(updated)
            return updated
          })
        }

        await new Promise<void>((resolve, reject) => {
          let socket: WebSocket | null = null
          try {
            socket = new WebSocket(wsUrl)
          } catch (e) {
            return reject(e)
          }

          const timeoutTimer = setTimeout(() => {
            if (!wsActive) {
              if (socket && socket.readyState !== WebSocket.CLOSED) {
                socket.close()
              }
              reject(new Error('WebSocket connection timeout'))
            }
          }, 60000)

          socket.onopen = () => {
            wsActive = true
            clearTimeout(timeoutTimer)
            
            const allowedToolsList = ['rag_search']
            if (activeTools.codeExecution) allowedToolsList.push('sandbox_execute')

            const payload = {
              action: 'run_agent',
              workspace_id: 'default_workspace',
              session_id: sessionId,
              prompt: text,
              active_document_ids: scopeFiles.map((s) => s.id),
              allowed_tools: allowedToolsList,
              temperature: 0.1,
            }
            socket?.send(JSON.stringify(payload))
          }


          socket.onmessage = (event) => {
            try {
              const frame = JSON.parse(event.data)
              if (frame.event === 'thought') {
                liveSteps.push(frame.content || 'Analyzing request...')
                setCurrentThinking({
                  duration: 'Reasoning in progress…',
                  steps: [...liveSteps],
                })
              } else if (frame.event === 'tool_call') {
                liveSteps.push(`Calling tool: ${frame.tool_name || 'execution'}`)
                setCurrentThinking({
                  duration: 'Executing sovereign tools…',
                  steps: [...liveSteps],
                })
              } else if (frame.event === 'token') {
                if (frame.token) {
                  liveSteps.push(`Streaming generation…`)
                  setCurrentThinking((prev) => ({
                    duration: 'Generating output (Live Stream)…',
                    steps: prev?.steps || liveSteps,
                  }))
                }
              } else if (frame.event === 'tool_result') {

                liveSteps.push(`Tool completed: ${frame.tool_name || 'done'}`)
                setCurrentThinking({
                  duration: 'Synthesizing output…',
                  steps: [...liveSteps],
                })
              } else if (frame.event === 'final_answer') {
                receivedFinalAnswer = true
                const modelMsg: ChatMessage = {
                  id: `model-${Date.now()}`,
                  sender: 'model',
                  text: frame.content || '',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  modelUsed: frame.metrics?.model_used || 'llama3.1:8b',
                  modelCapability: frame.metrics?.model_capability || 'general_chat',
                  routingReason: frame.metrics?.routing_reason || 'Dynamic Model Router allocation',
                  thinkingDuration: `${frame.metrics?.execution_time_ms || 420}ms (Sovereign Enclave)`,
                  thinkingSteps: liveSteps.length > 0 ? liveSteps : [
                    'Sovereign AI graph execution verified',
                    'Zero-egress audit trace recorded'
                  ],
                  artifact: frame.artifact || undefined,
                }

                if (frame.artifact) {
                  setActiveArtifact(frame.artifact)
                  setIsArtifactOpen(true)
                }
                setMessages((prev) => {
                  const updated = [...prev, modelMsg]
                  persistExchange(updated)
                  return updated
                })
                resolve()
              }
            } catch (err) {
              console.error('Failed to parse frame', err)
            }
          }

          socket.onerror = (err) => {
            clearTimeout(timeoutTimer)
            if (!receivedFinalAnswer) {
              reject(err)
            }
          }

          socket.onclose = () => {
            clearTimeout(timeoutTimer)
            if (!receivedFinalAnswer && !wsActive) {
              reject(new Error('WebSocket closed early'))
            } else {
              resolve()
            }
          }
        })
      } catch (wsErr) {
        console.warn('Backend WebSocket unavailable, falling back to simulated inference:', wsErr)
        
        // Fallback to simulation
        const response = await simulateModelResponse(text, {
          activeTools,
          scopeFiles: scopeFiles.map((s) => s.name),
        })

        const modelMsg: ChatMessage = {
          id: `model-${Date.now()}`,
          sender: 'model',
          text: response.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          thinkingDuration: response.thinkingDuration,
          thinkingSteps: response.thinkingSteps,
          artifact: response.artifact,
        }

        setMessages((prev) => {
          const updated = [...prev, modelMsg]
          const existingIdx = chatSessions.findIndex((s) => s.id === sessionId)
          const title = text.length > 38 ? text.slice(0, 38) + '…' : text
          let updatedSessions: ChatSession[]
          if (existingIdx >= 0) {
            updatedSessions = chatSessions.map((s) => s.id === sessionId ? { ...s, messages: updated, messageCount: updated.length } : s)
          } else {
            updatedSessions = [{
              id: sessionId,
              title,
              preview: response.text.slice(0, 80) + '…',
              timestamp: 'Just now',
              model: 'llama3.1:8b',
              messageCount: updated.length,
              isPinned: false,
              path: `/chat/${sessionId}`,
              messages: updated,
            }, ...chatSessions]
          }
          setChatSessions(updatedSessions)
          saveSessions(updatedSessions)
          return updated
        })
      } finally {
        setIsStreaming(false)
        setCurrentThinking(null)
      }
    },
    [activeTools, currentChatId, scopeFiles, chatSessions]
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
        chatSessions,
        currentChatId,
        loadChatSession,
        resetToNewChat,
        deleteChatSession,
        isCmdPaletteOpen,
        setIsCmdPaletteOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        openSettings,
        closeSettings,
        toggleSettings,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
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
