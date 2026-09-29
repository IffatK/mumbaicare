import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { useToast } from '../components/Toast';
import { useHospitals } from '../components/HospitalFilter';
import { PageHeader, Loading, ErrorState, Badge, Field, Spinner, Disclaimer } from '../components/ui';
const schema = z.object({ code: z.string().min(2, 'Required'), name: z.string().min(3, 'Required'), area: z.string().min(2, 'Required'),
  type: z.string().min(2), phone: z.string().optional(), email: z.string().email('Invalid email').or(z.literal('')).optional() });
type F = z.infer<typeof schema>;
function HospitalDialog({ initial, onClose }: { initial?: any; onClose: () => void }) {
  const toast = useToast(); const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<F>({ resolver: zodResolver(schema),
    defaultValues: initial ?? { type: 'General', email: '' } });
  const m = useMutation({ mutationFn: (v: F) => api(initial ? `/hospitals/${initial.id}` : '/hospitals', { method: initial ? 'PUT' : 'POST', body: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hospitals'] }); toast('ok', initial ? 'Hospital updated' : 'Hospital added'); onClose(); },
    onError: (e: any) => toast('err', e.message) });
  return <div className="fixed inset-0 z-40 grid place-items-center bg-navy-950/50 p-4" role="dialog" aria-modal aria-label="Hospital details">
    <form onSubmit={handleSubmit(v => m.mutateAsync(v).catch(() => {}))} className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
      <div className="mb-4 flex justify-between"><h2 className="font-display text-lg font-semibold text-navy-900">{initial ? 'Edit hospital' : 'Add hospital'}</h2><button type="button" onClick={onClose} aria-label="Close"><X /></button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Code" error={errors.code?.message}><input className="input" {...register('code')} placeholder="H-KUR-09" /></Field>
        <Field label="Type"><select className="input" {...register('type')}><option>General</option><option>Multi-specialty</option><option>Municipal</option></select></Field>
        <div className="sm:col-span-2"><Field label="Name" error={errors.name?.message}><input className="input" {...register('name')} placeholder="Kurla Example Hospital (Demo)" /></Field></div>
        <Field label="Area" error={errors.area?.message}><input className="input" {...register('area')} /></Field>
        <Field label="Phone (demo)"><input className="input" {...register('phone')} /></Field>
        <div className="sm:col-span-2"><Field label="Email (demo)" error={errors.email?.message}><input className="input" {...register('email')} /></Field></div>
      </div>
      <p className="mt-3 text-xs text-ink-500">Use fictional hospitals only and add "(Demo)" to the name.</p>
      <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner />}Save hospital</button></div>
    </form></div>;
}
export default function Hospitals() {
  const { user } = useAuth(); const q = useHospitals(); const toast = useToast(); const qc = useQueryClient();
  const [dlg, setDlg] = useState<any>(null);
  const toggle = useMutation({ mutationFn: (h: any) => api(`/hospitals/${h.id}`, { method: 'PUT', body: { active: !h.active } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hospitals'] }); toast('ok', 'Status updated'); }, onError: (e: any) => toast('err', e.message) });
  return <>
    <PageHeader title="Hospitals" description="Fictional demo hospitals across Mumbai localities." actions={can(user, 'ADMIN') && <button className="btn-primary" onClick={() => setDlg({})}><Plus size={16} />Add hospital</button>} />
    {q.isError ? <ErrorState error={q.error} /> : q.isLoading ? <Loading /> :
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{q.data!.map(h => <article key={h.id} className={`panel p-4 ${h.active ? '' : 'opacity-60'}`}>
        <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-ink-500">{h.code}</p><h2 className="mt-0.5 font-semibold text-navy-900">{h.name}</h2></div>
          <Badge tone={h.active ? 'teal' : 'ink'}>{h.active ? 'Active' : 'Inactive'}</Badge></div>
        <p className="mt-2 text-sm text-ink-500">{h.area} · {h.type}</p>
        <p className="mt-3 text-2xl font-semibold text-navy-900">{h.patientCount.toLocaleString('en-IN')}<span className="ml-1 text-sm font-normal text-ink-500">patient records</span></p>
        <p className="mt-1 truncate text-xs text-ink-500">{h.phone} {h.email && `· ${h.email}`}</p>
        {can(user, 'ADMIN') && <div className="mt-3 flex gap-2 border-t border-ink-100 pt-3">
          <button className="btn-ghost !py-1 text-xs" onClick={() => setDlg(h)}><Pencil size={13} />Edit</button>
          <button className="btn-ghost !py-1 text-xs" onClick={() => toggle.mutate(h)}>{h.active ? 'Deactivate' : 'Activate'}</button></div>}
      </article>)}</div>}
    <div className="mt-4"><Disclaimer>These hospitals are fictional and do not represent real institutions.</Disclaimer></div>
    {dlg && <HospitalDialog initial={dlg.id ? dlg : undefined} onClose={() => setDlg(null)} />}
  </>;
}
