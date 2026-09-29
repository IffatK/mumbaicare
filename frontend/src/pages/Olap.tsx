import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BarChart, Bar, Cell } from 'recharts';
import { ArrowUpFromLine, ArrowDownToLine, Slice, Dice5, Repeat, Play, X } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Panel, Loading, ErrorState, DataTable, ExportBtn, Disclaimer, Empty, Spinner, Badge } from '../components/ui';
import { ChartBox, axis, grid, tip, XAxis, YAxis } from '../components/Charts';
import { COLORS } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { useToast } from '../components/Toast';
const TIME = ['year', 'quarter', 'month', 'day']; // coarse -> fine
const FILTERABLE = ['hospital', 'disease', 'severity', 'year', 'gender', 'ageGroup', 'area'];
type Filter = { dimension: string; values: (string | number)[] };
export default function Olap() {
  const toast = useToast();
  const meta = useQuery({ queryKey: ['olap-meta'], queryFn: () => api('/olap/meta') });
  const [rows, setRows] = useState<string[]>(['hospital']);
  const [columns, setColumns] = useState<string[]>(['year']);
  const [measure, setMeasure] = useState('patientCount');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [draft, setDraft] = useState<{ dimension: string; values: string[] }>({ dimension: 'hospital', values: [] });
  const [lastOp, setLastOp] = useState('Aggregate');
  const run = useMutation({ mutationFn: (b: any) => api('/olap/query', { method: 'POST', body: b }), onError: (e: any) => toast('err', e.message) });
  const exec = (op: string, next?: { rows?: string[]; columns?: string[]; filters?: Filter[] }) => {
    const b = { rows: next?.rows ?? rows, columns: next?.columns ?? columns, measure, filters: next?.filters ?? filters };
    if (next?.rows) setRows(next.rows); if (next?.columns) setColumns(next.columns); if (next?.filters) setFilters(next.filters);
    setLastOp(op); run.mutate(b);
  };
  const label = (k: string) => meta.data?.dimensions.find((d: any) => d.key === k)?.label ?? k;
  // time level currently in use (rows or columns)
  const timeIn = (arr: string[]) => arr.find(d => TIME.includes(d));
  const shiftTime = (dir: 1 | -1) => {
    const inRows = timeIn(rows), inCols = timeIn(columns); const cur = inRows ?? inCols;
    if (!cur) { exec(dir === 1 ? 'Drill-down' : 'Roll-up', { rows: [...rows, dir === 1 ? 'year' : 'year'].slice(0, 3) }); return; }
    const i = TIME.indexOf(cur) + dir;
    if (i < 0) { exec('Roll-up', inRows ? { rows: rows.length > 1 ? rows.filter(r => r !== cur) : rows } : { columns: [] }); return; } // roll up past year = remove time
    if (i >= TIME.length) { toast('err', 'Already at the finest level (day).'); return; }
    const swap = (a: string[]) => a.map(x => (x === cur ? TIME[i] : x));
    exec(dir === 1 ? 'Drill-down' : 'Roll-up', inRows ? { rows: swap(rows) } : { columns: swap(columns) });
  };
  const addFilter = () => {
    if (!draft.values.length) return toast('err', 'Pick at least one value to filter on.');
    const next = [...filters.filter(f => f.dimension !== draft.dimension), { dimension: draft.dimension, values: draft.dimension === 'year' ? draft.values.map(Number) : draft.values }];
    exec(next.length > 1 ? 'Dice' : 'Slice', { filters: next });
  };
  const r: any = run.data;
  const chartKey = rows[0];
  const chartData = r ? (r.pivot ? r.pivot.rows.map((x: any) => ({ name: String(x[chartKey]), value: r.pivot.columns.reduce((s: number, c: string) => s + (Number(x[c]) || 0), 0) }))
    : Object.values(r.rows.reduce((a: any, x: any) => { const k = String(x[chartKey]); (a[k] ??= { name: k, value: 0 }).value += Number(x.value) || 0; return a; }, {}))) : [];
  const avgMeasure = measure.startsWith('avg');
  if (meta.isLoading) return <Loading h="h-96" />;
  if (meta.isError) return <ErrorState error={meta.error} />;
  const M: any = meta.data;
  const DimSelect = ({ value, onChange, allowNone, id }: any) => <select id={id} className="input" value={value} onChange={e => onChange(e.target.value)}>
    {allowNone && <option value="">None</option>}{M.dimensions.map((d: any) => <option key={d.key} value={d.key}>{d.label}</option>)}</select>;
  return <>
    <PageHeader title="OLAP explorer" description="Query the star-schema cube. Each operation runs a new aggregation pipeline on the warehouse." />
    <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
      <Panel title="Cube query">
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i}><label className="label" htmlFor={`r${i}`}>{i === 0 ? 'Rows' : `Rows, level ${i + 1}`}</label>
            <DimSelect id={`r${i}`} allowNone={i > 0} value={rows[i] ?? ''} onChange={(v: string) => { const n = [...rows]; if (v) n[i] = v; else n.splice(i); setRows(n.filter(Boolean)); }} /></div>).slice(0, Math.min(3, rows.length + 1))}
          <div><label className="label" htmlFor="col">Columns (pivot)</label><DimSelect id="col" allowNone value={columns[0] ?? ''} onChange={(v: string) => setColumns(v ? [v] : [])} /></div>
          <div><label className="label" htmlFor="m">Measure</label><select id="m" className="input" value={measure} onChange={e => setMeasure(e.target.value)}>{M.measures.map((m: any) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></div>
          <button className="btn-primary w-full" onClick={() => exec('Aggregate')} disabled={run.isPending}>{run.isPending ? <Spinner /> : <Play size={15} />}Run query</button>
          <div className="border-t border-ink-100 pt-3"><p className="label">Slice and dice</p>
            <div className="flex gap-2"><select aria-label="Filter dimension" className="input" value={draft.dimension} onChange={e => setDraft({ dimension: e.target.value, values: [] })}>
              {FILTERABLE.map(k => <option key={k} value={k}>{label(k)}</option>)}</select></div>
            <select aria-label="Filter values" multiple className="input mt-2 h-28" value={draft.values} onChange={e => setDraft({ ...draft, values: [...e.target.selectedOptions].map(o => o.value) })}>
              {(M.values[draft.dimension] ?? []).map((v: any) => <option key={v} value={v}>{v}</option>)}</select>
            <p className="mt-1 text-xs text-ink-500">Ctrl/Cmd-click to choose several values.</p>
            <button className="btn-ghost mt-2 w-full" onClick={addFilter}>{filters.length ? <Dice5 size={15} /> : <Slice size={15} />}Apply filter</button>
            {filters.length > 0 && <ul className="mt-2 space-y-1">{filters.map(f => <li key={f.dimension} className="flex items-center justify-between rounded bg-ink-100 px-2 py-1 text-xs">
              <span><strong>{label(f.dimension)}:</strong> {f.values.join(', ')}</span>
              <button aria-label={`Remove ${label(f.dimension)} filter`} onClick={() => exec('Remove filter', { filters: filters.filter(x => x !== f) })}><X size={13} /></button></li>)}</ul>}
          </div>
        </div>
      </Panel>
      <div className="min-w-0 space-y-4">
        <div className="panel flex flex-wrap gap-2 p-3">
          <button className="btn-ghost" onClick={() => shiftTime(-1)}><ArrowUpFromLine size={15} />Roll up time</button>
          <button className="btn-ghost" onClick={() => shiftTime(1)}><ArrowDownToLine size={15} />Drill down time</button>
          <button className="btn-ghost" disabled={!columns.length} onClick={() => exec('Pivot', { rows: [columns[0], ...rows.slice(1)], columns: [rows[0]] })}><Repeat size={15} />Pivot rows and columns</button>
          <span className="ml-auto self-center text-xs text-ink-500">Time hierarchy: year › quarter › month › day</span>
        </div>
        {run.isError ? <ErrorState error={run.error} /> : !r ? <div className="panel"><Empty title="Run a query to see results" hint="Start with Hospital by Admission year, then try the operations above." /></div> : <>
          <div className="panel flex flex-wrap items-center gap-2 px-4 py-3 text-sm"><Badge tone="teal">{lastOp}</Badge><span className="text-ink-700">{r.explain}</span><span className="ml-auto text-xs text-ink-500">{r.rows.length} cells · {r.ms} ms</span></div>
          <Panel title={`${M.measures.find((m: any) => m.key === measure)?.label} by ${label(chartKey)}`} subtitle={avgMeasure && (r.pivot || rows.length > 1) ? 'Chart shows the sum of averages across sub-groups; use the table for exact values.' : undefined}>
            {chartData.length ? <ChartBox h={Math.max(240, Math.min(chartData.length, 30) * 22)} label="OLAP result chart"><BarChart data={chartData.slice(0, 30)} layout="vertical">{grid}
              <XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" width={160} {...axis} />{tip}<Bar dataKey="value" name="Value">{chartData.slice(0, 30).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % 3]} />)}</Bar></BarChart></ChartBox> : <Empty />}
          </Panel>
          <Panel title="Result table" actions={<ExportBtn onClick={() => downloadCsv('olap-result.csv', r.pivot ? r.pivot.rows : r.rows)} />}>
            {r.pivot ? <DataTable rows={r.pivot.rows} columns={[...rows.map(d => ({ key: d, label: label(d) })), ...r.pivot.columns.map((c: string) => ({ key: c, label: c, align: 'right' as const }))]} />
              : <DataTable rows={r.rows} columns={[...rows.map(d => ({ key: d, label: label(d) })), { key: 'value', label: 'Value', align: 'right' as const }]} />}
          </Panel>
        </>}
        <Disclaimer />
      </div>
    </div>
  </>;
}
