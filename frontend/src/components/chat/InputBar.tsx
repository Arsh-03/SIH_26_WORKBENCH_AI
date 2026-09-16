import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkbench } from '../../lib/WorkbenchContext'
import { api } from '../../lib/api'

export interface InputBarProps {
  onSendMessage?: (text: string) => void
  isStreaming?: boolean
  onStopStreaming?: () => void
  className?: string
  placeholder?: string
}

interface SlashCommand {
  command: string
  label: string
  description: string
}

const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/explain', label: 'Explain Code', description: 'Break down architecture and logic' },
  { command: '/refactor', label: 'Refactor Module', description: 'Decouple rendering, improve performance' },
  { command: '/test', label: 'Generate Tests', description: 'Unit & integration test coverage' },
  { command: '/fix', label: 'Fix Bug', description: 'Diagnose and repair exception traces' },
]

export const InputBar: React.FC<InputBarProps> = ({
  onSendMessage,
  isStreaming: propIsStreaming,
  onStopStreaming: propOnStopStreaming,
  className = '',
  placeholder = 'Ask a question, propose an edit, or type / for commands…',
}) => {
  const {
    scopeFiles,
    removeScopeFile,
    setScopeFiles,
    activeTools,
    toggleTool,
    messages,
    isStreaming: ctxIsStreaming,
    stopStreaming: ctxStopStreaming,
    sendMessage: ctxSendMessage,
  } = useWorkbench()

  const isStreaming = propIsStreaming ?? ctxIsStreaming
  const onStopStreaming = propOnStopStreaming ?? ctxStopStreaming

  const [inputText, setInputText] = useState('')
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false)
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const [isAtMenuOpen, setIsAtMenuOpen] = useState(false)
  const [atQuery, setAtQuery] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSendFlashing, setIsSendFlashing] = useState(false)


  // Voice Input (Speech-to-Text & Audio Visualizer) State
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const baseTextRef = useRef<string>('')
  const hasLiveTranscriptRef = useRef<boolean>(false)

  // Clean up audio & recognition on unmount
  useEffect(() => {
    return () => {
      stopVoiceInput()
    }
  }, [])

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        // Ignore stop error
      }
      recognitionRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch (err) {
        // Ignore stop error
      }
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    setIsListening(false)
    setAudioLevel(0)
  }

  const startVoiceInput = async () => {
    setSpeechError(null)
    hasLiveTranscriptRef.current = false
    audioChunksRef.current = []

    try {
      // 1. Request microphone access for real-time audio analysis & recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      // 2. Set up Web Audio API equalizer visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyserRef.current = analyser

      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateLevel = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const average = sum / dataArray.length
        setAudioLevel(Math.min(1, average / 60))
        animationFrameRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()

      // 3. Set up MediaRecorder for universal browser support (Firefox, Safari, Chrome, Edge)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
        ? 'audio/ogg'
        : ''

      const options = mimeType ? { mimeType } : undefined
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
        // If Web Speech API was not available or produced no transcript, transcribe via Whisper backend
        if (!hasLiveTranscriptRef.current && audioBlob.size > 1000) {
          setIsTranscribing(true)
          try {
            const res = await api.transcribeAudio(audioBlob, `speech_${Date.now()}.webm`)
            if (res.text && res.text.trim()) {
              setInputText((prev) => {
                const base = prev ? (prev.endsWith(' ') ? prev : `${prev} `) : ''
                return `${base}${res.text.trim()}`
              })
            }
          } catch (err: any) {
            console.error('Backend transcription failed:', err)
            setSpeechError(err.message || 'Failed to transcribe audio.')
          } finally {
            setIsTranscribing(false)
          }
        }
      }

      mediaRecorder.start(250) // Collect 250ms chunks
      setIsListening(true)

      // 4. Also try browser SpeechRecognition if available for instantaneous real-time typing
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition()
          recognition.continuous = true
          recognition.interimResults = true
          recognition.lang = 'en-US'

          baseTextRef.current = inputText ? (inputText.endsWith(' ') ? inputText : `${inputText} `) : ''

          recognition.onresult = (event: any) => {
            let interimTranscript = ''
            let finalTranscript = ''

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript
              } else {
                interimTranscript += event.results[i][0].transcript
              }
            }

            const fullSpoken = (finalTranscript || interimTranscript).trim()
            if (fullSpoken) {
              hasLiveTranscriptRef.current = true
              setInputText(`${baseTextRef.current}${fullSpoken}`)
            }
          }

          recognition.onerror = (event: any) => {
            if (event.error !== 'no-speech') {
              console.warn('Speech recognition warning:', event.error)
            }
          }

          recognitionRef.current = recognition
          recognition.start()
        } catch (e) {
          // Gracefully fall back to backend MediaRecorder transcription
          console.warn('Native speech recognition skipped, using backend Whisper:', e)
        }
      }
    } catch (err: any) {
      console.error('Error starting audio recording:', err)
      setSpeechError(err.message || 'Microphone access denied or unavailable.')
      stopVoiceInput()
    }
  }

  const toggleVoiceInput = () => {
    if (isListening) {
      stopVoiceInput()
    } else {
      startVoiceInput()
    }
  }

  // Handle file & photo selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newScopeFiles = Array.from(files).map((f) => ({
      id: `file-${Date.now()}-${f.name}`,
      name: f.name,
    }))

    setScopeFiles((prev) => [...prev, ...newScopeFiles])
    setIsAttachmentOpen(false)

    // Attempt background document upload to backend
    Array.from(files).forEach((f) => {
      api.uploadDocument('default_workspace', f).catch((err) => {
        console.warn('Document upload notice:', err)
      })
    })

    if (fileInputRef.current) fileInputRef.current.value = ''
  }


  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }, [inputText])

  // Filter slash commands based on typed query after '/'
  const filteredSlashCommands = SLASH_COMMANDS.filter((cmd) => {
    if (!slashQuery) return true
    const q = slashQuery.toLowerCase()
    return (
      cmd.command.slice(1).toLowerCase().includes(q) ||
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q)
    )
  })

  // Filter @ file mentions (session artifacts + scope files)
  const availableAtFiles = React.useMemo(() => {
    const list: string[] = scopeFiles.map((s) => s.name)
    messages.forEach((m) => {
      if (m.artifact && !list.includes(m.artifact.title)) {
        list.push(m.artifact.title)
      }
    })
    return list.filter((f) => !atQuery || f.toLowerCase().includes(atQuery.toLowerCase()))
  }, [scopeFiles, messages, atQuery])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files)
      const newScopes = droppedFiles.map((f) => ({
        id: f.name,
        name: f.name,
      }))
      setScopeFiles([...scopeFiles, ...newScopes])
      droppedFiles.forEach((f) => {
        api.uploadDocument('default_workspace', f).catch((err) => {
          console.warn('Document upload notice:', err)
        })
      })
    }
  }

  // Detect slash commands and @ file mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputText(val)

    if (val.startsWith('/')) {
      const spaceIdx = val.indexOf(' ')
      if (spaceIdx === -1) {
        const query = val.slice(1)
        setSlashQuery(query)
        setIsSlashMenuOpen(true)
        setIsAtMenuOpen(false)
        setSlashSelectedIndex(0)
        return
      }
    }

    const atIdx = val.lastIndexOf('@')
    if (atIdx !== -1 && (atIdx === 0 || val[atIdx - 1] === ' ')) {
      const query = val.slice(atIdx + 1)
      setAtQuery(query)
      setIsAtMenuOpen(true)
      setIsSlashMenuOpen(false)
      return
    }

    setIsSlashMenuOpen(false)
    setIsAtMenuOpen(false)
  }

  // Insert selected @ file mention and focus input
  const handleSelectAtFile = (fileName: string) => {
    const atIdx = inputText.lastIndexOf('@')
    const prefix = atIdx !== -1 ? inputText.slice(0, atIdx) : inputText
    setInputText(`${prefix}@${fileName} `)
    setIsAtMenuOpen(false)
    setAtQuery('')
    textareaRef.current?.focus()
  }

  // Insert selected slash command and focus input
  const handleSelectSlash = (cmd: SlashCommand) => {
    setInputText(`${cmd.command} `)
    setIsSlashMenuOpen(false)
    setSlashQuery('')
    textareaRef.current?.focus()
  }


  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    // If streaming and input is empty, treat as stop generation request
    if (isStreaming && !inputText.trim()) {
      onStopStreaming?.()
      return
    }

    if (isListening) {
      stopVoiceInput()
    }

    if (!inputText.trim()) return

    // Trigger amber flash + scale micro-interaction (DESIGN.md Section 6)
    setIsSendFlashing(true)
    setTimeout(() => setIsSendFlashing(false), 120)

    const textToSend = inputText.trim()
    setInputText('')
    setIsSlashMenuOpen(false)
    setSlashQuery('')

    if (onSendMessage) {
      onSendMessage(textToSend)
    } else {
      ctxSendMessage(textToSend)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle slash menu navigation
    if (isSlashMenuOpen && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashSelectedIndex((prev) => (prev + 1) % filteredSlashCommands.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashSelectedIndex(
          (prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length
        )
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selected = filteredSlashCommands[slashSelectedIndex]
        if (selected) {
          handleSelectSlash(selected)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsSlashMenuOpen(false)
        return
      }
    }

    // Normal Enter to submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Close attachment popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsAttachmentOpen(false)
      }
    }

    if (isAttachmentOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isAttachmentOpen])

  const hasReportInScope = useMemo(() => {
    return scopeFiles.some((f) => {
      const lower = f.name.toLowerCase()
      return (
        lower.endsWith('.pdf') ||
        lower.endsWith('.csv') ||
        lower.endsWith('.xlsx') ||
        lower.endsWith('.xls') ||
        lower.endsWith('.docx') ||
        lower.endsWith('.doc') ||
        lower.endsWith('.txt') ||
        lower.endsWith('.json') ||
        lower.includes('report') ||
        lower.includes('log') ||
        lower.includes('telemetry')
      )
    })
  }, [scopeFiles])

  return (
    <div className={`relative w-full max-w-4xl mx-auto select-none ${className}`}>
      {/* Context Indicator Strip (DESIGN.md Section 4B): Reflects real open artifact files */}
      <AnimatePresence>
        {scopeFiles.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 font-mono text-[10px] text-text-muted border-b border-border/40 bg-surface-1/40 rounded-t-[4px]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="uppercase tracking-widest text-text-muted/80 font-semibold">
                IN SCOPE:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {scopeFiles.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, scale: 0.8, width: 0 }}
                    animate={{ opacity: 1, scale: 1, width: 'auto' }}
                    exit={{
                      opacity: 0,
                      scale: 0.8,
                      width: 0,
                      paddingLeft: 0,
                      paddingRight: 0,
                      marginLeft: 0,
                      marginRight: 0,
                    }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="inline-flex items-center gap-1.5 rounded-[2px] border border-border/80 bg-surface-1 px-2 py-0.5 text-text-body overflow-hidden whitespace-nowrap"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-primary shrink-0" />
                    <span className="truncate max-w-[200px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeScopeFile(file.id)}
                      className="ml-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer text-xs leading-none"
                      aria-label={`Remove ${file.name} from scope`}
                    >
                      ×
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Quick Action: Analyze & Generate Infographics */}
            {hasReportInScope && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => {
                  const docList = scopeFiles.map((f) => f.name).join(', ')
                  const prompt = `Analyze the uploaded document (${docList}) and generate interactive visual analytics including operational KPIs, unit yield curves, 2D equipment fouling heatmaps, and engineering recommendations.`
                  setInputText(prompt)
                  if (textareaRef.current) {
                    textareaRef.current.focus()
                  }
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-accent-primary/15 text-accent-primary hover:bg-accent-primary hover:text-black border border-accent-primary/60 shadow-xs transition-all cursor-pointer select-none font-mono text-[10px] font-bold shrink-0 ml-auto group"
                title="Generate Chart.js, Heatmaps, and KPIs from this report"
              >
                <span className="group-hover:scale-110 transition-transform">📊</span>
                <span>Analyze &amp; Generate Infographics</span>
              </motion.button>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Floating Tool & Attachment Popover */}
      <AnimatePresence>
        {isAttachmentOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-full left-4 mb-2 w-72 rounded-[4px] border border-border bg-surface-2 p-2 shadow-2xl z-30 space-y-1"
          >
            <div className="px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border/60">
              ATTACHMENTS & TOOLS
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.py,.ts,.tsx,.md"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-left px-2.5 py-1.5 text-xs text-text-body hover:text-text-primary rounded-[2px] transition-colors border-l-2 border-transparent hover:border-accent-primary cursor-pointer"
            >
              + Add photos & files
            </button>


            <div className="pt-1 border-t border-border/40">
              <span className="px-2.5 py-1 block font-mono text-[9px] uppercase tracking-wider text-text-muted">
                ACTIVE TOOLS
              </span>

              {/* Tool Toggle: Web Search */}
              <button
                type="button"
                onClick={() => toggleTool('webSearch')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-text-body hover:text-text-primary rounded-[2px] transition-colors border-l-2 border-transparent hover:border-accent-primary cursor-pointer"
              >
                <span>Web search</span>
                {activeTools.webSearch && (
                  <span className="font-mono text-xs text-accent-primary font-bold">✓</span>
                )}
              </button>

              {/* Tool Toggle: Code Execution */}
              <button
                type="button"
                onClick={() => toggleTool('codeExecution')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-text-body hover:text-text-primary rounded-[2px] transition-colors border-l-2 border-transparent hover:border-accent-primary cursor-pointer"
              >
                <span>Code execution</span>
                {activeTools.codeExecution && (
                  <span className="font-mono text-xs text-accent-primary font-bold">✓</span>
                )}
              </button>

              {/* Tool Toggle: Deep Research */}
              <button
                type="button"
                onClick={() => toggleTool('deepResearch')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-text-body hover:text-text-primary rounded-[2px] transition-colors border-l-2 border-transparent hover:border-accent-primary cursor-pointer"
              >
                <span>Deep research</span>
                {activeTools.deepResearch && (
                  <span className="font-mono text-xs text-accent-primary font-bold">✓</span>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slash Command Dropdown */}
      <AnimatePresence>
        {isSlashMenuOpen && filteredSlashCommands.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute bottom-full left-6 mb-2 w-80 rounded-[4px] border border-border bg-surface-2 p-1.5 shadow-xl z-30 space-y-0.5"
          >
            <div className="flex items-center justify-between px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted border-b border-border/40">
              <span>COMMANDS</span>
              {slashQuery && (
                <span className="text-accent-primary">matching &ldquo;{slashQuery}&rdquo;</span>
              )}
            </div>
            {filteredSlashCommands.map((cmd, idx) => {
              const isSelected = idx === slashSelectedIndex
              return (
                <button
                  key={cmd.command}
                  type="button"
                  onClick={() => handleSelectSlash(cmd)}
                  onMouseEnter={() => setSlashSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-[2px] transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-l-2 border-accent-primary bg-surface-1 text-text-primary'
                      : 'border-l-2 border-transparent hover:bg-surface-1/50 text-text-body'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-xs font-semibold text-text-primary">
                      {cmd.command}
                    </span>
                    <span className="font-body text-[11px] text-text-muted">
                      {cmd.description}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-accent-primary">↵</span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* @ File Reference Dropdown */}
      <AnimatePresence>
        {isAtMenuOpen && availableAtFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute bottom-full left-6 mb-2 w-80 rounded-[4px] border border-border bg-surface-2 p-1.5 shadow-xl z-30 space-y-0.5"
          >
            <div className="flex items-center justify-between px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted border-b border-border/40">
              <span>ATTACH ARTIFACT REFERENCE</span>
              {atQuery && (
                <span className="text-accent-primary">matching &ldquo;{atQuery}&rdquo;</span>
              )}
            </div>
            {availableAtFiles.map((file) => (
              <button
                key={file}
                type="button"
                onClick={() => handleSelectAtFile(file)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-[2px] transition-colors cursor-pointer border-l-2 border-transparent hover:border-accent-primary hover:bg-surface-1 text-text-body"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-xs text-accent-primary font-bold">@</span>
                  <span className="font-mono text-xs text-text-primary truncate">{file}</span>
                </div>
                <span className="font-mono text-[10px] text-accent-primary shrink-0 font-semibold">Attach</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Elevation 2 Input Container with 1px offset shadow & Drag/Drop highlighting */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col rounded-[4px] border bg-surface-2 shadow-[0_4px_0_#110E0A] transition-all ${
          isDragOver
            ? 'border-accent-primary bg-accent-primary/5 ring-2 ring-accent-primary/50'
            : 'border-border'
        }`}
      >
        {/* Model Indicator Strip */}
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-primary" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-primary">
              PRO REASONING · HALIDE-V4
            </span>
          </div>
          <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
            {isStreaming ? 'Synthesizing…' : 'Ready'}
          </span>
        </div>

        {/* Speech Error Banner */}
        <AnimatePresence>
          {speechError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between bg-red-950/40 border-b border-red-500/30 px-3.5 py-1.5 text-xs text-red-300"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-400">⚠️</span>
                <span>{speechError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                className="text-red-400 hover:text-red-200 cursor-pointer font-mono text-[10px] ml-2"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Audio Listening & Waveform Banner */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center justify-between bg-accent-primary/10 border-b border-accent-primary/30 px-3.5 py-2 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-primary"></span>
                </span>
                <span className="font-mono text-[11px] font-semibold text-accent-primary uppercase tracking-wider">
                  Listening…
                </span>
                <span className="text-text-muted text-[11px] hidden sm:inline truncate">
                  Speak clearly into your microphone
                </span>

                {/* Real-time Dynamic Audio Equalizer Bars */}
                <div className="flex items-end gap-[3px] h-3.5 px-1.5 py-0.5 bg-surface-1/80 rounded-[3px] border border-accent-primary/20">
                  {[0.4, 0.9, 0.6, 1.0, 0.7, 0.3].map((multiplier, idx) => {
                    const barHeight = Math.max(3, Math.min(14, audioLevel * 18 * multiplier + (idx % 2 === 0 ? 3 : 2)))
                    return (
                      <motion.span
                        key={idx}
                        animate={{ height: barHeight }}
                        transition={{ duration: 0.08 }}
                        className="w-[2.5px] rounded-full bg-accent-primary"
                      />
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={stopVoiceInput}
                  className="rounded-[2px] bg-accent-primary px-2 py-0.5 font-mono text-[10px] font-semibold text-background hover:bg-accent-primary/90 transition-colors cursor-pointer"
                >
                  Done ✓
                </button>
              </div>
            </motion.div>
          )}

          {isTranscribing && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 bg-surface-2 border-b border-accent-primary/30 px-3.5 py-1.5 text-xs text-text-primary font-mono"
            >
              <svg className="animate-spin h-3.5 w-3.5 text-accent-primary shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-accent-primary text-[11px]">Transcribing audio with Whisper AI…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text Input Area */}
        <div className="px-4 py-3">
          <textarea
            id="workbench-chat-input"
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Dictating live audio... speak now' : placeholder}
            className="w-full resize-none bg-transparent font-display text-[15px] text-text-primary placeholder:italic placeholder:text-text-placeholder focus:outline-none leading-relaxed"
          />
        </div>

        {/* Bottom Tray: Actions & Send Button */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-text-muted">
            {/* Paperclip Button for Attachments */}
            <button
              type="button"
              onClick={() => setIsAttachmentOpen((p) => !p)}
              className={`flex h-7 w-7 items-center justify-center rounded-[2px] transition-colors cursor-pointer ${
                isAttachmentOpen
                  ? 'bg-surface-1 text-accent-primary border border-accent-primary/40'
                  : 'hover:bg-surface-1 hover:text-text-primary'
              }`}
              title="Tool & Attachment Menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            {/* Mic / Audio Input Icon */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`relative flex items-center justify-center rounded-[2px] transition-all cursor-pointer ${
                isListening
                  ? 'h-7 px-2 gap-1.5 bg-accent-primary/20 text-accent-primary border border-accent-primary shadow-xs font-semibold'
                  : 'h-7 w-7 hover:bg-surface-1 hover:text-text-primary'
              }`}
              title={isListening ? 'Stop Voice Recording (Dictating...)' : 'Voice Input (Dictate prompt)'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isListening ? 'text-accent-primary animate-pulse' : ''}
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
              {isListening && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-accent-primary">
                  REC
                </span>
              )}
            </button>
          </div>

          {/* Send / Queue / Stop Button */}
          {isStreaming && inputText.trim() ? (
            <motion.button
              type="button"
              onClick={() => handleSubmit()}
              animate={{
                scale: isSendFlashing ? 0.94 : 1,
                filter: isSendFlashing ? 'brightness(1.3)' : 'brightness(1)',
                backgroundColor: isSendFlashing ? '#F5A66B' : '#D97A3F',
              }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="relative flex h-8 px-2.5 items-center justify-center gap-1 rounded-[2px] bg-accent-primary text-background font-mono font-bold text-[11px] shadow-sm hover:brightness-110 transition-all cursor-pointer"
              title="Add to queue (Enter)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Queue</span>
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={() => handleSubmit()}
              animate={{
                scale: isSendFlashing ? 0.94 : 1,
                filter: isSendFlashing ? 'brightness(1.3)' : 'brightness(1)',
                backgroundColor: isSendFlashing ? '#F5A66B' : '#D97A3F',
              }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              disabled={!inputText.trim() && !isStreaming}
              className={`relative flex h-8 w-8 items-center justify-center rounded-[2px] bg-accent-primary text-background font-bold transition-opacity cursor-pointer ${
                !inputText.trim() && !isStreaming ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-110'
              }`}
              title={isStreaming ? 'Stop generation' : 'Send message (Enter)'}
            >
              <div className="relative flex items-center justify-center w-4 h-4">
                {/* Morphing Stem / Stop Square */}
                <motion.span
                  initial={false}
                  animate={
                    isStreaming
                      ? {
                          width: 10,
                          height: 10,
                          borderRadius: 1.5,
                          y: 0,
                        }
                      : {
                          width: 2.5,
                          height: 12,
                          borderRadius: 1,
                          y: 1,
                        }
                  }
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute bg-background pointer-events-none"
                />
                {/* Morphing Arrowhead / Chevron */}
                <motion.span
                  initial={false}
                  animate={
                    isStreaming
                      ? {
                          width: 0,
                          height: 0,
                          scale: 0,
                          opacity: 0,
                          y: 0,
                        }
                      : {
                          width: 7,
                          height: 7,
                          scale: 1,
                          opacity: 1,
                          y: -2.5,
                        }
                  }
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute border-t-[2.5px] border-l-[2.5px] border-background rotate-45 pointer-events-none"
                />
              </div>
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}

export default InputBar
