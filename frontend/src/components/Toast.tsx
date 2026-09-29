import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
type T = { id: number; kind: 'ok' | 'err'; msg: string };
const Ctx = createContext<(kind: T['kind'], msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: T['kind'], msg: string) => {
    const id = Date.now() + Math.random(); setItems(x => [...x, { id, kind, msg }]);
    setTimeout(() => setItems(x => x.filter(t => t.id !== id)), 4500);
  }, []);
  return <Ctx.Provider value={push}>{children}
    <div className="fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
      {items.map(t => <div key={t.id} className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm shadow-lg ${t.kind === 'ok' ? 'border-tide-500 bg-tide-100 text-tide-700' : 'border-alert-600 bg-alert-100 text-alert-600'}`}>
        {t.kind === 'ok' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<span className="flex-1">{t.msg}</span>
        <button aria-label="Dismiss" onClick={() => setItems(x => x.filter(y => y.id !== t.id))}><X size={16} /></button></div>)}
    </div></Ctx.Provider>;
}
export const useToast = () => useContext(Ctx);
