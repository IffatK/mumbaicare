# Architecture

```
React SPA (frontend/)
   │ REST + JWT  (/api)
   ▼
Express API (backend/src)
   ├─ routes: auth · patients · hospitals · analytics · reports · quality     → operational collections
   ├─ services/etl.ts        operational collections ─► transform/validate ─► dw_* collections
   ├─ routes/olap.ts         aggregation pipelines over the star schema
   └─ services/mining/*      K-Means · Decision Tree · Apriori · cross-hospital (read dw_*)
   ▼
MongoDB: users, hospitals, patients, counters, etlruns, activitylogs, dw_fact_*, dw_dim_*
```

## Operational vs analytical data
- **Operational analytics** (Overview, Admissions, Disease, Hospital comparison) aggregate the `patients` collection directly, so they are always current.
- **OLAP and mining** read the warehouse, which holds cleaned and conformed data. The Data warehouse page shows how many records have changed since the last ETL run.

## ETL rules
These are documented at the top of `backend/src/services/etl.ts`.

Transform rules:
- **T1:** trim categorical values; title-case gender; upper-case severity.
- **T2:** normalise dates to UTC midnight; date keys are yyyymmdd integers.
- **T3:** derive the age group.
- **T4:** recompute the stay from the dates.
- **T5:** normalise the test list (sorted, no duplicates).

Validation rules. A record that fails any of these is rejected and logged with its rule code. It is never silently modified.
- **R01:** a required field is missing.
- **R02:** age is outside 0–110.
- **R03:** the discharge date is before the admission date.
- **R04:** the cost is negative.
- **R05:** the status and discharge date don't match.
- **R06:** the admission date is in the future.
- **R07:** the hospital doesn't exist.

Load:
- Dimensions are upserted on their natural keys. A surrogate key is assigned once, from a counter.
- Facts are upserted on `sourceRecordId`, so re-runs never duplicate.
- Facts whose source record was deleted are removed.

## OLAP mapping
| Operation | Pipeline |
|---|---|
| Roll-up / drill-down | Change the date level in the `$group` key: year › quarter › month › day |
| Slice | One `$match` on a dimension value |
| Dice | Two or more `$match` conditions |
| Pivot | Swap the row and column dimensions; the API returns a cross-tab |

## Data mining
All algorithms are implemented from scratch in TypeScript and seeded (seed 42), so results are reproducible.

| Algorithm | File | Notes |
|---|---|---|
| K-Means | kmeans.ts | k-means++ init, best of 10 runs, optional z-score scaling, silhouette score on a 1000-point sample |
| Decision tree | decisionTree.ts | CART with Gini impurity, balanced class weights, stratified split, one-hot categories, feature importance, text export |
| Apriori | apriori.ts | Level-wise candidate generation with subset pruning, max itemset size 4; rules scored by support, confidence and lift |
