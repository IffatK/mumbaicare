import { createContext, useContext, useState, ReactNode } from 'react';
export interface GlobalFilters { hospitalIds: number[]; from: string; to: string }
const Ctx = createContext<{ f: GlobalFilters; setF: (f: GlobalFilters) => void }>(null!);
export function FilterProvider({ children }: { children: ReactNode }) {
  const [f, setF] = useState<GlobalFilters>({ hospitalIds: [], from: '', to: '' });
  return <Ctx.Provider value={{ f, setF }}>{children}</Ctx.Provider>;
}
export const useFilters = () => useContext(Ctx);
export const filterQuery = (f: GlobalFilters) => ({ hospitalIds: f.hospitalIds.join(',') || undefined, from: f.from || undefined, to: f.to || undefined });
