import type { AccessFact } from './api'

const STATUS_LABEL: Record<AccessFact['status'], string> = {
  confirmed: 'Confirmed',
  reported: 'Reported',
  not_known: 'Not known yet',
}

export function formatAccessFact(access: AccessFact): string {
  const lead = access.note.trim() ? access.note : STATUS_LABEL[access.status]
  return `${lead} — ${STATUS_LABEL[access.status].toLowerCase()} by ${access.owner}, last confirmed ${access.lastConfirmed}`
}

export function accessSearchText(access: AccessFact): string {
  return `${access.note} ${access.status} ${access.owner}`.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function accessSuggestsStepFree(access: AccessFact): boolean {
  const text = accessSearchText(access)
  const NEGATION = /\b(no|not|without|non|isn't|aren't|lacking)\b/
  const targetPattern = /\b(step|ramp)\w*/g
  let match: RegExpExecArray | null
  let foundAffirmative = false
  while ((match = targetPattern.exec(text))) {
    const windowStart = Math.max(0, match.index - 20)
    const windowEnd = Math.min(text.length, match.index + match[0].length + 20)
    const window = text.slice(windowStart, windowEnd)
    if (!NEGATION.test(window)) foundAffirmative = true
  }
  return foundAffirmative
}
