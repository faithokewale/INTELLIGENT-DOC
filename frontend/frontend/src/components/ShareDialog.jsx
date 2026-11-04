import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { api, toast } from '../api'

export default function ShareDialog({ doc, onClose }) {
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState('viewer')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', h); return () => removeEventListener('keydown', h) }, [onClose])
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      const r = await api(`/documents/${doc.id}/permissions`, { method: 'POST', json: { email: email.trim(), permission } })
      toast(`Shared with ${r.shared_with} as ${r.permission}`, 'success'); onClose()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="sh" className="card w-full max-w-md animate-pop p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="sh" className="text-lg font-bold">Share document</h2><p className="mt-1 truncate text-sm text-muted">{doc.filename}</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost !p-2"><X size={18} /></button>
        </div>
        <label className="mt-5 block text-sm font-medium">Email of a registered user
          <input autoFocus required type="email" className="input mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </label>
        <label className="mt-4 block text-sm font-medium">Access
          <select className="input mt-1.5" value={permission} onChange={(e) => setPermission(e.target.value)}>
            <option value="viewer">Viewer</option><option value="editor">Editor</option>
          </select>
        </label>
        <p className="mt-2 text-xs text-muted">Viewers and editors can both search and ask questions.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button disabled={busy} className="btn-primary">{busy ? 'Sharing…' : 'Share'}</button>
        </div>
      </form>
    </div>
  )
}
