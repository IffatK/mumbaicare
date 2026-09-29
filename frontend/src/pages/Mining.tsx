import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ScatterChart, Scatter, BarChart, Bar, ZAxis } from 'recharts';
import { Play } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useHospitals } from '../components/HospitalFilter';
import { PageHeader, Panel, Kpi, ErrorState, DataTable, ExportBtn, Disclaimer, Spinner, Empty, Badge } from '../components/ui';
import { ChartBox, axis, grid, tip, legend, XAxis, YAxis } from '../components/Charts';
import { COLORS, num } from '../lib/format';
import { downloadCsv } from '../lib/csv';
const NUM = [['age', 'Age'], ['systolic_bp', 'Systolic BP'], ['diastolic_bp', 'Diastolic BP'], ['cholesterol', 'Cholesterol'], ['heart_rate', 'Heart rate'], ['stay_days', 'Stay duration'], ['treatment_cost', 'Treatment cost']];
const CAT = [['gender', 'Gender'], ['disease', 'Condition'], ['hospital', 'Hospital']];
const lbl = (k: string) => [...NUM, ...CAT].find(x => x[0] === k)?.[1] ?? k;
function useRun(path: string) { const toast = useToast(); return useMutation({ mutationFn: (b: any) => api(path, { method: 'POST', body: b }), onError: (e: any) => toast('err', e.message) }); }
function Checks({ opts, value, onChange }: { opts: string[][]; value: string[]; onChange: (v: string[]) => void }) {
  return <div className="flex flex-wrap gap-2">{opts.map(([k, l]) => { const on = value.includes(k);
    return <label key={k} className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-harbor-600 bg-harbor-100 text-harbor-600' : 'border-ink-200 text-ink-700'}`}>
      <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? value.filter(x => x !== k) : [...value, k])} />{l}</label>; })}</div>;
}
function HospitalScope({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const { data: hs = [] } = useHospitals();
  return <select aria-label="Hospital scope" className="input" value={value[0] ?? ''} onChange={e => onChange(e.target.value ? [Number(e.target.value)] : [])}>
    <option value="">All hospitals</option>{hs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>;
}

function KMeansTab() {
  const [features, setF] = useState(['age', 'treatment_cost']); const [k, setK] = useState(3); const [std, setStd] = useState(true); const [h, setH] = useState<number[]>([]);
  const run = useRun('/mining/kmeans'); const r: any = run.data;
  return <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
    <Panel title="Parameters"><div className="space-y-3">
      <div><p className="label">Numeric features (choose at least two)</p><Checks opts={NUM} value={features} onChange={setF} /></div>
      <div><label className="label" htmlFor="k">Number of clusters (K): {k}</label><input id="k" type="range" min={2} max={10} value={k} onChange={e => setK(+e.target.value)} className="w-full accent-tide-600" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={std} onChange={e => setStd(e.target.checked)} />Standardise features (z-score)</label>
      <div><p className="label">Scope</p><HospitalScope value={h} onChange={setH} /></div>
      <button className="btn-primary w-full" disabled={features.length < 2 || run.isPending} onClick={() => run.mutate({ features, k, standardize: std, hospitalIds: h.length ? h : undefined })}>{run.isPending ? <Spinner /> : <Play size={15} />}Run K-Means</button>
      {features.length < 2 && <p className="text-xs text-alert-600">Select at least two features.</p>}
    </div></Panel>
    <div className="min-w-0 space-y-4">{run.isError ? <ErrorState error={run.error} /> : !r ? <div className="panel"><Empty title="Choose features and run K-Means" hint="Records with missing values (for example, stay duration of admitted patients) are excluded." /></div> : <>
      <div className="grid grid-cols-3 gap-3"><Kpi label="Records clustered" value={num(r.rows)} /><Kpi label="Silhouette score" value={r.silhouette} tone="teal" hint="−1 to 1; higher is better separated" /><Kpi label="Inertia" value={num(r.inertia)} tone="blue" /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`${lbl(r.features[0])} vs ${lbl(r.features[1])}`} subtitle="Sample of up to 800 points">
          <ChartBox h={300} label="Cluster scatter plot"><ScatterChart>{grid}<XAxis type="number" dataKey={r.features[0]} name={lbl(r.features[0])} {...axis} /><YAxis type="number" dataKey={r.features[1]} name={lbl(r.features[1])} {...axis} width={70} /><ZAxis range={[16, 16]} />{tip}{legend}
            {r.clusters.map((c: any) => <Scatter key={c.cluster} name={`Cluster ${c.cluster}`} data={r.points.filter((p: any) => p.cluster === c.cluster)} fill={COLORS[c.cluster % COLORS.length]} fillOpacity={0.7} />)}</ScatterChart></ChartBox></Panel>
        <Panel title="Cluster sizes"><ChartBox h={300} label="Cluster sizes"><BarChart data={r.clusters.map((c: any) => ({ name: `Cluster ${c.cluster}`, size: c.size }))}>{grid}<XAxis dataKey="name" {...axis} /><YAxis {...axis} />{tip}<Bar dataKey="size" name="Records" fill="#0E8C83" /></BarChart></ChartBox></Panel>
      </div>
      <Panel title="Centroids (original units)" actions={<ExportBtn label="Export assignments" onClick={() => downloadCsv('kmeans-assignments.csv', r.assignments)} />}>
        <DataTable rows={r.centroids} columns={[{ key: 'cluster', label: 'Cluster' }, ...r.features.map((f: string) => ({ key: f, label: lbl(f), align: 'right' as const }))]} /></Panel>
      <Panel title="Cluster characteristics"><ul className="space-y-2 text-sm">{r.summary.map((s: any) => <li key={s.cluster} className="flex gap-2"><span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[s.cluster % COLORS.length] }} /><span><strong>Cluster {s.cluster}</strong> ({num(s.size)} records): {s.description}.</span></li>)}</ul></Panel>
      <Disclaimer>{r.disclaimer} Clusters are statistical groupings, not risk groups.</Disclaimer>
    </>}</div>
  </div>;
}

function TreeTab() {
  const [target, setTarget] = useState('severity'); const [features, setF] = useState(['age', 'heart_rate', 'systolic_bp', 'treatment_cost', 'disease']);
  const [depth, setDepth] = useState(4); const [test, setTest] = useState(0.3); const [h, setH] = useState<number[]>([]);
  const run = useRun('/mining/decision-tree'); const r: any = run.data;
  const maxCell = r ? Math.max(...r.confusion.flat()) : 1;
  return <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
    <Panel title="Parameters"><div className="space-y-3">
      <div><label className="label" htmlFor="tg">Target attribute</label><select id="tg" className="input" value={target} onChange={e => setTarget(e.target.value)}>
        <option value="severity">Severity</option><option value="is_discharged">Discharged (0/1)</option><option value="age_group">Age group</option></select></div>
      <div><p className="label">Input features</p><Checks opts={[...NUM, ...CAT].filter(([k]) => !(target === 'age_group' && k === 'age') && !(target === 'is_discharged' && k === 'stay_days'))} value={features} onChange={setF} /></div>
      <div><label className="label" htmlFor="d">Maximum depth: {depth}</label><input id="d" type="range" min={1} max={10} value={depth} onChange={e => setDepth(+e.target.value)} className="w-full accent-tide-600" /></div>
      <div><label className="label" htmlFor="ts">Test split: {Math.round(test * 100)}%</label><input id="ts" type="range" min={0.1} max={0.5} step={0.05} value={test} onChange={e => setTest(+e.target.value)} className="w-full accent-tide-600" /></div>
      <div><p className="label">Scope</p><HospitalScope value={h} onChange={setH} /></div>
      <button className="btn-primary w-full" disabled={!features.length || run.isPending} onClick={() => run.mutate({ target, features, maxDepth: depth, testSize: test, hospitalIds: h.length ? h : undefined })}>{run.isPending ? <Spinner /> : <Play size={15} />}Train decision tree</button>
      <p className="text-xs text-ink-500">Random seed fixed at 42, so results are reproducible.</p>
    </div></Panel>
    <div className="min-w-0 space-y-4">{run.isError ? <ErrorState error={run.error} /> : !r ? <div className="panel"><Empty title="Choose a target and features, then train" /></div> : <>
      <div className="grid grid-cols-3 gap-3"><Kpi label="Test accuracy" value={`${(r.accuracy * 100).toFixed(1)}%`} tone="teal" /><Kpi label="Training rows" value={num(r.train)} /><Kpi label="Test rows" value={num(r.test)} tone="blue" /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Confusion matrix" subtitle="Rows: actual. Columns: predicted.">
          <div className="overflow-x-auto"><table className="text-sm"><thead><tr><th className="th"></th>{r.labels.map((l: string) => <th key={l} className="th text-center">{l}</th>)}</tr></thead>
            <tbody>{r.confusion.map((row: number[], i: number) => <tr key={i}><th className="th">{r.labels[i]}</th>{row.map((v, j) =>
              <td key={j} className="border border-white px-4 py-3 text-center font-semibold" style={{ background: `rgba(${i === j ? '14,140,131' : '192,57,43'},${0.08 + 0.7 * v / maxCell})`, color: v / maxCell > 0.5 ? '#fff' : '#15202B' }}>{v}</td>)}</tr>)}</tbody></table></div></Panel>
        <Panel title="Feature importance"><ChartBox h={Math.max(200, r.importance.length * 24)} label="Feature importance"><BarChart data={r.importance} layout="vertical">{grid}<XAxis type="number" {...axis} /><YAxis type="category" dataKey="feature" width={150} {...axis} />{tip}<Bar dataKey="importance" fill="#1D5FA8" /></BarChart></ChartBox></Panel>
      </div>
      <Panel title="Per-class metrics"><DataTable rows={r.perClass} columns={[{ key: 'label', label: 'Class' }, { key: 'precision', label: 'Precision', align: 'right' }, { key: 'recall', label: 'Recall', align: 'right' }, { key: 'f1', label: 'F1', align: 'right' }, { key: 'support', label: 'Support', align: 'right' }]} /></Panel>
      <Panel title="Tree rules" actions={<ExportBtn label="Export predictions" onClick={() => downloadCsv('tree-sample-predictions.csv', r.samples)} />}><pre className="max-h-80 overflow-auto rounded bg-navy-950 p-3 text-xs leading-relaxed text-ink-100">{r.treeText}</pre></Panel>
      <Panel title="Sample test predictions"><DataTable max="max-h-64" rows={r.samples} columns={[{ key: 'record_id', label: 'Record' }, { key: 'actual', label: 'Actual' }, { key: 'predicted', label: 'Predicted' },
        { key: 'ok', label: 'Match', render: x => <Badge tone={x.actual === x.predicted ? 'teal' : 'alert'}>{x.actual === x.predicted ? 'Yes' : 'No'}</Badge> }]} /></Panel>
      <Disclaimer>{r.disclaimer} The model classifies synthetic records; it cannot diagnose patients or predict clinical outcomes.</Disclaimer>
    </>}</div>
  </div>;
}

function AprioriTab() {
  const [p, setP] = useState({ source: 'tests_treatment', minSupport: 0.05, minConfidence: 0.5, minLift: 1.1 }); const [h, setH] = useState<number[]>([]);
  const [sort, setSort] = useState<'lift' | 'confidence' | 'support'>('lift'); const [q, setQ] = useState('');
  const run = useRun('/mining/apriori'); const r: any = run.data;
  const rules = r ? [...r.rules].filter((x: any) => !q || [...x.antecedents, ...x.consequents].join(' ').toLowerCase().includes(q.toLowerCase())).sort((a: any, b: any) => b[sort] - a[sort]) : [];
  return <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
    <Panel title="Parameters"><div className="space-y-3">
      <div><label className="label" htmlFor="src">Transactions</label><select id="src" className="input" value={p.source} onChange={e => setP({ ...p, source: e.target.value })}>
        <option value="tests_treatment">Tests and treatment per admission</option><option value="tests">Tests only</option></select></div>
      {([['minSupport', 'Minimum support', 0.01, 0.5, 0.01], ['minConfidence', 'Minimum confidence', 0.05, 1, 0.05], ['minLift', 'Minimum lift', 0, 10, 0.1]] as const).map(([k, l, mn, mx, st]) =>
        <div key={k}><label className="label" htmlFor={k}>{l}</label><input id={k} type="number" className="input" min={mn} max={mx} step={st} value={p[k]} onChange={e => setP({ ...p, [k]: +e.target.value })} /></div>)}
      <div><p className="label">Scope</p><HospitalScope value={h} onChange={setH} /></div>
      <button className="btn-primary w-full" disabled={run.isPending} onClick={() => run.mutate({ ...p, hospitalIds: h.length ? h : undefined })}>{run.isPending ? <Spinner /> : <Play size={15} />}Run Apriori</button>
    </div></Panel>
    <div className="min-w-0 space-y-4">{run.isError ? <ErrorState error={run.error} /> : !r ? <div className="panel"><Empty title="Set thresholds and run Apriori" hint="Each admission is a transaction of its tests and treatment." /></div> : <>
      <div className="grid grid-cols-3 gap-3"><Kpi label="Transactions" value={num(r.transactions)} /><Kpi label="Frequent itemsets" value={num(r.itemsets.length)} tone="teal" /><Kpi label="Rules" value={num(r.rules.length)} tone="blue" /></div>
      <Panel title="Association rules" actions={<ExportBtn onClick={() => downloadCsv('apriori-rules.csv', r.rules.map((x: any) => ({ ...x, antecedents: x.antecedents.join(' + '), consequents: x.consequents.join(' + ') })))} />}>
        <div className="mb-3 flex flex-wrap gap-2"><input className="input max-w-xs" placeholder="Filter by item" value={q} onChange={e => setQ(e.target.value)} aria-label="Filter rules" />
          <select aria-label="Sort rules" className="input !w-auto" value={sort} onChange={e => setSort(e.target.value as any)}><option value="lift">Sort by lift</option><option value="confidence">Sort by confidence</option><option value="support">Sort by support</option></select></div>
        {rules.length ? <DataTable rows={rules} columns={[{ key: 'a', label: 'If', render: x => x.antecedents.join(' + ') }, { key: 'c', label: 'Then', render: x => x.consequents.join(' + ') },
          { key: 'support', label: 'Support', align: 'right' }, { key: 'confidence', label: 'Confidence', align: 'right' }, { key: 'lift', label: 'Lift', align: 'right' }]} /> : <Empty title="No rules at these thresholds" hint="Lower the minimum support or confidence." />}
      </Panel>
      <Panel title="Frequent itemsets"><DataTable max="max-h-64" rows={r.itemsets} columns={[{ key: 'items', label: 'Items', render: x => x.items.join(', ') }, { key: 'support', label: 'Support', align: 'right' }]} /></Panel>
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </>}</div>
  </div>;
}

function CrossTab() {
  const [features, setF] = useState(['age', 'stay_days', 'treatment_cost']); const [k, setK] = useState(3);
  const run = useRun('/mining/cross-hospital'); const r: any = run.data;
  const short = (s: string) => s.replace(' (Demo)', '');
  const pivot = (rows: any[], col: string, prefix = '') => Object.values(rows.reduce((a: any, x: any) => { (a[x.hospital] ??= { hospital: short(x.hospital) })[prefix + x[col]] = x.count; return a; }, {})) as any[];
  const clusterKeys = r ? [...new Set(r.clusterSizes.map((x: any) => `Cluster ${x.cluster}`))] as string[] : [];
  return <div className="space-y-4">
    <Panel title="Parameters"><div className="flex flex-wrap items-end gap-4">
      <div><p className="label">Features</p><Checks opts={NUM} value={features} onChange={setF} /></div>
      <div><label className="label" htmlFor="ck">K = {k}</label><input id="ck" type="range" min={2} max={8} value={k} onChange={e => setK(+e.target.value)} className="accent-tide-600" /></div>
      <button className="btn-primary" disabled={features.length < 2 || run.isPending} onClick={() => run.mutate({ features, k })}>{run.isPending ? <Spinner /> : <Play size={15} />}Compare hospitals</button></div></Panel>
    {run.isError ? <ErrorState error={run.error} /> : !r ? <div className="panel"><Empty title="Run the cross-hospital analysis" /></div> : <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cluster sizes by hospital"><ChartBox h={300} label="Stacked cluster sizes per hospital"><BarChart data={pivot(r.clusterSizes.map((x: any) => ({ ...x })), 'cluster', 'Cluster ')}>{grid}<XAxis dataKey="hospital" {...axis} /><YAxis {...axis} />{tip}{legend}
          {clusterKeys.map((c, i) => <Bar key={c} dataKey={c} stackId="c" fill={COLORS[i % COLORS.length]} />)}</BarChart></ChartBox></Panel>
        <Panel title="Severity by hospital"><ChartBox h={300} label="Severity per hospital"><BarChart data={pivot(r.severity, 'severity')}>{grid}<XAxis dataKey="hospital" {...axis} /><YAxis {...axis} />{tip}{legend}
          <Bar dataKey="MILD" name="Mild" stackId="s" fill="#14A89C" /><Bar dataKey="MODERATE" name="Moderate" stackId="s" fill="#B7791F" /><Bar dataKey="SEVERE" name="Severe" stackId="s" fill="#C0392B" /></BarChart></ChartBox></Panel>
      </div>
      <Panel title="Average stay and cost by cluster and hospital" actions={<ExportBtn onClick={() => downloadCsv('cross-hospital.csv', r.clusterAverages)} />}>
        <DataTable rows={r.clusterAverages} columns={[{ key: 'hospital', label: 'Hospital' }, { key: 'cluster', label: 'Cluster' }, ...(r.clusterAverages[0]?.avg_stay_days !== undefined ? [{ key: 'avg_stay_days', label: 'Avg stay (days)', align: 'right' as const }] : []),
          ...(r.clusterAverages[0]?.avg_treatment_cost !== undefined ? [{ key: 'avg_treatment_cost', label: 'Avg cost (₹)', align: 'right' as const }] : [])]} /></Panel>
      <Panel title="Sample sizes"><div className="flex flex-wrap gap-2">{r.samples.map((s: any) => <Badge key={s.hospital} tone={s.smallSample ? 'amber' : 'ink'}>{short(s.hospital)}: n={s.n}</Badge>)}</div>
        <p className="mt-2 text-xs text-ink-500">{r.note}</p></Panel>
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </>}
  </div>;
}

const TABS = [['kmeans', 'K-Means clustering', KMeansTab], ['tree', 'Decision tree', TreeTab], ['apriori', 'Apriori rules', AprioriTab], ['cross', 'Cross-hospital patterns', CrossTab]] as const;
export default function Mining() {
  const [tab, setTab] = useState<string>('kmeans'); const Active = TABS.find(t => t[0] === tab)![2];
  return <>
    <PageHeader title="Data mining" description="Algorithms run in the Node.js backend on the warehouse data. Outputs are statistical patterns in synthetic records." />
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ink-200" role="tablist">{TABS.map(([k, l]) =>
      <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? 'border-tide-600 text-navy-900' : 'border-transparent text-ink-500 hover:text-navy-900'}`}>{l}</button>)}</div>
    <Active />
  </>;
}
