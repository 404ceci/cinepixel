import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'

type Mode = 'login' | 'register'

/** Only same-site paths are allowed as a redirect target (no open redirects). */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}

export function LoginPage() {
  const [params, setParams] = useSearchParams()
  const { user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const mode: Mode = params.get('mode') === 'register' ? 'register' : 'login'
  const next = safeNext(params.get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={next} replace />

  const switchMode = (m: Mode) => {
    setError(null)
    setParams(
      (p) => {
        if (m === 'register') p.set('mode', 'register')
        else p.delete('mode')
        return p
      },
      { replace: true },
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await (mode === 'login' ? signIn(email, password) : signUp(email, password))
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth__card">
        <p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'New here'}</p>
        <h1 className="auth__title">{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
        <p className="auth__lead">
          {mode === 'login'
            ? 'Sign in to rate movies and see your list.'
            : 'Your ratings are saved to this account.'}
        </p>

        <div className="tabs" role="tablist" aria-label="Account">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className="tabs__btn"
            onClick={() => switchMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className="tabs__btn"
            onClick={() => switchMode('register')}
          >
            Create account
          </button>
        </div>

        <form className="auth__form" onSubmit={submit} noValidate>
          <label className="input-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="input-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === 'register' ? 8 : undefined}
              required
              aria-describedby={mode === 'register' ? 'pw-hint' : undefined}
            />
            {mode === 'register' && (
              <small id="pw-hint" className="input-field__hint">
                At least 8 characters.
              </small>
            )}
          </label>

          {error && (
            <p className="auth__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </section>
  )
}
