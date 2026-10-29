import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { workflowSnippets } from '../data/workflowCode'
import { PaneCollapseButton } from '../kit'
import { stepState } from '../transferSteps'
import type { CodeLanguage, TransferEvent } from '../types'

interface TemporalCodeViewProps {
  events: TransferEvent[]
  language: CodeLanguage
  onLanguageChange: (language: CodeLanguage) => void
}

const LANGUAGES = Object.keys(workflowSnippets) as CodeLanguage[]

interface Syntax {
  comment: string
  keywords: Set<string>
  constants: Set<string>
  builtins: Set<string>
  methods: Set<string>
  domain: Set<string>
}

const SYNTAX: Record<CodeLanguage, Syntax> = {
  python: {
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
  go: {
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
  typescript: {
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
  java: {
    comment: '//',
    keywords: new Set([
      'public', 'class', 'implements', 'void', 'new', 'try', 'catch', 'for',
    ]),
    constants: new Set(['true', 'false', 'null', 'this']),
    builtins: new Set([
      'Workflow', 'ActivityOptions', 'RetryOptions', 'Duration', 'ActivityFailure',
      'Activities', 'List', 'ArrayList', 'Consumer', 'Collections', 'Transfer',
    ]),
    methods: new Set([
      'newActivityStub', 'newBuilder', 'setRetryOptions', 'setMaximumAttempts',
      'setBackoffCoefficient', 'build', 'await', 'ofSeconds', 'add', 'reverse', 'accept',
    ]),
    domain: new Set([
      'validate', 'withdraw', 'deposit', 'sendNotification', 'undoWithdraw',
      'compensations', 'transfer', 'comp', 'activities',
    ]),
  },
  dotnet: {
    comment: '//',
    keywords: new Set([
      'public', 'class', 'async', 'await', 'var', 'new', 'try', 'catch', 'foreach', 'in',
    ]),
    constants: new Set(['true', 'false', 'null', 'this']),
    builtins: new Set([
      'Workflow', 'WorkflowRun', 'Task', 'List', 'Func', 'TimeSpan',
      'ActivityFailureException', 'Activities', 'Transfer',
    ]),
    methods: new Set([
      'ExecuteActivityAsync', 'WaitConditionAsync', 'FromSeconds', 'Add', 'Reverse',
      'RetryPolicy', 'MaximumAttempts', 'BackoffCoefficient',
    ]),
    domain: new Set([
      'ValidateAsync', 'WithdrawAsync', 'DepositAsync', 'SendNotificationAsync',
      'UndoWithdrawAsync', 'compensations', 'transfer', 'comp',
    ]),
  },
  ruby: {
    comment: '#',
    keywords: new Set(['class', 'def', 'begin', 'rescue', 'do', 'end']),
    constants: new Set(['true', 'false', 'nil', 'self']),
    builtins: new Set(['Temporalio', 'Workflow', 'Definition', 'RetryPolicy', 'StandardError']),
    methods: new Set(['execute_activity', 'wait_condition', 'new', 'reverse_each']),
    domain: new Set([
      'Validate', 'Withdraw', 'Deposit', 'SendNotification', 'UndoWithdraw',
      'compensations', 'transfer', 'comp',
    ]),
  },
  php: {
    comment: '//',
    keywords: new Set(['class', 'public', 'function', 'new', 'try', 'catch', 'yield', 'fn']),
    constants: new Set(['true', 'false', 'null', 'this']),
    builtins: new Set([
      'Workflow', 'Saga', 'ActivityOptions', 'RetryOptions', 'AccountActivities',
      'Transfer', 'Throwable',
    ]),
    methods: new Set([
      'newActivityStub', 'withRetryOptions', 'withMaximumAttempts', 'withBackoffCoefficient',
      'awaitWithTimeout', 'addCompensation', 'compensate',
    ]),
    domain: new Set([
      'validate', 'withdraw', 'deposit', 'sendNotification', 'undoWithdraw',
      'saga', 'transfer', 'accounts',
    ]),
  },
  rust: {
    comment: '//',
    keywords: new Set([
      'impl', 'pub', 'async', 'fn', 'let', 'mut', 'for', 'in', 'if', 'await', 'Self',
    ]),
    constants: new Set(['true', 'false', 'Ok', 'Err']),
    builtins: new Set([
      'WorkflowContext', 'WorkflowResult', 'Result', 'ActivityExecutionError', 'Vec',
      'ActivityOptions', 'RetryPolicy', 'Duration', 'Activities',
    ]),
    methods: new Set([
      'start_activity', 'wait_condition', 'timer', 'state', 'select', 'push', 'clone',
      'with_start_to_close_timeout', 'start_to_close_timeout', 'retry_policy', 'builder',
      'maximum_attempts', 'backoff_coefficient', 'build', 'from_secs', 'into_iter', 'rev',
      'ok', 'is_err',
    ]),
    domain: new Set([
      'validate', 'withdraw', 'deposit', 'send_notification', 'send_failure_notification',
      'undo_withdraw', 'compensations', 'transfer', 'comp',
    ]),
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
        <span key={key++} className="c">
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
        <span key={key++} className="s">
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
        <span key={key++} className="k">
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
        <span key={key++} className="t">
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

      // Token classes are the kit's code palette: keyword, function, type/literal.
      let tokenClass: string | undefined
      if (syntax.keywords.has(word)) tokenClass = 'k'
      else if (syntax.constants.has(word) || syntax.builtins.has(word)) tokenClass = 't'
      else if (syntax.methods.has(word) || syntax.domain.has(word)) tokenClass = 'f'
      parts.push(
        <span key={key++} className={tokenClass}>
          {word}
        </span>
      )
      i = end
      continue
    }

    // Default: whitespace, operators and punctuation
    parts.push(text[i])
    i++
  }

  return parts
}

export function TemporalCodeView({ events, language, onLanguageChange }: TemporalCodeViewProps) {
  const code = workflowSnippets[language]
  const approxLineCount = Math.round(code.lines.filter((line) => !line.isBlank).length / 10) * 10
  const preRef = useRef<HTMLPreElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // The step that moved most recently is the one the Workflow is on.
  const current = events.at(-1)
  const currentStep = current?.step
  const currentStatus = currentStep ? stepState(currentStep, events).status : undefined

  useEffect(() => {
    preRef.current?.querySelector('.ln.hl')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [currentStep, currentStatus, language])

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const i = LANGUAGES.indexOf(language)
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: LANGUAGES.length - 1 }[event.key]
    if (to === undefined) return
    event.preventDefault()
    const j = (to + LANGUAGES.length) % LANGUAGES.length
    onLanguageChange(LANGUAGES[j])
    tabRefs.current[j]?.focus()
  }

  return (
    <div className="h-full flex flex-col">
      <div className="card-head pane-head">
        <div>
          <p className="eyebrow">{code.label} · simplified excerpt</p>
          <h2 className="heading">Workflow code</h2>
        </div>
        <PaneCollapseButton />
      </div>

      <pre
        ref={preRef}
        className="codeview"
        id="workflow-code"
        role="tabpanel"
        tabIndex={0}
        aria-label={`Money transfer Workflow, ${code.label}`}
      >
        {code.lines.map((line, i) => {
          const lit = currentStep !== undefined && line.step === currentStep
          return (
            <span key={i} className={lit ? 'ln hl' : 'ln'} data-status={lit ? currentStatus : undefined}>
              {line.isBlank ? '' : tokenizeLine(line.text, SYNTAX[language])}
            </span>
          )
        })}
      </pre>

      <div className="px-4 py-2 border-t border-border">
        {events.length === 0 ? (
          <p className="muted">Start a transfer to see the code light up as each Activity runs.</p>
        ) : (
          <p className="muted">
            No message queues, retry services or dead letter queues.{' '}
            <span className="text-t-green">
              ~{approxLineCount} lines of code, with retries, Signals and compensation built in.
            </span>
          </p>
        )}
      </div>

      <div className="code-tabs" role="tablist" aria-label="SDK language" onKeyDown={onTabKey}>
        {LANGUAGES.map((value, i) => (
          <button
            key={value}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={value === language}
            aria-controls="workflow-code"
            tabIndex={value === language ? 0 : -1}
            onClick={() => onLanguageChange(value)}
          >
            {workflowSnippets[value].label}
          </button>
        ))}
      </div>
    </div>
  )
}
