import { describe, expect, it } from 'vitest'
import { eventImageSrc } from './eventDisplay'

describe('eventImageSrc', () => {
  it('returns the image url when present', () => {
    expect(eventImageSrc('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
  })

  it('falls back to the placeholder when empty or blank', () => {
    expect(eventImageSrc('')).toBe('/event-placeholder.svg')
    expect(eventImageSrc('   ')).toBe('/event-placeholder.svg')
  })
})
