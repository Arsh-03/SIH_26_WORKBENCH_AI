import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  Lock,
  User,
  Mail,
  ArrowRight,
  Sparkles,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Cpu,
  Terminal,
  Zap,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'
import type { DemoUser } from '../lib/api'
import { FilmGrain } from '../components/layout/FilmGrain'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register, loginWithDemo, isAuthenticated } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('AI Researcher')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([])

  const fromPath = (location.state as any)?.from?.pathname || '/chat'

  useEffect(() => {
    if (isAuthenticated) {
      navigate(fromPath, { replace: true })
    }
  }, [isAuthenticated, navigate, fromPath])

  useEffect(() => {
    const fetchDemos = async () => {
      try {
        const demos = await api.getDemoUsers()
        if (demos && demos.length > 0) {
          setDemoUsers(demos)
        } else {
          setDemoUsers([
            {
              username: 'admin',
              password: 'Sovereign@2026',
              full_name: 'Lead AI Architect',
              role: 'Lead AI Architect',
              avatar_letter: 'A',
              badge: 'Enclave Admin',
            },
            {
              username: 'researcher',
              password: 'Sovereign@2026',
              full_name: 'Elena Rostova',
              role: 'Senior ML Researcher',
              avatar_letter: 'E',
              badge: 'Air-Gap Analyst',
            },
          ])
        }
      } catch {
        // Fallback demo users
        setDemoUsers([
          {
            username: 'admin',
            password: 'Sovereign@2026',
            full_name: 'Lead AI Architect',
            role: 'Lead AI Architect',
            avatar_letter: 'A',
            badge: 'Enclave Admin',
          },
          {
            username: 'researcher',
            password: 'Sovereign@2026',
            full_name: 'Elena Rostova',
            role: 'Senior ML Researcher',
            avatar_letter: 'E',
            badge: 'Air-Gap Analyst',
          },
        ])
      }
    }
    fetchDemos()
  }, [])

  const passwordChecks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }

  const isPasswordValid =
    passwordChecks.minLength &&
    passwordChecks.hasUpper &&
    passwordChecks.hasLower &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSpecial

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsLoading(true)

    try {
      if (mode === 'login') {
        if (!username || !password) {
          throw new Error('Please enter both username and password.')
        }
        await login(username, password)
      } else {
        if (!username || !email || !password || !fullName) {
          throw new Error('Please fill in all registration fields.')
        }
        if (!isPasswordValid) {
          throw new Error('Password must meet all security enclave requirements (min 8 chars, uppercase, lowercase, digit & special character).')
        }
        await register({
          username,
          email,
          password,
          full_name: fullName,
          role,
        })
      }
      navigate(fromPath, { replace: true })
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoClick = async (demo: DemoUser) => {
    setErrorMsg(null)
    setIsLoading(true)
    try {
      await loginWithDemo(demo)
      navigate(fromPath, { replace: true })
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo authentication failed.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background text-text-primary px-4 py-12 overflow-hidden selection:bg-accent-primary/20 selection:text-text-primary">
      <FilmGrain />

      {/* Ambient background glow effects */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-accent-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent-secondary/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Side: Sovereign Branding & Air-Gap Enclave Telemetry */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="lg:col-span-5 flex flex-col justify-between p-8 rounded-lg border border-border/80 bg-surface-1/90 backdrop-blur-md shadow-2xl relative overflow-hidden"
        >
          {/* Subtle grid watermark */}
          <div className="absolute inset-0 bg-[radial-gradient(#3D3226_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />

          <div>
            {/* Sovereign Badge */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] border border-emerald-500/30 bg-emerald-950/30 text-emerald-400 text-xs font-mono mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>ZERO-EGRESS AIR-GAP ACTIVE</span>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-accent-primary text-background font-display font-bold text-lg shadow-md">
                SW
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
                  Sovereign AI
                </h1>
                <p className="font-mono text-[10px] uppercase tracking-widest text-accent-primary font-semibold">
                  WORKBENCH ENCLAVE 2026
                </p>
              </div>
            </div>

            <p className="text-sm text-text-muted mt-4 leading-relaxed font-body">
              Isolated on-premise generative intelligence platform. Bilateral reasoning graphs, persistent SQLite audit trails, and zero external data egress.
            </p>

            {/* Enclave Capabilities List */}
            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-3 p-2.5 rounded border border-border/60 bg-surface-2/60">
                <ShieldCheck className="h-4 w-4 text-accent-primary mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-text-primary block">Hardware-Enforced Air Gap</span>
                  <span className="text-text-muted">Local inference only (Ollama / VLM / Nomic Embeddings)</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded border border-border/60 bg-surface-2/60">
                <Terminal className="h-4 w-4 text-accent-primary mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-text-primary block">SQLite Chat & Audit Persistence</span>
                  <span className="text-text-muted">Full session history, tool logs & multi-version artifacts</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded border border-border/60 bg-surface-2/60">
                <Cpu className="h-4 w-4 text-accent-primary mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-text-primary block">Sandboxed Code Execution</span>
                  <span className="text-text-muted">Isolated containerized execution runtime</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Security Footer */}
          <div className="pt-8 border-t border-border/60 mt-8 flex items-center justify-between text-[11px] font-mono text-text-muted">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-accent-primary" />
              AES-256 / SHA-256 JWT
            </span>
            <span>v1.0.0-SEC</span>
          </div>
        </motion.div>

        {/* Right Side: Interactive Login / Register Form & Demo Users */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
          className="lg:col-span-7 flex flex-col justify-between p-8 rounded-lg border border-border/80 bg-surface-1/90 backdrop-blur-md shadow-2xl"
        >
          <div>
            {/* Tab Switcher */}
            <div className="flex items-center border-b border-border/80 pb-4 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setErrorMsg(null)
                }}
                className={`relative pb-2 font-display text-base font-semibold transition-colors mr-6 ${
                  mode === 'login' ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Sign In
                {mode === 'login' && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-primary shadow-[0_0_8px_rgba(217,122,63,0.6)]"
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('register')
                  setErrorMsg(null)
                }}
                className={`relative pb-2 font-display text-base font-semibold transition-colors ${
                  mode === 'register' ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Create Account
                {mode === 'register' && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-primary shadow-[0_0_8px_rgba(217,122,63,0.6)]"
                  />
                )}
              </button>
            </div>

            {/* Error Message Box */}
            <AnimatePresence mode="wait">
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-4 flex items-center gap-2.5 p-3 rounded border border-red-500/40 bg-red-950/30 text-red-300 text-xs font-mono"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span className="flex-1">{errorMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-text-muted mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Dr. Alexander Vance"
                        className="w-full rounded-[4px] border border-border bg-surface-2 py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary transition-all font-body"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-text-muted mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alexander@sovereign.local"
                        className="w-full rounded-[4px] border border-border bg-surface-2 py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary transition-all font-body"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-text-muted mb-1.5">
                      Role / Clearance Level
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full rounded-[4px] border border-border bg-surface-2 py-2.5 px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary transition-all font-body"
                    >
                      <option value="Lead AI Architect">Lead AI Architect</option>
                      <option value="Senior ML Researcher">Senior ML Researcher</option>
                      <option value="Security & Compliance Auditor">Security & Compliance Auditor</option>
                      <option value="Data Enclave Operator">Data Enclave Operator</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-text-muted mb-1.5">
                  {mode === 'login' ? 'Username or Email' : 'Username'}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={mode === 'login' ? 'admin or admin@sovereign.local' : 'alexander_v'}
                    className="w-full rounded-[4px] border border-border bg-surface-2 py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary transition-all font-body"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-text-muted mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-[4px] border border-border bg-surface-2 py-2.5 pl-9 pr-10 text-sm text-text-primary placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Live Password Enclave Requirements (Registration Mode) */}
                {mode === 'register' && (
                  <div className="mt-2.5 p-3 rounded-[4px] border border-border/80 bg-surface-2/70 space-y-1.5 font-mono text-[11px]">
                    <span className="block text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">
                      ENCLAVE PASSWORD CRITERIA:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <span
                        className={`flex items-center gap-1.5 transition-colors ${
                          passwordChecks.minLength ? 'text-emerald-400 font-medium' : 'text-text-muted'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${passwordChecks.minLength ? 'bg-emerald-400' : 'bg-text-placeholder'}`} />
                        8+ Characters
                      </span>
                      <span
                        className={`flex items-center gap-1.5 transition-colors ${
                          passwordChecks.hasUpper ? 'text-emerald-400 font-medium' : 'text-text-muted'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${passwordChecks.hasUpper ? 'bg-emerald-400' : 'bg-text-placeholder'}`} />
                        1 Uppercase (A-Z)
                      </span>
                      <span
                        className={`flex items-center gap-1.5 transition-colors ${
                          passwordChecks.hasLower ? 'text-emerald-400 font-medium' : 'text-text-muted'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${passwordChecks.hasLower ? 'bg-emerald-400' : 'bg-text-placeholder'}`} />
                        1 Lowercase (a-z)
                      </span>
                      <span
                        className={`flex items-center gap-1.5 transition-colors ${
                          passwordChecks.hasNumber ? 'text-emerald-400 font-medium' : 'text-text-muted'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${passwordChecks.hasNumber ? 'bg-emerald-400' : 'bg-text-placeholder'}`} />
                        1 Number (0-9)
                      </span>
                      <span
                        className={`col-span-2 flex items-center gap-1.5 transition-colors ${
                          passwordChecks.hasSpecial ? 'text-emerald-400 font-medium' : 'text-text-muted'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${passwordChecks.hasSpecial ? 'bg-emerald-400' : 'bg-text-placeholder'}`} />
                        1 Special Char (!@#$%^&*)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-[4px] bg-accent-primary px-4 py-2.5 font-display text-sm font-semibold text-background shadow-md transition-all hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 disabled:opacity-50 mt-2 cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 font-mono text-xs">
                    <Zap className="h-4 w-4 animate-spin text-background" />
                    AUTHENTICATING ENCLAVE SESSION...
                  </span>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Access Sovereign Workbench' : 'Create Enclave Account'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Demo Login Cards Section */}
          <div className="mt-8 pt-6 border-t border-border/80">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent-primary" />
                ONE-CLICK DEMO OPERATOR ACCESS
              </span>
              <span className="text-[10px] font-mono text-emerald-400/90">Zero Setup Required</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {demoUsers.map((demo) => (
                <button
                  key={demo.username}
                  type="button"
                  onClick={() => handleDemoClick(demo)}
                  disabled={isLoading}
                  className="group flex items-center gap-3 p-3 rounded-[4px] border border-border/90 bg-surface-2/60 hover:bg-surface-2 hover:border-accent-primary/60 transition-all text-left cursor-pointer"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-accent-primary/20 text-accent-primary font-display font-bold text-xs group-hover:bg-accent-primary group-hover:text-background transition-colors">
                    {demo.avatar_letter || demo.username[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-body text-xs font-semibold text-text-primary truncate">
                        {demo.full_name}
                      </span>
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-1 border border-border text-accent-primary">
                        {demo.username}
                      </span>
                    </div>
                    <span className="block font-mono text-[10px] text-text-muted truncate mt-0.5">
                      {demo.role}
                    </span>
                  </div>
                  <CheckCircle2 className="h-3.5 w-3.5 text-text-muted group-hover:text-accent-primary shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default LoginPage
