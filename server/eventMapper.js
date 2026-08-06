const REQUIRED_FIELDS = ['title', 'category', 'time', 'place', 'cost', 'registration', 'plain', 'date', 'host']
const OPTIONAL_TEXT_FIELDS = ['bus', 'group', 'noise', 'support', 'image', 'reason', 'short']
const ACCESS_STATUSES = ['confirmed', 'reported', 'not_known']

export function rowToEvent(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    date: row.date,
    time: row.time,
    place: row.place,
    cost: row.cost,
    bus: row.bus,
    group: row.group_label,
    noise: row.noise,
    access: {
      status: row.access_status,
      owner: row.access_owner,
      lastConfirmed: row.access_last_confirmed,
      note: row.access_note,
    },
    support: row.support,
    registration: row.registration,
    registrationUrl: row.registration_url,
    image: row.image,
    reason: row.reason,
    short: row.short,
    plain: row.plain,
    host: row.host,
    arrival: JSON.parse(row.arrival),
    journey: row.journey ? JSON.parse(row.journey) : undefined,
    createdBy: row.created_by,
  }
}

export function eventInputToRow(input, id, createdAt, createdBy) {
  return {
    id,
    title: input.title,
    category: input.category,
    date: input.date,
    time: input.time,
    place: input.place,
    cost: input.cost,
    bus: input.bus || '',
    group_label: input.group || '',
    noise: input.noise || '',
    access_status: input.access.status,
    access_owner: input.access.owner,
    access_last_confirmed: input.access.lastConfirmed,
    access_note: input.access.note || '',
    support: input.support || '',
    registration: input.registration,
    registration_url: input.registrationUrl || '',
    image: input.image || '',
    reason: input.reason || '',
    short: input.short || '',
    plain: input.plain,
    host: input.host,
    arrival: JSON.stringify(input.arrival),
    journey: input.journey ? JSON.stringify(input.journey) : null,
    created_at: createdAt,
    created_by: createdBy,
  }
}

export function validateEventInput(input) {
  const errors = []
  for (const field of REQUIRED_FIELDS) {
    const value = input[field]
    if (typeof value !== 'string' || !value.trim()) errors.push(`${field} is required`)
  }
  for (const field of OPTIONAL_TEXT_FIELDS) {
    const value = input[field]
    if (value !== undefined && value !== null && typeof value !== 'string') errors.push(`${field} must be text`)
  }
  if (input.registration === 'Sign up first' && (!input.registrationUrl || !input.registrationUrl.trim())) {
    errors.push('registrationUrl is required when registration is "Sign up first"')
  }
  if (typeof input.date === 'string' && input.date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(input.date.trim())) {
    errors.push('date must be in YYYY-MM-DD format')
  }
  if (!input.access || typeof input.access !== 'object') {
    errors.push('access is required')
  } else {
    if (!ACCESS_STATUSES.includes(input.access.status)) errors.push('access.status must be confirmed, reported, or not_known')
    if (!input.access.owner || !input.access.owner.trim()) errors.push('access.owner is required')
    if (!input.access.lastConfirmed || !input.access.lastConfirmed.trim()) errors.push('access.lastConfirmed is required')
  }
  if (!Array.isArray(input.arrival) || input.arrival.length === 0) {
    errors.push('at least one arrival step is required')
  } else if (input.arrival.some((step) => !step.title || !step.detail)) {
    errors.push('each arrival step needs a title and detail')
  }
  return errors
}
