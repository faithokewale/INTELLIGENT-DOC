import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { UploadCloud, Share2, ArrowRight, FileText } from 'lucide-react'
import { api, toast } from '../api'
import StatusChip, { RoleBadge } from '../components/StatusChip'
import ShareDialog from '../components/ShareDialog'

const MAX = 100 * 1024 * 1024
const active = (s) => s === 'pending' || s === 'processing'

export default function Documents() {
  const [docs, setDocs] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(null)
  const input = useRef()
  const load = useCallback(() => api('/documents').then(setDocs).catch((e) => { setDocs((d) => d || []); toast(e.message) }), [])
  useEffect(() => { load() }, [load])

  const pending = (docs || []).filter((d) => active(d.processing_status)).map((d) => d.id).join(',')
  useEffect(() => {
    if (!pending) return
    const t = setInterval(() => pending.split(',').forEach((id) =>
      api(`/documents/${id}/status`).then((r) => setDocs((ds) => ds.map((d) => d.id === r.document_id ? { ...d, processing_status: r.processing_status } : d))).catch(() => {})), 2000)
    return () => clearInterval(t)
  }, [pending])

  const upload = async (file) => {
    setError('')
    if (!file) return
    if (!/\.(pdf|docx)$/i.test(file.name)) return setError('Only .pdf and .docx files are supported.')
    if (file.size > MAX) return setError('This file is over 100 MB. Choose a smaller file.')
    if (file.size === 0) return setError('This file is empty.')
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await api('/documents/upload', { method: 'POST', form: fd })
      setDocs((d) => [{ id: r.document_id, filename: r.filename, processing_status: r.processing_status, role: 'owner', owner_email: '', created_at: new Date().toISOString() }, ...(d || [])])
      toast('Upload received. Processing has started.', 'success')
    } catch (e) { setError(e.message) } finally { setUploading(false); if (input.current) input.current.value = '' }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Your documents</h1>
      <p className="mt-2 text-muted">Upload a file, wait for it to be read, then ask it anything.</p>
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]) }}
        className={`mt-8 rounded-2xl border-2 border-dashed p-10 text-center transition ${drag ? 'border-accent bg-soft' : 'border-line bg-surface'}`}>
        <UploadCloud className="mx-auto text-accent" size={32} />
        <p className="mt-3 font-semibold">{uploading ? 'Uploading…' : 'Drop a PDF or Word file here'}</p>
        <p className="mt-1 text-sm text-muted">.pdf or .docx, up to 100 MB</p>
        <input ref={input} type="file" accept=".pdf,.docx" className="sr-only" id="file" onChange={(e) => upload(e.target.files[0])} />
        <button onClick={() => input.current.click()} disabled={uploading} className="btn-primary mt-4">Choose file</button>
        {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <div className="mt-8 space-y-3">
        {docs === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}
        {docs?.length === 0 && (
          <div className="card p-10 text-center"><FileText className="mx-auto text-muted" size={28} />
            <p className="mt-3 font-semibold">No documents yet</p><p className="text-sm text-muted">Upload your first file above to get started.</p></div>
        )}
        {docs?.map((d) => (
          <div key={d.id} className="card flex flex-wrap items-center gap-3 p-4 sm:px-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-soft"><FileText size={18} className="text-accent" /></div>
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate font-semibold">{d.filename}</p>
              {d.role !== 'owner' && d.owner_email && <p className="truncate text-xs text-muted">Shared by {d.owner_email}</p>}
            </div>
            <StatusChip status={d.processing_status} /><RoleBadge role={d.role} />
            {d.role === 'owner' && <button onClick={() => setSharing(d)} className="btn-ghost"><Share2 size={16} /> Share</button>}
            <Link to={`/documents/${d.id}`} className="btn-primary">Open <ArrowRight size={16} /></Link>
          </div>
        ))}
      </div>
      {sharing && <ShareDialog doc={sharing} onClose={() => setSharing(null)} />}
    </div>
  )
}
