import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { api } from '../lib/api';
import { useFilters, filterQuery } from '../lib/filters';
import GlobalFilterBar from '../components/HospitalFilter';
import { useConditions } from './Patients';
import { PageHeader, Panel, Loading, ErrorState, DataTable, ExportBtn, Disclaimer } from '../components/ui';
import { ChartBox, axis, grid, tip, legend, XAxis, YAxis } from '../components/Charts';
import { COLORS, SEV_COLORS } from '../lib/format';
import { downloadCsv } from '../lib/csv';
export default function Diseases() {
  const { f } = useFilters(); const { data: conds = [] } = useConditions();
  const [x, setX] = useState({ condition: '', severity: '', gender: '' });
  const q = useQuery({ queryKey: ['diseases', f, x], queryFn: () => api('/analytics/diseases', { query: { ...filterQuery(f), ...x } }) });
  const d: any = q.data;
  // reshape trend into one column per condition (top 5 only, for readability)
  const top = d?.byDisease.slice(0, 5).map((r: any) => r.name) ?? [];
  const trend = d ? Object.values(d.trend.reduce((acc: any, r: any) => { if (!top.includes(r.name)) return acc; (acc[r.period] ??= { period: r.period })[r.name] = r.value; return acc; }, {})) : [];
  return <>
    <PageHeader title="Disease and severity" description="Condition counts, severity mix, age groups and trends. Cross-filter with the controls below." />
    <GlobalFilterBar />
    <div className="panel mb-4 grid gap-3 p-3 sm:grid-cols-3">
      <select aria-label="Condition" className="input" value={x.condition} onChange={e => setX({ ...x, condition: e.target.value })}><option value="">All conditions</option>{conds.map(c => <option key={c}>{c}</option>)}</select>
      <select aria-label="Severity" className="input" value={x.severity} onChange={e => setX({ ...x, severity: e.target.value })}><option value="">All severities</option><option value="MILD">Mild</option><option value="MODERATE">Moderate</option><option value="SEVERE">Severe</option></select>
      <select aria-label="Gender" className="input" value={x.gender} onChange={e => setX({ ...x, gender: e.target.value })}><option value="">All genders</option><option>Male</option><option>Female</option><option>Other</option></select>
    </div>
    {q.isError ? <ErrorState error={q.error} retry={q.refetch} /> : q.isLoading ? <Loading h="h-96" /> : <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Severity mix by condition" className="lg:col-span-2">
        <ChartBox h={320} label="Stacked bars of severity per condition"><BarChart data={d.byDisease}>{grid}<XAxis dataKey="name" {...axis} interval={0} angle={-20} textAnchor="end" height={70} /><YAxis {...axis} />{tip}{legend}
          <Bar dataKey="mild" stackId="s" name="Mild" fill={SEV_COLORS.MILD} /><Bar dataKey="moderate" stackId="s" name="Moderate" fill={SEV_COLORS.MODERATE} /><Bar dataKey="severe" stackId="s" name="Severe" fill={SEV_COLORS.SEVERE} /></BarChart></ChartBox></Panel>
      <Panel title="Monthly trend, five most frequent conditions">
        <ChartBox h={280} label="Condition trend lines"><LineChart data={trend as any[]}>{grid}<XAxis dataKey="period" {...axis} minTickGap={24} /><YAxis {...axis} />{tip}{legend}
          {top.map((t: string, i: number) => <Line key={t} dataKey={t} stroke={COLORS[i]} dot={false} strokeWidth={1.8} />)}</LineChart></ChartBox></Panel>
      <Panel title="Age groups">
        <ChartBox h={280} label="Patients by age group"><BarChart data={d.ageGroups}>{grid}<XAxis dataKey="grp" {...axis} /><YAxis {...axis} />{tip}<Bar dataKey="value" name="Patients" fill="#12325A" /></BarChart></ChartBox></Panel>
      <Panel title="Gender">
        <ChartBox h={240} label="Patients by gender"><PieChart><Pie data={d.gender} dataKey="value" nameKey="name" outerRadius={85}>{d.gender.map((_: any, i: number) => <Cell key={i} fill={COLORS[i]} />)}</Pie>{tip}{legend}</PieChart></ChartBox></Panel>
      <Panel title="Condition table" actions={<ExportBtn onClick={() => downloadCsv('conditions.csv', d.byDisease)} />}>
        <DataTable rows={d.byDisease} max="max-h-60" columns={[{ key: 'name', label: 'Condition' }, { key: 'total', label: 'Patients', align: 'right' }, { key: 'severe', label: 'Severe', align: 'right' }, { key: 'avgAge', label: 'Avg age', align: 'right' }]} /></Panel>
      <div className="lg:col-span-2"><Disclaimer>Counts describe the synthetic dataset. They are not prevalence estimates and support no clinical conclusion.</Disclaimer></div>
    </div>}
  </>;
}
