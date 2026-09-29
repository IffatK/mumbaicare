# MumbaiCare — Hospital Patient Analytics and Decision Support System

A **MERN** (MongoDB, Express, React, Node.js) academic project for Data Warehousing and Data Mining. It covers patient record management, a star-schema data warehouse, an ETL pipeline, OLAP, K-Means clustering, decision-tree classification, Apriori association rules and reports.

> **Academic use only.** All patients and hospitals are synthetic. Hospital names ending in "(Demo)" are fictional. Nothing here is a diagnosis, prescription or clinical recommendation.

## Stack
| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript, Vite, React Router, Tailwind CSS, Recharts, TanStack Query, React Hook Form + Zod, Lucide |
| Backend | Node.js 20, Express, TypeScript, Mongoose, JWT, bcrypt, Zod |
| Database | MongoDB 7 (operational collections + `dw_*` warehouse collections) |

## Folder structure
```
mumbaicare/
├─ docker-compose.yml
├─ backend/
│  ├─ .env.example
│  └─ src/
│     ├─ index.ts                 # Express app, CORS, helmet, route mounting + role guards
│     ├─ config.ts, db.ts
│     ├─ middleware/auth.ts       # JWT verification, role checks
│     ├─ models/                  # User, Hospital, Patient, Counter, EtlRun, ActivityLog
│     │  └─ warehouse.ts          # star schema: fact + 4 dimension collections
│     ├─ routes/                  # auth, patients, hospitals, analytics, warehouse, olap, mining, reports, quality
│     ├─ services/
│     │  ├─ etl.ts                # extract → transform → validate → load
│     │  └─ mining/               # kmeans, decisionTree, apriori, crossHospital, dataset
│     ├─ lib/                     # errors, dates, filters
│     └─ scripts/                 # seed.ts, runEtl.ts, selfTest.ts
├─ frontend/
│  └─ src/
│     ├─ App.tsx                  # routes + role guards
│     ├─ lib/                     # api client, auth, filters, validation schemas, csv, formatting
│     ├─ components/              # layout (sidebar, top bar, breadcrumbs), UI kit, charts, toasts
│     └─ pages/                   # Landing, Login, Overview, Patients, PatientForm, PatientDetail, Hospitals,
│                                 # Admissions, Diseases, Comparison, Olap, Warehouse, Mining, Reports, Quality, Settings
└─ docs/ARCHITECTURE.md, docs/API.md
```

## Run it
### Option A — Docker (easiest)
```bash
docker compose up --build
```
Open http://localhost:5173. The backend seeds the database automatically on start.

### Option B — Manually
You need Node.js 20+ and MongoDB 7. Use a local install, or a free MongoDB Atlas cluster.
```bash
# terminal 1 — backend on :4000
cd backend
cp .env.example .env          # set MONGODB_URI and JWT_SECRET
npm install
npm run seed                  # demo users, 8 hospitals, 3000 patients
npm run dev

# terminal 2 — frontend on :5173 (proxies /api to :4000)
cd frontend
npm install
npm run dev
```

### First run
Sign in as the admin, go to **Data warehouse** and click **Run ETL**. OLAP and Data mining read from the warehouse, so they are empty until you do. You can also run the ETL from the command line with `npm run etl` inside `backend`.

## Adding staff accounts
Sign in as an admin → **Users & access**. Create staff/analyst/admin logins, assign a hospital for staff, reset passwords, disable accounts. Enforced server-side (`/api/users`, admin-only) — not just hidden in the UI.

## Troubleshooting
**`SSL alert number 80` / connection pool cleared, using MongoDB Atlas:** TLS handshake failing between your machine and Atlas — not a code bug. Usual causes: antivirus/corporate proxy doing SSL inspection, an old Node.js build on Windows, or your IP not whitelisted in Atlas Network Access. Fastest fix: skip Atlas entirely with **Option A (Docker)** above — a local Mongo container, one command, data persists in the `mongodata` volume across restarts, nothing to reconfigure each session. If you must use Atlas: whitelist `0.0.0.0/0` (dev only) in Atlas Network Access, confirm Node 20+, and try disabling any antivirus HTTPS scanning temporarily.

## Demo accounts (local development only)
Password for all accounts: `Password@123`
| Role | Email | Can do |
|---|---|---|
| Admin | admin@mumbaicare.local | Everything, including ETL and hospital management |
| Analyst | analyst@mumbaicare.local | Dashboards, OLAP, mining and reports; read-only records |
| Hospital staff | staff.andheri@mumbaicare.local | Records and analytics for Andheri Community Care (Demo) only |
| Hospital staff | staff.dadar@mumbaicare.local | Records and analytics for Dadar Central Clinic (Demo) only |

## Data warehouse design (star schema in MongoDB)
| Collection | Role | Key |
|---|---|---|
| `dw_fact_patient_admission` | Fact, one document per admission | `sourceRecordId` (unique, keeps ETL idempotent) |
| `dw_dim_hospital` | Dimension | `hospitalKey` |
| `dw_dim_patient` | Dimension (age group, gender) | `patientKey` |
| `dw_dim_disease` | Dimension (condition + severity) | `diseaseKey` |
| `dw_dim_date` | Dimension (day → month → quarter → year) | `dateKey` (yyyymmdd) |

The fact collection stores only surrogate keys and measures. OLAP queries join the dimensions with `$lookup`, filter with `$match` (slice and dice), and aggregate with `$group` (roll-up, drill-down and pivot). The full mapping is in `docs/ARCHITECTURE.md`.

## Testing
- `cd backend && npm test` runs the self-tests. They cover the ETL rules T1–T5 and R01–R07, K-Means on known clusters, a decision tree on a known threshold, and Apriori support, confidence and lift checked against hand calculation.

Manual checks:
1. **Staff scoping.** Signed in as staff, open another hospital's patient by URL; the API returns 404. Creating a record for another hospital returns 403.
2. **Form validation.** A discharge date before admission, a negative cost, or Discharged with no date are all rejected, by the form and by the API.
3. **ETL.** Run the ETL twice; the fact count stays the same. Edit a record and re-run; the change appears. Delete a record and re-run; its fact is removed.
4. **OLAP.** Query Hospital × Admission year. Then drill down, roll up, slice, dice and pivot.
5. **Mining.** Run K-Means, the decision tree (target severity), Apriori (support 0.05, confidence 0.5) and the cross-hospital analysis.

## Security notes
- Passwords are hashed with bcrypt. JWTs expire after 8 hours. Repeated failed logins are throttled.
- Roles are enforced in Express middleware, and staff hospital scoping is applied inside every database query.
- OLAP dimensions and measures come from a whitelist. User values are only ever compared as data.
- Error logs contain messages only, never patient data.
