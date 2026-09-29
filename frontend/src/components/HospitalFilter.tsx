import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useFilters } from '../lib/filters';
import { useAuth } from '../lib/auth';
import { RotateCcw } from 'lucide-react';
export const useHospitals = () => useQuery({ queryKey: ['hospitals'], queryFn: () => api<any[]>('/hospitals') });
/** Global hospital + date-range filter used by the analytics pages. */
export default function GlobalFilterBar() {
  const { f, setF } = useFilters(); const { user } = useAuth(); const { data: hs = [] } = useHospitals();
  const staff = user?.role === 'STAFF';
  return <div className="panel mb-5 flex flex-wrap items-end gap-3 p-3">
    <div className="min-w-[12rem] flex-1">
      <label className="label" htmlFor="gf-h">Hospital</label>
      {staff ? <p className="input bg-ink-50">{user?.hospitalName}</p> :
        <select id="gf-h" className="input" value={f.hospitalIds[0] ?? ''} onChange={e => setF({ ...f, hospitalIds: e.target.value ? [Number(e.target.value)] : [] })}>
          <option value="">All hospitals</option>{hs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>}
    </div>
    <div><label className="label" htmlFor="gf-f">Admitted from</label><input id="gf-f" type="date" className="input" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></div>
    <div><label className="label" htmlFor="gf-t">Admitted to</label><input id="gf-t" type="date" className="input" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></div>
    <button className="btn-ghost" onClick={() => setF({ hospitalIds: [], from: '', to: '' })}><RotateCcw size={14} />Reset</button>
  </div>;
}
