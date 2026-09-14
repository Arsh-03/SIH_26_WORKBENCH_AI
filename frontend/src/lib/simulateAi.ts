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
        'Recognized conversational greeting intent',
        'Initialized sovereign engineering assistant persona',
      ],
      text: `Hello! I am your Sovereign AI Engineering Workbench Assistant. I'm here to assist you with industrial plant engineering, technical standards (such as ASME Section VIII, boiler SOP-401, and safety policies), pressure vessel calculations, code development, and engineering documentation. How can I assist you with your technical operations today?`,
    }
  }

  // Scenario 0.5: Off-topic / Pop culture / Cartoons (e.g. Doraemon, movies, anime)
  if (/doraemon|anime|cartoon|movie|cinema|actor|celebrity|pop\s*culture|game\s*of\s*thrones|marvel/i.test(promptLower)) {
    return {
      thinkingDuration: `Thought for 0.4 seconds`,
      thinkingSteps: [
        'Classified query as non-engineering entertainment/pop-culture',
        'Applying sovereign engineering scope boundary',
      ],
      text: `I appreciate the question, but as a Sovereign Engineering AI Assistant, I don't follow pop culture, cartoons, or entertainment. My engine is designed exclusively for industrial plant engineering, technical specifications (like ASME Section VIII and plant SOPs), equipment inspection standards, and mathematical physics analysis. Please let me know if there's an engineering topic, calculation, or procedure I can assist you with!`,
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

  // Scenario 4: Report Infographics, 2D Heatmap & KPI Visualizer
  if (
    promptLower.includes('infographic') ||
    promptLower.includes('heatmap') ||
    promptLower.includes('kpi') ||
    promptLower.includes('radar') ||
    promptLower.includes('chart.js') ||
    promptLower.includes('analyze') ||
    promptLower.includes('report')
  ) {
    return {
      thinkingDuration: `Thought for ${durationSeconds} seconds`,
      thinkingSteps: [
        'Parsing uploaded report telemetry and equipment inspection tables...',
        'Computing 2D fouling factors across shell and tube passes (ASME/TEMA standards)...',
        'Calculating throughput delta variances and high-pressure steam OPEX metrics...',
        'Synthesizing interactive Chart.js radar distribution and 2D intensity heatmap...',
        ...toolNotes,
      ],
      text: `I have completed the technical analysis of the document. Below is the synthesized industrial telemetry report, including the **2D Tube-Bundle Fouling Heatmap**, **Executive KPI Scorecard**, and **Multi-Axis Performance Radar**.

:::analysis_progress
{
  "title": "REPORT EXTRACTION & TELEMETRY INGESTION PIPELINE",
  "steps": [
    { "name": "Telemetry Ingestion & Tabular OCR", "status": "completed", "detail": "Parsed 14 unit logs" },
    { "name": "ASME / TEMA Fouling Calculation", "status": "completed", "detail": "Computed thermal degradation" },
    { "name": "Chart.js & Heatmap Synthesis", "status": "completed", "detail": "Rendered 2D matrix" }
  ]
}
:::

:::infographic
{
  "title": "MRPL Crude Distillation Unit (CDU-1) Performance Dashboard",
  "subtitle": "Synthesized Operational Analytics & Heat Exchanger Inspection",
  "kpis": [
    {
      "label": "CDU-1 Crude Throughput",
      "value": "14,850",
      "unit": "MT/Day",
      "target": "15,000 MT/d",
      "delta": "+2.4%",
      "status": "nominal",
      "sparkline": [14200, 14450, 14600, 14750, 14850]
    },
    {
      "label": "High-Pressure Steam OPEX",
      "value": "$38.40",
      "unit": "/ Ton",
      "target": "$35.00",
      "delta": "+9.7%",
      "status": "warning",
      "sparkline": [34, 35, 36.5, 37.8, 38.4]
    },
    {
      "label": "Superheater Thermal Creep Risk",
      "value": "CRITICAL",
      "target": "ASME Sec VIII",
      "delta": "-14.2% Life",
      "status": "critical",
      "sparkline": [95, 90, 82, 71, 58]
    }
  ],
  "heatmap": {
    "title": "Heat Exchanger Tube-Bundle Fouling Intensity Matrix",
    "xLabels": ["E-101", "E-102", "E-103", "E-104", "E-105"],
    "yLabels": ["Inlet Zone", "Mid Pass 1", "Mid Pass 2", "Outlet Zone"],
    "values": [
      [1.2, 2.4, 1.8, 3.1, 4.2],
      [0.8, 1.5, 2.1, 2.8, 3.7],
      [1.9, 2.8, 3.4, 4.1, 5.0],
      [0.5, 0.9, 1.2, 1.8, 2.4]
    ],
    "valueLabel": "Fouling Factor (m² K / kW)",
    "colorScale": "thermal"
  },
  "chartjs": {
    "type": "radar",
    "title": "Unit Efficiency & Reliability Fingerprint",
    "labels": ["Thermal Yield", "Steam Efficiency", "ASME Margin", "Creep Reserve", "Emissions"],
    "datasets": [
      {
        "label": "Current Operating State",
        "data": [88, 74, 92, 65, 82],
        "borderColor": "#D97A3F",
        "backgroundColor": "rgba(217, 122, 63, 0.25)"
      },
      {
        "label": "Design Target (SOP-401)",
        "data": [95, 90, 100, 95, 90],
        "borderColor": "#10B981",
        "backgroundColor": "rgba(16, 185, 129, 0.15)"
      }
    ]
  },
  "rawTable": [
    { "Exchanger": "E-101", "InletTempC": 350, "OutletTempC": 280, "FoulingIndex": 1.2, "Status": "Nominal" },
    { "Exchanger": "E-102", "InletTempC": 380, "OutletTempC": 295, "FoulingIndex": 2.4, "Status": "Nominal" },
    { "Exchanger": "E-103", "InletTempC": 410, "OutletTempC": 310, "FoulingIndex": 1.8, "Status": "Nominal" },
    { "Exchanger": "E-104", "InletTempC": 440, "OutletTempC": 330, "FoulingIndex": 3.1, "Status": "Warning" },
    { "Exchanger": "E-105", "InletTempC": 480, "OutletTempC": 360, "FoulingIndex": 4.2, "Status": "Critical" }
  ]
}
:::

### Engineering Recommendations:
1. **Backwash Schedule**: Schedule chemical de-scaling for exchanger **E-105** during the upcoming 48-hour maintenance window.
2. **Steam Temperature**: Throttle superheater bypass valve V-204 to maintain outlet temperatures under 450°C in compliance with **SOP-401** to mitigate creep acceleration.`,
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
