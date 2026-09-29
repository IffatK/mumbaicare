import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ComposedChart, Bar, Line } from 'recharts';
import { api } from '../lib/api';
import { useFilters, filterQuery } from '../lib/filters';
import GlobalFilterBar from '../components/HospitalFilter';
import { PageHeader, Kpi, Panel, Loading, ErrorState, DataTable, ExportBtn, Disclaimer } from '../components/ui';
import { ChartBox, axis, grid, tip, legend, XAxis, YAxis } from '../components/Charts';
import { num } from '../lib/format';
import { downloadCsv } from '../lib/csv';
export default function Admissions() {
  const { f } = useFilters(); const [grain, setGrain] = useState<'day' | 'month' | 'year'>('month');
  const q = useQuery({ queryKey: ['admissions', f, grain], queryFn: () => api('/analytics/admissions', { query: { ...filterQuery(f), grain } }) });
  const d: any = q.data;
  return <>
    <PageHeader title="Admissions and discharges" description="Admission volume, discharges and length of stay, aggregated in the database." />
    <GlobalFilterBar />
    {q.isError ? <ErrorState error={q.error} retry={q.refetch} /> : q.isLoading ? <Loading h="h-96" /> : <>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Currently admitted" value={num(d.kpis.current)} tone="blue" /><Kpi label="Discharged (historical)" value={num(d.kpis.discharged)} tone="teal" />
        <Kpi label="Average length of stay" value={`${num(d.kpis.avgStay, 1)} days`} /></div>
      <Panel title="Admission-to-discharge trend" subtitle="Bars: admissions in the period. Line: how many of those are now discharged."
        actions={<div className="flex gap-1" role="group" aria-label="Time grain">{(['day', 'month', 'year'] as const).map(g =>
          <button key={g} className={`btn !px-2.5 !py-1 text-xs ${grain === g ? 'bg-navy-900 text-white' : 'btn-ghost'}`} aria-pressed={grain === g} onClick={() => setGrain(g)}>{g[0].toUpperCase() + g.slice(1)}</button>)}</div>}>
        <ChartBox h={300} label="Admissions and discharges over time"><ComposedChart data={d.trend}>{grid}<XAxis dataKey="period" {...axis} minTickGap={20} /><YAxis {...axis} />{tip}{legend}
          <Bar dataKey="admissions" name="Admissions" fill="#1D5FA8" /><Line dataKey="discharged" name="Discharged" stroke="#0E8C83" strokeWidth={2} dot={false} /></ComposedChart></ChartBox>
      </Panel>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="By hospital" actions={<ExportBtn onClick={() => downloadCsv('admissions-by-hospital.csv', d.byHospital)} />}>
          <DataTable rows={d.byHospital} columns={[{ key: 'name', label: 'Hospital' }, { key: 'admissions', label: 'Admissions', align: 'right' },
            { key: 'current', label: 'Admitted now', align: 'right' }, { key: 'discharged', label: 'Discharged', align: 'right' }, { key: 'avgStay', label: 'Avg stay', align: 'right' }]} /></Panel>
        <Panel title={`Detail by ${grain}`} actions={<ExportBtn onClick={() => downloadCsv(`admissions-${grain}.csv`, d.trend)} />}>
          <DataTable rows={[...d.trend].reverse()} columns={[{ key: 'period', label: 'Period' }, { key: 'admissions', label: 'Admissions', align: 'right' },
            { key: 'discharged', label: 'Discharged', align: 'right' }, { key: 'avgStay', label: 'Avg stay (days)', align: 'right' }]} /></Panel>
      </div>
      <div className="mt-4"><Disclaimer /></div>
    </>}
  </>;
}
