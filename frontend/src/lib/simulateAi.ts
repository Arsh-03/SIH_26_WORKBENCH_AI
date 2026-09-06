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
 * Stand-in for future real backend / streaming API call.
 * Designed with a signature that mirrors a real LLM endpoint request/response.
 * When integrating a real backend, only this function needs to be replaced with a fetch/stream call.
 */
export async function simulateModelResponse(
  userPrompt: string,
  context: ModelContext = {}
): Promise<SimulatedAiResponse> {
  // Simulated network & reasoning latency (~1.4s - 2.0s)
  const delay = Math.floor(Math.random() * 600) + 1400
  await new Promise((resolve) => setTimeout(resolve, delay))

  const promptLower = userPrompt.toLowerCase()
  const durationSeconds = (delay / 1000).toFixed(1)

  // Context-aware tool notes
  const toolNotes: string[] = []
  if (context.activeTools?.webSearch) toolNotes.push('Indexed current npm package landscape via Web Search')
  if (context.activeTools?.codeExecution) toolNotes.push('Executed TypeScript AST validation sandbox')
  if (context.activeTools?.deepResearch) toolNotes.push('Evaluated benchmark comparisons from memory cache')

  // Scenario 1: Rate Limiter Service
  if (promptLower.includes('rate limiter') || promptLower.includes('redis') || promptLower.includes('fastify')) {
    return {
      thinkingDuration: `Thought for ${durationSeconds} seconds`,
      thinkingSteps: [
        'Analyzing sliding window log vs sliding window counter trade-offs...',
        'Designing Redis multi/exec atomic pipeline to prevent race conditions under high concurrency...',
        'Constructing Fastify preHandler hook with standard RateLimit headers (Retry-After, X-RateLimit-Remaining)...',
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
          {
            name: 'rateLimiter.test.ts',
            language: 'typescript',
            content: `import { describe, it, expect, beforeEach } from 'vitest'
import { SlidingWindowLimiter } from './RateLimiter'

describe('SlidingWindowLimiter', () => {
  it('allows requests within window capacity', async () => {
    // Verified atomic execution test
  })
})`,
          },
        ],
        diffPreview: [
          { type: 'deletion', content: '- const count = await redis.get(key) // Race condition prone' },
          { type: 'addition', content: '+ const pipeline = this.redis.pipeline() // Atomic sliding window' },
          { type: 'context', content: '  pipeline.zadd(redisKey, now, `${now}:${Math.random()}`)' },
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
        'Selecting pages_per_range parameter based on block write distribution (128 pages = 1MB blocks)...',
        'Generating idempotent DDL migration with CONCURRENTLY index creation...',
        ...toolNotes,
      ],
      text: `Here is the optimized PostgreSQL migration. A BRIN (Block Range Index) is ideal for append-only event tables because it stores summary ranges for pages rather than individual rows, saving over 90% disk space compared to B-trees.`,
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
            content: `-- Up Migration: Add BRIN index on time-series telemetry events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telemetry_events_created_at_brin
ON telemetry_events
USING brin (created_at)
WITH (pages_per_range = 128);

-- Query verification
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM telemetry_events
WHERE created_at >= NOW() - INTERVAL '7 days';`,
          },
        ],
        diffPreview: [
          { type: 'deletion', content: '- CREATE INDEX idx_events_btree ON telemetry_events(created_at); -- 8.2 GB index' },
          { type: 'addition', content: '+ CREATE INDEX idx_events_brin ON telemetry_events USING brin(created_at); -- 14 MB index' },
        ],
      },
    }
  }

  // Scenario 3: Explain command
  if (promptLower.startsWith('/explain')) {
    const subject = userPrompt.replace(/^\/explain\s*/i, '').trim() || 'the active module'
    return {
      thinkingDuration: `Thought for ${durationSeconds} seconds`,
      thinkingSteps: [
        `Parsing structure and architectural flow for ${subject}...`,
        'Tracing lifecycle from mount to tear-down...',
        'Documenting concurrency boundaries and memory guarantees...',
        ...toolNotes,
      ],
      text: `### Architecture Explanation: ${subject}\n\n1. **Data Ingestion Flow**: Telemetry data streams asynchronously via Web Workers, keeping the UI thread strictly at 60 FPS.\n2. **Virtualization Strategy**: DOM nodes are recycled using fixed page windowing, ensuring zero memory leak even with 100k+ events.\n3. **Decoupled State**: Event dispatch uses an immutable ring buffer. No unnecessary re-renders occur on unmounted sibling routes.`,
    }
  }

  // Scenario 4: Test generation
  if (promptLower.startsWith('/test')) {
    return {
      thinkingDuration: `Thought for ${durationSeconds} seconds`,
      thinkingSteps: [
        'Analyzing edge cases: zero records, network disconnection, malformed payloads...',
        'Formulating unit test suites using Vitest and Mock Service Worker...',
        'Verifying assertion coverage reaches 100% on branch paths...',
        ...toolNotes,
      ],
      text: `I have generated comprehensive unit and integration tests covering standard execution, threshold timeouts, and edge cases for null payloads.`,
      artifact: {
        ...mockArtifactData,
        id: `artifact-tests-${Date.now()}`,
        title: 'telemetry.spec.ts',
        badge: 'Vitest · TypeScript',
        activeFile: 'telemetry.spec.ts',
        files: [
          {
            name: 'telemetry.spec.ts',
            language: 'typescript',
            content: `import { describe, it, expect, vi } from 'vitest'

describe('Telemetry Ingestion Suite', () => {
  it('discards records older than window threshold', () => {
    const now = Date.now()
    const validRecord = { timestamp: now - 1000, payload: 'ok' }
    const staleRecord = { timestamp: now - 86400000, payload: 'stale' }
    
    expect(validRecord.timestamp).toBeGreaterThan(now - 5000)
    expect(staleRecord.timestamp).toBeLessThan(now - 5000)
  })
})`,
          },
        ],
      },
    }
  }

  // Default: Return dashboard / code artifact with contextual message
  return {
    thinkingDuration: `Thought for ${durationSeconds} seconds`,
    thinkingSteps: [
      `Analyzing input: "${userPrompt.slice(0, 48)}..."`,
      'Inspecting syntax tree and dependency graph in scope...',
      'Constructing responsive TypeScript component with Darkroom Editorial aesthetics...',
      'Synthesizing live interactive preview and diff verification...',
      ...toolNotes,
    ],
    text: `I have prepared the requested implementation according to the Darkroom Editorial design system. The code is modularized, typed with strict TypeScript, and ready for immediate interactive preview.`,
    artifact: {
      ...mockArtifactData,
      id: `artifact-${Date.now()}`,
      title: 'EnhancedDashboard.tsx',
    },
  }
}
