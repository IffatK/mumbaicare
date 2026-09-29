import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileText, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { useHospitals } from '../components/HospitalFilter';
import { PageHeader, Panel, Spinner, DataTable, ExportBtn, Disclaimer, Empty, ErrorState } from '../components/ui';
import { dateTime, date, inr, inrShort, num, sevLabel } from '../lib/format';
import { downloadCsv } from '../lib/csv';
export default function Reports() {
  const { user } = useAuth(); const toast = useToast(); const { data: hs = [] } = useHospitals();
  const [p, setP] = useState({ title: 'MumbaiCare analytical report', hospitalIds: [] as number[], from: '', to: '', includeMining: false });
  const gen = useMutation({ mutationFn: () => api('/reports/generate', { method: 'POST', body: { ...p, from: p.from || undefined, to: p.to || undefined } }),
    onSuccess: () => toast('ok', 'Report generated'), onError: (e: any) => toast('err', e.message) });
  const r: any = gen.data;
  const H = ({ children }: any) => <h2 className="mb-2 mt-6 border-b border-ink-200 pb-1 font-display text-lg font-semibold text-navy-900">{children}</h2>;
  return <>
    <div className="print:hidden"><PageHeader title="Reports" description="Generate a report from live data, then print it or save it as PDF from the print dialog." />
      <Panel className="mb-4"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2"><label className="label" htmlFor="rt">Report title</label><input id="rt" className="input" value={p.title} onChange={e => setP({ ...p, title: e.target.value })} /></div>
        {user?.role !== 'STAFF' && <div><label className="label" htmlFor="rh">Hospitals</label><select id="rh" multiple className="input h-[38px] focus:h-32" value={p.hospitalIds.map(String)} onChange={e => setP({ ...p, hospitalIds: [...e.target.selectedOptions].map(o => +o.value) })}>
          {hs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>}
        <div><label className="label" htmlFor="rf">From</label><input id="rf" type="date" className="input" value={p.from} onChange={e => setP({ ...p, from: e.target.value })} /></div>
        <div><label className="label" htmlFor="rto">To</label><input id="rto" type="date" className="input" value={p.to} onChange={e => setP({ ...p, to: e.target.value })} /></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {user?.role !== 'STAFF' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.includeMining} onChange={e => setP({ ...p, includeMining: e.target.checked })} />Include K-Means summary</label>}
        <button className="btn-primary ml-auto" disabled={gen.isPending} onClick={() => gen.mutate()}>{gen.isPending ? <Spinner /> : <FileText size={16} />}Generate report</button>
        {r && <button className="btn-ghost" onClick={() => window.print()}><Printer size={16} />Print or save PDF</button>}
      </div></Panel></div>
    {gen.isError ? <ErrorState error={gen.error} /> : !r ? <div className="panel print:hidden"><Empty title="No report yet" hint="Choose filters and generate a report." /></div> :
    <article className="panel mx-auto max-w-4xl p-6 print:border-0 print:p-0 sm:p-10">
      <header className="border-b-2 border-navy-900 pb-4"><p className="text-sm font-semibold text-tide-700">MumbaiCare</p><h1 className="font-display text-3xl font-semibold text-navy-900">{r.title}</h1>
        <p className="mt-2 text-sm text-ink-500">Generated {dateTime(r.generatedAt)} by {r.generatedBy} · Hospitals: {r.hospitals.join(', ')} · Admissions {r.range.from ? date(r.range.from) : 'from start'} to {r.range.to ? date(r.range.to) : 'latest'}</p>
        <p className="text-sm text-ink-500">Warehouse last refreshed: {r.freshness ? dateTime(r.freshness) : 'not yet loaded'}</p></header>
      <H>Dataset summary</H>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[['Records', num(r.summary.total)], ['Admitted now', num(r.summary.admitted)], ['Discharged', num(r.summary.discharged)], ['Avg stay', `${num(r.summary.avgStay, 1)} days`],
        ['Avg cost', inr(r.summary.avgCost)], ['Total cost', inrShort(r.summary.totalCost)], ['First admission', date(r.summary.firstAdmission)], ['Last admission', date(r.summary.lastAdmission)]].map(([l, v]) =>
        <div key={l}><p className="text-xs text-ink-500">{l}</p><p className="font-semibold">{v}</p></div>)}</div>
      <H>Disease and severity</H>
      <div className="mb-2 flex justify-end print:hidden"><ExportBtn onClick={() => downloadCsv('report-diseases.csv', r.diseases)} /></div>
      <DataTable max="" rows={r.diseases} columns={[{ key: 'name', label: 'Condition' }, { key: 'total', label: 'Patients', align: 'right' }, { key: 'severe', label: 'Severe', align: 'right' }, { key: 'avgCost', label: 'Avg cost', align: 'right', render: x => inr(x.avgCost) }]} />
      <p className="mt-2 text-sm">Severity: {r.severity.map((s: any) => `${sevLabel(s.name)} ${num(s.total)}`).join(' · ')}</p>
      <H>Treatment cost and hospital comparison</H>
      <div className="mb-2 flex justify-end print:hidden"><ExportBtn onClick={() => downloadCsv('report-hospitals.csv', r.hospitalComparison)} /></div>
      <DataTable max="" rows={r.hospitalComparison} columns={[{ key: 'name', label: 'Hospital' }, { key: 'total', label: 'Patients', align: 'right' }, { key: 'avgStay', label: 'Avg stay', align: 'right' }, { key: 'avgCost', label: 'Avg cost', align: 'right', render: x => inr(x.avgCost) }, { key: 'totalCost', label: 'Total cost', align: 'right', render: x => inrShort(x.totalCost) }]} />
      <H>OLAP roll-up: admissions by quarter (warehouse)</H>
      <DataTable max="" rows={r.olapQuarterly.map((x: any) => ({ ...x, period: `${x.year} Q${x.quarter}` }))} columns={[{ key: 'period', label: 'Quarter' }, { key: 'admissions', label: 'Admissions', align: 'right' }, { key: 'avgCost', label: 'Avg cost', align: 'right', render: x => inr(x.avgCost) }]} />
      {r.mining && <><H>K-Means summary (age, stay, cost; K = 3)</H>{r.mining.error ? <p className="text-sm text-alert-600">{r.mining.error}</p> :
        <p className="text-sm">Silhouette {r.mining.silhouette}. Cluster sizes: {r.mining.sizes.map((c: any) => `cluster ${c.cluster} = ${num(c.size)}`).join(', ')}.</p>}</>}
      <div className="mt-8"><Disclaimer>Academic-use report built from synthetic, anonymised data. Figures are descriptive statistics and are not medical findings, diagnoses or recommendations.</Disclaimer></div>
    </article>}
  </>;
}
