import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, KeyRound, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { useHospitals } from '../components/HospitalFilter';
import { PageHeader, Loading, ErrorState, Badge, Field, Spinner, DataTable, Disclaimer } from '../components/ui';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Administrator', ANALYST: 'Analyst', STAFF: 'Hospital staff' };
const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => api<any[]>('/users') });

const createSchema = z.object({
  name: z.string().min(2, 'Required'), email: z.string().email('Invalid email'),
  role: z.enum(['ADMIN', 'ANALYST', 'STAFF']), hospitalId: z.string().optional(),
  password: z.string().min(8, 'At least 8 characters'),
}).refine(v => v.role !== 'STAFF' || !!v.hospitalId, { message: 'Pick a hospital for staff', path: ['hospitalId'] });
type CreateF = z.infer<typeof createSchema>;

function AddUserDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast(); const qc = useQueryClient(); const { data: hs = [] } = useHospitals();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<CreateF>({ resolver: zodResolver(createSchema), defaultValues: { role: 'STAFF' } });
  const role = watch('role');
  const m = useMutation({
    mutationFn: (v: CreateF) => api('/users', { method: 'POST', body: { ...v, hospitalId: v.hospitalId ? Number(v.hospitalId) : null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast('ok', 'Account created'); onClose(); },
    onError: (e: any) => toast('err', e.message),
  });
  return <div className="fixed inset-0 z-40 grid place-items-center bg-navy-950/50 p-4" role="dialog" aria-modal aria-label="Add staff or analyst">
    <form onSubmit={handleSubmit(v => m.mutateAsync(v).catch(() => {}))} className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
      <div className="mb-4 flex justify-between"><h2 className="font-display text-lg font-semibold text-navy-900">Add account</h2><button type="button" onClick={onClose} aria-label="Close"><X /></button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" error={errors.name?.message}><input className="input" {...register('name')} /></Field>
        <Field label="Email" error={errors.email?.message}><input className="input" type="email" {...register('email')} /></Field>
        <Field label="Role"><select className="input" {...register('role')}>
          <option value="STAFF">Hospital staff</option><option value="ANALYST">Analyst</option><option value="ADMIN">Administrator</option></select></Field>
        {role === 'STAFF' && <Field label="Hospital" error={errors.hospitalId?.message}><select className="input" {...register('hospitalId')}>
          <option value="">Select hospital</option>{hs.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>}
        <div className="sm:col-span-2"><Field label="Temporary password" error={errors.password?.message}><input className="input" type="text" {...register('password')} placeholder="At least 8 characters" /></Field></div>
      </div>
      <p className="mt-3 text-xs text-ink-500">Share this password with the user directly — they can't reset it themselves yet.</p>
      <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner />}Create account</button></div>
    </form></div>;
}

function ResetPasswordDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const m = useMutation({ mutationFn: () => api(`/users/${user.id}/reset-password`, { method: 'POST', body: { password } }),
    onSuccess: () => { toast('ok', `Password reset for ${user.name}`); onClose(); }, onError: (e: any) => toast('err', e.message) });
  return <div className="fixed inset-0 z-40 grid place-items-center bg-navy-950/50 p-4" role="dialog" aria-modal aria-label="Reset password">
    <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
      <div className="mb-4 flex justify-between"><h2 className="font-display text-lg font-semibold text-navy-900">Reset password</h2><button onClick={onClose} aria-label="Close"><X /></button></div>
      <Field label={`New password for ${user.name}`}><input className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></Field>
      <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={password.length < 8 || m.isPending} onClick={() => m.mutate()}>{m.isPending && <Spinner />}Reset</button></div>
    </div></div>;
}

export default function Users() {
  const { user: me } = useAuth(); const q = useUsers(); const toast = useToast(); const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false); const [resetUser, setResetUser] = useState<any>(null);
  const toggle = useMutation({ mutationFn: (u: any) => api(`/users/${u.id}`, { method: 'PUT', body: { active: !u.active } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast('ok', 'Status updated'); }, onError: (e: any) => toast('err', e.message) });
  return <>
    <PageHeader title="Users & access" description="Create staff and analyst logins, and control who can sign in." actions={<button className="btn-primary" onClick={() => setAddOpen(true)}><Plus size={16} />Add account</button>} />
    {q.isError ? <ErrorState error={q.error} /> : q.isLoading ? <Loading /> :
      <DataTable columns={[
        { key: 'name', label: 'Name', render: (u: any) => <span className="font-medium text-navy-900">{u.name}</span> },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', render: (u: any) => <Badge tone={u.role === 'ADMIN' ? 'blue' : u.role === 'ANALYST' ? 'amber' : 'teal'}>{ROLE_LABEL[u.role]}</Badge> },
        { key: 'hospital', label: 'Hospital', render: (u: any) => q.data!.length ? (u.hospitalId ?? '—') : '—' },
        { key: 'active', label: 'Status', render: (u: any) => <Badge tone={u.active ? 'teal' : 'ink'}>{u.active ? 'Active' : 'Disabled'}</Badge> },
        { key: 'actions', label: '', render: (u: any) => <div className="flex justify-end gap-2">
            <button className="btn-ghost !py-1 text-xs" onClick={() => setResetUser(u)}><KeyRound size={13} />Reset password</button>
            <button className="btn-ghost !py-1 text-xs" disabled={u.id === me?.id} onClick={() => toggle.mutate(u)}>{u.active ? 'Disable' : 'Enable'}</button>
          </div>, align: 'right' as const },
      ]} rows={q.data!} />}
    <div className="mt-4"><Disclaimer>Every account here is a demo login for coursework use — never store a real person's actual password.</Disclaimer></div>
    {addOpen && <AddUserDialog onClose={() => setAddOpen(false)} />}
    {resetUser && <ResetPasswordDialog user={resetUser} onClose={() => setResetUser(null)} />}
  </>;
}
