import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Moon, Sun, LogOut, FileText, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '../auth'
import { on } from '../api'

export function Toasts() {
  const [items, setItems] = useState([])
  useEffect(() => on('toast', (t) => {
    setItems((s) => [...s, t]); setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 5000)
  }), [])
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="card flex animate-pop items-start gap-2 p-3 text-sm">
          {t.kind === 'error' ? <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" />}
          <span className="flex-1">{t.msg}</span>
          <button aria-label="Dismiss" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}

export function ThemeToggle() {
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark; setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }
  return (
    <button onClick={toggle} className="btn-ghost !p-2.5" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-fg"><FileText size={18} /></span>
      Intelligence Doc
    </Link>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <div className="relative">
              <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
                className="grid h-10 w-10 place-items-center rounded-full bg-soft text-sm font-bold uppercase">{user.email[0]}</button>
              {open && (
                <div role="menu" className="card absolute right-0 mt-2 w-64 animate-pop p-2">
                  <div className="px-3 py-2"><p className="truncate text-sm font-semibold">{user.email}</p><p className="text-xs capitalize text-muted">Role: {user.role}</p></div>
                  <button role="menuitem" onClick={logout} className="btn-ghost w-full !justify-start"><LogOut size={16} /> Log out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><Outlet /></main>
      <Toasts />
    </div>
  )
}
