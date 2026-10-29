import { useEffect, useState } from 'react'
import type { CodeLanguage } from '../types'

const STORAGE_KEY = 'banking-demo:code-language'

function loadLanguage(): CodeLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'python' || saved === 'go') return saved
  } catch {
    // Storage unavailable — fall back to the default.
  }
  return 'python'
}

/**
 * Language shown in the workflow code pane. Display-only, so it lives in the
 * browser rather than in the backend demo settings.
 */
export function useCodeLanguage() {
  const [language, setLanguage] = useState<CodeLanguage>(loadLanguage)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language)
    } catch {
      // Persisting is a convenience only.
    }
  }, [language])

  return [language, setLanguage] as const
}
