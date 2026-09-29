export const inr = (n: any) => n == null || isNaN(Number(n)) ? '—' : '₹' + Math.round(Number(n)).toLocaleString('en-IN');
export const inrShort = (n: any) => { const v = Number(n); if (!isFinite(v)) return '—';
  return v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : inr(v); };
export const num = (n: any, d = 0) => n == null || isNaN(Number(n)) ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
export const date = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const dateTime = (d: any) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const sevLabel = (s: string) => s ? s.charAt(0) + s.slice(1).toLowerCase() : s;
export const COLORS = ['#1D5FA8', '#0E8C83', '#0C2340', '#B7791F', '#6B8FB8', '#14A89C', '#8A5A9E', '#C0392B', '#5E7A3A', '#A0AEC0'];
export const SEV_COLORS: Record<string, string> = { MILD: '#14A89C', MODERATE: '#B7791F', SEVERE: '#C0392B' };
