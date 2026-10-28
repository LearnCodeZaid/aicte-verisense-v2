import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useVerifyDocument } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/format";
import { humanize, METHOD_LABEL, VERIFICATION_DESCRIPTION, VERIFICATION_STATES } from "@/lib/labels";
import type { ApplicationDetail, DocumentT, Id, VerificationStatus } from "@/lib/types";
import { isOfficerPlus, useAuth } from "../../auth";
import { Panel } from "../../components/Panel";

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default function VerificationTab({ app, onOpenDocument }: { app: ApplicationDetail; onOpenDocument: (id: Id) => void }) {
  const { user } = useAuth();
  const officer = isOfficerPlus(user?.role);
  const verify = useVerifyDocument(app.id);
  const docs = app.documents ?? [];
  // Photos, rosters and similar evidence have no issuing authority; they are listed apart so they do not bury the real checks.
  const checked = docs.filter((d) => d.verification?.status !== "NOT_APPLICABLE");
  const unchecked = docs.filter((d) => d.verification?.status === "NOT_APPLICABLE");

  // One-line tally of the states (zero counts omitted)
  const tally = (VERIFICATION_STATES as VerificationStatus[])
    .map((s) => ({ s, n: checked.filter((d) => (d.verification?.status ?? "VERIFICATION_PENDING") === s).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.n} ${humanize(x.s).toLowerCase()}`)
    .join(" · ");

  const renderRow = (d: DocumentT) => {
    const v = d.verification;
    const busy = verify.isPending && String(verify.variables) === String(d.id);
    const comparisons = v?.comparisons ?? [];
    const hasDetail = !!v?.responseSummary || comparisons.length > 0;
    const meta = [v?.source, v?.method ? METHOD_LABEL[v.method] ?? v.method : null, v?.checkedAt ? fmtDateTime(v.checkedAt) : null].filter(Boolean).join(" · ");
    return (
      <li key={d.id} className="px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-56">
            <button type="button" onClick={() => onOpenDocument(d.id)} className="block max-w-full text-left hover:underline">
              <span className="block font-semibold leading-snug">{d.docTypeLabel || humanize(d.docType)}</span>
            </button>
            {v?.reason && <span className="mt-0.5 block text-sm leading-snug text-foreground/80">{v.reason}</span>}
            {meta && <span className="mt-1 block text-xs text-muted-foreground">{meta}</span>}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={v?.status ?? "VERIFICATION_PENDING"} kind="verification" />
            {officer && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={verify.isPending}
                onClick={() => verify.mutate(d.id)}
                aria-label={`Re-verify ${d.docTypeLabel}`}
                title="Re-verify with source"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {hasDetail && (
          <details className="group mt-2 text-xs">
            <summary className="inline-flex cursor-pointer list-none items-center rounded font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              Response and comparison detail
            </summary>
            <div className="mt-2 space-y-2 border-l-2 pl-3">
              {v?.responseSummary && <p className="text-sm">{v.responseSummary}</p>}
              {comparisons.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Field</th>
                        <th className="py-1 pr-3 font-medium">Submitted</th>
                        <th className="py-1 pr-3 font-medium">Source record</th>
                        <th className="py-1 font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisons.map((c, i) => (
                        <tr key={`${c.field}-${i}`} className="border-t">
                          <td className="py-1 pr-3">{humanize(c.field)}</td>
                          <td className="py-1 pr-3 break-words">{show(c.submitted)}</td>
                          <td className="py-1 pr-3 break-words">{show(c.source)}</td>
                          <td className="py-1">
                            <span className="inline-flex items-center gap-1">
                              {c.match ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                              {c.match ? "Match" : "Differs"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Issuing-authority verification"
        description="Each document is checked against its issuing authority (API, signed QR, DigiLocker or portal lookup)."
        flush
        actions={
          officer && docs.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              disabled={verify.isPending}
              onClick={async () => {
                for (const d of docs.filter((x) => x.verification?.status !== "VERIFIED" && x.verification?.status !== "NOT_APPLICABLE")) {
                  try {
                    await verify.mutateAsync(d.id);
                  } catch {
                    /* toast already shown */
                  }
                }
              }}
            >
              {verify.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
              Re-verify unresolved
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-2 border-b bg-amber-50/50 px-4 py-3 text-xs text-muted-foreground" aria-live="polite">
          <p>
            <span className="font-medium text-foreground">Simulated sources.</span> Results come from simulated authority connectors for
            demonstration. They are not official authentication; confirm with the issuing authority before relying on them.
          </p>
          {checked.length > 0 && <p className="font-medium text-foreground">{tally || "No results yet"}</p>}
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center rounded font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              What do the six states mean?
            </summary>
            <ul className="mt-2 space-y-1.5">
              {(VERIFICATION_STATES as VerificationStatus[]).map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <span className="shrink-0">
                    <StatusBadge status={s} kind="verification" />
                  </span>
                  <span className="pt-0.5">{VERIFICATION_DESCRIPTION[s]}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>

        {docs.length === 0 ? (
          <EmptyState compact title="No documents" description="Upload documents to run issuing-authority verification." />
        ) : (
          <>
            <ul className="divide-y">{checked.map(renderRow)}</ul>
            {unchecked.length > 0 && (
              <details className="group border-t">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="block text-sm font-semibold">Not checked at an issuing authority ({unchecked.length})</span>
                    <span className="block text-xs text-muted-foreground">
                      Photos and institution-generated documents are reviewed through cross-record rules and image analysis instead.
                    </span>
                  </span>
                </summary>
                <ul className="divide-y border-t bg-muted/20">
                  {unchecked.map((d) => (
                    <li key={d.id} className="px-4 py-2.5">
                      <button type="button" onClick={() => onOpenDocument(d.id)} className="text-left text-sm hover:underline">
                        <span className="font-medium">{d.docTypeLabel || humanize(d.docType)}</span>
                        <span className="mono ml-2 text-xs text-muted-foreground">{d.fileName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
