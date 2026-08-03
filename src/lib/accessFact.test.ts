import { describe, expect, it } from 'vitest'
import { accessSearchText, accessSuggestsStepFree, formatAccessFact } from './accessFact'

const confirmed = { status: 'confirmed' as const, owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: 'Ramp entrance' }
const notKnown = { status: 'not_known' as const, owner: 'KW Hab staff', lastConfirmed: '2026-07-01', note: '' }

describe('formatAccessFact', () => {
  it('leads with the note when present', () => {
    expect(formatAccessFact(confirmed)).toBe('Ramp entrance — confirmed by KW Hab staff, last confirmed 2026-07-10')
  })

  it('falls back to the status label when there is no note', () => {
    expect(formatAccessFact(notKnown)).toBe('Not known yet — not known yet by KW Hab staff, last confirmed 2026-07-01')
  })
})

describe('accessSearchText', () => {
  it('includes the note, status, and owner in lowercase', () => {
    expect(accessSearchText(confirmed)).toBe('ramp entrance confirmed kw hab staff')
  })
})

describe('accessSuggestsStepFree', () => {
  it('is true when the note mentions step or ramp', () => {
    expect(accessSuggestsStepFree(confirmed)).toBe(true)
  })

  it('is false otherwise', () => {
    expect(accessSuggestsStepFree(notKnown)).toBe(false)
  })
})
