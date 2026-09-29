import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { api } from '../lib/api';
import { useFilters, filterQuery } from '../lib/filters';
import { PageHeader, Kpi, Panel, Loading, ErrorState, Disclaimer, ExportBtn, Empty } from '../components/ui';
import GlobalFilterBar from '../components/HospitalFilter';
import { ChartBox, axis, grid, tip, legend, XAxis, YAxis } from '../components/Charts';
import { num, inr, inrShort, COLORS, SEV_COLORS, sevLabel } from '../lib/format';
import { downloadCsv } from '../lib/csv';
export default function Overview() {
  const { f } = useFilters();
  const q = useQuery({ queryKey: ['overview', f], queryFn: () => api('/analytics/overview', { query: filterQuery(f) }) });
  const d: any = q.data; const k = d?.kpis;
  return <>
    <PageHeader title="Overview" description="Hospital-wide patient statistics calculated live from the operational database." />
    <GlobalFilterBar />
    {q.isError ? <ErrorState error={q.error} retry={q.refetch} /> : <>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {q.isLoading ? Array.from({ length: 8 }).map((_, i) => <Loading key={i} h="h-[84px]" />) : <>
          <Kpi label="Patient records" value={num(k.total)} /><Kpi label="Currently admitted" value={num(k.admitted)} tone="blue" />
          <Kpi label="Discharged" value={num(k.discharged)} tone="teal" /><Kpi label="Hospitals" value={num(k.hospitals)} />
          <Kpi label="Average stay" value={`${num(k.avgStay, 1)} days`} tone="teal" hint="Discharged patients" /><Kpi label="Average treatment cost" value={inr(k.avgCost)} tone="blue" />
          <Kpi label="Total treatment cost" value={inrShort(k.totalCost)} /><Kpi label="Severe cases" value={num(k.severe)} tone="alert" hint={k.total ? `${num(k.severe / k.total * 100, 1)}% of records` : ''} />
        </>}
      </div>
      {q.isLoading ? <Loading h="h-96" /> : !k.total ? <Empty hint="Change the hospital or date filters." /> :
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Admissions per month" actions={<ExportBtn onClick={() => downloadCsv('admissions.csv', d.admissions)} />}>
          <ChartBox label="Line chart of monthly admissions"><LineChart data={d.admissions}>{grid}<XAxis dataKey="period" {...axis} /><YAxis {...axis} />{tip}
            <Line dataKey="value" name="Admissions" stroke="#1D5FA8" strokeWidth={2} dot={false} /></LineChart></ChartBox></Panel>
        <Panel title="Discharges per month" actions={<ExportBtn onClick={() => downloadCsv('discharges.csv', d.discharges)} />}>
          <ChartBox label="Line chart of monthly discharges"><LineChart data={d.discharges}>{grid}<XAxis dataKey="period" {...axis} /><YAxis {...axis} />{tip}
            <Line dataKey="value" name="Discharges" stroke="#0E8C83" strokeWidth={2} dot={false} /></LineChart></ChartBox></Panel>
        <Panel title="Patients by hospital" actions={<ExportBtn onClick={() => downloadCsv('by-hospital.csv', d.byHospital)} />}>
          <ChartBox h={300} label="Bar chart of patients per hospital"><BarChart data={d.byHospital} layout="vertical" margin={{ left: 10 }}>{grid}
            <XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" width={170} {...axis} tickFormatter={(s: string) => s.replace(' (Demo)', '')} />{tip}
            <Bar dataKey="patients" name="Patients" fill="#12325A" radius={[0, 3, 3, 0]} /></BarChart></ChartBox></Panel>
        <Panel title="Conditions" actions={<ExportBtn onClick={() => downloadCsv('conditions.csv', d.diseases)} />}>
          <ChartBox h={300} label="Bar chart of patient count per condition"><BarChart data={d.diseases} layout="vertical">{grid}
            <XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" width={150} {...axis} />{tip}
            <Bar dataKey="value" name="Patients" radius={[0, 3, 3, 0]}>{d.diseases.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></ChartBox></Panel>
        <Panel title="Severity distribution">
          <ChartBox label="Donut chart of severity"><PieChart><Pie data={d.severity.map((s: any) => ({ ...s, label: sevLabel(s.name) }))} dataKey="value" nameKey="label" innerRadius={60} outerRadius={95} paddingAngle={2}>
            {d.severity.map((s: any) => <Cell key={s.name} fill={SEV_COLORS[s.name]} />)}</Pie>{tip}{legend}</PieChart></ChartBox></Panel>
        <Panel title="Length of stay" subtitle="Days in hospital; 20 includes 20 or more">
          <ChartBox label="Histogram of stay duration"><BarChart data={d.stayHist}>{grid}<XAxis dataKey="bucket" {...axis} /><YAxis {...axis} />{tip}
            <Bar dataKey="value" name="Patients" fill="#0E8C83" /></BarChart></ChartBox></Panel>
        <Panel title="Average treatment cost by hospital">
          <ChartBox h={300} label="Bar chart of average cost by hospital"><BarChart data={d.byHospital}>{grid}
            <XAxis dataKey="name" {...axis} interval={0} angle={-25} textAnchor="end" height={70} tickFormatter={(s: string) => s.replace(' (Demo)', '').split(' ')[0]} />
            <YAxis {...axis} tickFormatter={inrShort} width={70} /><Tooltip2 /><Bar dataKey="avgCost" name="Average cost" fill="#1D5FA8" radius={[3, 3, 0, 0]} /></BarChart></ChartBox></Panel>
        <Panel title="Age and treatment cost" subtitle="First 600 matching records">
          <ChartBox h={300} label="Scatter plot of age against treatment cost"><ScatterChart>{grid}<XAxis dataKey="age" name="Age" type="number" {...axis} />
            <YAxis dataKey="cost" name="Cost" type="number" {...axis} tickFormatter={inrShort} width={70} /><ZAxis range={[18, 18]} />{tip}{legend}
            {['MILD', 'MODERATE', 'SEVERE'].map(s => <Scatter key={s} name={sevLabel(s)} data={d.scatter.filter((x: any) => x.severity === s)} fill={SEV_COLORS[s]} fillOpacity={0.6} />)}
          </ScatterChart></ChartBox></Panel>
      </div>}
      <div className="mt-5"><Disclaimer /></div>
    </>}
  </>;
}
import { Tooltip } from 'recharts';
const Tooltip2 = () => <Tooltip formatter={(v: any) => inr(v)} contentStyle={{ borderRadius: 6, fontSize: 12 }} />;
