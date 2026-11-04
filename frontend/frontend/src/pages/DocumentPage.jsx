import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Send, Plus, ChevronDown, Search, MessageSquare, Loader2, AlertCircle } from 'lucide-react'
import { api, toast } from '../api'
import StatusChip from '../components/StatusChip'
import Markdown from '../components/Markdown'

const pct = (s) => Math.round(Math.max(0, Math.min(1, s)) * 100)

function Chunk({ c }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-3 text-sm">
      <p className="leading-relaxed">{c.chunk_text}</p>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span>Chunk {c.chunk_index}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft" role="progressbar" aria-valuenow={pct(c.similarity)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct(c.similarity)}%` }} />
        </div>
        <span className="font-semibold text-ink">{pct(c.similarity)}% match</span>
      </div>
    </div>
  )
}

function Chat({ docId }) {
  const [convs, setConvs] = useState(null)
  const [cid, setCid] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [q, setQ] = useState('')
  const [thinking, setThinking] = useState(false)
  const [loadingHist, setLoadingHist] = useState(false)
  const [error, setError] = useState('')
  const [showList, setShowList] = useState(false)
  const end = useRef()
  const loadConvs = useCallback(() => api(`/documents/${docId}/conversations`).then(setConvs).catch(() => setConvs([])), [docId])
  useEffect(() => { loadConvs() }, [loadConvs])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, thinking])

  const open = async (id) => {
    setShowList(false); setCid(id); setMsgs([]); setError(''); setLoadingHist(true)
    try { const r = await api(`/documents/conversations/${id}/history`); setMsgs(r.messages) }
    catch (e) { toast(e.message) } finally { setLoadingHist(false) }
  }
  const fresh = () => { setCid(null); setMsgs([]); setError(''); setShowList(false) }
  const send = async (e) => {
    e.preventDefault()
    const question = q.trim()
    if (!question || thinking) return
    if (question.length > 2000) return setError('Questions can be up to 2000 characters.')
    setError(''); setQ(''); setMsgs((m) => [...m, { role: 'user', content: question }]); setThinking(true)
    try {
      const r = await api(`/documents/${docId}/ask`, { query: { question, conversation_id: cid } })
      const isNew = !cid; setCid(r.conversation_id)
      setMsgs((m) => [...m, { role: 'assistant', content: r.answer, sources: r.sources }])
      if (isNew) loadConvs()
    } catch (err) { setError(err.message) } finally { setThinking(false) }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[250px_1fr]">
      <aside className={`${showList ? 'block' : 'hidden'} md:block`}>
        <button onClick={fresh} className="btn-primary w-full"><Plus size={16} /> New chat</button>
        <div className="mt-3 space-y-1.5">
          {convs === null && [0, 1].map((i) => <div key={i} className="skeleton h-11" />)}
          {convs?.length === 0 && <p className="px-1 text-sm text-muted">No conversations yet. Ask your first question.</p>}
          {convs?.map((c) => (
            <button key={c.id} onClick={() => open(c.id)} aria-current={c.id === cid}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${c.id === cid ? 'bg-soft font-semibold' : 'hover:bg-soft/60'}`}>
              <span className="block truncate">{c.title || 'Untitled chat'}</span>
              <span className="text-xs text-muted">{new Date(c.created_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className="card flex h-[65vh] min-h-[420px] flex-col">
        <button onClick={() => setShowList(!showList)} className="btn-ghost m-2 !justify-start md:hidden"><MessageSquare size={16} /> Conversations</button>
        <div className="flex-1 space-y-5 overflow-y-auto p-5" aria-live="polite">
          {loadingHist && <><div className="skeleton h-12 w-2/3" /><div className="skeleton ml-auto h-16 w-3/4" /></>}
          {!loadingHist && !msgs.length && !thinking && (
            <div className="grid h-full place-items-center text-center"><div><MessageSquare className="mx-auto text-accent" size={28} />
              <p className="mt-3 font-semibold">Ask this document anything</p><p className="text-sm text-muted">Answers are drawn from the content of this file.</p></div></div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex animate-pop ${m.role === 'user' ? 'justify-end' : ''}`}>
              <div className={`max-w-[85%] ${m.role === 'user' ? 'rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-accent-fg' : ''}`}>
                {m.role === 'user' ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p> : <Markdown text={m.content} />}
              </div>
            </div>
          ))}
          {thinking && <div className="flex items-center gap-1.5 text-sm text-muted" aria-label="Thinking">
            {[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${d}ms` }} />)}<span className="ml-1">Reading the document…</span></div>}
          <div ref={end} />
        </div>
        {error && <p role="alert" className="mx-5 mb-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} maxLength={2000} placeholder="Ask a question…" aria-label="Your question" />
          <button disabled={thinking || !q.trim()} className="btn-primary" aria-label="Send"><Send size={16} /></button>
        </form>
      </section>
    </div>
  )
}

function SearchTab({ docId }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = async (e) => {
    e.preventDefault(); const query = q.trim(); if (!query) return
    setBusy(true); setError('')
    try { setRes((await api(`/documents/${docId}/search`, { query: { query } })).results) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div>
      <form onSubmit={go} className="flex gap-2">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} maxLength={1000} placeholder="Search inside this document…" aria-label="Search query" />
        <button disabled={busy || !q.trim()} className="btn-primary">{busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search</button>
      </form>
      {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-5 space-y-3">
        {res?.length === 0 && <p className="text-sm text-muted">No matching passages found. Try different words.</p>}
        {res?.map((r) => <div key={r.id} className="card p-4"><Chunk c={r} /></div>)}
      </div>
    </div>
  )
}

export default function DocumentPage() {
  const { id } = useParams()
  const [doc, setDoc] = useState(null)
  const [tab, setTab] = useState('chat')
  const [missing, setMissing] = useState('')
  const status = doc?.processing_status
  useEffect(() => {
    let stop = false
    const poll = () => api(`/documents/${id}/status`).then((r) => { if (!stop) setDoc(r) }).catch((e) => setMissing(e.message))
    poll()
    const t = setInterval(() => { if (!['completed', 'failed'].includes(status)) poll() }, 2000)
    return () => { stop = true; clearInterval(t) }
  }, [id, status])
  const tabs = [['chat', 'Chat', MessageSquare], ['search', 'Search', Search]]
  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} /> All documents</Link>
      {missing && !doc ? <div className="card mt-6 p-8 text-center"><AlertCircle className="mx-auto text-muted" /><p className="mt-2 font-semibold">{missing}</p></div> : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">{doc?.filename || <span className="skeleton inline-block h-8 w-64 align-middle" />}</h1>
            {status && <StatusChip status={status} />}
          </div>
          <div role="tablist" className="mt-6 inline-flex gap-1 rounded-2xl bg-soft p-1">
            {tabs.map(([k, label, Icon]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-surface shadow-card' : 'text-muted hover:text-ink'}`}><Icon size={15} />{label}</button>
            ))}
          </div>
          <div className="mt-5">
            {!doc ? <div className="skeleton h-64" /> : status === 'completed' ? (tab === 'chat' ? <Chat docId={id} /> : <SearchTab docId={id} />) : (
              <div className="card p-10 text-center">
                {status === 'failed' ? <><AlertCircle className="mx-auto text-red-500" size={28} /><p className="mt-3 font-semibold">This document could not be processed</p><p className="text-sm text-muted">Upload the file again, or try a different file.</p></>
                  : <><Loader2 className="mx-auto animate-spin text-accent" size={28} /><p className="mt-3 font-semibold">Still reading your document</p><p className="text-sm text-muted">Chat and search unlock when processing finishes. This page updates on its own.</p></>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
