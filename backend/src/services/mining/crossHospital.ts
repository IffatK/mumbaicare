import { runKMeans } from './kmeans';
import { Row } from './dataset';
import { round, DISCLAIMER } from './random';
/** Compares cluster membership and distributions across hospitals. */
export function runCrossHospital(data: Row[], features: string[], k = 3) {
  const km = runKMeans(data, features, k, true);
  const by = <T,>(rows: T[], key: (r: T) => string) => rows.reduce((m, r) => { const k2 = key(r); (m[k2] ??= []).push(r); return m; }, {} as Record<string, T[]>);
  const groups = by(km.rowsUsed.map((r, i) => ({ r, c: km.labels[i] })), x => `${x.r.hospital}\u0001${x.c}`);
  const clusterSizes = Object.entries(groups).map(([g, xs]) => { const [hospital, c] = g.split('\u0001'); return { hospital, cluster: Number(c), count: xs.length }; });
  const clusterAverages = Object.entries(groups).map(([g, xs]) => { const [hospital, c] = g.split('\u0001'); const o: any = { hospital, cluster: Number(c) };
    for (const f of ['stay_days', 'treatment_cost']) if (features.includes(f)) o[`avg_${f}`] = round(xs.reduce((s, x) => s + (x.r as any)[f], 0) / xs.length);
    return o; }).sort((a, b) => a.hospital.localeCompare(b.hospital) || a.cluster - b.cluster);
  const countBy = (field: 'severity' | 'disease') => Object.entries(by(data, r => `${r.hospital}\u0001${r[field]}`)).map(([g, xs]) => { const [hospital, v] = g.split('\u0001'); return { hospital, [field]: v, count: xs.length }; });
  const samples = Object.entries(by(data, r => r.hospital)).map(([hospital, xs]) => ({ hospital, n: xs.length, smallSample: xs.length < 100 }));
  return { k, features, clusterSizes, clusterAverages, severity: countBy('severity'), disease: countBy('disease'), samples,
    note: 'Differences reflect the synthetic generator, not hospital quality.', disclaimer: DISCLAIMER };
}
