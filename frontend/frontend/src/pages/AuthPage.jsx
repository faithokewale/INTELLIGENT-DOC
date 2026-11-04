import { useState } from 'react'
import { useAuth } from '../auth'
import { Logo, ThemeToggle, Toasts } from '../components/Layout'

export default function AuthPage() {
  const { login, register, notice } = useAuth()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '' })
  const [errs, setErrs] = useState({})
  const [serverErr, setServerErr] = useState('')
  const [busy, setBusy] = useState(false)
  const validate = () => {
    const e = {}
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email address'
    if (!f.password) e.password = 'Enter your password'
    else if (mode === 'register' && f.password.length < 8) e.password = 'Use at least 8 characters'
    setErrs(e); return !Object.keys(e).length
  }
  const submit = async (ev) => {
    ev.preventDefault(); setServerErr('')
    if (!validate()) return
    setBusy(true)
    try { await (mode === 'login' ? login : register)(f.email.trim(), f.password) }
    catch (e) { setServerErr(e.message) } finally { setBusy(false) }
  }
  const switchMode = () => { setMode(mode === 'login' ? 'register' : 'login'); setErrs({}); setServerErr('') }
  return (
    <div className="relative grid min-h-screen place-items-center p-4">
      <div className="absolute left-6 top-5"><Logo /></div>
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <form onSubmit={submit} noValidate className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold tracking-tight">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-1.5 text-sm text-muted">{mode === 'login' ? 'Log in to ask questions about your documents.' : 'Upload a PDF or Word file and start asking.'}</p>
        {notice && <p role="alert" className="mt-5 rounded-xl bg-soft px-3 py-2 text-sm">{notice}</p>}
        <label className="mt-6 block text-sm font-medium">Email
          <input type="email" autoComplete="email" className="input mt-1.5" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!errs.email} />
          {errs.email && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errs.email}</span>}
        </label>
        <label className="mt-4 block text-sm font-medium">Password
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="input mt-1.5" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-invalid={!!errs.password} />
          {errs.password && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errs.password}</span>}
        </label>
        {serverErr && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{serverErr}</p>}
        <button disabled={busy} className="btn-primary mt-6 w-full">{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        <p className="mt-5 text-center text-sm text-muted">
          {mode === 'login' ? 'New here?' : 'Already registered?'}{' '}
          <button type="button" onClick={switchMode} className="font-semibold text-accent underline-offset-2 hover:underline">{mode === 'login' ? 'Create an account' : 'Log in'}</button>
        </p>
      </form>
      <Toasts />
    </div>
  )
}
