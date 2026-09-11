import { useState, useEffect } from 'react'
import { createHighlighter, type Highlighter, type BundledLanguage, type BundledTheme } from 'shiki'

export interface ShikiToken {
  content: string
  color?: string
  fontStyle?: number
  bgColor?: string
}

export type LineTokens = ShikiToken[]

// Cache singleton highlighter promise to avoid multiple instances
let highlighterPromise: Promise<Highlighter> | null = null

const DEFAULT_THEME = 'tokyo-night'
const SUPPORTED_LANGS = [
  'python',
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'bash',
  'sql',
  'html',
  'css',
  'cpp',
  'c',
  'java',
  'rust',
  'go',
  'markdown',
  'yaml',
]

export const getShikiHighlighter = (): Promise<Highlighter> => {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [DEFAULT_THEME, 'github-dark', 'one-dark-pro'],
      langs: SUPPORTED_LANGS,
    }).catch((err) => {
      console.error('Failed to initialize Shiki highlighter:', err)
      highlighterPromise = null
      throw err
    })
  }
  return highlighterPromise
}

export const normalizeLanguage = (lang?: string): string => {
  if (!lang) return 'python'
  const l = lang.toLowerCase().trim()
  if (['py', 'python3', 'py3'].includes(l)) return 'python'
  if (['js', 'node', 'mjs', 'cjs'].includes(l)) return 'javascript'
  if (['ts'].includes(l)) return 'typescript'
  if (['sh', 'shell', 'zsh'].includes(l)) return 'bash'
  if (['c++', 'cc', 'cxx', 'h', 'hpp'].includes(l)) return 'cpp'
  if (['golang'].includes(l)) return 'go'
  if (['yml'].includes(l)) return 'yaml'
  if (['md'].includes(l)) return 'markdown'
  return l
}

/**
 * Custom React hook to highlight code using Shiki with VS Code Tokyo Night theme
 */
export const useShikiHighlighting = (code: string, language: string = 'python', theme: string = DEFAULT_THEME) => {
  const [tokenLines, setTokenLines] = useState<LineTokens[] | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    let isCancelled = false
    const normLang = normalizeLanguage(language)

    const tokenize = async () => {
      try {
        setIsLoading(true)
        const highlighter = await getShikiHighlighter()
        if (isCancelled) return

        // Ensure language is loaded
        const loadedLangs = highlighter.getLoadedLanguages()
        if (!loadedLangs.includes(normLang)) {
          try {
            await highlighter.loadLanguage(normLang as any)
          } catch {
            // Fallback to text if language not found
          }
        }

        const effectiveLang = highlighter.getLoadedLanguages().includes(normLang) ? normLang : 'text'
        const result = highlighter.codeToTokens(code, {
          lang: effectiveLang as BundledLanguage,
          theme: theme as BundledTheme,
        })

        if (!isCancelled) {
          setTokenLines(result.tokens as LineTokens[])
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Shiki highlighting error:', err)
        if (!isCancelled) {
          // Fallback simple line split
          const fallback = code.split('\n').map((line) => [{ content: line || ' ' }])
          setTokenLines(fallback)
          setIsLoading(false)
        }
      }
    }

    tokenize()

    return () => {
      isCancelled = true
    }
  }, [code, language, theme])

  return { tokenLines, isLoading }
}

/**
 * Detect interactive input prompt requests in code (e.g. input("..."), printf() -> scanf(), cout -> cin, prompt())
 */
export interface DetectedPrompt {
  id: string
  label: string
  placeholder?: string
  defaultValue: string
}

export const detectInteractiveInputs = (code: string, _language: string = 'python'): DetectedPrompt[] => {
  const prompts: DetectedPrompt[] = []
  if (!code) return prompts

  const lines = code.split('\n')
  let lastPromptLabel = ''
  let count = 1

  // Regex patterns to capture output print statements across languages
  const printRegexes = [
    /printf\s*\(\s*(["'])(.*?)\1/i,
    /cout\s*<<\s*(["'])(.*?)\1/i,
    /System\.(?:out|err)\.(?:print|println)\s*\(\s*(["'])(.*?)\1/i,
    /print\s*\(\s*(?:f)?(["'])(.*?)\1/i,
    /console\.(?:log|info)\s*\(\s*(["'])(.*?)\1/i,
    /fmt\.(?:Print|Println|Printf)\s*\(\s*(["'])(.*?)\1/i,
    /puts\s*\(\s*(["'])(.*?)\1/i,
  ]

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine || rawLine.startsWith('//') || rawLine.startsWith('#') || rawLine.startsWith('/*')) {
      continue
    }

    // Check if current line has a print statement
    for (const pr of printRegexes) {
      const match = pr.exec(rawLine)
      if (match && match[2]) {
        let cleanText = match[2]
          .replace(/\\n/g, '')
          .replace(/\\t/g, ' ')
          .replace(/[:：\s]+$/, '')
          .trim()
        if (cleanText.length > 0) {
          lastPromptLabel = cleanText
        }
      }
    }

    // Check for input statements
    // 1. C/C++ scanf, cin, fgets
    const scanfMatch = /scanf\s*\(\s*(["'])(.*?)\1/i.exec(rawLine)
    const isCin = /cin\s*>>/i.test(rawLine)
    const isFgets = /fgets\s*\(/i.test(rawLine)

    if (scanfMatch || isCin || isFgets) {
      let label = lastPromptLabel || `Input parameter #${count}`
      let placeholder = 'e.g. 10 20 30'

      if (scanfMatch && scanfMatch[2]) {
        const specifiers: string[] = scanfMatch[2].match(/%[0-9]*[a-zA-Z]/g) || []
        if (specifiers.length > 1) {
          placeholder = `e.g. ${specifiers.map((_, idx) => (idx + 1) * 10).join(' ')}`
        } else if (specifiers.includes('%f') || specifiers.includes('%lf')) {
          placeholder = 'e.g. 3.14'
        } else if (specifiers.includes('%d') || specifiers.includes('%i')) {
          placeholder = 'e.g. 42'
        } else if (specifiers.includes('%s')) {
          placeholder = 'e.g. hello'
        }
      }

      prompts.push({
        id: `input_${count}`,
        label: label.endsWith(':') ? label : `${label}:`,
        placeholder,
        defaultValue: '',
      })
      lastPromptLabel = '' // Reset after consumed
      count++
      continue
    }

    // 2. Python input(...)
    const pyInputMatch = /input\(\s*(?:(['"])(.*?)\1)?\s*\)/i.exec(rawLine)
    if (pyInputMatch) {
      let promptInside = pyInputMatch[2] ? pyInputMatch[2].replace(/\\n/g, '').replace(/[:\s]+$/, '').trim() : ''
      let label = promptInside || lastPromptLabel || `Input parameter #${count}`
      prompts.push({
        id: `input_${count}`,
        label: label.endsWith(':') ? label : `${label}:`,
        placeholder: 'Enter value',
        defaultValue: '',
      })
      lastPromptLabel = ''
      count++
      continue
    }

    // 3. Java Scanner / readLine
    const isJavaScan = /(?:scanner\s*\.\s*(?:next|nextInt|nextDouble|nextFloat|nextLine)|readLine\s*\()/i.test(rawLine)
    if (isJavaScan) {
      let label = lastPromptLabel || `Standard Input #${count}`
      prompts.push({
        id: `input_${count}`,
        label: label.endsWith(':') ? label : `${label}:`,
        placeholder: 'Enter value',
        defaultValue: '',
      })
      lastPromptLabel = ''
      count++
      continue
    }

    // 4. JS/TS prompt or readline
    const jsPromptMatch = /(?:prompt|question)\(\s*(?:(['"])(.*?)\1)?\s*\)/i.exec(rawLine)
    if (jsPromptMatch) {
      let promptInside = jsPromptMatch[2] ? jsPromptMatch[2].replace(/\\n/g, '').replace(/[:\s]+$/, '').trim() : ''
      let label = promptInside || lastPromptLabel || `Input parameter #${count}`
      prompts.push({
        id: `input_${count}`,
        label: label.endsWith(':') ? label : `${label}:`,
        placeholder: 'Enter value',
        defaultValue: '',
      })
      lastPromptLabel = ''
      count++
      continue
    }
  }

  return prompts
}
