/**
 * K-Means clustering (Lloyd's algorithm with k-means++ initialisation, best of 10 seeded runs).
 * Optional z-score standardisation so features on different scales (age vs ₹ cost) weigh equally.
 */
import { rng, shuffle, round, MiningError, DISCLAIMER } from './random';
import { Row } from './dataset';

const dist2 = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return s; };

export function kmeansCore(X: number[][], k: number, rand: () => number, nInit = 10, maxIter = 300) {
  let best: { labels: number[]; centroids: number[][]; inertia: number } | null = null;
  for (let run = 0; run < nInit; run++) {
    // k-means++ : first centre at random, next centres chosen with probability ∝ squared distance
    const centroids: number[][] = [X[Math.floor(rand() * X.length)].slice()];
    const d = X.map(x => dist2(x, centroids[0]));
    while (centroids.length < k) {
      const total = d.reduce((a, b) => a + b, 0); let r = rand() * total, idx = 0;
      for (; idx < X.length - 1; idx++) { r -= d[idx]; if (r <= 0) break; }
      centroids.push(X[idx].slice());
      X.forEach((x, i) => { d[i] = Math.min(d[i], dist2(x, centroids[centroids.length - 1])); });
    }
    const labels = new Array(X.length).fill(-1);
    for (let it = 0; it < maxIter; it++) {
      let changed = false;
      X.forEach((x, i) => { let bi = 0, bd = Infinity; centroids.forEach((c, j) => { const dd = dist2(x, c); if (dd < bd) { bd = dd; bi = j; } }); if (labels[i] !== bi) { labels[i] = bi; changed = true; } });
      const sums = centroids.map(c => new Array(c.length).fill(0)); const counts = new Array(k).fill(0);
      X.forEach((x, i) => { counts[labels[i]]++; x.forEach((v, f) => (sums[labels[i]][f] += v)); });
      for (let j = 0; j < k; j++) {
        if (counts[j] === 0) { // empty cluster: move it to the point farthest from its centre
          let far = 0, fd = -1; X.forEach((x, i) => { const dd = dist2(x, centroids[labels[i]]); if (dd > fd) { fd = dd; far = i; } });
          centroids[j] = X[far].slice(); changed = true;
        } else centroids[j] = sums[j].map(s => s / counts[j]);
      }
      if (!changed) break;
    }
    const inertia = X.reduce((s, x, i) => s + dist2(x, centroids[labels[i]]), 0);
    if (!best || inertia < best.inertia) best = { labels: [...labels], centroids: centroids.map(c => [...c]), inertia };
  }
  return best!;
}

/** Mean silhouette coefficient on a seeded sample (O(n²), so capped at 1000 points). */
export function silhouette(X: number[][], labels: number[], idx: number[]) {
  const k = Math.max(...labels) + 1; let total = 0, n = 0;
  for (const i of idx) {
    const sum = new Array(k).fill(0), cnt = new Array(k).fill(0);
    for (const j of idx) { if (i === j) continue; sum[labels[j]] += Math.sqrt(dist2(X[i], X[j])); cnt[labels[j]]++; }
    const a = cnt[labels[i]] ? sum[labels[i]] / cnt[labels[i]] : 0;
    let b = Infinity; for (let c = 0; c < k; c++) if (c !== labels[i] && cnt[c]) b = Math.min(b, sum[c] / cnt[c]);
    if (!isFinite(b) || cnt[labels[i]] === 0) continue;
    total += (b - a) / Math.max(a, b); n++;
  }
  return n ? total / n : 0;
}

export function runKMeans(data: Row[], features: string[], k: number, standardize = true) {
  const rows = data.filter(r => features.every(f => typeof (r as any)[f] === 'number' && isFinite((r as any)[f]))); // stay_days is null for admitted patients
  if (rows.length < k * 5) throw new MiningError(`Only ${rows.length} complete rows; not enough for K=${k}.`);
  const raw = rows.map(r => features.map(f => (r as any)[f] as number));
  const mean = features.map((_, f) => raw.reduce((s, x) => s + x[f], 0) / raw.length);
  const std = features.map((_, f) => Math.sqrt(raw.reduce((s, x) => s + (x[f] - mean[f]) ** 2, 0) / raw.length) || 1);
  const X = standardize ? raw.map(x => x.map((v, f) => (v - mean[f]) / std[f])) : raw;
  const rand = rng();
  const { labels, inertia } = kmeansCore(X, k, rand);
  const sample = shuffle(rows.map((_, i) => i), rand).slice(0, Math.min(rows.length, 1000));
  const sizes = Array.from({ length: k }, (_, c) => labels.filter(l => l === c).length);
  // centroids reported in original units for interpretation
  const centroids = sizes.map((_, c) => ({ cluster: c, ...Object.fromEntries(features.map((f, fi) => [f, round(raw.filter((_, i) => labels[i] === c).reduce((s, x) => s + x[fi], 0) / (sizes[c] || 1))])) }));
  const summary = centroids.map((c: any) => {
    const parts = features.map((f, fi) => ({ f, z: (c[f] - mean[fi]) / std[fi] })).filter(x => Math.abs(x.z) > 0.3).sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 2)
      .map(x => `${x.z > 0 ? 'higher' : 'lower'} ${x.f.replace('_', ' ')}`);
    return { cluster: c.cluster, size: sizes[c.cluster], description: parts.length ? `Records with ${parts.join(' and ')} than average` : 'Close to overall averages' };
  });
  const pick = (i: number) => ({ record_id: rows[i].record_id, ...Object.fromEntries(features.map(f => [f, (rows[i] as any)[f]])), cluster: labels[i] });
  return { k, features, rows: rows.length, silhouette: round(silhouette(X, labels, sample), 3), inertia: round(inertia),
    clusters: sizes.map((size, cluster) => ({ cluster, size })), centroids, summary,
    points: sample.slice(0, 800).map(pick),
    assignments: rows.slice(0, 2000).map((r, i) => ({ ...pick(i), hospital: r.hospital })),
    labels, rowsUsed: rows, disclaimer: DISCLAIMER };
}
