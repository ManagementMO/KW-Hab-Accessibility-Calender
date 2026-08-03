import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createEvent, type ArrivalStep, type Event, type Journey } from '../../lib/api'

const emptyArrivalStep: ArrivalStep = { icon: '', title: '', detail: '', image: '' }
const emptyJourney: Journey = { route: '', leave: '', duration: '', steps: [''] }

const initialForm = {
  title: '', category: '', day: '', time: '', place: '', cost: '', bus: '',
  group: '', noise: '', support: '', registration: 'Yes, just come' as Event['registration'],
  image: '', reason: '', short: '', plain: '',
  accessStatus: 'reported' as 'confirmed' | 'reported' | 'not_known',
  accessOwner: '', accessLastConfirmed: '', accessNote: '',
  arrival: [{ ...emptyArrivalStep }] as ArrivalStep[],
  includeJourney: false,
  journey: { ...emptyJourney },
}

type FormState = typeof initialForm

export function EventForm({ onCreated }: { onCreated: (event: Event) => void }) {
  const [form, setForm] = useState<FormState>(initialForm)
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))

  const updateArrivalStep = (index: number, key: keyof ArrivalStep, value: string) =>
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
      ['title', form.title], ['category', form.category], ['day', form.day], ['time', form.time],
      ['place', form.place], ['cost', form.cost], ['bus', form.bus], ['group', form.group],
      ['noise', form.noise], ['support', form.support], ['image', form.image],
      ['reason', form.reason], ['short', form.short], ['plain', form.plain],
      ['access owner', form.accessOwner], ['access last confirmed', form.accessLastConfirmed],
    ]
    for (const [label, value] of required) if (!value.trim()) problems.push(`${label} is required`)
    if (form.arrival.some((step) => !step.icon.trim() || !step.title.trim() || !step.detail.trim() || !step.image.trim())) {
      problems.push('every arrival step needs an icon, title, detail, and image')
    }
    return problems
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const problems = validate()
    setErrors(problems)
    setSuccess(false)
    if (problems.length) return
    setSubmitting(true)
    try {
      const created = await createEvent({
        title: form.title, category: form.category, day: form.day, time: form.time, place: form.place,
        cost: form.cost, bus: form.bus, group: form.group, noise: form.noise, support: form.support,
        registration: form.registration, image: form.image, reason: form.reason, short: form.short, plain: form.plain,
        access: { status: form.accessStatus, owner: form.accessOwner, lastConfirmed: form.accessLastConfirmed, note: form.accessNote },
        arrival: form.arrival,
        journey: form.includeJourney ? form.journey : undefined,
      })
      setForm(initialForm)
      setSuccess(true)
      onCreated(created)
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Could not create event'])
    } finally {
      setSubmitting(false)
    }
  }

  return <form className="event-form" onSubmit={submit}>
    <label>Event name<input value={form.title} onChange={(event) => update('title', event.target.value)} /></label>
    <label>Category<input value={form.category} onChange={(event) => update('category', event.target.value)} /></label>
    <label>Day<input value={form.day} onChange={(event) => update('day', event.target.value)} /></label>
    <label>Time<input value={form.time} onChange={(event) => update('time', event.target.value)} /></label>
    <label>Place<input value={form.place} onChange={(event) => update('place', event.target.value)} /></label>
    <label>Cost<input value={form.cost} onChange={(event) => update('cost', event.target.value)} /></label>
    <label>Bus<input value={form.bus} onChange={(event) => update('bus', event.target.value)} /></label>
    <label>Group<input value={form.group} onChange={(event) => update('group', event.target.value)} /></label>
    <label>Noise<input value={form.noise} onChange={(event) => update('noise', event.target.value)} /></label>
    <label>Support<input value={form.support} onChange={(event) => update('support', event.target.value)} /></label>
    <label>Registration
      <select value={form.registration} onChange={(event) => update('registration', event.target.value as Event['registration'])}>
        <option value="Yes, just come">Yes, just come</option>
        <option value="Sign up first">Sign up first</option>
      </select>
    </label>
    <label>Image URL<input value={form.image} onChange={(event) => update('image', event.target.value)} /></label>
    <label>Recommendation reason<input value={form.reason} onChange={(event) => update('reason', event.target.value)} /></label>
    <label>Short description<input value={form.short} onChange={(event) => update('short', event.target.value)} /></label>
    <label>Plain-language description<textarea value={form.plain} onChange={(event) => update('plain', event.target.value)} /></label>

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
        <label>Icon<input value={step.icon} onChange={(event) => updateArrivalStep(index, 'icon', event.target.value)} /></label>
        <label>Title<input value={step.title} onChange={(event) => updateArrivalStep(index, 'title', event.target.value)} /></label>
        <label>Detail<input value={step.detail} onChange={(event) => updateArrivalStep(index, 'detail', event.target.value)} /></label>
        <label>Image URL<input value={step.image} onChange={(event) => updateArrivalStep(index, 'image', event.target.value)} /></label>
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
    {success && <p role="status" className="form-success">Event created and visible to participants.</p>}
    <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create event'}</button>
  </form>
}
