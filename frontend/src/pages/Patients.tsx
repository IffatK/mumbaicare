import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, ArrowUpDown } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { useHospitals } from '../components/HospitalFilter';
import { PageHeader, Panel, Loading, ErrorState, Empty, SevBadge, Badge, ExportBtn, Disclaimer } from '../components/ui';
import { date, inr } from '../lib/format';
import { downloadCsv } from '../lib/csv';
export const useConditions = () => useQuery({ queryKey: ['conditions'], queryFn: () => api<string[]>('/patients/conditions') });
export default function Patients() {
  const { user } = useAuth(); const nav = useNavigate();
  const { data: hs = [] } = useHospitals(); const { data: conds = [] } = useConditions();
  const [f, setF] = useState({ page: 1, pageSize: 20, search: '', hospitalId: '', condition: '', severity: '', status: '', from: '', to: '', sort: 'admissionDate', dir: 'desc' });
  const set = (p: Partial<typeof f>) => setF(x => ({ ...x, page: 1, ...p }));
  const q = useQuery({ queryKey: ['patients', f], queryFn: () => api('/patients', { query: f }), placeholderData: p => p });
  const sortBy = (k: string) => setF(x => ({ ...x, sort: k, dir: x.sort === k && x.dir === 'desc' ? 'asc' : 'desc' }));
  const exportAll = async () => { const r = await api('/patients', { query: { ...f, all: 'true' } });
    downloadCsv('patients.csv', r.rows.map(({ hospital, ...p }: any) => ({ ...p, hospital: hospital.name }))); };
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / f.pageSize)) : 1;
  const Sort = ({ k, children }: any) => <button className="inline-flex items-center gap-1 hover:text-navy-900" onClick={() => sortBy(k)}>{children}<ArrowUpDown size={12} className={f.sort === k ? 'text-harbor-600' : ''} /></button>;
  return <>
    <PageHeader title="Patient records" description={user?.role === 'STAFF' ? `Records for ${user.hospitalName}.` : 'Synthetic patient admissions across all demo hospitals.'}
      actions={<><ExportBtn onClick={exportAll} />{can(user, 'ADMIN', 'STAFF') && <Link to="/app/patients/new" className="btn-primary"><Plus size={16} />Add patient</Link>}</>} />
    <Panel className="mb-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="relative sm:col-span-2 xl:col-span-2"><Search size={16} className="absolute left-2.5 top-2.5 text-ink-300" />
          <input aria-label="Search" className="input pl-8" placeholder="Record ID, condition or treatment" value={f.search} onChange={e => set({ search: e.target.value })} /></div>
        {user?.role !== 'STAFF' && <select aria-label="Hospital" className="input" value={f.hospitalId} onChange={e => set({ hospitalId: e.target.value })}><option value="">All hospitals</option>{hs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>}
        <select aria-label="Condition" className="input" value={f.condition} onChange={e => set({ condition: e.target.value })}><option value="">All conditions</option>{conds.map(c => <option key={c}>{c}</option>)}</select>
        <select aria-label="Severity" className="input" value={f.severity} onChange={e => set({ severity: e.target.value })}><option value="">All severities</option><option value="MILD">Mild</option><option value="MODERATE">Moderate</option><option value="SEVERE">Severe</option></select>
        <select aria-label="Status" className="input" value={f.status} onChange={e => set({ status: e.target.value })}><option value="">Any status</option><option value="ADMITTED">Admitted</option><option value="DISCHARGED">Discharged</option></select>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-2 xl:col-span-1"><input aria-label="Admitted from" type="date" className="input" value={f.from} onChange={e => set({ from: e.target.value })} /><input aria-label="Admitted to" type="date" className="input" value={f.to} onChange={e => set({ to: e.target.value })} /></div>
      </div>
    </Panel>
    {q.isError ? <ErrorState error={q.error} retry={q.refetch} /> : q.isLoading ? <Loading h="h-96" /> : !q.data.rows.length ? <Empty title="No records match" hint="Clear a filter or search term." /> :
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto"><table className="min-w-full">
        <thead><tr>{[['Record', 'recordId'], ['Hospital'], ['Age', 'age'], ['Gender'], ['Condition'], ['Severity'], ['Admitted', 'admissionDate'], ['Discharged'], ['Stay', 'stayDays'], ['Treatment'], ['Cost', 'cost'], ['Status']]
          .map(([l, k]) => <th key={l} className="th">{k ? <Sort k={k}>{l}</Sort> : l}</th>)}</tr></thead>
        <tbody>{q.data.rows.map((p: any) => <tr key={p.id} className="cursor-pointer hover:bg-harbor-100/40" onClick={() => nav(`/app/patients/${p.id}`)}>
          <td className="td font-semibold text-harbor-600"><Link to={`/app/patients/${p.id}`} onClick={e => e.stopPropagation()}>{p.recordId}</Link></td>
          <td className="td max-w-[12rem] truncate">{p.hospital.name.replace(' (Demo)', '')}</td><td className="td">{p.age}</td><td className="td">{p.gender}</td>
          <td className="td">{p.condition}</td><td className="td"><SevBadge s={p.severity} /></td><td className="td">{date(p.admissionDate)}</td>
          <td className="td">{date(p.dischargeDate)}</td><td className="td">{p.stayDays ?? '—'}</td><td className="td">{p.treatment}</td>
          <td className="td text-right">{inr(p.cost)}</td><td className="td"><Badge tone={p.status === 'ADMITTED' ? 'blue' : 'ink'}>{p.status === 'ADMITTED' ? 'Admitted' : 'Discharged'}</Badge></td></tr>)}</tbody>
      </table></div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 px-4 py-3 text-sm text-ink-500">
        <span>{q.data.total.toLocaleString('en-IN')} records · page {f.page} of {pages}</span>
        <div className="flex items-center gap-2">
          <select aria-label="Rows per page" className="input !w-auto !py-1" value={f.pageSize} onChange={e => set({ pageSize: Number(e.target.value) })}>{[20, 50, 100].map(n => <option key={n} value={n}>{n} per page</option>)}</select>
          <button className="btn-ghost !py-1" disabled={f.page <= 1} onClick={() => setF(x => ({ ...x, page: x.page - 1 }))}>Previous</button>
          <button className="btn-ghost !py-1" disabled={f.page >= pages} onClick={() => setF(x => ({ ...x, page: x.page + 1 }))}>Next</button></div>
      </div>
    </div>}
    <div className="mt-4"><Disclaimer /></div>
  </>;
}
