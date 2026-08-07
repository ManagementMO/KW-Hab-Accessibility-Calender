import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createEvent, updateEvent, type ArrivalStep, type Event, type Journey } from '../../lib/api'
import { suggestArrivalIcon } from '../../lib/arrivalIcon'
import { CATEGORIES } from '../../lib/categories'

const emptyArrivalStep: ArrivalStep = { icon: '', title: '', detail: '', image: '' }
const emptyJourney: Journey = { route: '', leave: '', duration: '', steps: [''] }

const TIME_PATTERN = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i

function todayDateString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function createInitialForm() {
  return {
    title: 'Weekly Art Circle', category: 'Art', date: todayDateString(), time: '2:00 PM', place: 'Victoria Hills Community Centre',
    cost: 'Free', bus: 'Route 7 stops nearby', group: 'Small group', noise: 'Low noise', support: 'Staff support available on request',
    registration: 'Yes, just come' as Event['registration'], registrationUrl: '',
    image: '', reason: 'A relaxed, creative way to meet new people.', short: 'A relaxed art session open to all abilities.',
    plain: 'We will paint and create art together. Staff are on hand to help with anything you need.', host: 'Priya, Program Coordinator',
    accessStatus: 'reported' as 'confirmed' | 'reported' | 'not_known',
    accessOwner: 'KW Hab staff', accessLastConfirmed: todayDateString(), accessNote: 'Step-free entrance from the parking lot.',
    arrival: [{ ...emptyArrivalStep, title: 'Enter through the main doors', detail: 'The main entrance is flat and wheelchair accessible, right by the parking lot.' }] as ArrivalStep[],
    includeJourney: false,
    journey: { ...emptyJourney },
  }
}

type FormState = ReturnType<typeof createInitialForm>

function eventToForm(event: Event): FormState {
  return {
    title: event.title, category: event.category, date: event.date, time: event.time, place: event.place,
    cost: event.cost, bus: event.bus, group: event.group, noise: event.noise, support: event.support,
    registration: event.registration, registrationUrl: event.registrationUrl,
    image: event.image, reason: event.reason, short: event.short, plain: event.plain, host: event.host,
    accessStatus: event.access.status, accessOwner: event.access.owner, accessLastConfirmed: event.access.lastConfirmed, accessNote: event.access.note,
    arrival: event.arrival,
    includeJourney: Boolean(event.journey),
    journey: event.journey ?? { ...emptyJourney },
  }
}

export function EventForm({ event, onSaved }: { event?: Event; onSaved: (event: Event) => void }) {
  const isEditing = Boolean(event)
  const [form, setForm] = useState<FormState>(() => (event ? eventToForm(event) : createInitialForm()))
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))

  const updateArrivalStep = (index: number, key: 'title' | 'detail' | 'image', value: string) =>
    setForm((current) => ({ ...current, arrival: current.arrival.map((step, i) => (i === index ? { ...step, [key]: value } : step)) }))
  const addArrivalStep = () => setForm((current) => ({ ...current, arrival: [...current.arrival, { ...emptyArrivalStep }] }))
  const removeArrivalStep = (index: number) => setForm((current) => ({ ...current, arrival: current.arrival.filter((_, i) => i !== index) }))

  const updateJourneyField = (key: 'route' | 'leave' | 'duration', value: string) =>
    setForm((current) => ({ ...current, journey: { ...current.journey, [key]: value } }))
  const updateJourneyStep = (index: number, value: string) =>
    setForm((current) => ({ ...current, journey: { ...current.journey, steps: current.journey.steps.map((step, i) => (i === index ? value : step)) } }))
  const addJourneyStep = () => setForm((current) => ({ ...current, journey: { ...current.journey, steps: [...current.journey.steps, ''] } }))

  const validate = (): string[] => {
    const problems: string[] = []
    const required: [string, string][] = [
      ['title', form.title], ['category', form.category], ['date', form.date], ['time', form.time],
      ['place', form.place], ['cost', form.cost], ['plain', form.plain], ['host', form.host],
      ['access owner', form.accessOwner], ['access last confirmed', form.accessLastConfirmed],
    ]
    for (const [label, value] of required) if (!value.trim()) problems.push(`${label} is required`)
    if (form.time.trim() && !TIME_PATTERN.test(form.time.trim())) {
      problems.push('time must be a valid 12-hour time, e.g. "2:00 PM"')
    }
    if (form.registration === 'Sign up first' && !form.registrationUrl.trim()) {
      problems.push('registration link is required when registration is "Sign up first"')
    }
    if (form.arrival.some((step) => !step.title.trim() || !step.detail.trim())) {
      problems.push('every arrival step needs a title and detail')
    }
    return problems
  }

  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault()
    const problems = validate()
    setErrors(problems)
    setSuccess(false)
    if (problems.length) return
    setSubmitting(true)
    try {
      const payload = {
        title: form.title, category: form.category, date: form.date, time: form.time, place: form.place,
        cost: form.cost, bus: form.bus, group: form.group, noise: form.noise, support: form.support,
        registration: form.registration, registrationUrl: form.registration === 'Sign up first' ? form.registrationUrl : '',
        image: form.image, reason: form.reason, short: form.short, plain: form.plain, host: form.host,
        access: { status: form.accessStatus, owner: form.accessOwner, lastConfirmed: form.accessLastConfirmed, note: form.accessNote },
        arrival: form.arrival.map((step) => ({ ...step, icon: suggestArrivalIcon(step.title + ' ' + step.detail) })),
        journey: form.includeJourney ? form.journey : undefined,
      }
      const saved = isEditing && event ? await updateEvent(event.id, payload) : await createEvent(payload)
      if (!isEditing) setForm(createInitialForm())
      setSuccess(true)
      onSaved(saved)
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Could not save event'])
    } finally {
      setSubmitting(false)
    }
  }

  return <form className="event-form" onSubmit={submit}>
    <label>Event name<input value={form.title} onChange={(event) => update('title', event.target.value)} /></label>
    <label>Category
      <select value={form.category} onChange={(event) => update('category', event.target.value)}>
        <option value="" disabled>Choose a category</option>
        {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
        <option value="Other">Other</option>
      </select>
    </label>
    <label>Date<input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} /></label>
    <label>Time<input value={form.time} onChange={(event) => update('time', event.target.value)} placeholder="e.g. 2:00 PM" /></label>
    <label>Place<input value={form.place} onChange={(event) => update('place', event.target.value)} /></label>
    <label>Cost<input value={form.cost} onChange={(event) => update('cost', event.target.value)} /></label>
    <label>Bus (optional)<input value={form.bus} onChange={(event) => update('bus', event.target.value)} /></label>
    <label>Group (optional)<input value={form.group} onChange={(event) => update('group', event.target.value)} /></label>
    <label>Noise (optional)<input value={form.noise} onChange={(event) => update('noise', event.target.value)} /></label>
    <label>Support (optional)<input value={form.support} onChange={(event) => update('support', event.target.value)} /></label>
    <label>Registration
      <select value={form.registration} onChange={(event) => update('registration', event.target.value as Event['registration'])}>
        <option value="Yes, just come">Yes, just come</option>
        <option value="Sign up first">Sign up first</option>
      </select>
    </label>
    {form.registration === 'Sign up first' && <label>Registration link<input type="url" value={form.registrationUrl} onChange={(event) => update('registrationUrl', event.target.value)} placeholder="https://kwhab.ca/register" /></label>}
    <label>Image URL (optional)<input value={form.image} onChange={(event) => update('image', event.target.value)} /></label>
    <label>Recommendation reason (optional)<input value={form.reason} onChange={(event) => update('reason', event.target.value)} /></label>
    <label>Short description (optional)<input value={form.short} onChange={(event) => update('short', event.target.value)} /></label>
    <label>Plain-language description<textarea value={form.plain} onChange={(event) => update('plain', event.target.value)} /></label>
    <label>Host<input value={form.host} onChange={(event) => update('host', event.target.value)} placeholder="e.g. Jordan, LEG Up! Program Coordinator" /></label>

    <fieldset className="access-fields">
      <legend>Access facts</legend>
      <label>Status
        <select value={form.accessStatus} onChange={(event) => update('accessStatus', event.target.value as FormState['accessStatus'])}>
          <option value="confirmed">Confirmed</option>
          <option value="reported">Reported</option>
          <option value="not_known">Not known</option>
        </select>
      </label>
      <label>Owner<input value={form.accessOwner} onChange={(event) => update('accessOwner', event.target.value)} placeholder="e.g. KW Hab staff" /></label>
      <label>Last confirmed<input type="date" value={form.accessLastConfirmed} onChange={(event) => update('accessLastConfirmed', event.target.value)} /></label>
      <label>Note (optional)<input value={form.accessNote} onChange={(event) => update('accessNote', event.target.value)} placeholder="e.g. step-free path to entrance" /></label>
    </fieldset>

    <fieldset className="arrival-fields">
      <legend>Arrival steps</legend>
      {form.arrival.map((step, index) => <div className="arrival-step-fields" key={index}>
        <span className="arrival-icon-preview" aria-label={'Icon for this step: ' + suggestArrivalIcon(step.title + ' ' + step.detail)}>{suggestArrivalIcon(step.title + ' ' + step.detail)}</span>
        <label>Title<input value={step.title} onChange={(event) => updateArrivalStep(index, 'title', event.target.value)} /></label>
        <label>Detail<input value={step.detail} onChange={(event) => updateArrivalStep(index, 'detail', event.target.value)} /></label>
        <label>Image URL (optional)<input value={step.image} onChange={(event) => updateArrivalStep(index, 'image', event.target.value)} /></label>
        {form.arrival.length > 1 && <button type="button" onClick={() => removeArrivalStep(index)} aria-label={'Remove step ' + (index + 1)}><Trash2 size={16} /></button>}
      </div>)}
      <button type="button" onClick={addArrivalStep}><Plus size={16} />Add arrival step</button>
    </fieldset>

    <fieldset className="journey-fields">
      <legend>
        <label><input type="checkbox" checked={form.includeJourney} onChange={(event) => update('includeJourney', event.target.checked)} />Include transit journey</label>
      </legend>
      {form.includeJourney && <>
        <label>Route<input value={form.journey.route} onChange={(event) => updateJourneyField('route', event.target.value)} /></label>
        <label>Leave time<input value={form.journey.leave} onChange={(event) => updateJourneyField('leave', event.target.value)} /></label>
        <label>Duration<input value={form.journey.duration} onChange={(event) => updateJourneyField('duration', event.target.value)} /></label>
        {form.journey.steps.map((step, index) => <label key={index}>Step {index + 1}<input value={step} onChange={(event) => updateJourneyStep(index, event.target.value)} /></label>)}
        <button type="button" onClick={addJourneyStep}><Plus size={16} />Add journey step</button>
      </>}
    </fieldset>

    {errors.length > 0 && <div role="alert" className="form-error"><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
    {success && <p role="status" className="form-success">{isEditing ? 'Event updated.' : 'Event created and visible to participants.'}</p>}
    <button type="submit" disabled={submitting}>{submitting ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save changes' : 'Create event')}</button>
  </form>
}
