import { afterEach, describe, expect, it } from 'vitest'
import { loadLanguage, loadMode, loadPecs, loadSaved, storeLanguage, storeMode, storePecs, storeSaved } from './localStore'

afterEach(() => { localStorage.clear() })

describe('localStore', () => {
  it('defaults saved to an empty list', () => {
    expect(loadSaved()).toEqual([])
  })

  it('round-trips saved event ids', () => {
    storeSaved(['abc-123', 'def-456'])
    expect(loadSaved()).toEqual(['abc-123', 'def-456'])
  })

  it('defaults reading mode to easy', () => {
    expect(loadMode()).toBe('easy')
  })

  it('round-trips reading mode', () => {
    storeMode('audio')
    expect(loadMode()).toBe('audio')
  })

  it('defaults pecs to false', () => {
    expect(loadPecs()).toBe(false)
  })

  it('round-trips pecs', () => {
    storePecs(true)
    expect(loadPecs()).toBe(true)
  })

  it('defaults language to en-CA', () => {
    expect(loadLanguage()).toBe('en-CA')
  })

  it('round-trips language', () => {
    storeLanguage('fr-CA')
    expect(loadLanguage()).toBe('fr-CA')
  })
})
