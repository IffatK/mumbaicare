/** All dates are stored as UTC midnight so a calendar date never shifts with the server timezone. */
export const toDate = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
export const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in server local time
export const DAY = 86_400_000;
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
export const dateKey = (d: Date) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
