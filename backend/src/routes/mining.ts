import { Router } from 'express';
import { z } from 'zod';
import { wrap, HttpError } from '../lib/http';
import { loadDataset } from '../services/mining/dataset';
import { runKMeans } from '../services/mining/kmeans';
import { runDecisionTree } from '../services/mining/decisionTree';
import { runApriori } from '../services/mining/apriori';
import { runCrossHospital } from '../services/mining/crossHospital';
import { MiningError } from '../services/mining/random';
const r = Router();
const NUM = ['age', 'systolic_bp', 'diastolic_bp', 'cholesterol', 'heart_rate', 'stay_days', 'treatment_cost'] as const;
const base = z.object({ hospitalIds: z.array(z.number()).optional() });
const guard = async <T,>(fn: () => Promise<T> | T) => { try { return await fn(); } catch (e) { if (e instanceof MiningError) throw new HttpError(400, e.message); throw e; } };

r.post('/kmeans', wrap(async (req, res) => {
  const b = base.extend({ features: z.array(z.enum(NUM)).min(2), k: z.number().int().min(2).max(10), standardize: z.boolean().default(true) }).parse(req.body);
  const { labels, rowsUsed, ...out } = await guard(async () => runKMeans(await loadDataset(b.hospitalIds), b.features, b.k, b.standardize));
  res.json(out);
}));
r.post('/decision-tree', wrap(async (req, res) => {
  const b = base.extend({ target: z.enum(['severity', 'is_discharged', 'age_group']).default('severity'),
    features: z.array(z.enum([...NUM, 'gender', 'disease', 'hospital'])).min(1), maxDepth: z.number().int().min(1).max(10).default(4),
    testSize: z.number().min(0.1).max(0.5).default(0.3) }).parse(req.body);
  res.json(await guard(async () => runDecisionTree(await loadDataset(b.hospitalIds), b.target, b.features, b.maxDepth, b.testSize)));
}));
r.post('/apriori', wrap(async (req, res) => {
  const b = base.extend({ source: z.enum(['tests', 'tests_treatment']).default('tests_treatment'), minSupport: z.number().min(0.01).max(1),
    minConfidence: z.number().min(0.05).max(1), minLift: z.number().min(0).max(50).default(1) }).parse(req.body);
  res.json(await guard(async () => runApriori(await loadDataset(b.hospitalIds), b.source, b.minSupport, b.minConfidence, b.minLift)));
}));
r.post('/cross-hospital', wrap(async (req, res) => {
  const b = base.extend({ features: z.array(z.enum(NUM)).min(2).default(['age', 'stay_days', 'treatment_cost']), k: z.number().int().min(2).max(8).default(3) }).parse(req.body);
  res.json(await guard(async () => runCrossHospital(await loadDataset(b.hospitalIds), b.features, b.k)));
}));
export default r;
