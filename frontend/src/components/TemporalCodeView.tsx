import { type ReactNode, useMemo } from 'react'
import {
  goCode,
  goCompensation,
  pythonCode,
  pythonCompensation,
  typescriptCode,
  typescriptCompensation,
  type CodeLine,
} from '../data/workflowCode'
import type { CodeLanguage, StepStatus, TransferEvent } from '../types'

interface TemporalCodeViewProps {
  events: TransferEvent[]
  finalStatus: string | null
  language: CodeLanguage
}

function getStepStatus(step: string, events: TransferEvent[]): StepStatus | null {
  const stepEvents = events.filter((e) => e.step === step)
  if (stepEvents.length === 0) return null
  return stepEvents[stepEvents.length - 1].status
}

const STEP_BG: Record<string, string> = {
  running: 'bg-(--ultraviolet)/20 border-l-2 border-(--indigo-300)',
  completed: 'bg-(--mint)/8',
  retrying: 'bg-(--mustard)/15 border-l-2 border-(--mustard)',
  failed: 'bg-(--coral)/15 border-l-2 border-(--coral)',
}

interface Syntax {
  comment: string
  keywords: Set<string>
  constants: Set<string>
  builtins: Set<string>
  methods: Set<string>
  domain: Set<string>
}

interface LanguageCode {
  label: string
  main: CodeLine[]
  compensation: CodeLine[]
  syntax: Syntax
}

const LANGUAGES: Record<CodeLanguage, LanguageCode> = {
  python: {
    label: 'Python',
    main: pythonCode,
    compensation: pythonCompensation,
    syntax: {
      comment: '#',
      keywords: new Set([
        'class', 'async', 'def', 'await', 'for', 'in', 'try', 'except',
        'if', 'return', 'lambda',
      ]),
      constants: new Set(['True', 'False', 'None', 'self']),
      builtins: new Set(['workflow', 'activity', 'RetryPolicy', 'timedelta']),
      methods: new Set([
        'execute_activity', 'wait_condition', 'defn', 'run', 'signal', 'query', 'append',
      ]),
      domain: new Set([
        'validate', 'withdraw', 'deposit', 'send_notification', 'undo_withdraw',
        'compensations', 'transfer', 'comp',
      ]),
    },
  },
  go: {
    label: 'Go',
    main: goCode,
    compensation: goCompensation,
    syntax: {
      comment: '//',
      keywords: new Set(['func', 'var', 'defer', 'if', 'for', 'return', 'any', 'bool', 'error']),
      constants: new Set(['nil', 'true', 'false']),
      builtins: new Set(['workflow', 'temporal', 'time', 'Context', 'RetryPolicy']),
      methods: new Set([
        'ExecuteActivity', 'WithRetryPolicy', 'AwaitWithTimeout', 'Get', 'append', 'len',
      ]),
      domain: new Set([
        'Validate', 'Withdraw', 'Deposit', 'SendNotification', 'UndoWithdraw',
        'compensations', 'compensate', 'comps', 'transfer', 'Transfer',
      ]),
    },
  },
  typescript: {
    label: 'TypeScript',
    main: typescriptCode,
    compensation: typescriptCompensation,
    syntax: {
      comment: '//',
      keywords: new Set([
        'export', 'async', 'function', 'const', 'await', 'try', 'catch', 'for', 'of', 'void',
      ]),
      constants: new Set(['true', 'false', 'null', 'undefined']),
      builtins: new Set(['Promise', 'Activities', 'Compensation', 'Transfer']),
      methods: new Set(['proxyActivities', 'condition', 'push', 'reverse']),
      domain: new Set([
        'validate', 'withdraw', 'deposit', 'sendNotification', 'undoWithdraw',
        'compensations', 'transfer', 'comp',
      ]),
    },
  },
}

function tokenizeLine(text: string, syntax: Syntax): ReactNode[] {
  if (!text.trim()) return [text]

  const parts: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < text.length) {
    // Comments
    if (text.startsWith(syntax.comment, i)) {
      parts.push(
        <span key={key++} className="text-(--gray-500) italic">
          {text.slice(i)}
        </span>
      )
      return parts
    }

    // Strings
    if (text[i] === '"' || text[i] === "'") {
      const quote = text[i]
      let end = i + 1
      while (end < text.length && text[end] !== quote) end++
      end++ // include closing quote
      parts.push(
        <span key={key++} className="text-(--pink-100)">
          {text.slice(i, end)}
        </span>
      )
      i = end
      continue
    }

    // Decorators
    if (text[i] === '@') {
      let end = i + 1
      while (end < text.length && /[\w.]/.test(text[end])) end++
      parts.push(
        <span key={key++} className="text-(--mustard)">
          {text.slice(i, end)}
        </span>
      )
      i = end
      continue
    }

    // Numbers
    if (/\d/.test(text[i]) && (i === 0 || !/\w/.test(text[i - 1]))) {
      let end = i
      while (end < text.length && /[\d.]/.test(text[end])) end++
      parts.push(
        <span key={key++} className="text-(--coral)">
          {text.slice(i, end)}
        </span>
      )
      i = end
      continue
    }

    // Words (identifiers/keywords)
    if (/[a-zA-Z_]/.test(text[i])) {
      let end = i
      while (end < text.length && /[\w]/.test(text[end])) end++
      const word = text.slice(i, end)

      if (syntax.constants.has(word)) {
        parts.push(
          <span key={key++} className="text-(--coral)">
            {word}
          </span>
        )
      } else if (syntax.keywords.has(word)) {
        parts.push(
          <span key={key++} className="text-(--purple)">
            {word}
          </span>
        )
      } else if (syntax.builtins.has(word)) {
        parts.push(
          <span key={key++} className="text-(--indigo-300)">
            {word}
          </span>
        )
      } else if (syntax.methods.has(word)) {
        parts.push(
          <span key={key++} className="text-(--mustard)">
            {word}
          </span>
        )
      } else if (syntax.domain.has(word)) {
        parts.push(
          <span key={key++} className="text-(--mint)">
            {word}
          </span>
        )
      } else {
        parts.push(<span key={key++}>{word}</span>)
      }
      i = end
      continue
    }

    // Operators and punctuation
    if ('=()[]{}:;,.+-*/<>!'.includes(text[i])) {
      parts.push(
        <span key={key++} className="text-(--gray-400)">
          {text[i]}
        </span>
      )
      i++
      continue
    }

    // Default: whitespace and other
    parts.push(<span key={key++}>{text[i]}</span>)
    i++
  }

  return parts
}

export function TemporalCodeView({ events, finalStatus, language }: TemporalCodeViewProps) {
  const code = LANGUAGES[language]
  const showCompensation = events.some(
    (e) => e.step === 'undo_withdraw' || e.step === 'send_notification_failure'
  )

  const allLines = useMemo(() => {
    const lines = [...code.main]
    if (showCompensation || finalStatus === 'reversed' || finalStatus === 'failed') {
      lines.push(...code.compensation)
    }
    return lines
  }, [code, showCompensation, finalStatus])

  // Counted over the full snippet so the figure doesn't jump when compensation appears.
  const approxLineCount = useMemo(() => {
    const codeLines = [...code.main, ...code.compensation].filter((line) => !line.isBlank)
    return Math.round(codeLines.length / 10) * 10
  }, [code])

  return (
    <div className="h-full flex flex-col bg-(--slab)">
      {/* Header */}
      <div className="px-4 py-3 border-b border-(--line) flex items-center justify-between">
        <div>
          <h2 className="eyebrow">Workflow Code</h2>
          <p className="text-xs text-(--gray-300) mt-0.5">{code.label}</p>
        </div>
      </div>

      {/* Code */}
      <div className="flex-1 overflow-y-auto p-3 font-(family-name:--mono) text-[13px] leading-5">
        {allLines.map((line, i) => (
          <CodeLineRow
            key={i}
            line={line}
            lineNumber={i + 1}
            events={events}
            syntax={code.syntax}
          />
        ))}

        {/* Footer message */}
        <div className="mt-6 px-3 py-3 border-t border-(--line)">
          {events.length === 0 ? (
            <p className="text-xs text-(--gray-500) italic">
              Initiate a transfer to see the code light up as each activity runs
            </p>
          ) : (
            <div className="text-xs text-(--gray-400) space-y-1">
              <p>No message queues. No retry services. No dead letter queues.</p>
              <p className="text-(--mint) font-medium">
                ~{approxLineCount} lines of code. Retries, signals, and compensation — all built in.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CodeLineRow({
  line,
  lineNumber,
  events,
  syntax,
}: {
  line: CodeLine
  lineNumber: number
  events: TransferEvent[]
  syntax: Syntax
}) {
  const stepStatus = line.step ? getStepStatus(line.step, events) : null
  const bgClass = stepStatus ? STEP_BG[stepStatus] || '' : ''

  return (
    <div className={`flex min-h-[20px] transition-colors duration-300 ${bgClass}`}>
      <span className="w-8 flex-shrink-0 text-right pr-2 text-(--gray-500) select-none text-xs leading-5">
        {lineNumber}
      </span>
      <span className={`flex-1 ${line.isBlank ? '' : 'whitespace-pre'} text-(--indigo-100)`}>
        {line.isBlank ? '\u00A0' : tokenizeLine(line.text, syntax)}
      </span>
    </div>
  )
}
