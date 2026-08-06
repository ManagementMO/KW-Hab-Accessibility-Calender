export function getCurrentWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const dayOfWeek = now.getDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function isDateInCurrentWeek(dateStr: string, now: Date = new Date()): boolean {
  if (!dateStr.trim()) return true
  const eventDate = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(eventDate.getTime())) return true
  const { start, end } = getCurrentWeekRange(now)
  return eventDate >= start && eventDate <= end
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function getWeekdayName(dateStr: string): string {
  if (!dateStr.trim()) return ''
  const date = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return ''
  return WEEKDAY_NAMES[date.getDay()]
}
