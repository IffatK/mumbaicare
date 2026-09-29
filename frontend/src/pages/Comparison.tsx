import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line } from 'recharts';
import { api } from '../lib/api';
import { useHospitals } from '../components/HospitalFilter';
import { PageHeader, Panel, Loading, ErrorState, DataTable, ExportBtn, Disclaimer, Badge, Empty } from '../components/ui';
import { ChartBox, axis, grid, tip, legend, XAxis, YAxis } from '../components/Charts';
import { COLORS, SEV_COLORS, inr, inrShort, num } from '../lib/format';
import { downloadCsv } from '../lib/csv';
const SMALL = 100;
const short = (s: string) => s.replace(' (Demo)', '');
export default function Comparison() {
  const { data: hs = [] } = useHospitals(); const [sel, setSel] = useState<number[]>([]);
  const ids = sel.length ? sel : hs.slice(0, 3).map(h => h.id);
  const q = useQuery({ queryKey: ['compare', ids], enabled: ids.length > 0, queryFn: () => api('/analytics/hospitals', { query: { hospitalIds: ids.join(',') } }) });
  const d: any = q.data; const names: string[] = d?.metrics.map((m: any) => m.name) ?? [];
  const pivot = (rows: any[], key = 'name') => Object.values(rows.reduce((a: any, r: any) => { (a[r[key]] ??= { [key]: r[key] })[short(r.hospital)] = r.value; return a; }, {}));
  return <>
    <PageHeader title="Hospital comparison" description="Descriptive statistics side by side. Differences reflect the synthetic data and are not a ranking of care quality." />
    <div className="panel mb-4 p-3"><p className="label">Hospitals to compare</p><div className="flex flex-wrap gap-2">{hs.map(h => { const on = ids.includes(h.id);
      return <button key={h.id} aria-pressed={on} onClick={() => setSel(on ? ids.filter(i => i !== h.id) : [...ids, h.id])}
        className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-navy-900 bg-navy-900 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'}`}>{short(h.name)}</button>; })}</div></div>
    {!ids.length ? <Empty title="Select at least one hospital" /> : q.isError ? <ErrorState error={q.error} /> : q.isLoading ? <Loading h="h-96" /> : <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Metrics" className="lg:col-span-2" actions={<ExportBtn onClick={() => downloadCsv('hospital-comparison.csv', d.metrics)} />}>
        <DataTable rows={d.metrics} columns={[{ key: 'name', label: 'Hospital', render: r => <span className="flex items-center gap-2">{r.name}{r.total < SMALL && <Badge tone="amber">Small sample (n={r.total})</Badge>}</span> },
          { key: 'total', label: 'Patients', align: 'right', render: r => num(r.total) }, { key: 'admissions', label: 'Admissions', align: 'right' }, { key: 'discharges', label: 'Discharges', align: 'right' },
          { key: 'avgStay', label: 'Avg stay (days)', align: 'right' }, { key: 'avgCost', label: 'Avg cost', align: 'right', render: r => inr(r.avgCost) }, { key: 'totalCost', label: 'Total cost', align: 'right', render: r => inrShort(r.totalCost) }]} /></Panel>
      <Panel title="Average stay and cost">
        <ChartBox label="Average stay by hospital"><BarChart data={d.metrics.map((m: any) => ({ ...m, name: short(m.name) }))}>{grid}<XAxis dataKey="name" {...axis} /><YAxis yAxisId="a" {...axis} /><YAxis yAxisId="b" orientation="right" {...axis} tickFormatter={inrShort} width={65} />{tip}{legend}
          <Bar yAxisId="a" dataKey="avgStay" name="Avg stay (days)" fill="#0E8C83" /><Bar yAxisId="b" dataKey="avgCost" name="Avg cost (₹)" fill="#1D5FA8" /></BarChart></ChartBox></Panel>
      <Panel title="Severity distribution">
        <ChartBox label="Severity per hospital"><BarChart data={Object.values(d.severity.reduce((a: any, r: any) => { (a[r.hospital] ??= { hospital: short(r.hospital) })[r.name] = r.value; return a; }, {})) as any[]}>
          {grid}<XAxis dataKey="hospital" {...axis} /><YAxis {...axis} />{tip}{legend}
          {['MILD', 'MODERATE', 'SEVERE'].map(s => <Bar key={s} dataKey={s} stackId="x" name={s[0] + s.slice(1).toLowerCase()} fill={SEV_COLORS[s]} />)}</BarChart></ChartBox></Panel>
      <Panel title="Condition mix">
        <ChartBox h={300} label="Condition counts per hospital"><BarChart data={pivot(d.disease)} layout="vertical">{grid}<XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" width={140} {...axis} />{tip}{legend}
          {names.map((n, i) => <Bar key={n} dataKey={short(n)} fill={COLORS[i % COLORS.length]} />)}</BarChart></ChartBox></Panel>
      <Panel title="Monthly admissions">
        <ChartBox h={300} label="Monthly admissions per hospital"><LineChart data={Object.values(d.monthly.reduce((a: any, r: any) => { (a[r.period] ??= { period: r.period })[short(r.hospital)] = r.value; return a; }, {})) as any[]}>
          {grid}<XAxis dataKey="period" {...axis} minTickGap={24} /><YAxis {...axis} />{tip}{legend}
          {names.map((n, i) => <Line key={n} dataKey={short(n)} stroke={COLORS[i % COLORS.length]} dot={false} />)}</LineChart></ChartBox></Panel>
      <div className="lg:col-span-2"><Disclaimer>Hospitals with fewer than {SMALL} records are flagged. Comparisons describe synthetic volumes and costs only; they do not indicate that any hospital is medically better or worse.</Disclaimer></div>
    </div>}
  </>;
}
