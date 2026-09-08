import type { ArtifactData } from './types'
import { mockArtifactData } from './mockData'

export interface SimulatedAiResponse {
  text: string
  thinkingDuration: string
  thinkingSteps: string[]
  artifact?: ArtifactData
}

export interface ModelContext {
  activeTools?: {
    webSearch: boolean
    codeExecution: boolean
    deepResearch: boolean
  }
  scopeFiles?: string[]
}

/**
 * simulateModelResponse
 * Stand-in for real backend / streaming API call when socket is offline or in simulation mode.
 */
export async function simulateModelResponse(
  userPrompt: string,
  context: ModelContext = {}
): Promise<SimulatedAiResponse> {
  const promptLower = userPrompt.trim().toLowerCase()

  // Scenario 0: Conversational Greetings (hey, hi, hello)
  const isGreeting = /^(hey|hi|hello|greetings|good morning|good afternoon|good evening|sup|yo)\b/i.test(promptLower)
  if (isGreeting || promptLower.length <= 4) {
    return {
      thinkingDuration: `Thought for 0.3 seconds`,
      thinkingSteps: [
        'Recognized conversational input intent',
        'Initialized sovereign assistant persona',
      ],
      text: `Hello! I am your Sovereign AI Engineering Workbench Assistant. How can I help you today with your code, industrial SOP documents, or system architecture?`,
    }
  }

  // Simulated latency for complex engineering queries
  const delay = Math.floor(Math.random() * 400) + 1000
  await new Promise((resolve) => setTimeout(resolve, delay))
  const durationSeconds = (delay / 1000).toFixed(1)

  // Context-aware tool notes
  const toolNotes: string[] = []
  if (context.activeTools?.webSearch) toolNotes.push('Indexed current technical landscape via Web Search')
  if (context.activeTools?.codeExecution) toolNotes.push('Executed TypeScript AST validation sandbox')
  if (context.activeTools?.deepResearch) toolNotes.push('Evaluated benchmark comparisons from memory cache')

  // Scenario 1: Rate Limiter Service
  if (promptLower.includes('rate limiter') || promptLower.includes('redis') || promptLower.includes('fastify')) {
    return {
      thinkingDuration: `Thought for ${durationSeconds} seconds`,
      thinkingSteps: [
        'Analyzing sliding window log vs sliding window counter trade-offs...',
        'Designing Redis multi/exec atomic pipeline to prevent race conditions under high concurrency...',
        'Constructing Fastify preHandler hook with standard RateLimit headers...',
        ...toolNotes,
      ],
      text: `I've implemented a sliding window counter rate limiter designed for high-concurrency microservices. It leverages Redis transactions to guarantee atomic counter increments with sub-millisecond overhead.`,
      artifact: {
        ...mockArtifactData,
        id: `artifact-rate-limiter-${Date.now()}`,
        title: 'RateLimiter.ts',
        badge: 'TypeScript · Fastify',
        activeFile: 'RateLimiter.ts',
        files: [
          {
            name: 'RateLimiter.ts',
            language: 'typescript',
            content: `import { FastifyRequest, FastifyReply } from 'fastify'
import Redis from 'ioredis'

export interface RateLimitOptions {
  windowMs: number
  maxRequests: number
  keyPrefix?: string
}

export class SlidingWindowLimiter {
  private redis: Redis
  private windowMs: number
  private maxRequests: number
  private prefix: string

  constructor(redis: Redis, options: RateLimitOptions) {
    this.redis = redis
    this.windowMs = options.windowMs
    this.maxRequests = options.maxRequests
    this.prefix = options.keyPrefix || 'rl:'
  }

  async checkLimit(key: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const clearBefore = now - this.windowMs
    const redisKey = \`\${this.prefix}\${key}\`

    const pipeline = this.redis.pipeline()
    pipeline.zremrangebyscore(redisKey, 0, clearBefore)
    pipeline.zadd(redisKey, now, \`\${now}:\${Math.random()}\`)
    pipeline.zcard(redisKey)
    pipeline.pexpire(redisKey, this.windowMs)

    const results = await pipeline.exec()
    const currentCount = (results?.[2]?.[1] as number) || 0

    const allowed = currentCount <= this.maxRequests
    const remaining = Math.max(0, this.maxRequests - currentCount)
    const resetTime = now + this.windowMs

    return { allowed, remaining, resetTime }
  }
}`,
          },
        ],
        diffPreview: [
          { type: 'deletion', content: '- const count = await redis.get(key) // Race condition prone' },
          { type: 'addition', content: '+ const pipeline = this.redis.pipeline() // Atomic sliding window' },
        ],
      },
    }
  }

  // Scenario 2: Postgres BRIN Index Migration
  if (promptLower.includes('postgres') || promptLower.includes('brin') || promptLower.includes('migration') || promptLower.includes('index')) {
    return {
      thinkingDuration: `Thought for ${durationSeconds} seconds`,
      thinkingSteps: [
        'Checking physical table block ordering and correlation with timestamp column...',
        'Selecting pages_per_range parameter based on block write distribution...',
        'Generating idempotent DDL migration with CONCURRENTLY index creation...',
        ...toolNotes,
      ],
      text: `Here is the optimized PostgreSQL migration using BRIN (Block Range Index), ideal for append-only event tables.`,
      artifact: {
        ...mockArtifactData,
        id: `artifact-brin-${Date.now()}`,
        title: '001_brin_migration.sql',
        badge: 'SQL · Postgres',
        activeFile: '001_brin_migration.sql',
        files: [
          {
            name: '001_brin_migration.sql',
            language: 'sql',
            content: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telemetry_events_created_at_brin
ON telemetry_events
USING brin (created_at)
WITH (pages_per_range = 128);`,
          },
        ],
      },
    }
  }

  // Scenario 3: Explicit Component / Code Request
  if (promptLower.includes('dashboard') || promptLower.includes('component') || promptLower.includes('react') || promptLower.includes('ui')) {
    return {
      thinkingDuration: `Thought for ${durationSeconds} seconds`,
      thinkingSteps: [
        `Analyzing component specs for "${userPrompt.slice(0, 30)}..."`,
        'Constructing responsive React component with Darkroom Editorial styling...',
        ...toolNotes,
      ],
      text: `I have generated the requested UI component according to the Darkroom Editorial design system.`,
      artifact: {
        ...mockArtifactData,
        id: `artifact-${Date.now()}`,
        title: 'EnhancedDashboard.tsx',
      },
    }
  }

  // Default: Conversational & Technical Explanation without hardcoded code artifacts
  return {
    thinkingDuration: `Thought for ${durationSeconds} seconds`,
    thinkingSteps: [
      `Analyzing engineering request: "${userPrompt.slice(0, 48)}..."`,
      'Evaluating system architecture and operational parameters...',
      ...toolNotes,
    ],
    text: `I have analyzed your query regarding "${userPrompt}". \n\nPlease let me know if you would like me to generate specific code implementations, run Python data calculations in the sandbox, or search through uploaded SOP documents.`,
  }
}
