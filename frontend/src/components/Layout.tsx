import { useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Users, UserCog, Building2, BedDouble, Activity, GitCompare, Boxes, Database, BrainCircuit, FileText, ShieldCheck, Settings, LogOut, Menu, X, ChevronRight } from 'lucide-react';
import { useAuth, Role } from '../lib/auth';
export const NAV: { to: string; label: string; icon: any; roles: Role[] }[] = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, roles: ['ADMIN', 'ANALYST', 'STAFF'] },
  { to: '/app/patients', label: 'Patient records', icon: Users, roles: ['ADMIN', 'ANALYST', 'STAFF'] },
  { to: '/app/hospitals', label: 'Hospitals', icon: Building2, roles: ['ADMIN', 'ANALYST', 'STAFF'] },
  { to: '/app/admissions', label: 'Admissions & discharges', icon: BedDouble, roles: ['ADMIN', 'ANALYST', 'STAFF'] },
  { to: '/app/diseases', label: 'Disease & severity', icon: Activity, roles: ['ADMIN', 'ANALYST', 'STAFF'] },
  { to: '/app/comparison', label: 'Hospital comparison', icon: GitCompare, roles: ['ADMIN', 'ANALYST'] },
  { to: '/app/olap', label: 'OLAP explorer', icon: Boxes, roles: ['ADMIN', 'ANALYST'] },
  { to: '/app/warehouse', label: 'Data warehouse', icon: Database, roles: ['ADMIN', 'ANALYST'] },
  { to: '/app/mining', label: 'Data mining', icon: BrainCircuit, roles: ['ADMIN', 'ANALYST'] },
  { to: '/app/reports', label: 'Reports', icon: FileText, roles: ['ADMIN', 'ANALYST', 'STAFF'] },
  { to: '/app/quality', label: 'Data quality', icon: ShieldCheck, roles: ['ADMIN', 'ANALYST'] },
  { to: '/app/users', label: 'Users & access', icon: UserCog, roles: ['ADMIN'] },
  { to: '/app/settings', label: 'Settings', icon: Settings, roles: ['ADMIN', 'ANALYST', 'STAFF'] },
];
const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Administrator', ANALYST: 'Analyst', STAFF: 'Hospital staff' };
export function Logo({ light = false }: { light?: boolean }) {
  return <span className="flex items-center gap-2">
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="7" fill={light ? '#12325A' : '#0C2340'} /><path d="M9 22V10l7 8 7-8v12" stroke="#14A89C" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <span className={`font-display text-lg font-semibold ${light ? 'text-white' : 'text-navy-900'}`}>MumbaiCare</span></span>;
}
export default function Layout() {
  const { user, logout } = useAuth(); const loc = useLocation(); const [open, setOpen] = useState(false);
  const items = NAV.filter(n => user && n.roles.includes(user.role));
  const current = [...NAV].sort((a, b) => b.to.length - a.to.length).find(n => loc.pathname.startsWith(n.to));
  const sub = loc.pathname.split('/').slice(3).filter(Boolean);
  const sidebar = <nav className="flex h-full flex-col bg-navy-900 text-ink-200" aria-label="Main">
    <div className="flex h-14 items-center justify-between px-4"><Link to="/app" onClick={() => setOpen(false)}><Logo light /></Link>
      <button className="text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></div>
    <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">{items.map(n =>
      <li key={n.to}><NavLink end={n.to === '/app'} to={n.to} onClick={() => setOpen(false)} className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-navy-800 font-semibold text-white shadow-[inset_3px_0_0_#14A89C]' : 'hover:bg-navy-800/60 hover:text-white'}`}>
        <n.icon size={17} />{n.label}</NavLink></li>)}</ul>
    <p className="px-4 pb-4 text-[11px] leading-snug text-ink-300/70">Synthetic data. Academic use only.</p>
  </nav>;
  return <div className="flex min-h-screen">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">{sidebar}</aside>
    {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
      <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside></div>}
    <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur">
        <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
        <ol className="flex min-w-0 items-center gap-1 text-sm text-ink-500" aria-label="Breadcrumb">
          <li><Link to="/app" className="hover:text-navy-900">Home</Link></li>
          {current && current.to !== '/app' && <><ChevronRight size={14} /><li><Link to={current.to} className="hover:text-navy-900">{current.label}</Link></li></>}
          {sub.length > 0 && current?.to !== '/app' && <><ChevronRight size={14} /><li className="truncate font-medium text-ink-700">{sub[sub.length - 1] === 'new' ? 'New' : sub[sub.length - 1] === 'edit' ? 'Edit' : 'Details'}</li></>}
        </ol>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block"><p className="text-sm font-semibold text-navy-900">{user?.name}</p>
            <p className="text-xs text-ink-500">{user && ROLE_LABEL[user.role]}{user?.hospitalName ? ` · ${user.hospitalName}` : ''}</p></div>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-tide-100 text-sm font-bold text-tide-700" aria-hidden>{user?.name[0]}</span>
          <button className="btn-ghost !px-2" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6"><Outlet /></main>
    </div></div>;
}
