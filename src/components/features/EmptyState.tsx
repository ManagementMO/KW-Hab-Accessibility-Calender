import { CalendarX2 } from 'lucide-react'
import { ListenButton, Language } from '../accessibility/ListenButton'
import { ReadingMode } from '../accessibility/AccessibilityBar'

export function EmptyState({ mode, pecs, language, slow }: { mode: ReadingMode; pecs: boolean; language: Language; slow: boolean }) {
  const message = 'No events at this time.'
  return <div className="empty-state" role="status">
    <CalendarX2 size={40} aria-hidden="true" />
    <p>{pecs ? '🚫📅' : message}</p>
    {mode === 'audio' && <ListenButton text={message} label="empty events" slow={slow} language={language} />}
  </div>
}
