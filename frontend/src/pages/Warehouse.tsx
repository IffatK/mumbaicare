import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { useToast } from '../components/Toast';
import { PageHeader, Panel, Kpi, Loading, ErrorState, DataTable, Spinner, Badge, Disclaimer } from '../components/ui';
import { dateTime, num } from '../lib/format';

function SchemaDiagram({ tables }: { tables: any[] }) {
  const fact = tables.find(t => t.kind === 'fact'); const dims = tables.filter(t => t.kind === 'dimension');
  const pos = [[20, 20], [520, 20], [20, 290], [520, 290]];
  const Box = ({ t, x, y, w = 210, factBox = false }: any) => <g>
    <rect x={x} y={y} width={w} height={32 + Math.min(t.columns.length, factBox ? 11 : 8) * 15} rx="6" fill={factBox ? '#DDF3F0' : '#fff'} stroke={factBox ? '#0E8C83' : '#1D5FA8'} />
    <rect x={x} y={y} width={w} height="26" rx="6" fill={factBox ? '#0E8C83' : '#12325A'} />
    <text x={x + 10} y={y + 17} fill="#fff" fontSize="12" fontWeight="700">{t.name}</text>
    <text x={x + w - 10} y={y + 17} fill="#DDF3F0" fontSize="11" textAnchor="end">{num(t.rows)} rows</text>
    {t.columns.slice(0, factBox ? 11 : 8).map((c: string, i: number) => <text key={c} x={x + 10} y={y + 42 + i * 15} fontSize="11" fill={/Key$/.test(c) ? '#1D5FA8' : '#3A4A5C'} fontWeight={/Key$/.test(c) ? 600 : 400}>{c}</text>)}
  </g>;
  return <div className="overflow-x-auto"><svg viewBox="0 0 750 470" className="min-w-[640px]" role="img" aria-label="Star schema diagram with the fact table in the centre">
    {dims.map((_, i) => <line key={i} x1={pos[i][0] + 105} y1={pos[i][1] + 60} x2={375} y2={235} stroke="#2F74C0" strokeDasharray="4 4" />)}
    {dims.map((t, i) => <Box key={t.name} t={t} x={pos[i][0]} y={pos[i][1]} />)}
    {fact && <Box t={fact} x={265} y={120} w={220} factBox />}
  </svg></div>;
}
export default function Warehouse() {
  const { user } = useAuth(); const toast = useToast(); const qc = useQueryClient();
  const schema = useQuery({ queryKey: ['dw-schema'], queryFn: () => api<any[]>('/warehouse/schema') });
  const status = useQuery({ queryKey: ['dw-status'], queryFn: () => api('/warehouse/status') });
  const etl = useMutation({ mutationFn: () => api('/warehouse/etl/run', { method: 'POST' }),
    onSuccess: (r: any) => { qc.invalidateQueries(); toast(r.status === 'SUCCESS' ? 'ok' : 'err', `ETL ${r.status.toLowerCase()}: ${r.loaded} loaded, ${r.rejected} rejected`); },
    onError: (e: any) => toast('err', e.message) });
  const s: any = status.data; const last = s?.runs?.[0];
  return <>
    <PageHeader title="Data warehouse" description="Star schema stored as dw_* collections in MongoDB, loaded by the Node.js ETL pipeline."
      actions={can(user, 'ADMIN') && <button className="btn-teal" disabled={etl.isPending} onClick={() => etl.mutate()}>{etl.isPending ? <Spinner /> : <Play size={16} />}{etl.isPending ? 'Running ETL' : 'Run ETL'}</button>} />
    {status.isError ? <ErrorState error={status.error} /> : status.isLoading ? <Loading h="h-24" /> :
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Operational records" value={num(s.operationalRecords)} />
        <Kpi label="Fact rows" value={num(schema.data?.find(t => t.kind === 'fact')?.rows)} tone="teal" />
        <Kpi label="Last successful ETL" value={<span className="text-base">{s.lastSuccess ? dateTime(s.lastSuccess.endedAt) : 'Never'}</span>} tone="blue" />
        <Kpi label="Changes since last load" value={num(s.pendingChanges)} tone={s.pendingChanges ? 'alert' : 'teal'} hint={s.pendingChanges ? 'Run the ETL to refresh the warehouse' : 'Warehouse is up to date'} />
      </div>}
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Panel title="Star schema">{schema.isError ? <ErrorState error={schema.error} /> : schema.isLoading ? <Loading /> : <SchemaDiagram tables={schema.data!} />}</Panel>
      <Panel title="Latest run">{!last ? <p className="text-sm text-ink-500">No ETL run yet.{can(user, 'ADMIN') ? ' Use Run ETL to load the warehouse.' : ''}</p> : <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2">{last.status === 'SUCCESS' ? <CheckCircle2 className="text-tide-600" /> : last.status === 'FAILED' ? <XCircle className="text-alert-600" /> : <Clock />}<strong>{last.status}</strong><span className="text-ink-500">run #{last.id}</span></p>
        <div className="grid grid-cols-2 gap-2">{[['Extracted', last.extracted], ['Transformed', last.transformed], ['Loaded', last.loaded], ['Rejected', last.rejected]].map(([l, v]) =>
          <div key={l as string} className="rounded bg-ink-50 px-3 py-2"><p className="text-xs text-ink-500">{l}</p><p className="text-lg font-semibold">{num(v)}</p></div>)}</div>
        <p className="text-xs text-ink-500">Started {dateTime(last.startedAt)} · ended {dateTime(last.endedAt)}</p>
        {Array.isArray(last.errors) && last.errors.length > 0 && <div><p className="label">Rejected records and errors</p>
          <DataTable max="max-h-48" rows={last.errors} columns={[{ key: 'recordId', label: 'Record' }, { key: 'rule', label: 'Rule' }, { key: 'message', label: 'Message' }]} /></div>}
      </div>}</Panel>
    </div>
    <Panel title="ETL history" className="mt-4">
      <DataTable rows={s?.runs ?? []} columns={[{ key: 'id', label: 'Run' }, { key: 'status', label: 'Status', render: r => <Badge tone={r.status === 'SUCCESS' ? 'teal' : r.status === 'FAILED' ? 'alert' : 'amber'}>{r.status}</Badge> },
        { key: 'startedAt', label: 'Started', render: r => dateTime(r.startedAt) }, { key: 'endedAt', label: 'Ended', render: r => dateTime(r.endedAt) },
        { key: 'extracted', label: 'Extracted', align: 'right' }, { key: 'loaded', label: 'Loaded', align: 'right' }, { key: 'rejected', label: 'Rejected', align: 'right' }]} />
    </Panel>
    <Panel title="Tables" className="mt-4">
      <DataTable rows={schema.data ?? []} columns={[{ key: 'name', label: 'Table' }, { key: 'kind', label: 'Type' }, { key: 'rows', label: 'Rows', align: 'right', render: r => num(r.rows) }, { key: 'columns', label: 'Columns', render: r => <span className="whitespace-normal text-xs">{r.columns.join(', ')}</span> }]} />
    </Panel>
    <div className="mt-4"><Disclaimer>Re-running the ETL is safe: facts are keyed on the source record ID and updated in place, so no duplicates are created.</Disclaimer></div>
  </>;
}
