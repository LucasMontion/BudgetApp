import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function AuthScreen({ onContinueAsGuest }) {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [verifyEmailSent, setVerifyEmailSent] = useState(false)
  const { signIn, signUp } = useAuth()

  function switchTab(t) {
    setTab(t)
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setError(null)
    setLoading(true)
    try {
      if (tab === 'login') {
        await signIn(email, password)
        // onAuthStateChange in AuthContext handles the rest
      } else {
        const data = await signUp(email, password)
        if (!data.session) {
          setVerifyEmailSent(true)
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (verifyEmailSent) {
    return (
      <div className="auth-screen">
        <div className="auth-hero">
          <div className="auth-logo">
            <LogoIcon />
          </div>
          <h1 className="auth-app-name">My Budget</h1>
        </div>

        <div className="auth-card">
          <div className="auth-verify">
            <div className="auth-verify__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <h2 className="auth-verify__title">Check your email</h2>
            <p className="auth-verify__body">
              We sent a confirmation link to <strong>{email}</strong>.
              Open it to activate your account, then sign in here.
            </p>
            <button
              className="btn-primary"
              onClick={() => { setVerifyEmailSent(false); switchTab('login') }}
            >
              Back to sign in
            </button>
          </div>
        </div>

        <button className="auth-guest-btn" onClick={onContinueAsGuest}>
          Continue without account
        </button>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <div className="auth-logo">
          <LogoIcon />
        </div>
        <h1 className="auth-app-name">My Budget</h1>
        <p className="auth-tagline">Track spending, anywhere</p>
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'login' ? ' auth-tab--active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Sign in
          </button>
          <button
            className={`auth-tab${tab === 'signup' ? ' auth-tab--active' : ''}`}
            onClick={() => switchTab('signup')}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="field-input"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="field-input"
              type="password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button
            className="btn-primary"
            type="submit"
            disabled={loading || !email || !password}
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>

      <button className="auth-guest-btn" onClick={onContinueAsGuest}>
        Continue without account
      </button>
    </div>
  )
}

function LogoIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </svg>
  )
}
