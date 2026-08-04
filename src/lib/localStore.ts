import type { ReadingMode } from '../components/accessibility/AccessibilityBar'
import type { Language } from '../components/accessibility/ListenButton'

const KEYS = {
  saved: 'belonging-loop.saved',
  mode: 'belonging-loop.mode',
  pecs: 'belonging-loop.pecs',
  language: 'belonging-loop.language',
} as const

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadSaved(): string[] { return readJson(KEYS.saved, []) }
export function storeSaved(saved: string[]) { writeJson(KEYS.saved, saved) }

export function loadMode(): ReadingMode { return readJson(KEYS.mode, 'easy') }
export function storeMode(mode: ReadingMode) { writeJson(KEYS.mode, mode) }

export function loadPecs(): boolean { return readJson(KEYS.pecs, false) }
export function storePecs(pecs: boolean) { writeJson(KEYS.pecs, pecs) }

export function loadLanguage(): Language { return readJson(KEYS.language, 'en-CA') }
export function storeLanguage(language: Language) { writeJson(KEYS.language, language) }
