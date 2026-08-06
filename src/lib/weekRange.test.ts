import { describe, expect, it } from 'vitest'
import { getCurrentWeekRange, getWeekdayName, isDateInCurrentWeek } from './weekRange'

const thursday = new Date(2026, 7, 6, 14, 30) // Thursday, August 6 2026
const sunday = new Date(2026, 7, 9, 9, 0) // Sunday, August 9 2026 (end of the same week)

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

describe('getCurrentWeekRange', () => {
  it('returns Monday 00:00:00 through Sunday 23:59:59.999 for a mid-week date', () => {
    const { start, end } = getCurrentWeekRange(thursday)
    expect(localDateString(start)).toBe('2026-08-03')
    expect(start.getHours()).toBe(0)
    expect(localDateString(end)).toBe('2026-08-09')
    expect(end.getHours()).toBe(23)
  })

  it('treats Sunday as the last day of its week, not the start of a new one', () => {
    const { start, end } = getCurrentWeekRange(sunday)
    expect(localDateString(start)).toBe('2026-08-03')
    expect(localDateString(end)).toBe('2026-08-09')
  })
})

describe('isDateInCurrentWeek', () => {
  it('is true for the Monday start boundary', () => {
    expect(isDateInCurrentWeek('2026-08-03', thursday)).toBe(true)
  })

  it('is true for the Sunday end boundary', () => {
    expect(isDateInCurrentWeek('2026-08-09', thursday)).toBe(true)
  })

  it('is false for the Saturday before this week', () => {
    expect(isDateInCurrentWeek('2026-08-02', thursday)).toBe(false)
  })

  it('is false for the Monday after this week', () => {
    expect(isDateInCurrentWeek('2026-08-10', thursday)).toBe(false)
  })

  it('is true (not hidden) when the date is empty, treating undated events as always current', () => {
    expect(isDateInCurrentWeek('', thursday)).toBe(true)
  })

  it('is true (not hidden) when the date string is invalid', () => {
    expect(isDateInCurrentWeek('not-a-date', thursday)).toBe(true)
  })

  it('recomputes from the real current date when no date is injected', () => {
    expect(isDateInCurrentWeek(localDateString(new Date()))).toBe(true)
  })
})

describe('getWeekdayName', () => {
  it('derives the correct weekday name from a date string', () => {
    expect(getWeekdayName('2026-08-03')).toBe('Monday')
    expect(getWeekdayName('2026-08-06')).toBe('Thursday')
    expect(getWeekdayName('2026-08-09')).toBe('Sunday')
  })

  it('returns an empty string for an empty or invalid date', () => {
    expect(getWeekdayName('')).toBe('')
    expect(getWeekdayName('not-a-date')).toBe('')
  })
})
