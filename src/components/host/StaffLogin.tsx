import { useState, type FormEvent } from 'react'
import { ArrowLeft, LogIn } from 'lucide-react'
import { login } from '../../lib/api'

export function StaffLogin({ onSuccess, onBack }: { onSuccess: (email: string) => void; onBack: () => void }) {
  const [email, setEmail] = useState(import.meta.env.VITE_STAFF_EMAIL ?? '')
  const [password, setPassword] = useState(import.meta.env.VITE_STAFF_PASSWORD ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await login(email, password)
      onSuccess(result.email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in')
      setSubmitting(false)
    }
  }

  return <main id="main-content" className="onboarding">
    <section className="decision-screen staff-login">
      <p className="eyebrow">STAFF SIGN IN</p>
      <h1>Staff login</h1>
      <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button type="submit" disabled={submitting}><LogIn size={18} />{submitting ? 'Signing in...' : 'Sign in'}</button>
      </form>
      <button className="text-action" type="button" onClick={onBack}><ArrowLeft size={16} />Back</button>
    </section>
  </main>
}
