# API reference
Base URL: `/api`. Every route except login requires `Authorization: Bearer <JWT>`.

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | /auth/login | public | `{email,password}` → `{token,user}` |
| GET | /auth/me | all | current profile |
| GET | /patients | all | `page,pageSize,search,hospitalId,condition,severity,status,from,to,sort,dir`; staff auto-scoped |
| GET | /patients/conditions | all | distinct conditions |
| GET | /patients/:id | all | 404 if outside staff scope |
| POST | /patients | admin, staff | validated; ID and stay generated server-side |
| PUT | /patients/:id | admin, staff | |
| DELETE | /patients/:id | admin | |
| GET | /hospitals, /hospitals/:id | all | with patient counts |
| POST, PUT | /hospitals[/:id] | admin | `active` toggles status |
| GET | /analytics/overview | all | KPIs + chart series; `hospitalIds,from,to` |
| GET | /analytics/admissions | all | `grain=day|month|year` |
| GET | /analytics/diseases | all | + `condition,severity,gender` |
| GET | /analytics/hospitals | all | comparison metrics |
| GET | /warehouse/schema | admin, analyst | collections, fields, document counts |
| GET | /warehouse/status | admin, analyst | ETL history and freshness |
| POST | /warehouse/etl/run | admin | runs the ETL; 409 if one is already running |
| GET | /olap/meta | admin, analyst | dimensions, measures, member values |
| POST | /olap/query | admin, analyst | `{rows[], columns[], measure, filters:[{dimension,values[]}]}` |
| POST | /mining/kmeans | admin, analyst | `{features[], k, standardize, hospitalIds?}` |
| POST | /mining/decision-tree | admin, analyst | `{target, features[], maxDepth, testSize}` |
| POST | /mining/apriori | admin, analyst | `{source, minSupport, minConfidence, minLift}` |
| POST | /mining/cross-hospital | admin, analyst | `{features[], k}` |
| POST | /reports/generate | all | `{title, hospitalIds[], from, to, includeMining}` |
| GET | /quality, /quality/records/:key | admin, analyst | validation checks |

Errors return `{error}` with the HTTP status. Validation errors add `issues[]` in Zod format.
