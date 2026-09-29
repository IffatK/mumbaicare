import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ReactNode } from 'react';
export const axis = { tick: { fontSize: 11, fill: '#66768A' }, tickLine: false, axisLine: { stroke: '#D8DFE6' } };
export const grid = <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F5" vertical={false} />;
export const tip = <Tooltip contentStyle={{ borderRadius: 6, border: '1px solid #D8DFE6', fontSize: 12 }} />;
export const legend = <Legend wrapperStyle={{ fontSize: 12 }} />;
export function ChartBox({ h = 260, label, children }: { h?: number; label: string; children: ReactNode }) {
  return <div role="img" aria-label={label} style={{ height: h }}><ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer></div>;
}
export { XAxis, YAxis };
