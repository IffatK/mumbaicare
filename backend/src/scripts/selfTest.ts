/**
 * Self-test for the pure logic (no database needed): ETL transform rules, K-Means, Decision Tree, Apriori.
 * Run with: npm test
 */
import assert from 'assert';
import { transform } from '../services/etl';
import { kmeansCore } from '../services/mining/kmeans';
import { runDecisionTree } from '../services/mining/decisionTree';
import { aprioriCore, runApriori } from '../services/mining/apriori';
import { rng } from '../services/mining/random';
let passed = 0; const ok = (name: string, fn: () => void) => { fn(); passed++; console.log('  ✓', name); };

console.log('ETL transform');
const base = { recordId: 'MC-1', hospitalId: 1, age: 40, gender: ' male ', condition: ' Dengue ', severity: 'mild', admissionDate: new Date('2025-01-01'),
  dischargeDate: new Date('2025-01-05'), cost: 100, status: 'DISCHARGED', treatment: 'IV', tests: 'ECG, CBC,CBC', systolicBp: 1, diastolicBp: 1, cholesterol: 1, heartRate: 1 };
ok('cleans and derives fields (T1–T5)', () => {
  const { clean } = transform([base], new Set([1])); const c = clean[0];
  assert.equal(c.gender, 'Male'); assert.equal(c.condition, 'Dengue'); assert.equal(c.severity, 'MILD');
  assert.equal(c.stay, 4); assert.equal(c.ageGroup, '35-49'); assert.equal(c.tests, 'CBC,ECG');
});
ok('rejects each rule R01–R07', () => {
  const bad = [{ ...base, recordId: 'a', condition: '' }, { ...base, recordId: 'b', age: 150 }, { ...base, recordId: 'c', dischargeDate: new Date('2024-12-01') },
    { ...base, recordId: 'd', cost: -1 }, { ...base, recordId: 'e', status: 'ADMITTED' }, { ...base, recordId: 'f', admissionDate: new Date('2999-01-01'), dischargeDate: null, status: 'ADMITTED' },
    { ...base, recordId: 'g', hospitalId: 99 }];
  const { clean, rejected } = transform(bad, new Set([1]));
  assert.equal(clean.length, 0); assert.deepEqual(rejected.map(r => r.rule.slice(0, 3)), ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07']);
});

console.log('K-Means');
ok('recovers three well-separated blobs', () => {
  const r = rng(1); const X: number[][] = []; for (const [cx, cy] of [[0, 0], [10, 10], [0, 10]]) for (let i = 0; i < 50; i++) X.push([cx + r(), cy + r()]);
  const { labels } = kmeansCore(X, 3, rng(42));
  for (let g = 0; g < 3; g++) assert.equal(new Set(labels.slice(g * 50, g * 50 + 50)).size, 1, 'each blob in one cluster');
  assert.equal(new Set(labels).size, 3);
});

console.log('Decision tree');
ok('learns a threshold rule perfectly', () => {
  const rows: any[] = Array.from({ length: 200 }, (_, i) => ({ record_id: String(i), age: i % 100, gender: i % 2 ? 'Male' : 'Female', severity: i % 100 < 50 ? 'MILD' : 'SEVERE' }));
  const out = runDecisionTree(rows, 'severity', ['age', 'gender'], 3, 0.3);
  assert.equal(out.accuracy, 1); assert.equal(out.importance[0].feature, 'age'); assert.equal(out.test, 60);
});

console.log('Apriori');
ok('support, confidence and lift match hand calculation', () => {
  const tx = [['A', 'B'], ['A', 'B'], ['A', 'C'], ['B', 'C']];
  const { itemsets, support } = aprioriCore(tx, 0.5);
  assert.equal(support(['A', 'B']), 0.5); assert.ok(!itemsets.some(i => i.join() === 'A,C'));
  const out = runApriori(tx.map((t, i) => ({ tests: t.join(','), treatment: 'x', record_id: String(i) })) as any, 'tests', 0.5, 0.5, 0);
  const rule = out.rules.find(r => r.antecedents.join() === 'A' && r.consequents.join() === 'B')!;
  assert.equal(rule.confidence, 0.6667); assert.equal(rule.lift, 0.889);   // conf 2/3, lift (2/3)/(3/4)
});
console.log(`\n${passed} tests passed`);
