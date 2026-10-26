import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useStore } from "../store";

export default function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0">
      {toasts.map((t) => {
        const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : Info;
        const cls = t.kind === "success" ? "border-st-resolved/30 text-st-resolved" : t.kind === "error" ? "border-st-breach/30 text-st-breach" : "border-slt-blue-100 text-slt-blue";
        return (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={`animate-toast pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-white px-4 py-3 shadow-[var(--shadow-overlay)] ${cls}`}>
            <Icon size={17} className="mt-0.5 shrink-0" aria-hidden />
            <p className="flex-1 text-sm text-ink">{t.text}</p>
            <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="text-ink-faint hover:text-ink"><X size={15} /></button>
          </div>
        );
      })}
    </div>
  );
}
