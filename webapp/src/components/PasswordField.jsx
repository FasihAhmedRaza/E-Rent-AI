import { useState } from 'react'

const EYE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
const EYE_OFF = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19m-6.7-1.06A3 3 0 1 1 9.7 9.7" /><path d="M1 1l22 22" /><path d="M6.6 6.6A13.6 13.6 0 0 0 1 12s4 8 11 8a9.7 9.7 0 0 0 5.4-1.6" /></svg>

export default function PasswordField({ value, onChange, placeholder = '••••••••', autoComplete = 'current-password', minLength = 6, required = true }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="inp" type={show ? 'text' : 'password'} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete} minLength={minLength} required={required}
        style={{ paddingInlineEnd: 44 }}
      />
      <button
        type="button" onClick={() => setShow((s) => !s)} title={show ? 'Hide password' : 'Show password'}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'var(--muted)' }}
      >
        <span style={{ width: 18, height: 18, display: 'block' }}>{show ? EYE_OFF : EYE}</span>
      </button>
    </div>
  )
}
