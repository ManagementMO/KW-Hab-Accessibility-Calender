import { Settings2, Users } from 'lucide-react'

export function EntryChoice({ onParticipant, onStaff }: { onParticipant: () => void; onStaff: () => void }) {
  return <main id="main-content" className="onboarding">
    <section className="decision-screen">
      <p className="eyebrow">KW HABILITATION · WELCOME</p>
      <h1>Who's using this today?</h1>
      <p>Pick one to continue.</p>
      <div className="decision-choices">
        <button onClick={onParticipant} aria-label="I'm a participant"><Users size={40} /><strong>I'm a participant</strong></button>
        <button onClick={onStaff} aria-label="I'm staff"><Settings2 size={40} /><strong>I'm staff</strong></button>
      </div>
    </section>
  </main>
}
