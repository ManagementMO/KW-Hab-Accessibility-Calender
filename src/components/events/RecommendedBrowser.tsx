import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { accessSearchText, accessSuggestsStepFree, formatAccessFact } from '../../lib/accessFact'
import { Event } from '../../lib/api'
import { eventImageSrc } from '../../lib/eventDisplay'
import { Language } from '../accessibility/ListenButton'
import { ReadingMode } from '../accessibility/AccessibilityBar'
import { EmptyState } from '../features/EmptyState'

const filters = ['Today', 'Free', '♿ Wheelchair', '🔇 Quiet', '🚌 Bus', 'Near Me', 'Art', 'Youth', 'Adults']

export function RecommendedBrowser({ events, onOpen, mode, pecs, language, slow }: {
  events: Event[]; onOpen: (event: Event) => void; mode: ReadingMode; pecs: boolean; language: Language; slow: boolean
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string[]>([])
  const displayed = useMemo(() => events.filter((event) =>
    `${event.title} ${event.category} ${event.cost} ${event.noise} ${event.bus} ${accessSearchText(event.access)}`.toLowerCase().includes(query.toLowerCase())
    && active.every((filter) => filter === 'Free' ? event.cost === 'Free'
      : filter.includes('Quiet') ? event.noise.toLowerCase().includes('quiet')
      : filter.includes('Wheelchair') ? accessSuggestsStepFree(event.access)
      : filter === 'Art' ? event.category === 'Art'
      : true)
  ), [active, query, events])

  if (events.length === 0) return <section className="screen recommended-screen"><EmptyState mode={mode} pecs={pecs} language={language} slow={slow} /></section>

  return <section className="screen recommended-screen">
    <p className="eyebrow">A FEW GOOD MATCHES</p><h1>Recommended for you</h1>
    <label className="search-bar"><Search size={22} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What would you like to do?" aria-label="Search events" /></label>
    <div className="filter-row">{filters.map((filter) => <button key={filter} className={active.includes(filter) ? 'active' : ''} onClick={() => setActive((all) => all.includes(filter) ? all.filter((item) => item !== filter) : [...all, filter])} aria-pressed={active.includes(filter)}>{filter}</button>)}</div>
    <p><strong>{displayed.length} events.</strong></p>
    {displayed.length ? <div className="event-grid">{displayed.map((event) => <article className="event-card" key={event.id}><img src={eventImageSrc(event.image)} alt={event.title} /><div className="event-card-body"><h2>{event.title}</h2><p>{event.day} · {event.place}</p><p>♿ {formatAccessFact(event.access)}</p><button className="open-event" onClick={() => onOpen(event)}>See event</button></div></article>)}</div>
      : <div className="empty-week"><h2>No events match</h2><p>Try removing a filter.</p></div>}
  </section>
}
