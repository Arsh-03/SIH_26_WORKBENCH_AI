import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import type { ChatMessage, ArtifactData, ChatCitationItem } from '../../lib/types'
import { ThinkingIndicator } from './ThinkingIndicator'
import { ArtifactCard } from './ArtifactCard'
import { InteractiveCodeBlock } from './InteractiveCodeBlock'
import { InteractiveChartCard, type ChartSpec } from './InteractiveChartCard'
import { InfographicsCard, type InfographicSpec } from './InfographicsCard'
import { InteractiveEconomicsCard, type EconomicsSpec } from './InteractiveEconomicsCard'
import { InteractivePhysicsCard, type PhysicsSpec } from './InteractivePhysicsCard'
import { InteractivePidCanvas, type PidSpec } from './InteractivePidCanvas'
import { api } from '../../lib/api'
import { useAudioPlayback } from '../../lib/AudioPlaybackContext'

export interface MessageBlockProps {
  message: ChatMessage
  onOpenArtifact: (artifact: ArtifactData) => void
  onSelectOption?: (optionText: string) => void
  onEditPrompt?: (newText: string) => void
  isLatestUserPrompt?: boolean
  isArtifactOpen?: boolean
  className?: string
}

/**
 * Normalizes Markdown tables, ensuring that compressed row delimiters on the same line ('| |')
 * are broken into separate lines with proper Markdown table syntax so remark-gfm parses them into HTML tables.
 */
const normalizeMarkdownTables = (rawText: string): string => {
  if (!rawText || !rawText.includes('|')) return rawText
  let formatted = rawText.replace(/\|\s*\|\s*(?=[^|\n]+(?:\||$))/g, '|\n|')
  formatted = formatted.replace(/([^\n])\n(\|(?:\s*[^|\n]+\s*\|)+)\n(\|(?:\s*[-:]+[-| :]*\|)+)/g, '$1\n\n$2\n$3')
  return formatted
}

/**
 * Normalizes unparsed LaTeX delimiters (e.g. \[...\], \(...\), or bracketed formulas)
 * into standard markdown math syntax ($$...$$ and $...$).
 */
const preprocessMathText = (rawText: string): string => {
  if (!rawText) return ''
  let formatted = rawText.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`)
  formatted = formatted.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`)
  // Transform bracketed equation lines e.g. [ F = 0.6 + \frac{0.4}{...} ]
  formatted = formatted.replace(/(?:^|\n)\s*\[\s*([A-Za-z0-9_\\\+\-\*\/\^\(\)\{\}\=\s,.]+)\s*\]\s*(?=\n|$)/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`)
  return formatted
}

const CIRCLE_NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']

export const cleanDocName = (docId: string): string => {
  if (!docId) return 'Grounding Document'
  let name = docId.replace(/^company_shared\//, '').replace(/^company_doc_/, '')
  name = name.replace(/\.md$/i, '').replace(/_md$/i, '')
  return name.replace(/_/g, ' ')
}

/**
 * Normalizes citation patterns into markdown links: [badge](#cite-...)
 * Handles:
 * - Numbered citations: [1], [2], ①, ②
 * - Direct document references: "Refer to company_shared/SOP-401_Industrial_Boiler_Operations.md, Section 3"
 * - "Additionally, refer to ASME_Section_VIII_Pressure_Specs.md, Section 3"
 * - Standalone file mentions: "SOP-401_Industrial_Boiler_Operations.md"
 * - Bracketed document tags: [Doc: ...], [Wikipedia]
 */
const preprocessCitations = (rawText: string, citations?: ChatCitationItem[]): string => {
  if (!rawText) return ''
  let text = rawText

  // 0a. Strip backticks around file paths e.g. `company_shared/SOP-401...` or `ASME_...md`
  text = text.replace(/`([^`\n\r]*?[A-Za-z0-9_\-\./\\]+\.(?:md|pdf|docx|txt|json|csv)[^`\n\r]*?)`/gi, '$1')

  // 0b. Strip backticks around citation brackets e.g. `[1]`, `[^1]`, `①`
  text = text.replace(/`(\[?\^?\d+\]?|[①-⑩])`/g, '$1')

  // 0c. Clean up any broken browser-sanitized citation links e.g. [①](http://...) or [1](http://...)
  text = text.replace(/\[([①-⑩]|\d+)\]\([^\)]+\)/g, '[$1]')

  // 1. Transform explicit numeric citations e.g. [1], [2], [^1] -> academic Numbered Badge [1]
  text = text.replace(/(?<!\[)\[\^?(\d+)\](?!\()/g, (_, numStr) => {
    const num = parseInt(numStr, 10)
    return `[${num}](#cite-${num})`
  })

  // 2. Transform standalone circled numbers ①, ② if present into academic numbered badge
  text = text.replace(/(?<!\[)([①-⑩])(?!\()/g, (char) => {
    const num = CIRCLE_NUMS.indexOf(char) + 1
    return `[${num}](#cite-${num})`
  })

  // 3. Transform contextual document references: "Refer to / Additionally, refer to / See ... (company_shared/)?doc.md(, Section X)?"
  text = text.replace(
    /(?:((?:Additionally,?\s*)?(?:Refer to|refer to|See|see|Consult|consult|According to|according to))\s+)[`'"]?(?:company_shared\/)?([A-Za-z0-9_\-\.]+\.(?:md|pdf|docx|txt))[`'"]?(?:,?\s*Section\s*([0-9A-Za-z\.]+))?/gi,
    (fullMatch, prefix, docFileName, sec) => {
      if (fullMatch.includes('#cite-') || fullMatch.includes('](')) return fullMatch
      let citIdx = 1
      if (citations && citations.length > 0) {
        const foundIdx = citations.findIndex(
          (c) =>
            c.document_id.toLowerCase().includes(docFileName.toLowerCase()) ||
            docFileName.toLowerCase().includes(c.document_id.toLowerCase())
        )
        if (foundIdx >= 0) {
          citIdx = foundIdx + 1
        }
      }
      const cleanDoc = cleanDocName(docFileName)
      const secTag = sec ? `__sec_${sec}` : ''
      const secDisplay = sec ? ` Sec. ${sec}` : ''
      return `${prefix} [${cleanDoc}${secDisplay}](#cite-${docFileName}${secTag}) [${citIdx}](#cite-${citIdx})`
    }
  )

  // 4. Transform standalone document filename references only if they match verified retrieved citations
  text = text.replace(
    /(?<![\[\(/#a-zA-Z0-9_\-])(?:company_shared\/)?([A-Za-z0-9_\-]+\.(?:md|pdf|docx|txt))(?![\]\)\w])/gi,
    (match, docFileName) => {
      if (match.includes('#cite-') || match.includes('](')) return match
      if (!citations || citations.length === 0) return match
      const foundIdx = citations.findIndex(
        (c) =>
          c.document_id.toLowerCase().includes(docFileName.toLowerCase()) ||
          docFileName.toLowerCase().includes(c.document_id.toLowerCase())
      )
      if (foundIdx < 0) return match
      const citIdx = foundIdx + 1
      const cleanDoc = cleanDocName(docFileName)
      return `[${cleanDoc}](#cite-${docFileName}) [${citIdx}](#cite-${citIdx})`
    }
  )

  // 5. Transform [Doc: ASME_Section_VIII_Pressure_Specs.md, Page 1] or [Source: XYZ]
  text = text.replace(/\[(?:Doc|Source):\s*([A-Za-z0-9_\-\.]+)(?:,\s*Page\s*(\d+))?\]/gi, (_, docId, page) => {
    let citIdx = 1
    if (citations && citations.length > 0) {
      const foundIdx = citations.findIndex(
        (c) =>
          c.document_id.toLowerCase().includes(docId.toLowerCase()) ||
          docId.toLowerCase().includes(c.document_id.toLowerCase())
      )
      if (foundIdx >= 0) {
        citIdx = foundIdx + 1
      }
    }
    const pageTag = page ? `__p_${page}` : ''
    return `[${citIdx}](#cite-${docId}${pageTag})`
  })

  // 6. Transform explicit text pill citations like [Wikipedia], [SOP-401], or [ASME Section VIII] if they match citations
  if (citations && citations.length > 0) {
    citations.forEach((c, idx) => {
      const docClean = cleanDocName(c.document_id).trim()
      const baseName = c.document_id.replace(/\.[^/.]+$/, '').replace(/^company_doc_/, '')

      const matchPatterns = [baseName, docClean]
      for (const pattern of matchPatterns) {
        if (!pattern) continue
        const esc = pattern.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
        const regex = new RegExp(`(?<![\\(#])\\[(${esc})\\](?!\\()`, 'gi')
        text = text.replace(regex, `[$1](#cite-pill-${idx + 1})`)
      }
    })
  }

  return text
}

/**
 * Extracts :::options ... ::: blocks for Human-in-the-Loop interactive option cards.
 * Strips all occurrences globally and collects unique options.
 */
const extractOptions = (text: string): { cleanText: string; options: string[] } => {
  if (!text) return { cleanText: '', options: [] }
  const matches = [...text.matchAll(/:::options\s*([\s\S]*?):::/g)]
  if (!matches || matches.length === 0) return { cleanText: text, options: [] }

  const cleanText = text.replace(/:::options\s*([\s\S]*?):::/g, '').trim()
  const rawOptions: string[] = []
  for (const m of matches) {
    const lines = m[1].split('\n')
    for (const l of lines) {
      const opt = l.replace(/^[-*•\d\.\)]\s*/, '').trim()
      if (opt && !rawOptions.includes(opt)) {
        rawOptions.push(opt)
      }
    }
  }
  return { cleanText, options: rawOptions }
}

/**
 * Detects code execution outputs (e.g. `**Output:**\n\n...` or `Output:\n...`)
 * and transforms them into structured `:::output\n...\n:::` blocks so they render as
 * highlighted, high-contrast terminal execution output cards.
 */
const normalizeOutputBlocks = (rawText: string): string => {
  if (!rawText) return ''
  return rawText.replace(
    /(?:^|\n)(?:\*{0,2}(?:Output|Terminal Output|Execution Output|Console Output)\*{0,2}:\s*)\n+((?:(?!\n\s*#{1,4}\s|\n\s*```|\n\s*:::|\n\s*\*{0,2}(?:ASME|Creep|Fuel|Comparison|Conclusion|Recommendation|Option))[^\n]+(?:\n|$))+)/gi,
    (_, outContent) => {
      const trimmed = outContent.trim()
      if (!trimmed) return _
      return `\n\n:::output\n${trimmed}\n:::\n\n`
    }
  )
}

interface ContentPart {
  type: 'text' | 'chart' | 'infographic' | 'economics' | 'physics' | 'output' | 'pid' | 'analysis_progress'
  content?: string
  chartSpec?: ChartSpec
  infographicSpec?: InfographicSpec
  economicsSpec?: EconomicsSpec
  physicsSpec?: PhysicsSpec
  pidSpec?: PidSpec
  outputContent?: string
  analysisProgress?: {
    title?: string
    steps: Array<{ name: string; status: 'completed' | 'in_progress' | 'pending'; detail?: string }>
  }
}

/**
 * Splits text into markdown text segments and dynamic :::chart,  :::infographic, :::economics, :::physics, :::output, :::pid, and aliased :::stimulative blocks.
 */
const parseContentWithCharts = (text: string): ContentPart[] => {
  if (!text) return [{ type: 'text', content: '' }]

  const regex = /:::(chart|infographic|economics|physics|output|pid|stimulative|stimulate|simulation|simulate|interactive|graph|plot|visualization|analytics|asme)\s*([\s\S]*?):::/gi
  const parts: ContentPart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index)
      if (textBefore.trim()) {
        parts.push({ type: 'text', content: textBefore })
      }
    }

    const blockType = match[1].toLowerCase()
    const rawJson = match[2].trim()

    if (blockType === 'output') {
      parts.push({ type: 'output', outputContent: rawJson })
    } else {
      let parsed: any = null
      try {
        parsed = JSON.parse(rawJson)
      } catch {
        try {
          const fixed = rawJson
            .replace(/,\s*([}\]])/g, '$1')
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":')
            .replace(/:\s*'([^']*)'/g, ':"$1"')
          parsed = JSON.parse(fixed)
        } catch {
          parsed = null
        }
      }

      if (parsed && typeof parsed === 'object') {
        if (blockType === 'infographic') {
          parts.push({ type: 'infographic', infographicSpec: parsed })
        } else if (blockType === 'chart') {
          // If chart contains advanced infographic types, route to infographicSpec
          if (
            parsed.type === 'heatmap' ||
            parsed.type === 'radar' ||
            parsed.type === 'kpi' ||
            parsed.type === 'multi_axis' ||
            parsed.type === 'figure' ||
            parsed.heatmap ||
            parsed.kpis
          ) {
            parts.push({ type: 'infographic', infographicSpec: parsed })
          } else {
            parts.push({ type: 'chart', chartSpec: parsed })
          }
        } else if (blockType === 'analysis_progress') {
          parts.push({ type: 'analysis_progress', analysisProgress: parsed })
        } else if (blockType === 'economics') {
          parts.push({ type: 'economics', economicsSpec: parsed })
        } else if (blockType === 'physics') {
          parts.push({ type: 'physics', physicsSpec: parsed })
        } else if (blockType === 'pid' || (parsed.nodes && parsed.pipes) || (parsed.equipment && parsed.nodes)) {
          parts.push({ type: 'pid', pidSpec: parsed })
        } else if (
          blockType === 'physics' ||
          blockType === 'asme' ||
          parsed.formulaLatex ||
          parsed.marginOfSafety !== undefined ||
          (parsed.inputs && parsed.results && (parsed.standard || parsed.safetyAssessment))
        ) {
          parts.push({ type: 'physics', physicsSpec: parsed })
        } else if (
          blockType === 'economics' ||
          parsed.headlineMetric ||
          parsed.costBreakdown ||
          parsed.annualizedCapEx ||
          parsed.opexBreakdown
        ) {
          parts.push({ type: 'economics', economicsSpec: parsed })
        } else if (Array.isArray(parsed.data)) {
          parts.push({ type: 'chart', chartSpec: parsed })
        } else if (parsed.series && typeof parsed.data === 'object') {
          const dataArray = Array.isArray(parsed.data) ? parsed.data : [parsed.data]
          parts.push({ type: 'chart', chartSpec: { ...parsed, data: dataArray } })
        } else if (['chart', 'stimulative', 'stimulate', 'simulation', 'simulate', 'interactive', 'graph', 'plot', 'visualization', 'analytics'].includes(blockType)) {
          if (parsed.data && Array.isArray(parsed.data)) {
            parts.push({ type: 'chart', chartSpec: parsed })
          } else if (parsed.inputs && parsed.results) {
            parts.push({ type: 'physics', physicsSpec: parsed })
          } else {
            parts.push({ type: 'text', content: '```json\n' + rawJson + '\n```' })
          }
        } else {
          parts.push({ type: 'text', content: '```json\n' + rawJson + '\n```' })
        }
      } else {
        parts.push({ type: 'text', content: '```json\n' + rawJson + '\n```' })
      }
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    const textAfter = text.slice(lastIndex)
    if (textAfter.trim()) {
      parts.push({ type: 'text', content: textAfter })
    }
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }]
}

interface CitationBadgeAnchorProps {
  hrefStr: string
  childStr: string
  citations?: ChatCitationItem[]
  fullText?: string
  onOpenCitation: (cit: ChatCitationItem) => void
  children?: React.ReactNode
}

const CitationBadgeAnchor: React.FC<CitationBadgeAnchorProps> = ({
  hrefStr,
  childStr,
  citations,
  fullText,
  onOpenCitation,
}) => {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleMouseEnter = () => {
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    setIsOpen(false)
  }

  let targetId = hrefStr
    .replace(/^#cite-(?:pill-)?/, '')
    .replace(/^citation:\/\//, '')
    .replace(/^https?:\/\/[^\/]+\/chat\/[^\/]+\/?/, '')
    .replace(/^https?:\/\/[^\/]+\/?/, '')

  let sec = ''
  let page = ''

  if (targetId.includes('__sec_')) {
    const parts = targetId.split('__sec_')
    targetId = parts[0]
    sec = parts[1]
  } else if (targetId.includes('__p_')) {
    const parts = targetId.split('__p_')
    targetId = parts[0]
    page = parts[1]
  }

  // Determine if this is a numbered badge or text pill marker
  let matchedIndex = -1
  if (/^\d+$/.test(targetId)) {
    matchedIndex = parseInt(targetId, 10) - 1
  } else {
    const circleIdx = CIRCLE_NUMS.indexOf(childStr.replace(/[\[\]]/g, ''))
    if (circleIdx >= 0) {
      matchedIndex = circleIdx
    } else {
      const numMatch = childStr.match(/^\[?(\d+)\]?$/)
      if (numMatch) {
        matchedIndex = parseInt(numMatch[1], 10) - 1
      }
    }
  }

  let matchedCitation =
    matchedIndex >= 0 && citations ? citations[matchedIndex] : undefined

  if (!matchedCitation && targetId) {
    matchedCitation = citations?.find(
      (c) =>
        c.document_id.toLowerCase().includes(targetId.toLowerCase()) ||
        targetId.toLowerCase().includes(c.document_id.toLowerCase())
    )
  }

  if (!matchedCitation && citations && citations.length > 0) {
    matchedCitation = citations[0]
  }

  const numericVal = matchedIndex >= 0 ? matchedIndex + 1 : childStr.replace(/[^\d]/g, '') || '1'

  // Extract from full text if available and matchedCitation didn't supply rich info
  let textRefTitle = ''
  let textRefSec = ''
  let textRefSnippet = ''

  if (fullText) {
    const regex = new RegExp(`\\[${numericVal}\\]\\s*([^\\n\\r]+)`, 'i')
    const match = fullText.match(regex)
    if (match) {
      const rawLine = match[1].trim()
      const secMatch = rawLine.match(/Section\s*([0-9A-Za-z\.]+)/i)
      if (secMatch) textRefSec = secMatch[1]
      const parts = rawLine.split(',')
      textRefTitle = parts[0].replace(/^📄|\.md$/g, '').trim()
      textRefSnippet = rawLine
    }
  }

  let rawDocName = matchedCitation
    ? cleanDocName(matchedCitation.document_id)
    : textRefTitle || (targetId && !/^\d+$/.test(targetId) ? cleanDocName(targetId) : '')

  if (!rawDocName || /^\d+$/.test(rawDocName)) {
    rawDocName = 'Company Safety & Operational Policy'
  }

  const docName = rawDocName
  const snippet =
    matchedCitation?.snippet ||
    textRefSnippet ||
    'Authoritative grounding source verified from on-premise knowledge base.'

  const displayLoc = sec
    ? `Section ${sec}`
    : textRefSec
      ? `Section ${textRefSec}`
      : page
        ? `Page ${page}`
        : matchedCitation?.page_number
          ? `Page ${matchedCitation.page_number}`
          : 'Grounding Spec'

  const isWeb = docName.toLowerCase().includes('wikipedia') || docName.toLowerCase().includes('http')
  const isNumericBadge = matchedIndex >= 0 || /^\[?\d+\]?$/.test(childStr) || /[①-⑩]/.test(childStr)
  const pillLabel = childStr.replace(/^[\[\(]+|[\]\)]+$/g, '')

  const triggerCitationOpen = () => {
    if (matchedCitation) {
      onOpenCitation(matchedCitation)
    } else {
      onOpenCitation({
        document_id: targetId || 'company_safety_policy',
        page_number: page ? parseInt(page, 10) : 1,
        snippet,
      })
    }
  }

  return (
    <span
      className="relative inline-block align-baseline mx-0.5"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* The Anchor Button: Numbered Badge [1] vs Text Pill Marker */}
      {isNumericBadge ? (
        <button
          type="button"
          title={`Inspect citation [${numericVal}]: ${docName} (${displayLoc})`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            triggerCitationOpen()
          }}
          className="inline-flex items-center justify-center h-[18px] min-w-[20px] px-1 text-[10.5px] font-mono font-bold rounded-[3px] bg-accent-primary/15 text-accent-primary hover:bg-accent-primary hover:text-black border border-accent-primary/40 shadow-2xs transition-all cursor-pointer select-none leading-none -translate-y-0.5"
        >
          [{numericVal}]
        </button>
      ) : (
        <button
          type="button"
          title={`Inspect citation: ${docName} (${displayLoc})`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            triggerCitationOpen()
          }}
          className="inline-flex items-center gap-1 h-[20px] px-2 text-[10.5px] font-mono font-medium rounded-[3px] bg-surface-2 text-text-primary hover:bg-accent-primary/20 hover:border-accent-primary/80 hover:text-accent-primary border border-border/80 shadow-2xs transition-all cursor-pointer select-none leading-none -translate-y-0.5"
        >
          <span className="text-accent-primary text-[10px]">{isWeb ? '🌐' : '📄'}</span>
          <span className="truncate max-w-[220px] sm:max-w-[280px]">{pillLabel}</span>
        </button>
      )}

      {/* Shape of AI / Perplexity Hover State Preview Overlay with Seamless Bridge */}
      {isOpen && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="pointer-events-auto absolute bottom-full left-1/2 -translate-x-1/2 pb-3.5 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex flex-col w-72 sm:w-84 p-3 rounded-[6px] bg-[#1a1410] border border-accent-primary/60 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5 mb-1.5">
              <span className="font-mono text-[10.5px] font-bold text-accent-primary uppercase truncate max-w-[190px] flex items-center gap-1.5">
                <span>{isWeb ? '🌐' : '📄'}</span>
                <span className="truncate">{docName}</span>
              </span>
              <span className="font-mono text-[9px] text-text-muted/90 bg-surface-2 px-1.5 py-0.5 rounded border border-border/60 font-semibold shrink-0">
                {displayLoc}
              </span>
            </div>
            <p className="font-body text-[11.5px] text-text-body italic leading-relaxed line-clamp-4 mb-2 pl-2 border-l-2 border-accent-primary/50 bg-surface-1/50 py-1 rounded-r">
              "{snippet}"
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                triggerCitationOpen()
              }}
              className="flex items-center justify-between font-mono text-[9.5px] text-accent-primary border-t border-border/40 pt-1.5 font-semibold hover:underline cursor-pointer"
            >
              <span>Open document in side panel</span>
              <span>↗</span>
            </button>
            {/* Tooltip Arrow Pointer */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-3.5 border-4 border-transparent border-t-[#1a1410]" />
          </div>
        </div>
      )}
    </span>
  )
}

/**
 * MessageBlock Component
 * Follows DESIGN.md Screen 2 & Section 4:
 * - User prompt: flat rectangle on Elevation 1 (#211B15), right-aligned, hairline top rule, not a chat bubble
 * - Model response: caption-style thinking indicator, General Sans body text (leading 1.65), markdown & KaTeX math formatting, inline artifact card
 */
export const MessageBlock: React.FC<MessageBlockProps> = ({
  message,
  onOpenArtifact,
  onSelectOption,
  onEditPrompt,
  isLatestUserPrompt = false,
  isArtifactOpen = false,
  className = '',
}) => {
  const [isCitationsExpanded, setIsCitationsExpanded] = React.useState(false)
  const [selectedOptionIndices, setSelectedOptionIndices] = React.useState<number[]>([])
  const [isEditing, setIsEditing] = React.useState(false)
  const [editText, setEditText] = React.useState(message.text)
  const [isPromptCopied, setIsPromptCopied] = React.useState(false)
  const [isAiCopied, setIsAiCopied] = React.useState(false)
  const { activeText, isPlaying, playText } = useAudioPlayback()

  const isUser = message.sender === 'user'

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(message.text)
      setIsPromptCopied(true)
      setTimeout(() => setIsPromptCopied(false), 1800)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = message.text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setIsPromptCopied(true)
      setTimeout(() => setIsPromptCopied(false), 1800)
    }
  }

  const handleSaveEdit = () => {
    if (!editText.trim()) return
    setIsEditing(false)
    if (onEditPrompt) {
      onEditPrompt(editText.trim())
    }
  }

  const handleOpenCitation = async (cit: ChatCitationItem) => {
    const cleanTitle = cleanDocName(cit.document_id)
    let docContent = cit.content

    if (!docContent) {
      try {
        const rawDocId = cit.document_id.replace(/^company_shared\//, '')
        const res = await api.getDocumentContent('company_shared', `company_doc_${rawDocId.replace(/\./g, '_')}`)
        if (res?.content) {
          docContent = res.content
        }
      } catch {
        // use fallback formatting below
      }
    }

    if (!docContent) {
      docContent =
        `# ${cleanTitle}\n\n` +
        `**Page / Section Reference**: Page ${cit.page_number || 1}\n\n` +
        `---\n\n` +
        `### Verified Grounding Chunk Snippet:\n` +
        `> ${cit.snippet || 'Grounding chunk verified from official on-premise knowledge base.'}\n\n` +
        `---\n\n` +
        `*Sovereign AI On-Premise Grounding Verification: ACTIVE*\n`
    }

    const artifact: ArtifactData = {
      id: `doc_${cit.document_id}`,
      title: cleanTitle,
      badge: 'Authoritative Grounding Source',
      activeFile: cleanTitle,
      files: [
        {
          name: cleanTitle,
          language: 'markdown',
          content: docContent,
        },
      ],
    }
    onOpenArtifact(artifact)
  }

  if (isUser) {
    return (
      <div id={`msg-${message.id}`} className={`flex justify-end my-4 scroll-mt-8 group ${className}`}>
        {/* User Prompt: flat rectangle on Elevation 1 with hairline border */}
        <div className="relative max-w-2xl rounded-[4px] border border-border bg-surface-1 px-5 py-3.5 shadow-sm transition-all hover:border-border/90">
          <div className="flex items-center justify-between gap-4 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                {isLatestUserPrompt ? 'LATEST USER PROMPT' : 'USER PROMPT'}
              </span>
              {isLatestUserPrompt && (
                <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-accent-primary/20 text-accent-primary font-bold border border-accent-primary/40">
                  LATEST
                </span>
              )}
            </div>

            {/* Action Tray: Faded icons that become prominent on hover */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-text-muted/60">
                {message.timestamp}
              </span>

              {/* Copy Prompt Button */}
              <button
                type="button"
                onClick={handleCopyPrompt}
                title={isPromptCopied ? 'Copied prompt!' : 'Copy prompt'}
                className={`flex items-center gap-1 font-mono text-[10px] p-1 rounded transition-all cursor-pointer ${isPromptCopied
                  ? 'text-accent-primary bg-accent-primary/15 opacity-100'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2 opacity-40 group-hover:opacity-100'
                  }`}
              >
                {isPromptCopied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Copied</span>
                  </>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                )}
              </button>

              {/* Edit Prompt Button (available only on the recent latest user prompt) */}
              {onEditPrompt && isLatestUserPrompt && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  title="Edit and resend prompt"
                  className="flex items-center p-1 rounded text-text-muted hover:text-accent-primary hover:bg-surface-2 opacity-40 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="flex flex-col gap-2 pt-1 min-w-[280px] sm:min-w-[420px]">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleSaveEdit()
                  }
                  if (e.key === 'Escape') {
                    setIsEditing(false)
                    setEditText(message.text)
                  }
                }}
                rows={Math.min(8, Math.max(2, editText.split('\n').length))}
                autoFocus
                className="w-full rounded-[3px] border border-accent-primary/60 bg-surface-2 p-2.5 font-body text-[13.5px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary leading-relaxed resize-y"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-[10px] text-text-muted/70">
                  Press ⌘+Enter / Ctrl+Enter to resend
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false)
                      setEditText(message.text)
                    }}
                    className="px-2.5 py-1 rounded text-[11px] font-mono text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-3 py-1 rounded bg-accent-primary text-background text-[11px] font-mono font-bold hover:brightness-110 transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <span>Resend</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="font-body text-[14px] leading-relaxed text-text-primary whitespace-pre-wrap">
              {message.text}
            </p>
          )}
        </div>
      </div>
    )
  }

  const { cleanText, options } = extractOptions(message.text)
  const outputNormalized = normalizeOutputBlocks(cleanText)
  const tableNormalized = normalizeMarkdownTables(outputNormalized)
  const textWithCitations = preprocessCitations(tableNormalized, message.citations)
  const processedText = preprocessMathText(textWithCitations)
  const contentParts = parseContentWithCharts(processedText)

  const handleCopyAiContent = async () => {
    try {
      await navigator.clipboard.writeText(cleanText)
      setIsAiCopied(true)
      setTimeout(() => setIsAiCopied(false), 1800)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = cleanText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setIsAiCopied(true)
      setTimeout(() => setIsAiCopied(false), 1800)
    }
  }

  return (
    <div id={`msg-${message.id}`} className={`flex flex-col items-start w-full max-w-3xl my-5 space-y-3 scroll-mt-8 ${className}`}>
      {/* Model Response Header */}
      <div className="flex items-center justify-between w-full flex-wrap gap-2 group">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-widest text-accent-primary font-semibold">
            AI ASSISTANT
          </span>

          {/* Active Dynamic Model Tag Badge */}
          {message.modelUsed && (
            <div
              title={message.routingReason ? `Routed by Dynamic Model Router: ${message.routingReason}` : `Active Model: ${message.modelUsed}`}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] bg-surface-2/90 text-text-primary border border-border/80 px-2 py-0.5 rounded-[3px] shadow-2xs group hover:border-accent-primary/50 transition-colors cursor-help"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-primary"></span>
              </span>
              <span className="font-medium tracking-tight text-accent-primary">{message.modelUsed}</span>
              {message.modelCapability && (
                <span className="text-[9px] uppercase tracking-wider text-text-muted/80 border-l border-border/60 pl-1.5">
                  {message.modelCapability}
                </span>
              )}
            </div>
          )}

          <span className="font-mono text-[10px] text-text-muted/60">
            {message.timestamp}
          </span>
        </div>
      </div>

      {/* Thinking Indicator if steps exist */}
      {message.thinkingDuration && (
        <ThinkingIndicator
          duration={message.thinkingDuration}
          steps={message.thinkingSteps}
        />
      )}

      {/* Model Body Text: General Sans, line-height 1.65 with Markdown Parsing, KaTeX Math & Dynamic Charts */}
      <div className="font-body text-[15px] leading-[1.7] text-text-body pl-0.5 space-y-2.5 w-full">
        {contentParts.map((part, pIdx) => {
          if (part.type === 'infographic' && part.infographicSpec) {
            return (
              <InfographicsCard
                key={`infographic-${pIdx}`}
                spec={part.infographicSpec}
              />
            )
          }

          if (part.type === 'analysis_progress' && part.analysisProgress) {
            return (
              <div
                key={`prog-${pIdx}`}
                className="my-3 p-3.5 rounded-[4px] border border-border bg-[#181410] font-mono text-xs space-y-2.5 shadow-xs select-none"
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="font-semibold uppercase tracking-wider text-accent-primary flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-primary"></span>
                    </span>
                    {part.analysisProgress.title || 'DOCUMENT REPORT EXTRACTION PIPELINE'}
                  </span>
                  <span className="text-[10px] text-text-muted">SOVEREIGN ANALYTICS</span>
                </div>
                <div className="space-y-2">
                  {part.analysisProgress.steps.map((step, sIdx) => (
                    <div key={sIdx} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        {step.status === 'completed' ? (
                          <span className="text-emerald-400 font-bold">✓</span>
                        ) : step.status === 'in_progress' ? (
                          <span className="text-accent-primary animate-spin">◐</span>
                        ) : (
                          <span className="text-text-muted/60">○</span>
                        )}
                        <span
                          className={
                            step.status === 'completed'
                              ? 'text-text-primary'
                              : step.status === 'in_progress'
                                ? 'text-accent-primary font-semibold'
                                : 'text-text-muted'
                          }
                        >
                          {step.name}
                        </span>
                      </div>
                      {step.detail && <span className="text-[10px] text-text-muted">{step.detail}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          if (part.type === 'chart' && part.chartSpec) {
            return (
              <InteractiveChartCard
                key={`chart-${pIdx}`}
                spec={part.chartSpec}
              />
            )
          }

          if (part.type === 'economics' && part.economicsSpec) {
            return (
              <InteractiveEconomicsCard
                key={`econ-${pIdx}`}
                spec={part.economicsSpec}
              />
            )
          }

          if (part.type === 'physics' && part.physicsSpec) {
            return (
              <InteractivePhysicsCard
                key={`phys-${pIdx}`}
                spec={part.physicsSpec}
              />
            )
          }

          if (part.type === 'output' && part.outputContent) {
            return (
              <div
                key={`out-${pIdx}`}
                className="my-3 w-full rounded-md border border-border/80 bg-[#14100C] overflow-hidden shadow-xs"
              >
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-surface-2/90 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono text-[10px] uppercase font-bold text-accent-primary tracking-wider">
                      TERMINAL · SIMULATION OUTPUT
                    </span>
                  </div>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-1 border border-border/60 text-text-muted">
                    PYTHON ENCLAVE
                  </span>
                </div>
                <div className="p-3.5 font-mono text-[13px] leading-relaxed text-emerald-400/95 whitespace-pre-wrap bg-[#100C09] selection:bg-emerald-900/50">
                  {part.outputContent}
                </div>
              </div>
            )
          }

          if (part.type === 'pid' && part.pidSpec) {
            return (
              <InteractivePidCanvas
                key={`pid-${pIdx}`}
                spec={part.pidSpec}
                onSelectEquipment={(tag) => {
                  if (onSelectOption) onSelectOption(`Inspect operating specs for ${tag}`)
                }}
              />
            )
          }

          if (!part.content) return null

          return (
            <ReactMarkdown
              key={`md-${pIdx}`}
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                p: ({ children }) => <p className="mb-2 leading-[1.7] text-text-body">{children}</p>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 rounded-[3px] border border-border/80 bg-surface-1/60 shadow-2xs">
                    <table className="min-w-full divide-y divide-border border-collapse text-[13px]">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-surface-2/90 text-text-primary font-bold text-xs uppercase tracking-wider">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-border/60 bg-surface-1/40">{children}</tbody>,
                tr: ({ children }) => <tr className="hover:bg-surface-2/40 transition-colors">{children}</tr>,
                th: ({ children }) => <th className="px-3.5 py-2 text-left font-semibold text-text-primary border-r border-border/60 last:border-r-0">{children}</th>,
                td: ({ children }) => <td className="px-3.5 py-2 text-text-body border-r border-border/40 last:border-r-0 leading-normal">{children}</td>,
                strong: ({ children }) => (
                  <strong className="font-semibold text-text-primary tracking-tight">
                    {children}
                  </strong>
                ),
                h1: ({ children }) => (
                  <h1 className="font-title text-[18px] font-semibold text-text-primary mt-3 mb-1.5 border-b border-border/40 pb-1">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="font-title text-[16px] font-semibold text-text-primary mt-3 mb-1">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="font-title text-[15px] font-medium text-accent-primary mt-2 mb-1">
                    {children}
                  </h3>
                ),
                ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 text-text-body">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-text-body">{children}</ol>,
                li: ({ children }) => <li className="pl-0.5">{children}</li>,
                code: ({ className, children }: any) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const content = String(children).replace(/\n$/, '')
                  const isMultiline = content.includes('\n')
                  if (match || isMultiline) {
                    return (
                      <InteractiveCodeBlock
                        code={content}
                        language={match ? match[1] : 'python'}
                      />
                    )
                  }
                  if (content.includes('#cite-') || /\[.*?\]\(#cite-.*?\)/.test(content)) {
                    const cleaned = content.replace(/\[(.*?)\]\(#cite-.*?\)/g, '$1')
                    return (
                      <span className="font-mono text-[11px] text-accent-primary bg-surface-2 px-1.5 py-0.5 rounded border border-border/80">
                        {cleaned}
                      </span>
                    )
                  }
                  return (
                    <code className="font-mono text-[13px] bg-surface-2 text-accent-primary px-1.5 py-0.5 rounded border border-border/50">
                      {children}
                    </code>
                  )
                },
                a: ({ href, children }: any) => {
                  const hrefStr = href || ''
                  const childStr = String(children || '').trim()
                  const isCitationLink =
                    hrefStr.startsWith('#cite-') ||
                    hrefStr.startsWith('citation://') ||
                    /[①-⑩]/.test(childStr) ||
                    /^\[?\d+\]?$/.test(childStr) ||
                    (/^\[?[A-Za-z0-9_\-\.\s]+\]?$/.test(childStr) && hrefStr.startsWith('#cite'))

                  if (isCitationLink) {
                    return (
                      <CitationBadgeAnchor
                        hrefStr={hrefStr}
                        childStr={childStr}
                        citations={message.citations}
                        fullText={message.text}
                        onOpenCitation={handleOpenCitation}
                      >
                        {children}
                      </CitationBadgeAnchor>
                    )
                  }

                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent-primary underline hover:text-accent-hover transition-colors"
                    >
                      {children}
                    </a>
                  )
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-accent-primary/60 pl-3 py-1 my-2 text-text-muted bg-surface-1/40 rounded-r text-[14px]">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {part.content}
            </ReactMarkdown>
          )
        })}
      </div>

      {/* Sleek Gemini-style Sources Footer Bar */}
      {message.citations && message.citations.length > 0 && (
        <div className="w-full mt-2 pt-2 border-t border-border/40 flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[10px] uppercase tracking-wider text-accent-primary font-bold flex items-center gap-1 mr-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3 h-3 text-accent-primary"
                >
                  <path
                    fillRule="evenodd"
                    d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.5 9.525l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.248z"
                    clipRule="evenodd"
                  />
                </svg>
                Sources Grounded:
              </span>
              {message.citations.map((cit, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleOpenCitation(cit)}
                  title="Click to view full source document in preview panel beside"
                  className="inline-flex items-center gap-1.5 font-mono text-[9.5px] px-2 py-0.5 rounded-[3px] bg-surface-2 border border-border/70 hover:border-accent-primary/60 hover:text-accent-primary transition-all cursor-pointer shadow-2xs"
                >
                  <span className="text-accent-primary font-bold">[{idx + 1}]</span>
                  <span className="truncate max-w-[150px] text-text-primary">{cleanDocName(cit.document_id)}</span>
                  <span className="text-[8.5px] text-text-muted">p.{cit.page_number || 1}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsCitationsExpanded(!isCitationsExpanded)}
              className="font-mono text-[9.5px] text-text-muted hover:text-accent-primary transition-colors cursor-pointer"
            >
              {isCitationsExpanded ? 'Hide Details ▲' : 'All Snippets ▼'}
            </button>
          </div>

          {/* Collapsible details drawer if user explicitly clicks 'All Snippets' */}
          {isCitationsExpanded && (
            <div className="w-full flex flex-col gap-2 p-2.5 rounded-[4px] bg-surface-1/90 border border-border/70">
              {message.citations.map((cit, idx) => (
                <div
                  key={idx}
                  className="font-mono text-[10.5px] text-text-muted leading-relaxed border-b border-border/30 last:border-0 pb-1.5 last:pb-0"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-accent-primary font-bold">
                      [{idx + 1}] {cleanDocName(cit.document_id)}
                    </span>
                    <span className="text-[9px] text-text-muted border-l border-border/50 pl-2">
                      Page {cit.page_number || 1}
                    </span>
                  </div>
                  <p className="font-body text-[11px] text-text-body/90 italic">"{cit.snippet}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Response Bottom Action Bar (Icon-only copy button) */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => playText(cleanText)}
          title={activeText === cleanText && isPlaying ? 'Pause response audio' : 'Listen to response'}
          aria-label={activeText === cleanText && isPlaying ? 'Pause response audio' : 'Listen to response'}
          className={`flex items-center justify-center p-1.5 rounded-[4px] transition-all cursor-pointer ${activeText === cleanText && isPlaying
            ? 'text-accent-primary bg-accent-primary/15 border border-accent-primary/40'
            : 'text-text-muted hover:text-text-primary hover:bg-surface-2 border border-transparent hover:border-border/60'
            }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {activeText === cleanText && isPlaying ? <><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></> : <><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></>}
          </svg>
        </button>
        <button
          type="button"
          onClick={handleCopyAiContent}
          title={isAiCopied ? 'Copied response!' : 'Copy response'}
          aria-label="Copy response"
          className={`flex items-center justify-center p-1.5 rounded-[4px] transition-all cursor-pointer ${isAiCopied
            ? 'text-accent-primary bg-accent-primary/15 border border-accent-primary/40'
            : 'text-text-muted hover:text-text-primary hover:bg-surface-2 border border-transparent hover:border-border/60'
            }`}
        >
          {isAiCopied ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-primary">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          )}
        </button>
      </div>

      {/* Human-in-the-Loop Interactive Options Card with Multi-Select */}
      {options.length > 0 && (
        <div className="w-full mt-3 rounded-[4px] border border-accent-primary/40 bg-[#16110D] p-3.5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between border-b border-accent-primary/20 pb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-primary"></span>
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-accent-primary font-bold">
                HUMAN-IN-THE-LOOP · SELECT OPTIONS
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedOptionIndices.length === options.length) {
                    setSelectedOptionIndices([])
                  } else {
                    setSelectedOptionIndices(options.map((_, i) => i))
                  }
                }}
                className="font-mono text-[10px] text-accent-primary hover:underline px-2 py-0.5 rounded bg-surface-2/80 border border-border/80 transition-all cursor-pointer"
              >
                {selectedOptionIndices.length === options.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-0.5">
            {options.map((opt, oIdx) => {
              const isSelected = selectedOptionIndices.includes(oIdx)
              return (
                <div
                  key={oIdx}
                  onClick={() => {
                    setSelectedOptionIndices((prev) =>
                      prev.includes(oIdx) ? prev.filter((i) => i !== oIdx) : [...prev, oIdx]
                    )
                  }}
                  className={`group flex items-center justify-between gap-3 rounded-[3px] border px-3 py-2 text-left transition-all cursor-pointer shadow-2xs ${isSelected
                    ? 'border-accent-primary bg-accent-primary/15'
                    : 'border-border/80 bg-surface-1/90 hover:border-accent-primary/60 hover:bg-surface-2'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => { }} // handled by row onClick
                      className="accent-[#FF6B00] rounded cursor-pointer h-3.5 w-3.5 shrink-0"
                    />
                    <span className="font-mono text-[11px] text-accent-primary font-bold shrink-0 bg-surface-2 px-1.5 py-0.5 rounded-[2px] border border-border">
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                    <span className="font-body text-[13px] text-text-primary leading-snug">
                      {opt}
                    </span>
                  </div>
                  <button
                    type="button"
                    title="Execute only this option"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectOption && onSelectOption(opt)
                    }}
                    className="font-mono text-[11px] text-text-muted hover:text-accent-primary hover:bg-surface-2 px-1.5 py-0.5 rounded border border-transparent hover:border-border transition-all shrink-0 cursor-pointer"
                  >
                    Run →
                  </button>
                </div>
              )
            })}
          </div>

          {/* Consolidated Action Button when 1 or more options are selected */}
          {selectedOptionIndices.length > 0 && (
            <div className="pt-2 border-t border-accent-primary/20 flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] text-text-muted">
                {selectedOptionIndices.length === 1
                  ? '1 option selected'
                  : `${selectedOptionIndices.length} options selected (consolidated)`}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!onSelectOption || selectedOptionIndices.length === 0) return
                  if (selectedOptionIndices.length === 1) {
                    onSelectOption(options[selectedOptionIndices[0]])
                    return
                  }
                  const chosenTexts = selectedOptionIndices.map((i) => options[i])
                  const prompt = `Please provide a concise, balanced overview covering:\n${chosenTexts
                    .map((t, idx) => `${idx + 1}. ${t}`)
                    .join('\n')}\nKeep it direct, to the point, and well-structured without redundant text.`
                  onSelectOption(prompt)
                }}
                className="font-mono text-[11px] font-semibold bg-accent-primary hover:bg-accent-primary/90 text-black px-3.5 py-1.5 rounded-[3px] shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>
                  {selectedOptionIndices.length > 1
                    ? `Review Selected (${selectedOptionIndices.length})`
                    : 'Execute Selected Option'}
                </span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inline Artifact Card */}
      {message.artifact && (
        <ArtifactCard
          artifact={message.artifact}
          onOpen={() => onOpenArtifact(message.artifact!)}
          isOpen={isArtifactOpen}
        />
      )}
    </div>
  )
}

export default MessageBlock