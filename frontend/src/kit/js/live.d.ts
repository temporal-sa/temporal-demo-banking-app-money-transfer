export interface LiveState {
  state: 'idle' | 'live' | 'stale'
  ageMs: number
  failures: number
}

export interface LivePoll {
  refresh: () => void
  readonly failures: number
  stop: () => void
}

declare global {
  interface Window {
    Live: {
      poll: <T>(options: {
        url?: string
        load?: (signal: AbortSignal) => Promise<T>
        interval?: number
        onData?: (data: T) => void
        onState?: (state: LiveState) => void
        onError?: (error: unknown) => void
        immediate?: boolean
        pauseWhenHidden?: boolean
      }) => LivePoll
      freshness: (el: HTMLElement | null) => (state: LiveState) => void
    }
  }
}
