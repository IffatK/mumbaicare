/**
 * Decision tree classifier (CART, Gini impurity, balanced class weights), written from scratch.
 * Categorical inputs are one-hot encoded; data is split into train/test with a seeded stratified split.
 */
import { rng, shuffle, round, MiningError, DISCLAIMER } from './random';
import { Row } from './dataset';

type Node = { leaf: true; cls: string; counts: Record<string, number> } | { leaf: false; feature: number; threshold: number; left: Node; right: Node; cls: string };
const CATEGORICAL = new Set(['gender', 'disease', 'hospital', 'age_group', 'severity']);

function gini(w: Record<string, number>, total: number) { if (!total) return 0; let s = 1; for (const v of Object.values(w)) s -= (v / total) ** 2; return s; }
const argmax = (w: Record<string, number>) => Object.entries(w).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

function build(X: number[][], y: string[], weight: Record<string, number>, idx: number[], depth: number, maxDepth: number, importance: number[], totalW: number): Node {
  const counts: Record<string, number> = {}; for (const i of idx) counts[y[i]] = (counts[y[i]] ?? 0) + weight[y[i]];
  const wN = Object.values(counts).reduce((a, b) => a + b, 0); const imp = gini(counts, wN);
  if (depth >= maxDepth || idx.length < 2 || imp === 0) return { leaf: true, cls: argmax(counts), counts };
  let best = { gain: 0, f: -1, t: 0 };
  for (let f = 0; f < X[0].length; f++) {
    const sorted = [...idx].sort((a, b) => X[a][f] - X[b][f]);
    const left: Record<string, number> = {}; let wl = 0;
    for (let s = 0; s < sorted.length - 1; s++) {
      const i = sorted[s]; left[y[i]] = (left[y[i]] ?? 0) + weight[y[i]]; wl += weight[y[i]];
      if (X[i][f] === X[sorted[s + 1]][f]) continue;
      const right: Record<string, number> = {}; for (const c in counts) right[c] = counts[c] - (left[c] ?? 0);
      const wr = wN - wl; const gain = imp - (wl / wN) * gini(left, wl) - (wr / wN) * gini(right, wr);
      if (gain > best.gain + 1e-12) best = { gain, f, t: (X[i][f] + X[sorted[s + 1]][f]) / 2 };
    }
  }
  if (best.f < 0) return { leaf: true, cls: argmax(counts), counts };
  importance[best.f] += (wN / totalW) * best.gain;
  const L = idx.filter(i => X[i][best.f] <= best.t), R = idx.filter(i => X[i][best.f] > best.t);
  return { leaf: false, feature: best.f, threshold: best.t, cls: argmax(counts),
    left: build(X, y, weight, L, depth + 1, maxDepth, importance, totalW), right: build(X, y, weight, R, depth + 1, maxDepth, importance, totalW) };
}
const predict = (n: Node, x: number[]): string => (n.leaf ? n.cls : predict(x[n.feature] <= n.threshold ? n.left : n.right, x));
function exportText(n: Node, names: string[], depth = 0): string {
  const pad = '|   '.repeat(depth) + '|--- ';
  if (n.leaf) return `${pad}class: ${n.cls}\n`;
  const t = round(n.threshold, 2);
  return `${pad}${names[n.feature]} <= ${t}\n${exportText(n.left, names, depth + 1)}${pad}${names[n.feature]} >  ${t}\n${exportText(n.right, names, depth + 1)}`;
}

export function runDecisionTree(data: Row[], target: string, features: string[], maxDepth = 4, testSize = 0.3) {
  if (features.includes(target)) throw new MiningError('The target cannot also be an input feature.');
  const rows = data.filter(r => [...features, target].every(f => (r as any)[f] !== null && (r as any)[f] !== undefined && (r as any)[f] !== ''));
  if (rows.length < 20) throw new MiningError('Not enough complete rows to train a tree.');
  // one-hot encode categorical features (column names like disease_Dengue)
  const cols: { name: string; get: (r: Row) => number }[] = [];
  for (const f of features) {
    if (CATEGORICAL.has(f)) for (const v of [...new Set(rows.map(r => String((r as any)[f])))].sort()) cols.push({ name: `${f}_${v}`, get: r => (String((r as any)[f]) === v ? 1 : 0) });
    else cols.push({ name: f, get: r => Number((r as any)[f]) });
  }
  const X = rows.map(r => cols.map(c => c.get(r))); const y = rows.map(r => String((r as any)[target]));
  const labels = [...new Set(y)].sort(); if (labels.length < 2) throw new MiningError('The target has only one class in this selection.');
  // stratified split
  const rand = rng(); const train: number[] = [], test: number[] = [];
  for (const l of labels) { const ids = shuffle(y.map((c, i) => (c === l ? i : -1)).filter(i => i >= 0), rand); const nt = Math.round(ids.length * testSize); test.push(...ids.slice(0, nt)); train.push(...ids.slice(nt)); }
  // balanced class weights: n / (classes * n_class)
  const weight: Record<string, number> = {}; for (const l of labels) weight[l] = train.length / (labels.length * train.filter(i => y[i] === l).length);
  const importance = new Array(cols.length).fill(0);
  const tree = build(X, y, weight, train, 0, maxDepth, importance, train.reduce((s, i) => s + weight[y[i]], 0));
  const pred = test.map(i => predict(tree, X[i]));
  const confusion = labels.map(a => labels.map(p => test.filter((i, j) => y[i] === a && pred[j] === p).length));
  const perClass = labels.map((l, li) => {
    const tp = confusion[li][li], fp = labels.reduce((s, _, a) => s + (a !== li ? confusion[a][li] : 0), 0), fn = confusion[li].reduce((s, v, p) => s + (p !== li ? v : 0), 0);
    const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0;
    return { label: l, precision: round(precision, 3), recall: round(recall, 3), f1: round(precision + recall ? (2 * precision * recall) / (precision + recall) : 0, 3), support: tp + fn };
  });
  const impTotal = importance.reduce((a, b) => a + b, 0) || 1;
  return { target, features, train: train.length, test: test.length, accuracy: round(pred.filter((p, j) => p === y[test[j]]).length / test.length, 4), labels,
    perClass, confusion,
    importance: cols.map((c, i) => ({ feature: c.name, importance: round(importance[i] / impTotal, 4) })).filter(x => x.importance > 0).sort((a, b) => b.importance - a.importance).slice(0, 15),
    treeText: exportText(tree, cols.map(c => c.name)),
    samples: test.slice(0, 25).map((i, j) => ({ record_id: rows[i].record_id, actual: y[i], predicted: pred[j] })),
    seed: 42, disclaimer: DISCLAIMER };
}
