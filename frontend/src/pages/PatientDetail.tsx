import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { useToast } from '../components/Toast';
import { PageHeader, Panel, Loading, ErrorState, SevBadge, Badge, Disclaimer } from '../components/ui';
import { date, inr, dateTime } from '../lib/format';
export default function PatientDetail() {
  const { id } = useParams(); const { user } = useAuth(); const toast = useToast(); const nav = useNavigate(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['patient', id], queryFn: () => api(`/patients/${id}`) });
  const del = useMutation({ mutationFn: () => api(`/patients/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries(); toast('ok', 'Record deleted'); nav('/app/patients'); }, onError: (e: any) => toast('err', e.message) });
  if (q.isLoading) return <Loading h="h-96" />;
  if (q.isError) return <ErrorState error={q.error} />;
  const p: any = q.data;
  const Row = ({ l, v }: any) => <div className="flex justify-between gap-4 border-b border-ink-100 py-2 text-sm last:border-0"><dt className="text-ink-500">{l}</dt><dd className="text-right font-medium">{v}</dd></div>;
  const canEdit = can(user, 'ADMIN') || (user?.role === 'STAFF' && user.hospitalId === p.hospitalId);
  return <>
    <PageHeader title={p.recordId} description={`${p.condition} · ${p.hospital.name}`} actions={<>
      {canEdit && <Link className="btn-ghost" to={`/app/patients/${p.id}/edit`}><Pencil size={15} />Edit</Link>}
      {can(user, 'ADMIN') && <button className="btn-danger" onClick={() => confirm(`Delete ${p.recordId}? This cannot be undone.`) && del.mutate()}><Trash2 size={15} />Delete</button>}</>} />
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Record"><dl><Row l="Record ID" v={p.recordId} /><Row l="Age" v={p.age} /><Row l="Gender" v={p.gender} />
        <Row l="Status" v={<Badge tone={p.status === 'ADMITTED' ? 'blue' : 'ink'}>{p.status === 'ADMITTED' ? 'Admitted' : 'Discharged'}</Badge>} /><Row l="Last updated" v={dateTime(p.updatedAt)} /></dl></Panel>
      <Panel title="Hospital"><dl><Row l="Name" v={p.hospital.name} /><Row l="Area" v={p.hospital.area} /><Row l="Type" v={p.hospital.type} /></dl></Panel>
      <Panel title="Condition and vitals"><dl><Row l="Condition" v={p.condition} /><Row l="Severity" v={<SevBadge s={p.severity} />} />
        <Row l="Blood pressure" v={`${p.systolicBp}/${p.diastolicBp} mmHg`} /><Row l="Cholesterol" v={`${p.cholesterol} mg/dL`} /><Row l="Heart rate" v={`${p.heartRate} bpm`} /></dl></Panel>
      <Panel title="Admission and discharge"><dl><Row l="Admitted" v={date(p.admissionDate)} /><Row l="Discharged" v={date(p.dischargeDate)} /><Row l="Stay" v={p.stayDays != null ? `${p.stayDays} days` : 'Ongoing'} /></dl></Panel>
      <Panel title="Treatment and cost" className="lg:col-span-2"><dl><Row l="Treatment" v={p.treatment} /><Row l="Tests" v={p.tests || '—'} /><Row l="Treatment cost" v={inr(p.cost)} /></dl></Panel>
    </div>
    <div className="mt-4"><Disclaimer>This is a synthetic record created for statistical analysis. It does not describe a real person and carries no clinical meaning.</Disclaimer></div>
  </>;
}
