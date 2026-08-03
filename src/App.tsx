import { useEffect, useMemo, useState } from 'react'
import {
  Accessibility, ArrowLeft, Bell, Bus, CalendarDays, Check, ChevronRight,
  CircleHelp, Clock3, Ear, Heart, Home, Image, MapPin, MessageCircle, Mic,
  Paintbrush, Phone, Printer, Settings2, ShieldCheck,
  Sparkles, Star, Volume2, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Event, getEvents, getSession, logout as apiLogout } from './lib/api'
import { formatAccessFact } from './lib/accessFact'
import { loadLanguage, loadMode, loadPecs, loadSaved, storeLanguage, storeMode, storePecs, storeSaved } from './lib/localStore'
import { AccessibilityBar, ColorModePicker, ColorMode, ReadingMode } from './components/accessibility/AccessibilityBar'
import { Language, ListenButton } from './components/accessibility/ListenButton'
import { Onboarding } from './components/features/Onboarding'
import { HostProfile } from './components/host/HostProfile'
import { EventCommunity } from './components/community/EventCommunity'
import { ReminderModal } from './components/features/ReminderModal'
import { RecommendedBrowser } from './components/events/RecommendedBrowser'
import { AboutKWHab } from './components/features/AboutKWHab'
import { StaffOperations } from './components/host/StaffOperations'
import { EntryChoice } from './components/features/EntryChoice'
import { StaffLogin } from './components/host/StaffLogin'
import { EventForm } from './components/host/EventForm'
import { EmptyState } from './components/features/EmptyState'

type Tab = 'home' | 'recommended' | 'week' | 'calendar' | 'circle' | 'support'
type Entry = 'checking' | 'choice' | 'participant' | 'staff-login' | 'staff'

const categories = [
  ['🎨', 'Art'], ['🌳', 'Outdoors'], ['🎵', 'Music'], ['🍳', 'Cooking'],
  ['🏀', 'Sports'], ['🎉', 'Social'], ['🧘', 'Quiet'], ['🚌', 'Trips'],
]

const navItems: [LucideIcon, Tab, string][] = [
  [Home, 'home', 'Home'],
  [CalendarDays, 'week', 'My Week'],
  [CalendarDays, 'calendar', 'All events'],
  [MessageCircle, 'circle', 'Community'],
  [Heart, 'support', 'Support'],
]

const calendarExtras = [
  { day: 'Monday', time: '10:00 AM', icon: '🧘', title: 'Quiet Morning Yoga', place: 'Grand River Recreation Centre', type: 'Calm activity' },
  { day: 'Tuesday', time: '4:30 PM', icon: '🍳', title: 'Cooking Club', place: 'KW Hab Kitchen', type: 'LEG Up!' },
  { day: 'Thursday', time: '5:00 PM', icon: '🎳', title: 'Bowling Buddies', place: 'Bingemans', type: 'Out and About' },
  { day: 'Sunday', time: '1:00 PM', icon: '🎉', title: 'Sunday Social', place: 'Victoria Park Pavilion', type: 'Community gathering' },
]

const supportCards: [LucideIcon, string, string, string, string][] = [
  [Accessibility, 'Mobility support', 'Entrances, paths, and getting around', 'Jordan · trained staff', 'Available to request'],
  [MessageCircle, 'Communication support', 'Pictures, plain words, and time to talk', 'Mina · communication helper', 'Available to request'],
  [Ear, 'Hearing support', 'Find a quieter seat or use a hearing loop', 'Staff can check first', 'Ask the host'],
  [Accessibility, 'Visual support', 'A sighted guide and clear route details', 'Jordan · trained staff', 'Book ahead'],
  [Heart, 'Calm support', 'Quiet space, headphones, or a break plan', 'Priya · event staff', 'Available at events'],
  [Bus, 'Transportation help', 'Bus routes and a ride-planning call', 'Mina · coordinator', 'Call to plan'],
]

function StatusBadge({ state }: { state: Event['registration'] }) {
  return <span className={'registration ' + (state === 'Yes, just come' ? 'drop-in' : 'signup')}>
    {state === 'Yes, just come' ? <Check size={18} /> : <CalendarDays size={18} />}{state}
  </span>
}

function SymbolStrip({ event }: { event: Event }) {
  const items = [
    ['🎨', event.category], ['🕐', event.day + ' · ' + event.time], ['📍', event.place], ['🆓', event.cost],
    ['🚌', event.bus], ['👥', event.group], ['🔊', event.noise], ['♿', formatAccessFact(event.access)], ['🧑‍🤝‍🧑', event.support],
  ]
  return <div className="symbol-strip" aria-label="Event details">{items.map(([icon, value]) => <span key={value}><b aria-hidden="true">{icon}</b>{value}</span>)}</div>
}

function EventCard({ event, onOpen, compact = false, slow }: { event: Event; onOpen: (event: Event) => void; compact?: boolean; slow: boolean }) {
  return <article className={'event-card' + (compact ? ' compact' : '')}>
    <button className="event-image-button" onClick={() => onOpen(event)} aria-label={event.title}>
      <img src={event.image} alt={event.title + ' event'} /><span className="event-photo-tag">{event.category}</span>
    </button>
    <div className="event-card-body">
      <div className="event-card-title"><h3>{event.title}</h3><ListenButton text={event.title + '. ' + event.plain} label={event.title} slow={slow} /></div>
      <StatusBadge state={event.registration} />
      {!compact && <p className="recommendation"><Sparkles size={16} />{event.reason}</p>}
      <div className="mini-details"><span><Clock3 size={16} />{event.day}</span><span><MapPin size={16} />{event.place}</span></div>
      <button className="open-event" onClick={() => onOpen(event)}>See event <ChevronRight size={18} /></button>
    </div>
  </article>
}

function App() {
  const [entry, setEntry] = useState<Entry>('checking')
  const [tab, setTab] = useState<Tab>('home')
  const [mode, setMode] = useState<ReadingMode>(() => loadMode())
  const [pecs, setPecs] = useState(() => loadPecs())
  const [colorMode, setColorMode] = useState<ColorMode>('normal')
  const [colorPicker, setColorPicker] = useState(false)
  const [language, setLanguage] = useState<Language>(() => loadLanguage())
  const [onboarding, setOnboarding] = useState(true)
  const [selected, setSelected] = useState<Event | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [eventsLoaded, setEventsLoaded] = useState(false)
  const [saved, setSaved] = useState<string[]>(() => loadSaved())
  const [requested, setRequested] = useState<string | null>(null)
  const [accessibilityLens, setAccessibilityLens] = useState(false)
  const [reminders, setReminders] = useState(false)
  const [reminderChoice, setReminderChoice] = useState<string | null>(null)
  const [about, setAbout] = useState(false)
  const slow = mode === 'audio'
  const selectedEvent = selected ?? events[0]
  const save = (event: Event) => setSaved((ids) => ids.includes(event.id) ? ids : [...ids, event.id])
  const savedEvents = useMemo(() => events.filter((event) => saved.includes(event.id)), [saved, events])
  const openEvent = (event: Event) => { setSelected(event); setTab('recommended') }

  const refreshEvents = async () => {
    try {
      setEvents(await getEvents())
    } finally {
      setEventsLoaded(true)
    }
  }

  useEffect(() => {
    getSession().then((session) => setEntry(session ? 'staff' : 'choice'))
  }, [])

  useEffect(() => {
    if (entry === 'participant') refreshEvents()
  }, [entry])

  useEffect(() => {
    document.documentElement.dataset.colorMode = colorMode
    document.documentElement.dataset.pecs = String(pecs)
    document.documentElement.lang = language
  }, [colorMode, language, pecs])

  useEffect(() => { storeSaved(saved) }, [saved])
  useEffect(() => { storeMode(mode) }, [mode])
  useEffect(() => { storePecs(pecs) }, [pecs])
  useEffect(() => { storeLanguage(language) }, [language])

  const handleStaffLogout = async () => { await apiLogout(); setEntry('choice') }

  const header = <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className={'app-header' + (entry === 'staff' ? ' staff-active' : '')}>
      <button className="brand" onClick={() => { setSelected(null); setTab('home') }} aria-label="Belonging Loop home"><span><Sparkles size={20} /></span>belonging <strong>loop</strong></button><a className="kwhab-mark" href="https://kwhab.ca/" target="_blank" rel="noreferrer" aria-label="Visit KW Habilitation"><img src="/kwhab-logo.jpeg" alt="KW Habilitation services logo" /><span>KW Habilitation</span></a>{entry === 'staff' && <span className="staff-mode-badge">● STAFF MODE</span>}
      <AccessibilityBar mode={mode} pecs={pecs} language={language} onMode={setMode} onPecs={() => setPecs(!pecs)} onColor={() => setColorPicker(true)} onLanguage={setLanguage} />
      <button className="notification-button" onClick={() => setReminders(true)} aria-label="Reminder settings"><Bell size={22} /></button>
      {entry === 'staff'
        ? <button className="staff-entry" onClick={handleStaffLogout} aria-label="Log out of staff tools"><ArrowLeft size={20} /><span>Log out</span></button>
        : <button className="staff-entry" onClick={() => setEntry('staff-login')} aria-label="Open staff tools"><Settings2 size={20} /><span>Staff</span></button>}
    </header>
    {pecs && <div className="pecs-banner" role="status"><Image size={21} /><strong>PECS is ON</strong><span>Tap a picture.</span></div>}
    {mode === 'audio' && <div className="audio-banner"><Volume2 size={19} /><strong>Audio First</strong><span>Tap any speaker. Speech is slower.</span><button onClick={() => window.speechSynthesis?.cancel()} aria-label="Stop listening"><X size={16} /> Stop</button></div>}
  </>

  const renderHome = () => <section className="screen home-screen">
    <div className="welcome-row"><div><p className="eyebrow">YOUR COMMUNITY EVENTS</p><h1>{pecs ? 'Tap a picture' : 'What would you like to do?'}</h1><p>{pecs ? 'Choose one picture.' : 'Pick a picture. We will show a few good events.'}</p></div><ListenButton text="What would you like to do? Pick a picture. We will show good events." label="Home" slow={slow} /></div>
    <button className="say-wish" onClick={() => setTab('recommended')}><span><Mic size={29} /></span><div><strong>{pecs ? '🎤' : 'Tell us with your voice'}</strong><small>{pecs ? 'Tap to talk' : 'Say what you want to do'}</small></div><ChevronRight size={22} /></button>
    <div className="category-grid" aria-label="Event categories">{categories.map(([emoji, title]) => <button key={title} onClick={() => setTab('recommended')} aria-label={title}><span>{emoji}</span><strong>{pecs ? '' : title}</strong></button>)}</div>
    <section className="next-event"><div><p className="eyebrow">COMING UP</p><h2>Coming up</h2><p>{events.length > 0 ? 'One event is ready to explore.' : 'Check back soon for new events.'}</p></div>{events.length > 0 ? <EventCard event={events[0]} onOpen={openEvent} compact slow={slow} /> : <EmptyState mode={mode} pecs={pecs} language={language} slow={slow} />}</section><button className="home-about-link" onClick={() => setTab('support')} aria-label="Learn about KW Habilitation"><img src="/kwhab-logo.jpeg" alt="" /><span><strong>About KW Habilitation</strong><small>How we help people live, work, and belong.</small></span><ChevronRight size={22} /></button>
  </section>

  const renderRecommended = () => selected ? <section className="screen event-detail">
    <button className="back-button" onClick={() => setSelected(null)}><ArrowLeft size={19} />Back to events</button>
    <HostProfile slow={slow} language={language} />
    <div className="detail-hero"><img src={selected.image} alt={selected.title + ' event'} /><div><p className="eyebrow">{selected.category}</p><h1>{selected.title}</h1><p>{mode === 'standard' ? selected.short : selected.plain}</p><ListenButton text={selected.plain} label={selected.title + ' description'} slow={slow} language={language} /></div></div>
    <div className="detail-actions"><StatusBadge state={selected.registration} /><button className="save-button" onClick={() => save(selected)}>{saved.includes(selected.id) ? <Check size={20} /> : <CalendarDays size={20} />}{saved.includes(selected.id) ? 'Saved to My Week' : 'Save to My Week'}</button><a className="event-cta" href="https://kwhab.ca/" target="_blank" rel="noreferrer">Register / Learn more</a><button className="event-cta" onClick={() => setTab('circle')}>Join Community</button></div>
    <p className="recommendation detail-reason"><Sparkles size={18} />{selected.reason}</p>
    <div className="lens-row"><button className={accessibilityLens ? 'lens-button active' : 'lens-button'} onClick={() => setAccessibilityLens(!accessibilityLens)} aria-pressed={accessibilityLens}><Accessibility size={20} />Accessibility Lens</button>{accessibilityLens && <div className="lens-summary"><span>🚪 {formatAccessFact(selected.access)}</span><span>🚌 {selected.bus}</span><span>👥 {selected.group}</span></div>}</div>
    {!accessibilityLens && <SymbolStrip event={selected} />}
    {selected.journey && <section className="transit-card" aria-labelledby="transit-title"><div><p className="eyebrow">TRANSIT COMPANION</p><h2 id="transit-title">Can I get there?</h2><strong>🚌 {selected.journey.route}</strong><p>{selected.journey.leave}<br />{selected.journey.duration}</p></div><div className="journey-steps">{selected.journey.steps.map((step, index) => <span key={step}>{index ? '↓ ' : ''}{step}</span>)}</div><div><ListenButton text={selected.journey.route + '. ' + selected.journey.leave + '. ' + selected.journey.duration} label="journey" slow={slow} language={language} /><button className="maps-button" aria-label="Open journey in maps">📍 Open in Maps</button></div></section>}
    <section className="arrival-section"><div className="section-title"><div><p className="eyebrow">WHEN I GET THERE</p><h2>What happens when I arrive?</h2><p>Tap a picture to hear the step.</p></div><ListenButton text={selected.arrival.map((step) => step.title + '. ' + step.detail).join('. ')} label="arrival steps" slow={slow} /></div><div className="arrival-steps">{selected.arrival.map((step, index) => <button key={step.title} onClick={() => { if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(step.title + '. ' + step.detail)) }}><img src={step.image} alt={step.title} /><span className="step-number">{index + 1}</span><span className="step-icon">{step.icon}</span><strong>{step.title}</strong><small>{step.detail}</small><Volume2 size={17} /></button>)}</div><div className="arrival-video"><iframe title="First person walk to the event" src="https://www.youtube.com/embed/Scxs7L0vhZ4" allowFullScreen /><div><strong>Walk with me to the event</strong><small>First-person arrival video · 0:32</small></div></div></section>
    <section className="fact-note"><ShieldCheck size={24} /><div><strong>Event facts are checked by the host.</strong><p>Some access details are reported. Ask staff if you need to know more.</p></div><button onClick={() => setTab('support')}>Get support <ChevronRight size={18} /></button></section>
  </section> : <RecommendedBrowser events={events} onOpen={openEvent} mode={mode} pecs={pecs} language={language} slow={slow} />

  const renderWeek = () => <section className="screen week-screen"><div className="welcome-row"><div><p className="eyebrow">MY WEEK</p><h1>My plans</h1><p>Your confirmed event is big and clear.</p></div><button className="print-button" onClick={() => window.print()}><Printer size={20} />Print My Week</button></div><div className="week-list">{savedEvents.map((event) => <article key={event.id} className="week-card confirmed-plan"><div className="date-box"><strong>{event.day.slice(0, 3)}</strong><span>{event.time.slice(0, 5)}</span></div><img src={event.image} alt="" /><div><span className="confirmed-label">✓ You are going</span><h2>{event.title}</h2><p><Bus size={16} />{event.bus}</p><p><Heart size={16} />{event.support}</p></div><StatusBadge state={event.registration} /><ListenButton text={event.title + '. ' + event.day + '. ' + event.time + '. ' + event.bus} label={event.title} slow={slow} /></article>)}</div><section className="calendar-background"><p className="eyebrow">OTHER KW HAB EVENTS THIS WEEK</p>{events.length === 0 ? <EmptyState mode={mode} pecs={pecs} language={language} slow={slow} /> : <div>{events.filter((event) => !saved.includes(event.id)).map((event) => <button key={event.id} onClick={() => openEvent(event)} aria-label={event.title}><img src={event.image} alt="" /><span>{event.day}</span><strong>{event.title}</strong><small>{event.time}</small></button>)}</div>}</section><div className="fridge-note"><Printer size={19} /><span><strong>Print My Week</strong> makes a big, simple schedule with pictures and room for notes.</span></div></section>

  const renderCalendar = () => <section className="screen all-events-screen"><div className="welcome-row"><div><p className="eyebrow">KW HABILITATION</p><h1>All events</h1><p>Every community opportunity this week.</p></div><button className="print-button" onClick={() => window.print()}><Printer size={20} />Print calendar</button></div>{events.length === 0 ? <EmptyState mode={mode} pecs={pecs} language={language} slow={slow} /> : <div className="full-calendar" aria-label="KW Habilitation events calendar">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => <section key={day}><h2>{day}</h2>{calendarExtras.filter((event) => event.day === day).map((event) => <article key={event.title} className="calendar-event prototype"><span>{event.icon}</span><div><strong>{event.title}</strong><small>{event.time} · {event.place}</small><em>{event.type}</em></div><button onClick={() => setTab('support')} aria-label={'Ask about ' + event.title}>Ask</button></article>)}{events.filter((event) => event.day.startsWith(day)).map((event) => <button key={event.id} className={'calendar-event real' + (saved.includes(event.id) ? ' confirmed' : '')} onClick={() => openEvent(event)} aria-label={'Open ' + event.title}><img src={event.image} alt="" /><div><strong>{saved.includes(event.id) && '✓ '}{event.title}</strong><small>{event.time} · {event.place}</small><em>{event.category}</em></div></button>)}</section>)}</div>}</section>

  const renderSupport = () => about ? <AboutKWHab onBack={() => setAbout(false)} slow={slow} language={language} /> : <section className="screen support-screen"><div className="welcome-row"><div><p className="eyebrow">SUPPORT</p><h1>What help would be useful?</h1><p>Pick one kind of help. A staff person will talk with you.</p></div><ListenButton text="What help would be useful? Pick one kind of help. A staff person will talk with you." label="support options" slow={slow} /></div><div className="support-grid">{supportCards.map(([Icon, title, detail, staff, status]) => <article key={title}><div className="support-icon"><Icon size={30} /></div><h2>{title}</h2><p>{detail}</p><span>{staff}</span><small>{status}</small><button onClick={() => setRequested(title)}>{requested === title ? <Check size={18} /> : <Phone size={18} />}{requested === title ? 'Help request sent' : 'Ask for help'}</button></article>)}</div><section className="belonging-tap"><strong>🟡 BELONGING TAP</strong><h2>Tap a poster to find events.</h2><p>No app. No account. Just tap.</p><p>📚 Libraries · 🏥 Hospitals · 🚌 Bus stations · 🏠 Group homes</p><button>See where posters are →</button></section><section className="about-preview"><h2>About KW Habilitation</h2><p>We help people of all abilities live, work, and belong.</p><button onClick={() => setAbout(true)}>Learn more →</button></section><p className="support-footer"><CircleHelp size={18} />This is a request, not a booking. Staff will confirm what is possible.</p></section>

  const renderStaff = () => <section className="staff-screen"><header><div><p className="eyebrow">STAFF TOOLS · PROTOTYPE ONLY</p><h1>Event workspace</h1><p>Detailed tools stay separate from the participant calendar.</p></div></header><div className="staff-grid"><article><h2>1. Event details</h2><EventForm onCreated={() => refreshEvents()} /></article><article><h2>2. Arrival and access</h2><p><Image size={18} />4 arrival photos ready</p><p><Check size={18} />Step-free path: reported Jul 10</p><p><CircleHelp size={18} />Quiet bench: confirmed by host</p><button>Update access facts</button></article><article><h2>3. Moderation queue</h2><p><MessageCircle size={18} />2 chat messages pending</p><p>"Is there a quiet room?" — J</p><p>"Can I bring my mom?" — A</p><button>Open moderation</button></article><article><h2>4. Support coordination</h2><p><Accessibility size={18} />Jordan: mobility support</p><p><Bus size={18} />Route 7 transport information</p><p><ShieldCheck size={18} />No support is assigned automatically</p><button>Review support requests</button></article></div><StaffOperations /></section>

  if (entry === 'checking') return <div className="app-shell loading-shell"><p>Loading…</p></div>
  if (entry === 'choice') return <EntryChoice onParticipant={() => setEntry('participant')} onStaff={() => setEntry('staff-login')} />
  if (entry === 'staff-login') return <StaffLogin onSuccess={() => setEntry('staff')} onBack={() => setEntry('choice')} />
  if (entry === 'staff') return <div className="app-shell">{header}<main id="main-content">{renderStaff()}</main></div>

  if (onboarding) return <div className="app-shell">{header}<Onboarding onFinish={() => setOnboarding(false)} onMode={(nextMode, nextPecs) => { setMode(nextMode); if (nextPecs) setPecs(true) }} />{colorPicker && <ColorModePicker onChoose={setColorMode} onClose={() => setColorPicker(false)} />}</div>

  if (!eventsLoaded) return <div className="app-shell">{header}<main id="main-content"><p className="loading-note">Loading events…</p></main></div>

  return <div className="app-shell">{header}<main id="main-content">{tab === 'home' ? renderHome() : tab === 'recommended' ? renderRecommended() : tab === 'week' ? renderWeek() : tab === 'calendar' ? renderCalendar() : tab === 'circle' ? (events.length > 0 ? <EventCommunity event={selectedEvent} slow={slow} language={language} /> : <EmptyState mode={mode} pecs={pecs} language={language} slow={slow} />) : renderSupport()}</main><nav className="bottom-nav" aria-label="Main navigation">{navItems.map(([Icon, value, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => { setSelected(null); setTab(value) }} aria-label={label}><Icon size={30} /><span>{label}</span></button>)}</nav>{colorPicker && <ColorModePicker onChoose={setColorMode} onClose={() => setColorPicker(false)} />}{reminders && <ReminderModal choice={reminderChoice} onChoose={setReminderChoice} onClose={() => setReminders(false)} />}</div>
}

export default App
