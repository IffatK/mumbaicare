import { ReactNode } from 'react';
import { AlertTriangle, Inbox, Info, Download, Loader2 } from 'lucide-react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 className="font-display text-2xl font-semibold text-navy-900 sm:text-[1.7rem]">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm text-ink-500">{description}</p>}</div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>;
}
export function Panel({ title, subtitle, actions, children, className = '' }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel p-4 ${className}`}>
    {(title || actions) && <div className="mb-3 flex items-start justify-between gap-2">
      <div>{title && <h2 className="text-sm font-semibold text-navy-900">{title}</h2>}{subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}</div>{actions}</div>}
    {children}</section>;
}
export function Kpi({ label, value, hint, tone = 'navy' }: { label: string; value: ReactNode; hint?: string; tone?: 'navy' | 'teal' | 'alert' | 'blue' }) {
  const bar = { navy: 'bg-navy-900', teal: 'bg-tide-600', alert: 'bg-alert-600', blue: 'bg-harbor-600' }[tone];
  return <div className="panel relative overflow-hidden px-4 py-3">
    <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
    <p className="text-xs font-medium text-ink-500">{label}</p>
    <p className="mt-1 text-xl font-semibold text-navy-900 sm:text-2xl">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}</div>;
}
export const Skeleton = ({ className = 'h-4' }: { className?: string }) => <div className={`animate-pulse rounded bg-ink-100 ${className}`} />;
export function Loading({ h = 'h-64' }: { h?: string }) { return <Skeleton className={`w-full ${h}`} />; }
export function ErrorState({ error, retry }: { error: any; retry?: () => void }) {
  return <div className="flex flex-col items-center gap-2 rounded-lg border border-alert-600/30 bg-alert-100/50 p-6 text-center text-sm text-alert-600" role="alert">
    <AlertTriangle /><p>{error?.message ?? 'Something went wrong loading this data.'}</p>
    {retry && <button className="btn-ghost" onClick={retry}>Try again</button>}</div>;
}
export function Empty({ title = 'No data for these filters', hint, action }: { title?: string; hint?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-ink-500"><Inbox className="text-ink-300" />
    <p className="font-medium text-ink-700">{title}</p>{hint && <p>{hint}</p>}{action}</div>;
}
export function Disclaimer({ children }: { children?: ReactNode }) {
  return <div className="flex gap-2 rounded-md border border-harbor-500/30 bg-harbor-100 px-3 py-2 text-xs text-navy-800">
    <Info size={16} className="mt-0.5 shrink-0" />
    <p>{children ?? 'Synthetic, anonymised data for academic analysis. These are statistical summaries, not medical findings, diagnoses or recommendations.'}</p></div>;
}
export function Badge({ children, tone = 'ink' }: { children: ReactNode; tone?: 'ink' | 'teal' | 'amber' | 'alert' | 'blue' }) {
  const c = { ink: 'bg-ink-100 text-ink-700', teal: 'bg-tide-100 text-tide-700', amber: 'bg-amber-100 text-amber-600', alert: 'bg-alert-100 text-alert-600', blue: 'bg-harbor-100 text-harbor-600' }[tone];
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}
export const SevBadge = ({ s }: { s: string }) => <Badge tone={s === 'SEVERE' ? 'alert' : s === 'MODERATE' ? 'amber' : 'teal'}>{s.charAt(0) + s.slice(1).toLowerCase()}</Badge>;
export function ExportBtn({ onClick, label = 'Export CSV' }: { onClick: () => void; label?: string }) {
  return <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={onClick}><Download size={14} />{label}</button>;
}
export const Spinner = () => <Loader2 size={16} className="animate-spin" />;
export function Field({ label, error, children, htmlFor }: { label: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return <div><label className="label" htmlFor={htmlFor}>{label}</label>{children}{error && <p className="mt-1 text-xs text-alert-600" role="alert">{error}</p>}</div>;
}
export function DataTable({ columns, rows, max = 'max-h-[28rem]' }: { columns: { key: string; label: string; render?: (r: any) => ReactNode; align?: 'right' }[]; rows: any[]; max?: string }) {
  if (!rows?.length) return <Empty />;
  return <div className={`overflow-auto rounded-md border border-ink-200 ${max}`}><table className="min-w-full">
    <thead className="sticky top-0"><tr>{columns.map(c => <th key={c.key} className={`th ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="hover:bg-ink-50">{columns.map(c => <td key={c.key} className={`td ${c.align === 'right' ? 'text-right' : ''}`}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}</tr>)}</tbody>
  </table></div>;
}
