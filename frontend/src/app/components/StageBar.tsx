import { cn } from "@/lib/utils";

/** The five stages an institution sees, mapped from the detailed application status. */
export const STAGES = ["Draft", "Submitted", "Under review", "Awaiting decision", "Decided"];

export function stageOf(status: string) {
  if (status === "DRAFT") return 0;
  if (status === "RECOMMENDED") return 3;
  if (status === "DECIDED") return 4;
  if (status === "SUBMITTED" || status === "UNDER_VALIDATION") return 1;
  return 2;
}

export const NEEDS_RESPONSE = new Set(["DEFICIENCIES_FLAGGED", "RECTIFICATION_REQUESTED"]);

export function StageBar({ status }: { status: string }) {
  const at = stageOf(status);
  return (
    <div>
      <div className="flex gap-1" aria-hidden>
        {STAGES.map((s, i) => (
          <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= at ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Step {at + 1} of {STAGES.length}: {STAGES[at]}
      </p>
    </div>
  );
}
