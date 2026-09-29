/**
 * Apriori frequent-itemset mining and association rules, written from scratch.
 * Each admission is a transaction: its tests (+ optionally its treatment, prefixed "Tx:").
 */
import { round, DISCLAIMER } from './random';
import { Row } from './dataset';

export function aprioriCore(transactions: string[][], minSupport: number, maxLen = 4) {
  const n = transactions.length; const sets = transactions.map(t => new Set(t));
  const support = new Map<string, number>(); const key = (items: string[]) => items.join('\u0001');
  const count = (items: string[]) => sets.reduce((c, s) => c + (items.every(i => s.has(i)) ? 1 : 0), 0) / n;
  // L1
  const freq1 = new Map<string, number>(); for (const t of sets) for (const i of t) freq1.set(i, (freq1.get(i) ?? 0) + 1);
  let level = [...freq1.entries()].filter(([, c]) => c / n >= minSupport).map(([i]) => [i]).sort();
  level.forEach(l => support.set(key(l), freq1.get(l[0])! / n));
  const all: string[][] = [...level];
  for (let k = 2; k <= maxLen && level.length; k++) {
    // join step: combine itemsets sharing the first k-2 items; prune if any (k-1)-subset is infrequent
    const cands: string[][] = []; const prev = new Set(level.map(key));
    for (let a = 0; a < level.length; a++) for (let b = a + 1; b < level.length; b++) {
      if (level[a].slice(0, -1).join() !== level[b].slice(0, -1).join()) continue;
      const c = [...level[a], level[b][k - 2]].sort();
      if (c.every((_, i) => prev.has(key(c.filter((__, j) => j !== i))))) cands.push(c);
    }
    level = [];
    for (const c of cands) { const s = count(c); if (s >= minSupport) { support.set(key(c), s); level.push(c); } }
    all.push(...level);
  }
  return { itemsets: all, support: (items: string[]) => support.get(key([...items].sort()))! };
}

export function runApriori(data: Row[], source: string, minSupport: number, minConfidence: number, minLift = 1) {
  const tx = data.map(r => { const t = (r.tests ?? '').split(',').filter(Boolean); if (source === 'tests_treatment') t.push(`Tx: ${r.treatment}`); return t; });
  const { itemsets, support } = aprioriCore(tx, minSupport);
  const rules: any[] = [];
  for (const I of itemsets.filter(i => i.length >= 2)) {
    const sI = support(I);
    for (let mask = 1; mask < (1 << I.length) - 1; mask++) { // every non-empty proper subset as antecedent
      const A = I.filter((_, i) => mask & (1 << i)), C = I.filter((_, i) => !(mask & (1 << i)));
      const confidence = sI / support(A), lift = confidence / support(C);
      if (confidence >= minConfidence && lift >= minLift) rules.push({ antecedents: A, consequents: C, support: round(sI, 4), confidence: round(confidence, 4), lift: round(lift, 3) });
    }
  }
  rules.sort((a, b) => b.lift - a.lift || b.confidence - a.confidence);
  return { transactions: tx.length,
    itemsets: itemsets.map(items => ({ items, support: round(support(items), 4) })).sort((a, b) => b.support - a.support).slice(0, 200),
    rules: rules.slice(0, 300),
    disclaimer: `${DISCLAIMER} Association does not imply causation; rules are not treatment recommendations.` };
}
