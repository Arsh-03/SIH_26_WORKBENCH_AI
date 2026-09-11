import type {
  NavItem,
  PinnedProject,
  PinnedChat,
  RecentChat,
  UserProfile,
  CommandPaletteItem,
  SuggestionCardData,
  ScopeFile,
  ArtifactData,
  ChatMessage,
  ChatSession,
  ProjectItem,
  LibraryItem,
} from './types'

export const mockNavItems: NavItem[] = [
  { id: 'chats', label: 'Chats', to: '/chats', count: '24' },
  { id: 'projects', label: 'Projects', to: '/projects', count: '05' },
  { id: 'library', label: 'Library', to: '/library', count: '18' },
]

export const mockPinnedProjects: PinnedProject[] = [
  { id: 'proj-01', code: '01', title: 'Dashboard Redesign', path: '/projects' },
  { id: 'proj-02', code: '02', title: 'API Migration', path: '/projects' },
  { id: 'proj-03', code: '03', title: 'Auth Refactor', path: '/projects' },
  { id: 'proj-04', code: '04', title: 'Data Pipeline Cleanup', path: '/projects' },
  { id: 'proj-05', code: '05', title: 'Mobile Sync Service', path: '/projects' },
]

export const mockPinnedChats: PinnedChat[] = [
  {
    id: 'auth-middleware',
    title: 'User Auth Middleware',
    path: '/chat/auth-middleware',
    timestamp: '14:20',
    isPinned: true,
  },
  {
    id: 'graphql-schema',
    title: 'GraphQL Schema Migration',
    path: '/chat/graphql-schema',
    timestamp: 'Yesterday',
    isPinned: true,
  },
]

export const mockRecentChats: RecentChat[] = [
  { id: 'realtime-events', title: 'Real-time Event Stream', path: '/chat/realtime-events' },
  { id: 'postgres-index', title: 'Postgres Index Optimization', path: '/chat/postgres-index' },
  { id: 'docker-tuning', title: 'Docker Container Tuning', path: '/chat/docker-tuning' },
  { id: 'rate-limiter', title: 'API Rate Limiter', path: '/chat/rate-limiter' },
]

export const mockUserProfile: UserProfile = {
  name: 'Maaz',
  role: 'LEAD AI ARCHITECT',
  avatarLetter: 'M',
}

export const mockCommandPaletteItems: CommandPaletteItem[] = [
  // CHATS
  {
    id: 'cmd-chat-1',
    title: 'User Auth Middleware & Session Validation',
    category: 'CHATS',
    subtitle: 'Active · 14:20',
    active: true,
    path: '/chat/auth-middleware',
  },
  {
    id: 'cmd-chat-2',
    title: 'GraphQL Schema Migration & Resolver Generator',
    category: 'CHATS',
    subtitle: 'Yesterday',
    path: '/chat/graphql-schema',
  },
  {
    id: 'cmd-chat-3',
    title: 'Debug Failing Auth Middleware & CSRF Cookie Leak',
    category: 'CHATS',
    badge: 'Pinned',
    path: '/chat/csrf-debug',
  },
  // PROJECTS
  {
    id: 'cmd-proj-1',
    title: 'Dashboard Redesign',
    category: 'PROJECTS',
    subtitle: 'TOC 01',
    path: '/projects',
  },
  {
    id: 'cmd-proj-2',
    title: 'API Migration',
    category: 'PROJECTS',
    subtitle: 'TOC 02',
    path: '/projects',
  },
  {
    id: 'cmd-proj-3',
    title: 'Auth Refactor',
    category: 'PROJECTS',
    subtitle: 'TOC 03',
    path: '/projects',
  },
  // COMMANDS
  {
    id: 'cmd-act-new',
    title: 'New Chat Session',
    category: 'COMMANDS',
    shortcut: '⌘N',
  },
  {
    id: 'cmd-act-1',
    title: 'Export Schema Definitions (.ts)',
    category: 'COMMANDS',
    shortcut: '⇧⌘E',
  },
  {
    id: 'cmd-act-2',
    title: 'Toggle Split Workspace & Artifact Panel',
    category: 'COMMANDS',
    shortcut: '⌘\\',
  },
  {
    id: 'cmd-act-3',
    title: 'Generate Database Migration',
    category: 'COMMANDS',
    shortcut: '⌘M',
  },
  {
    id: 'cmd-act-settings',
    title: 'Open Preferences & Settings',
    category: 'COMMANDS',
    shortcut: '⌘,',
  },
]

export const mockSuggestionCards: SuggestionCardData[] = [
  {
    id: 'card-1',
    categoryCode: '01 / DASHBOARD',
    title: 'Build Analytics Dashboard',
    description: 'Interactive React component with real-time chart telemetry and filter controls.',
    prompt: 'Build an interactive React analytics dashboard with real-time chart telemetry, virtualized data tables, and CSV export in EnhancedDashboard.tsx.',
    actionLabel: 'VIEW TEMPLATE →',
  },
  {
    id: 'card-2',
    categoryCode: '02 / BACKEND',
    title: 'API Rate Limiter Service',
    description: 'Implement sliding window counter using Redis and Fastify middleware.',
    prompt: 'Implement a sliding window counter rate limiter in TypeScript using Redis pipelines and Fastify middleware hooks.',
    actionLabel: 'SYSTEM SPEC →',
  },
  {
    id: 'card-3',
    categoryCode: '03 / DATABASE',
    title: 'Postgres BRIN Indexing',
    description: 'Optimize high-volume append-only event tables with targeted index strategies.',
    prompt: 'Generate a Postgres migration script adding BRIN indexing on block range pages for high-throughput time-series event tables.',
    actionLabel: 'MIGRATION SCRIPT →',
  },
  {
    id: 'card-4',
    categoryCode: '04 / REFACTOR',
    title: 'Refactor Auth Middleware',
    description: 'Refactor JWT session validation to support rolling refresh tokens.',
    prompt: 'Refactor user authentication middleware to support rolling refresh token rotation and secure CSRF cookie validation.',
    actionLabel: 'SECURITY AUDIT →',
  },
]

export const mockScopeFiles: ScopeFile[] = [
  { id: 'f-1', name: 'EnhancedDashboard.tsx' },
  { id: 'f-2', name: 'useMetrics.ts' },
  { id: 'f-3', name: 'types.ts' },
]

export const mockArtifactData: ArtifactData = {
  id: 'artifact-enhanced-dashboard',
  title: 'EnhancedDashboard.tsx',
  badge: 'REACT',
  activeFile: 'EnhancedDashboard.tsx',
  files: [
    {
      name: 'EnhancedDashboard.tsx',
      language: 'tsx',
      content: `import React, { useState, useMemo } from 'react'
import { useMetrics } from './useMetrics'
import type { TelemetryRecord } from './types'

export const EnhancedDashboard: React.FC = () => {
  const { records, summary, isLoading } = useMetrics()
  const [filterQuery, setFilterQuery] = useState('')
  const [activeRange, setActiveRange] = useState<'1h' | '24h' | '7d'>('24h')

  const filteredRecords = useMemo(() => {
    if (!filterQuery) return records
    return records.filter(r => 
      r.endpoint.toLowerCase().includes(filterQuery.toLowerCase())
    )
  }, [records, filterQuery])

  return (
    <div className="p-6 space-y-6 bg-[#211B15] text-[#D8CDBC] rounded-[4px] border border-[#3D3226]">
      <div className="flex items-center justify-between border-b border-[#3D3226] pb-4">
        <div>
          <h2 className="font-display text-xl text-[#F5EFE6] font-semibold">
            Telemetry Performance Grid
          </h2>
          <p className="font-mono text-xs text-[#9C8E78]">
            Window: {activeRange} · Live Pipeline Latency
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['1h', '24h', '7d'] as const).map(range => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={\`px-2.5 py-1 text-xs font-mono rounded-[2px] transition-colors \${
                activeRange === range 
                  ? 'bg-[#D97A3F] text-[#181410] font-bold' 
                  : 'bg-[#2A2219] text-[#D8CDBC] hover:text-[#F5EFE6]'
              }\`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-[4px] bg-[#2A2219] border border-[#3D3226]">
          <span className="font-mono text-[10px] uppercase text-[#9C8E78]">P99 Latency</span>
          <div className="font-mono text-2xl font-semibold text-[#F5EFE6] mt-1">{summary.p99}ms</div>
          <span className="font-mono text-[10px] text-[#D97A3F]">-14.2% vs prev window</span>
        </div>
        <div className="p-4 rounded-[4px] bg-[#2A2219] border border-[#3D3226]">
          <span className="font-mono text-[10px] uppercase text-[#9C8E78]">Throughput</span>
          <div className="font-mono text-2xl font-semibold text-[#F5EFE6] mt-1">{summary.rps} req/s</div>
          <span className="font-mono text-[10px] text-[#9C8E78]">Optimal headroom</span>
        </div>
        <div className="p-4 rounded-[4px] bg-[#2A2219] border border-[#3D3226]">
          <span className="font-mono text-[10px] uppercase text-[#9C8E78]">Error Rate</span>
          <div className="font-mono text-2xl font-semibold text-[#F5EFE6] mt-1">{summary.errorRate}%</div>
          <span className="font-mono text-[10px] text-[#D97A3F]">Under 0.05% SLA threshold</span>
        </div>
      </div>
    </div>
  )
}`,
    },
    {
      name: 'useMetrics.ts',
      language: 'typescript',
      content: `import { useState, useEffect } from 'react'
import type { TelemetryRecord, MetricsSummary } from './types'

export function useMetrics() {
  const [records, setRecords] = useState<TelemetryRecord[]>([])
  const [summary, setSummary] = useState<MetricsSummary>({
    p99: 14.8,
    rps: '12,480',
    errorRate: '0.012',
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setSummary(prev => ({
        ...prev,
        p99: +(14 + Math.random() * 2).toFixed(1),
      }))
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  return { records, summary, isLoading }
}`,
    },
    {
      name: 'types.ts',
      language: 'typescript',
      content: `export interface TelemetryRecord {
  id: string
  timestamp: string
  endpoint: string
  status: number
  durationMs: number
}

export interface MetricsSummary {
  p99: number
  rps: string
  errorRate: string
}`,
    },
  ],
  diffPreview: [
    {
      type: 'context',
      content: '  const { records, summary, isLoading } = useMetrics()',
      lineNumber: 5,
    },
    {
      type: 'deletion',
      content: '- const filteredRecords = records.filter(r => r.endpoint.includes(query)) // Blocking synchronous iteration',
      lineNumber: 6,
    },
    {
      type: 'addition',
      content: '+ const filteredRecords = useMemo(() => workerFilter(records, query), [records, query]) // Decoupled WebWorker pass',
      lineNumber: 7,
    },
    {
      type: 'addition',
      content: '+ const [activeRange, setActiveRange] = useState<Range>("24h") // Granular telemetry windowing',
      lineNumber: 8,
    },
    {
      type: 'context',
      content: '  return (',
      lineNumber: 9,
    },
  ],
  terminalOutput: `$ vite build && tsc --noEmit
✓ Compiled EnhancedDashboard.tsx in 142ms
✓ Worker bundle workerFilter.js emitted (12.4 kB)
✓ Virtualized row benchmarks: 60.0 FPS sustained at 100,000 rows
Tests: 8 passed, 0 failed, 8 total
Snapshots: 2 matched
Time: 1.182s
STATUS: Ready for deployment.`,
  versions: [
    {
      version: 'V.1',
      label: 'Initial implementation',
      timestamp: '14:02',
      diffSummary: 'Synchronous filter loop with direct DOM render',
      files: [],
    },
    {
      version: 'V.2',
      label: 'Worker thread offload',
      timestamp: '14:14',
      diffSummary: 'Offloaded filter computation to WebWorker',
      files: [],
    },
    {
      version: 'V.3',
      label: 'Current (Virtualized grid + SLA monitors)',
      timestamp: '14:22',
      diffSummary: 'Added telemetry KPI summary and virtualized scrolling',
      files: [],
    },
  ],
}

export const mockInitialMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'user',
    timestamp: '14:20',
    text: 'Refactor the analytics grid inside EnhancedDashboard.tsx to decouple the data fetching loop from client-side filtering. Heavy filter passes should remain jank-free even under high-volume telemetry records, and add export handling.',
  },
  {
    id: 'msg-2',
    sender: 'model',
    timestamp: '14:21',
    thinkingDuration: 'Thought for 6 seconds',
    thinkingSteps: [
      'Inspected render bottleneck in EnhancedDashboard.tsx: synchronous Array.prototype.filter blocking the main thread on 100k records.',
      'Decoupled useMetrics hook from synchronous window scroll event listener and introduced memoized windowing.',
      'Constructed WebWorker pipeline for parallel text filtering and CSV streaming.',
      'Verified zero layout shifts, 60 FPS scroll performance, and styled telemetry metric cards.',
    ],
    text: 'I have refactored the analytics grid inside EnhancedDashboard.tsx to decouple the data fetching loop from client-side filtering. Heavy filter passes now execute in a dedicated worker thread, keeping the main 60 FPS thread jank-free even under 100,000 active telemetry records.\n\nThe artifact below includes the virtualized table, real-time KPI metrics, and inline export handling.',
    artifact: mockArtifactData,
  },
]

export const mockChatSessions: ChatSession[] = [
  {
    id: 'auth-middleware',
    title: 'User Auth Middleware & Session Validation',
    preview: 'I have refactored the analytics grid inside EnhancedDashboard.tsx to decouple the data fetching loop from client-side filtering…',
    timestamp: '14:20 Today',
    isPinned: true,
    messageCount: 2,
    model: 'Halide-V4',
    messages: mockInitialMessages,
  },
  {
    id: 'graphql-schema',
    title: 'GraphQL Schema Migration & Resolver Generator',
    preview: 'Generated typed schema AST and batch DataLoader resolvers for multi-tenant accounts…',
    timestamp: 'Yesterday',
    isPinned: true,
    messageCount: 4,
    model: 'Halide-V4',
    messages: [
      {
        id: 'g-1',
        sender: 'user',
        timestamp: 'Yesterday',
        text: 'Generate DataLoader batch resolvers for the GraphQL accounts schema to eliminate N+1 queries.',
      },
      {
        id: 'g-2',
        sender: 'model',
        timestamp: 'Yesterday',
        text: 'I have implemented batch DataLoader caches with memoized request keys, dropping DB round-trips by 88%.',
      },
    ],
  },
  {
    id: 'realtime-events',
    title: 'Real-time Event Stream & SSE Telemetry',
    preview: 'Implemented backpressure buffer with ring buffer allocation to handle sudden telemetry spikes…',
    timestamp: 'Sep 4',
    messageCount: 3,
    model: 'Halide-V4',
    messages: [
      {
        id: 'r-1',
        sender: 'user',
        timestamp: 'Sep 4',
        text: 'How do we handle client reconnection drops during high-frequency SSE message streams?',
      },
      {
        id: 'r-2',
        sender: 'model',
        timestamp: 'Sep 4',
        text: 'Use Last-Event-ID HTTP headers paired with an ephemeral Redis stream cursor to replay missed events seamlessly.',
      },
    ],
  },
  {
    id: 'postgres-index',
    title: 'Postgres Index Optimization & BRIN Tables',
    preview: 'Replaced standard B-tree indices on time-partitioned logs with BRIN indexing, reducing disk usage by 72%…',
    timestamp: 'Sep 3',
    messageCount: 5,
    model: 'Halide-V4',
    messages: [
      {
        id: 'p-1',
        sender: 'user',
        timestamp: 'Sep 3',
        text: 'Our audit log table is 400 GB and indexes take 120 GB. How to reduce index overhead?',
      },
      {
        id: 'p-2',
        sender: 'model',
        timestamp: 'Sep 3',
        text: 'For append-only ordered logs, BRIN indexes summarize data across disk pages, dropping index footprint to under 4 GB.',
      },
    ],
  },
  {
    id: 'docker-tuning',
    title: 'Docker Container Tuning & Memory Limits',
    preview: 'Configured cgroup v2 memory swap controls and node flags --max-old-space-size for production pods…',
    timestamp: 'Sep 1',
    messageCount: 2,
    model: 'Halide-V4',
    messages: [
      {
        id: 'd-1',
        sender: 'user',
        timestamp: 'Sep 1',
        text: 'Node containers are being OOMKilled despite staying under 70% average memory usage.',
      },
      {
        id: 'd-2',
        sender: 'model',
        timestamp: 'Sep 1',
        text: 'V8 heap memory spikes during garbage collection cycles. Set --max-old-space-size to 75% of the container hard limit.',
      },
    ],
  },
  {
    id: 'rate-limiter',
    title: 'API Rate Limiter Service',
    preview: 'Implemented sliding window counter algorithm using Redis multi-exec transactions and Fastify preHandler…',
    timestamp: 'Aug 30',
    messageCount: 3,
    model: 'Halide-V4',
    messages: [
      {
        id: 'rl-1',
        sender: 'user',
        timestamp: 'Aug 30',
        text: 'Implement a sliding window rate limiter in Redis for authenticated API keys.',
      },
      {
        id: 'rl-2',
        sender: 'model',
        timestamp: 'Aug 30',
        text: 'Here is the sliding window counter using Redis sorted sets (ZADD, ZREMRANGEBYSCORE) with atomic TTL expiry.',
      },
    ],
  },
]

export const mockDetailedProjects: ProjectItem[] = [
  {
    id: 'proj-01',
    code: '01',
    title: 'Dashboard Redesign',
    description: 'High-performance telemetry console, decoupled client-side filtering, 60 FPS virtualization, and darkroom styling.',
    filesCount: 14,
    artifactsCount: 3,
    lastActive: '10m ago',
    tags: ['React', 'Telemetry', 'Virtualization'],
  },
  {
    id: 'proj-02',
    code: '02',
    title: 'API Migration',
    description: 'Fastify gateway rewrite, GraphQL schema stitcher, DataLoader batch caching, and OpenAPI contract validation.',
    filesCount: 28,
    artifactsCount: 6,
    lastActive: '2h ago',
    tags: ['Node.js', 'Fastify', 'GraphQL'],
  },
  {
    id: 'proj-03',
    code: '03',
    title: 'Auth Refactor',
    description: 'JWT rolling refresh token rotation, Redis session revocation lists, secure HTTP-only cookies, and CSRF token binding.',
    filesCount: 9,
    artifactsCount: 2,
    lastActive: 'Yesterday',
    tags: ['Security', 'Redis', 'JWT'],
  },
  {
    id: 'proj-04',
    code: '04',
    title: 'Data Pipeline Cleanup',
    description: 'ClickHouse ingestion sink optimization, Kafka consumer lag alerts, and backpressure ring buffer tuning.',
    filesCount: 18,
    artifactsCount: 4,
    lastActive: '3d ago',
    tags: ['Data', 'Kafka', 'Pipelines'],
  },
  {
    id: 'proj-05',
    code: '05',
    title: 'Mobile Sync Service',
    description: 'Delta synchronization protocol over persistent WebSockets with conflict resolution and offline-first storage.',
    filesCount: 12,
    artifactsCount: 2,
    lastActive: '5d ago',
    tags: ['WebSockets', 'Sync', 'Mobile'],
  },
]

export const mockLibraryItems: LibraryItem[] = [
  {
    id: 'lib-1',
    title: 'EnhancedDashboard.tsx',
    badge: 'REACT',
    category: 'Components',
    language: 'tsx',
    description: 'Decoupled real-time telemetry performance grid with virtualized rows and worker thread filtering.',
    filesCount: 3,
    updatedAt: '14:22 Today',
    artifact: mockArtifactData,
  },
  {
    id: 'lib-2',
    title: 'RateLimiter.ts',
    badge: 'SERVICE',
    category: 'APIs',
    language: 'ts',
    description: 'Sliding window counter rate limiter algorithm using Redis sorted sets and pipeline execution.',
    filesCount: 2,
    updatedAt: 'Yesterday',
    artifact: {
      ...mockArtifactData,
      id: 'lib-art-rate-limiter',
      title: 'RateLimiter.ts',
      badge: 'SERVICE',
      activeFile: 'RateLimiter.ts',
    },
  },
  {
    id: 'lib-3',
    title: '001_brin_migration.sql',
    badge: 'SQL',
    category: 'Migrations',
    language: 'sql',
    description: 'Postgres BRIN block range index strategy reducing index disk overhead by 72% on append-only events.',
    filesCount: 1,
    updatedAt: 'Sep 3',
    artifact: {
      ...mockArtifactData,
      id: 'lib-art-brin',
      title: '001_brin_migration.sql',
      badge: 'SQL',
      activeFile: '001_brin_migration.sql',
    },
  },
  {
    id: 'lib-4',
    title: 'authMiddleware.ts',
    badge: 'SECURITY',
    category: 'APIs',
    language: 'ts',
    description: 'JWT session validation with rolling refresh tokens, CSRF protection, and Redis token revocation.',
    filesCount: 2,
    updatedAt: 'Sep 1',
    artifact: {
      ...mockArtifactData,
      id: 'lib-art-auth',
      title: 'authMiddleware.ts',
      badge: 'SECURITY',
      activeFile: 'authMiddleware.ts',
    },
  },
  {
    id: 'lib-5',
    title: 'metricsSchema.prisma',
    badge: 'SCHEMA',
    category: 'Schemas',
    language: 'prisma',
    description: 'Prisma data model definitions for multi-tenant telemetry and latency benchmarks.',
    filesCount: 1,
    updatedAt: 'Aug 28',
    artifact: {
      ...mockArtifactData,
      id: 'lib-art-schema',
      title: 'metricsSchema.prisma',
      badge: 'SCHEMA',
      activeFile: 'metricsSchema.prisma',
    },
  },
  {
    id: 'lib-6',
    title: 'useSSEStream.ts',
    badge: 'HOOK',
    category: 'Components',
    language: 'ts',
    description: 'React hook for fault-tolerant SSE streaming with exponential backoff and cursor synchronization.',
    filesCount: 1,
    updatedAt: 'Aug 24',
    artifact: {
      ...mockArtifactData,
      id: 'lib-art-sse',
      title: 'useSSEStream.ts',
      badge: 'HOOK',
      activeFile: 'useSSEStream.ts',
    },
  },
]
