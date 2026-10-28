import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDashed, Loader2, MessageSquarePlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSaveCriterionNote, useVerificationSummary } from "@/lib/hooks";
import { errorMessage } from "@/lib/api";
import type { CriterionBasis, CriterionState, Id, VerificationCriterion } from "@/lib/types";

const STATE_META: Record<CriterionState, { label: string; Icon: typeof CheckCircle2; icon: string; chip: string }> = {
  PASSED: { label: "Passed", Icon: CheckCircle2, icon: "text-emerald-600", chip: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  FAILED: { label: "Failed", Icon: XCircle, icon: "text-red-600", chip: "border-red-200 bg-red-50 text-red-800" },
  NEEDS_REVIEW: { label: "Needs review", Icon: AlertTriangle, icon: "text-amber-600", chip: "border-amber-200 bg-amber-50 text-amber-900" },
  NOT_EVALUATED: { label: "Not evaluated", Icon: CircleDashed, icon: "text-slate-400", chip: "border-slate-200 bg-slate-50 text-slate-700" },
};

function basisLabel(basis: CriterionBasis, explanation: string): string | null {
  const simulated = /simulat/i.test(explanation);
  switch (basis) {
    case "CONFIRMED":
      return simulated ? "Confirmed (simulated source)" : "Confirmed";
    case "PRELIMINARY_AI":
      return "Preliminary AI warning";
    case "SOURCE_UNAVAILABLE":
      return simulated ? "Source unavailable (simulated source)" : "Source unavailable";
    default:
      return null;
  }
}

function fmt(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function NoteBox({ applicationId, criterion }: { applicationId: Id; criterion: VerificationCriterion }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const save = useSaveCriterionNote(applicationId);
  const trimmed = text.trim();
  const inputId = `note-${criterion.id}`;

  const submit = () => {
    if (!trimmed) return;
    setSaved(false);
    save.mutate(
      { criterionId: criterion.id, note: trimmed },
      {
        onSuccess: () => {
          setText("");
          setSaved(true);
          setOpen(false);
        },
      },
    );
  };

  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="ghost" className="-ml-2 h-8 text-[#0B2E59]" onClick={() => setOpen(true)}>
          <MessageSquarePlus className="mr-1.5 h-4 w-4" aria-hidden />
          Add note
        </Button>
        <span role="status" aria-live="polite" className="text-xs text-emerald-700">
          {saved && "Note saved."}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <label htmlFor={inputId} className="text-xs font-medium text-slate-700">
        Reviewer note
      </label>
      <Textarea
        id={inputId}
        value={text}
        maxLength={2000}
        rows={2}
        autoFocus
        placeholder="Add a note for this question (recorded in the audit history)"
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={!trimmed || save.isPending} onClick={submit}>
          {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
          Save note
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <span role="status" aria-live="polite" className="text-xs">
          {save.isPending && <span className="text-slate-500">Saving...</span>}
          {save.isError && <span className="text-red-700">Could not save note: {errorMessage(save.error)}</span>}
        </span>
      </div>
    </div>
  );
}

const CriterionRow = memo(function CriterionRow({
  applicationId,
  criterion: c,
  canReview,
}: {
  applicationId: Id;
  criterion: VerificationCriterion;
  canReview: boolean;
}) {
  const meta = STATE_META[c.state] ?? STATE_META.NOT_EVALUATED;
  const basis = basisLabel(c.basis, c.explanation);
  const evId = `ev-${c.id}`;
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <meta.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.icon}`} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-snug text-slate-900">{c.question}</span>
            <span className="mt-0.5 block text-sm leading-snug text-slate-600">{c.explanation}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${meta.chip}`}>{meta.label}</span>
            {basis && <span className="max-w-[11rem] text-right text-[11px] leading-tight text-slate-500">{basis}</span>}
          </span>
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
        </summary>

        <div className="space-y-1 px-4 pb-4 pl-[3.25rem]">
          {c.evidence.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-700">Evidence ({c.evidence.length})</p>
              <ul id={evId} className="mt-1 space-y-2 border-l-2 border-slate-200 pl-3">
                {c.evidence.map((e, i) => (
                  <li key={i} className="text-xs text-slate-700">
                    <span className="font-medium text-slate-900">{e.label}</span>
                    {e.detail && <span className="block text-slate-600">{e.detail}</span>}
                    <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {e.findingId != null && (
                        <Link className="text-[#0B2E59] underline underline-offset-2" to={`?tab=findings&finding=${e.findingId}`}>
                          View finding
                        </Link>
                      )}
                      {e.documentId != null && (
                        <Link className="text-[#0B2E59] underline underline-offset-2" to={`?tab=documents&doc=${e.documentId}`}>
                          View document
                        </Link>
                      )}
                      {e.ruleId && <span className="text-slate-500">Rule {e.ruleId}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {c.reviewNote && (
            <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <p className="whitespace-pre-wrap">{c.reviewNote.note}</p>
              <p className="mt-1 text-slate-500">
                Reviewer note by {c.reviewNote.by} · {fmt(c.reviewNote.at)}
              </p>
            </div>
          )}
          {canReview && <NoteBox applicationId={applicationId} criterion={c} />}
        </div>
      </details>
    </li>
  );
});

export default function VerificationSummaryPanel({ applicationId, canReview }: { applicationId: Id; canReview: boolean }) {
  const q = useVerificationSummary(applicationId);
  const data = q.data;

  let body: React.ReactNode;
  if (q.isLoading) {
    body = (
      <div className="divide-y" aria-busy="true" aria-label="Loading verification summary">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3.5">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (q.isError) {
    body = (
      <div role="alert" className="m-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p>We could not load the verification summary. {errorMessage(q.error)}</p>
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => q.refetch()}>
          Try again
        </Button>
      </div>
    );
  } else if (!data || data.criteria.length === 0) {
    body = (
      <p className="p-4 text-sm text-slate-600">No summary is available yet. Upload documents and run verification to see the six checks here.</p>
    );
  } else {
    body = (
      <ul className="divide-y">
        {data.criteria.map((c) => (
          <CriterionRow key={c.id} applicationId={applicationId} criterion={c} canReview={canReview} />
        ))}
      </ul>
    );
  }

  const counts = data?.counts;
  const attention = counts ? counts.needsReview + counts.notEvaluated : 0;

  return (
    <section aria-labelledby="vs-heading" className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
        <div>
          <h2 id="vs-heading" className="text-base font-semibold text-slate-900">
            Application Verification Summary
          </h2>
          {data?.evaluatedAt && <p className="text-xs text-slate-500">Evaluated {fmt(data.evaluatedAt)}</p>}
        </div>
        {counts && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium" aria-live="polite">
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">{counts.passed} passed</span>
            <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-800">{counts.failed} failed</span>
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">{attention} need attention</span>
          </p>
        )}
      </div>
      {body}
      <p className="border-t bg-muted/30 px-4 py-2.5 text-xs text-slate-500">
        This summary is advisory. It never approves or rejects an application; only authorised reviewers make that decision.
      </p>
    </section>
  );
}
