import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Panel, Kpi, Loading, ErrorState, DataTable, Badge, Disclaimer } from '../components/ui';
import { dateTime, num, date } from '../lib/format';
export default function Quality() {
  const q = useQuery({ queryKey: ['quality'], queryFn: () => api('/quality') }); const [sel, setSel] = useState<string | null>(null);
  const recs = useQuery({ queryKey: ['quality', sel], enabled: !!sel, queryFn: () => api(`/quality/records/${sel}`) });
  const lastEtl = useQuery({ queryKey: ['dw-status'], queryFn: () => api('/warehouse/status') });
  const d: any = q.data; const issues = d ? d.checks.reduce((s: number, c: any) => s + c.count, 0) : 0;
  const rejected = (lastEtl.data as any)?.runs?.[0]?.errors ?? [];
  return <>
    <PageHeader title="Data quality" description="Read-only validation checks on the operational database. Records are never changed automatically."
      actions={<button className="btn-ghost" onClick={() => q.refetch()}><RefreshCw size={15} />Re-run checks</button>} />
    {q.isError ? <ErrorState error={q.error} /> : q.isLoading ? <Loading h="h-96" /> : <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><Kpi label="Operational records" value={num(d.total)} /><Kpi label="Rule violations" value={num(issues)} tone={issues ? 'alert' : 'teal'} />
        <Kpi label="Duplicate record IDs" value={num(d.duplicates.length)} tone={d.duplicates.length ? 'alert' : 'teal'} /><Kpi label="Last validated" value={<span className="text-base">{dateTime(d.checkedAt)}</span>} tone="blue" /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Validation checks" subtitle="Select a check with violations to review the records.">
          <ul className="divide-y divide-ink-100">{d.checks.map((c: any) => <li key={c.key}><button disabled={!c.count} onClick={() => setSel(c.key)}
            className={`flex w-full items-center justify-between px-2 py-2.5 text-left text-sm ${sel === c.key ? 'bg-harbor-100' : c.count ? 'hover:bg-ink-50' : ''}`}>
            <span>{c.label}</span><Badge tone={c.count ? 'alert' : 'teal'}>{c.count ? num(c.count) : 'Pass'}</Badge></button></li>)}</ul></Panel>
        <Panel title="Missing values by field" subtitle={d.note}>
          <DataTable rows={d.missing} columns={[{ key: 'field', label: 'Field' }, { key: 'count', label: 'Missing', align: 'right', render: r => num(r.count) }, { key: 'pct', label: '% of records', align: 'right', render: r => `${num(r.count / d.total * 100, 1)}%` }]} /></Panel>
      </div>
      {sel && <Panel title={`Records: ${d.checks.find((c: any) => c.key === sel)?.label}`} className="mt-4">
        {recs.isLoading ? <Loading /> : <DataTable rows={(recs.data as any[]) ?? []} columns={[{ key: 'recordId', label: 'Record' }, { key: 'status', label: 'Status' }, { key: 'admissionDate', label: 'Admitted', render: r => date(r.admissionDate) },
          { key: 'dischargeDate', label: 'Discharged', render: r => date(r.dischargeDate) }, { key: 'stayDays', label: 'Stay' }, { key: 'age', label: 'Age' }, { key: 'cost', label: 'Cost', align: 'right' }]} />}</Panel>}
      <Panel title="Records rejected by the latest ETL run" className="mt-4">
        {rejected.length ? <DataTable max="max-h-64" rows={rejected} columns={[{ key: 'recordId', label: 'Record' }, { key: 'rule', label: 'Rule' }, { key: 'message', label: 'Message' }]} /> : <p className="text-sm text-ink-500">No rejected records in the latest run.</p>}</Panel>
      <div className="mt-4"><Disclaimer>Fix flagged records through the patient form; the next ETL run will pick up the corrected values.</Disclaimer></div>
    </>}
  </>;
}
