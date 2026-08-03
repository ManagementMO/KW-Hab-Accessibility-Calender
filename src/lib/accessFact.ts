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
  return text.includes('step') || text.includes('ramp')
}
