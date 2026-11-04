function inline(t) {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="rounded bg-soft px-1.5 py-0.5 text-[0.85em]">{p.slice(1, -1)}</code>
    if (/^\*[^*\s][^*]*\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>
    return p
  })
}

export default function Markdown({ text }) {
  const blocks = []
  let list = null
  const flush = () => { if (list) { blocks.push(list); list = null } }
  text.split('\n').forEach((raw) => {
    const line = raw.trimEnd()
    let m
    if (!line.trim()) return flush()
    if ((m = line.match(/^\s*[*\-•]\s+(.*)/))) {
      if (!list || list.t !== 'ul') { flush(); list = { t: 'ul', items: [] } }
      return list.items.push(m[1])
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (!list || list.t !== 'ol') { flush(); list = { t: 'ol', items: [] } }
      return list.items.push(m[1])
    }
    flush()
    blocks.push((m = line.match(/^#{1,6}\s+(.*)/)) ? { t: 'h', text: m[1] } : { t: 'p', text: line })
  })
  flush()
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((b, i) =>
        b.t === 'ul' ? <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-accent">{b.items.map((x, j) => <li key={j}>{inline(x)}</li>)}</ul>
        : b.t === 'ol' ? <ol key={i} className="list-decimal space-y-1.5 pl-5 marker:text-accent">{b.items.map((x, j) => <li key={j}>{inline(x)}</li>)}</ol>
        : b.t === 'h' ? <p key={i} className="font-semibold">{inline(b.text)}</p>
        : <p key={i}>{inline(b.text)}</p>)}
    </div>
  )
}
