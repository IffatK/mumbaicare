import { Link } from 'react-router-dom';
import { Logo } from '../components/Layout';
import { Database, Boxes, BrainCircuit, BedDouble, GitCompare, FileText, ShieldAlert } from 'lucide-react';

/** The signature element: the star schema itself, drawn as the hero. */
function StarHero() {
  const dims = [
    { x: 60, y: 40, t: 'DimHospital', s: 'area, type' },
    { x: 330, y: 40, t: 'DimDate', s: 'day → year' },
    { x: 60, y: 250, t: 'DimPatient', s: 'age group, gender' },
    { x: 330, y: 250, t: 'DimDisease', s: 'condition, severity' },
  ];
  return <svg viewBox="0 0 500 330" className="w-full" role="img" aria-label="Star schema: a central patient admissions fact table joined to hospital, date, patient and disease dimensions">
    {dims.map(d => <line key={d.t} x1={d.x + 55} y1={d.y + 28} x2={250} y2={165} stroke="#2F74C0" strokeWidth="1.5" strokeDasharray="4 4" />)}
    <rect x="165" y="125" width="170" height="80" rx="8" fill="#14A89C" />
    <text x="250" y="158" textAnchor="middle" fill="#081A2E" fontWeight="700" fontSize="15">FactPatientAdmission</text>
    <text x="250" y="180" textAnchor="middle" fill="#081A2E" fontSize="12">stay · cost · count</text>
    {dims.map(d => <g key={d.t}><rect x={d.x} y={d.y} width="110" height="56" rx="6" fill="#12325A" stroke="#2F74C0" />
      <text x={d.x + 55} y={d.y + 24} textAnchor="middle" fill="#fff" fontWeight="600" fontSize="12.5">{d.t}</text>
      <text x={d.x + 55} y={d.y + 42} textAnchor="middle" fill="#B7C2CE" fontSize="10.5">{d.s}</text></g>)}
  </svg>;
}
const FEATURES = [
  { icon: BedDouble, t: 'Admissions and discharges', d: 'Daily, monthly and yearly trends, length of stay and current occupancy per hospital.' },
  { icon: GitCompare, t: 'Hospital comparison', d: 'Put hospitals side by side on volume, stay, cost, disease mix and severity, with sample sizes shown.' },
  { icon: Database, t: 'Star-schema warehouse', d: 'An ETL pipeline cleans operational records and loads a fact collection with four dimension collections.' },
  { icon: Boxes, t: 'OLAP explorer', d: 'Roll up, drill down, slice, dice and pivot the cube with real aggregation pipelines.' },
  { icon: BrainCircuit, t: 'Data mining', d: 'K-Means clustering, decision-tree classification and Apriori association rules, implemented in the backend.' },
  { icon: FileText, t: 'Reports', d: 'Filtered, printable reports with CSV export and data-freshness stamps.' },
];
export default function Landing() {
  return <div className="min-h-screen bg-white">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Logo /><Link to="/login" className="btn-primary">Sign in</Link></header>
    <section className="bg-navy-900">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-[1.1fr_1fr] md:py-20">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight text-white md:text-5xl">Patient analytics for Mumbai's hospitals, built on a real data warehouse.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-200">MumbaiCare turns hospital admission records into a star-schema warehouse you can query, compare and mine. It is a Data Warehousing and Data Mining project running on synthetic data.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link to="/login" className="btn-teal !px-5 !py-2.5">Sign in to the dashboard</Link>
            <a href="#how" className="btn !px-5 !py-2.5 text-white ring-1 ring-white/30 hover:bg-white/10">How it works</a></div>
        </div>
        <div className="rounded-xl bg-navy-950/60 p-4 ring-1 ring-white/10"><StarHero /></div>
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5 py-16">
      <h2 className="font-display text-2xl font-semibold text-navy-900">What you can analyse</h2>
      <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(f => <div key={f.t}><f.icon className="text-tide-600" /><h3 className="mt-3 font-semibold text-navy-900">{f.t}</h3><p className="mt-1 text-sm leading-relaxed text-ink-500">{f.d}</p></div>)}
      </div>
    </section>
    <section id="how" className="border-y border-ink-200 bg-ink-50">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-2xl font-semibold text-navy-900">From records to patterns</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-4">
          {[['Operational database', 'Staff record admissions in MongoDB through validated forms.'], ['ETL', 'A Node.js pipeline extracts, cleans, validates and flags rejected records with a rule code.'],
            ['Warehouse', 'A fact table with hospital, patient, date and disease dimensions.'], ['Analysis', 'OLAP queries, charts, clustering, classification and association rules.']]
            .map(([t, d], i) => <li key={t} className="border-l-2 border-tide-600 pl-4"><p className="text-sm font-semibold text-tide-700">Step {i + 1}</p><h3 className="mt-1 font-semibold text-navy-900">{t}</h3><p className="mt-1 text-sm text-ink-500">{d}</p></li>)}
        </ol>
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex gap-3 rounded-lg border border-amber-600/40 bg-amber-100 p-5 text-sm text-ink-900">
        <ShieldAlert className="shrink-0 text-amber-600" />
        <p><strong>Privacy and academic use.</strong> Every patient record and hospital in MumbaiCare is synthetic; hospital names ending in "(Demo)" are fictional. Results are statistical patterns for coursework, not medical findings, and the platform does not provide diagnoses, prescriptions or clinical advice.</p>
      </div>
    </section>
    <footer className="border-t border-ink-200 py-6 text-center text-xs text-ink-500">MumbaiCare · Data Warehousing and Data Mining academic project</footer>
  </div>;
}
