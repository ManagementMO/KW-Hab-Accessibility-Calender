import { describe, expect, it } from 'vitest'
import { suggestArrivalIcon } from './arrivalIcon'

describe('suggestArrivalIcon', () => {
  it('matches a door/entrance keyword', () => {
    expect(suggestArrivalIcon('Use the front door')).toBe('🚪')
  })

  it('matches a ramp/wheelchair keyword', () => {
    expect(suggestArrivalIcon('Ramp entrance on the side')).toBe('♿')
  })

  it('matches a bench/seat keyword', () => {
    expect(suggestArrivalIcon('See the quiet bench by the garden')).toBe('🪑')
  })

  it('is case-insensitive', () => {
    expect(suggestArrivalIcon('MEET STAFF AND SAY HELLO')).toBe('👋')
  })

  it('falls back to a default pin when nothing matches', () => {
    expect(suggestArrivalIcon('Walk to the picnic area')).not.toBe('')
    expect(suggestArrivalIcon('')).toBe('📍')
  })
})
