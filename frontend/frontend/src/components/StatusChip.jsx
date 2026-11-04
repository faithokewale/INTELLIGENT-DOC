import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
const map = {
  pending: ['Queued', Clock, 'bg-soft text-muted'],
  processing: ['Processing', Loader2, 'bg-soft text-accent', true],
  completed: ['Ready', CheckCircle2, 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'],
  failed: ['Failed', AlertCircle, 'bg-red-500/15 text-red-700 dark:text-red-300'],
}
export default function StatusChip({ status }) {
  const [label, Icon, cls, spin] = map[status] || map.pending
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}><Icon size={13} className={spin ? 'animate-spin' : ''} />{label}</span>
}
export const RoleBadge = ({ role }) => <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold capitalize text-muted">{role}</span>
