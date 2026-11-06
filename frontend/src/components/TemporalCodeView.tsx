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

const ACTIVITY_NAMES = [
  'validate', 'withdraw', 'deposit', 'sendNotification', 'undoWithdraw', 'registerApproval',
  'removeApproval', 'send_notification', 'undo_withdraw', 'register_approval', 'remove_approval',
  'Validate', 'Withdraw', 'Deposit', 'SendNotification', 'UndoWithdraw', 'RegisterApproval',
  'RemoveApproval', 'ValidateAsync', 'WithdrawAsync', 'DepositAsync', 'SendNotificationAsync',
  'UndoWithdrawAsync', 'RegisterApprovalAsync', 'RemoveApprovalAsync',
]

const SYNTAX: Record<CodeLanguage, Syntax> = {
  python: {
    comment: '#',
    keywords: new Set([
      'class', 'async', 'def', 'await', 'try', 'except', 'as', 'if', 'return', 'lambda', 'raise',
    ]),
    constants: new Set(['True', 'False', 'None', 'self']),
    builtins: new Set([
      'workflow', 'AccountTransferActivities', 'ApplicationError', 'RuntimeError', 'Exception',
      'TransferInput', 'TransferOutput', 'DepositResponse', 'timedelta', 'asyncio', 'TimeoutError',
      'Sequence', 'RawValue', 'Any',
    ]),
    methods: new Set([
      'execute_activity', 'wait_condition', 'defn', 'run', 'uuid4', 'payload_converter', 'info',
      'from_payload',
    ]),
    domain: new Set([...ACTIVITY_NAMES, 'updateProgress', 'updateProgressStatus']),
  },
  go: {
    comment: '//',
    keywords: new Set(['func', 'var', 'if', 'return', 'bool', 'error', 'panic']),
    constants: new Set(['nil', 'true', 'false']),
    builtins: new Set([
      'workflow', 'temporal', 'time', 'Context', 'RetryPolicy', 'ActivityOptions', 'Activities',
      'Input', 'Output', 'DepositResponse',
    ]),
    methods: new Set([
      'ExecuteActivity', 'WithActivityOptions', 'AwaitWithTimeout', 'Get', 'GetInfo', 'Sprintf',
      'NewNonRetryableApplicationError',
    ]),
    domain: new Set([...ACTIVITY_NAMES, 'AccountTransfer']),
  },
  typescript: {
    comment: '//',
    keywords: new Set([
      'export', 'default', 'async', 'function', 'const', 'await', 'try', 'catch', 'if', 'throw',
      'return', 'new', 'typeof', 'instanceof',
    ]),
    constants: new Set(['true', 'false', 'null', 'undefined']),
    builtins: new Set([
      'Promise', 'ApplicationFailure', 'ActivityFailure', 'Error', 'ReturnType', 'TransferInput',
      'TransferOutput',
    ]),
    methods: new Set([
      'proxyActivities', 'condition', 'nonRetryable', 'workflowInfo', 'uuid4', 'createActivities',
    ]),
    domain: new Set([...ACTIVITY_NAMES, 'accountTransfer', 'updateProgress']),
  },
  java: {
    comment: '//',
    keywords: new Set([
      'public', 'private', 'final', 'class', 'implements', 'new', 'try', 'catch', 'if', 'throw',
      'return',
    ]),
    constants: new Set(['true', 'false', 'null', 'this']),
    builtins: new Set([
      'Workflow', 'ActivityOptions', 'RetryOptions', 'Duration', 'ActivityFailure',
      'ApplicationFailure', 'DynamicWorkflow', 'EncodedValues', 'IllegalStateException', 'Object',
      'String', 'TransferActivities', 'TransferInput', 'TransferOutput', 'TransferMessages',
    ]),
    methods: new Set([
      'newActivityStub', 'newBuilder', 'setStartToCloseTimeout', 'setRetryOptions',
      'setInitialInterval', 'setBackoffCoefficient', 'setMaximumInterval', 'build', 'await',
      'ofSeconds', 'randomUUID', 'getInfo', 'newNonRetryableFailure',
    ]),
    domain: new Set([...ACTIVITY_NAMES, 'activities', 'updateProgress', 'execute']),
  },
  dotnet: {
    comment: '//',
    keywords: new Set([
      'public', 'private', 'static', 'readonly', 'class', 'async', 'await', 'var', 'new', 'try',
      'catch', 'if', 'throw', 'return',
    ]),
    constants: new Set(['true', 'false', 'null', 'this']),
    builtins: new Set([
      'Workflow', 'WorkflowRun', 'Task', 'TimeSpan', 'ActivityOptions', 'ActivityFailureException',
      'ApplicationFailureException', 'InvalidOperationException', 'IRawValue', 'TransferActivities',
      'TransferInput', 'TransferOutput',
    ]),
    methods: new Set([
      'ExecuteActivityAsync', 'WaitConditionAsync', 'FromSeconds', 'NewGuid', 'ToValue',
      'StartToCloseTimeout', 'RetryPolicy', 'InitialInterval', 'BackoffCoefficient',
      'MaximumInterval',
    ]),
    domain: new Set([...ACTIVITY_NAMES, 'RunAsync', 'UpdateProgressAsync']),
  },
  ruby: {
    comment: '#',
    keywords: new Set(['class', 'def', 'begin', 'rescue', 'if', 'raise', 'end']),
    constants: new Set(['true', 'false', 'nil', 'self']),
    builtins: new Set([
      'Temporalio', 'Workflow', 'Definition', 'RetryPolicy', 'Activities', 'ApplicationError',
      'Timeout', 'Error', 'ActivityError',
    ]),
    methods: new Set([
      'execute_activity', 'wait_condition', 'timeout', 'workflow_dynamic', 'workflow_raw_args',
      'new', 'merge', 'payload_converter', 'from_payload', 'uuid',
    ]),
    domain: new Set([...ACTIVITY_NAMES, 'execute', 'update_progress']),
  },
  php: {
    comment: '//',
    keywords: new Set([
      'class', 'public', 'function', 'new', 'try', 'catch', 'yield', 'from', 'fn', 'if', 'throw',
      'return', 'array', 'self', 'abstract', 'extends', 'protected',
    ]),
    constants: new Set(['true', 'false', 'null', 'this']),
    builtins: new Set([
      'Workflow', 'ActivityOptions', 'RetryOptions', 'TransferActivities', 'ActivityFailure',
      'ApplicationFailure', 'Error',
    ]),
    methods: new Set([
      'newActivityStub', 'withStartToCloseTimeout', 'withRetryOptions', 'withInitialInterval',
      'withBackoffCoefficient', 'withMaximumInterval', 'awaitWithTimeout', 'getInfo', 'uuid', 'sprintf',
    ]),
    domain: new Set([...ACTIVITY_NAMES, 'run', 'transfer', 'updateProgress', 'activities']),
  },
  rust: {
    comment: '//',
    keywords: new Set([
      'async', 'fn', 'let', 'match', 'if', 'return', 'await', 'mut', 'panic', 'select',
    ]),
    constants: new Set(['true', 'false', 'Ok', 'Err']),
    builtins: new Set([
      'WorkflowContext', 'WorkflowResult', 'ActivityOptions', 'RetryPolicy', 'Duration',
      'temporalio_sdk', 'workflows', 'TransferActivities', 'ApplicationFailure', 'TransferInput', 'TransferOutput', 'Transfer',
    ]),
    methods: new Set([
      'execute_activity', 'wait_condition', 'timer', 'uuid4', 'with_start_to_close_timeout',
      'retry_policy', 'builder', 'initial_interval', 'backoff_coefficient', 'maximum_interval',
      'build', 'from_secs', 'type_name', 'non_retryable', 'into', 'clone',
    ]),
    domain: new Set([...ACTIVITY_NAMES, 'account_transfer', 'activity_options', 'update_progress']),
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

  // The step that moved most recently is the one the Workflow is on, except that
  // a wait stays lit until it clears, whatever else reports in meanwhile.
  const waiting = stepState('approval_wait', events).status === 'waiting'
  const currentStep = waiting ? 'approval_wait' : events.at(-1)?.step
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
