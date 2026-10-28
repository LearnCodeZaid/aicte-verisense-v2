import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact marker shown next to every AI output. */
export function AdvisoryTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-2xs font-medium text-slate-700",
        className,
      )}
      title="Automated suggestion. Advisory only; an officer reviews it."
    >
      <Info className="h-3 w-3" aria-hidden />
      Advisory
    </span>
  );
}

/** Banner form of the advisory notice. */
export function AdvisoryNote({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700",
        className,
      )}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        <strong className="font-semibold">Advisory only.</strong>{" "}
        {children ?? "Automated checks help your review; they are not an approval decision."}
      </span>
    </div>
  );
}

export default AdvisoryNote;
