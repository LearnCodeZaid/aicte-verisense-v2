import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  FileSearch,
  Scale,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdvisoryTag } from "@/components/common/AdvisoryNote";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { ScoreRing } from "@/components/common/ScoreBar";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { useCrossVerification } from "@/lib/hooks";
import type { ApplicationDetail, CrossVerificationDiscrepancy, CrossVerificationField } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Panel } from "../../components/Panel";
import { PageSkeleton } from "../../components/Skeletons";

type OpenDoc = (docId: string | number, page?: number | null) => void;
type FieldState = "MISMATCH" | "MISSING" | "PARTIAL" | "MATCH";

// Mismatches first, then missing, partial, and finally matches (stable within each group).
const STATE_ORDER: Record<FieldState, number> = { MISMATCH: 0, MISSING: 1, PARTIAL: 2, MATCH: 3 };
const ROW_GRID = "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_140px_24px]";

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

function fieldState(f: CrossVerificationField): FieldState {
  if (f.documents.length === 0 || f.documents.every((d) => isBlank(d.value))) return "MISSING";
  if (f.status === "MISMATCH") return "MISMATCH";
  if (f.status === "PARTIAL_MATCH") return "PARTIAL";
  return "MATCH";
}

export default function CrossVerificationTab({
  app,
  onOpenDocument,
}: {
  app: ApplicationDetail;
  onOpenDocument: OpenDoc;
}) {
  const q = useCrossVerification(app.id);
  const result = q.data;

  const rows = useMemo(
    () =>
      (result?.fieldsChecked ?? [])
        .map((f) => ({ f, state: fieldState(f) }))
        .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]),
    [result],
  );
  const discByField = useMemo(() => {
    const m = new Map<string, CrossVerificationDiscrepancy[]>();
    for (const d of result?.discrepancies ?? []) m.set(d.field, [...(m.get(d.field) ?? []), d]);
    return m;
  }, [result]);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  if (!result || result.totalDocumentsAnalyzed === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No documents available for cross-verification"
        description="Upload statutory documents (Affidavit, Land Deed, Fire NOC, Occupancy Cert) to run automated cross-consistency analysis."
      />
    );
  }

  const isConsistent = result.status === "CONSISTENT";
  const isCritical = result.status === "CRITICAL_CONFLICT";
  const knownFields = new Set(result.fieldsChecked.map((f) => f.field));
  const orphanDiscs = result.discrepancies.filter((d) => !knownFields.has(d.field));
  const counts = rows.reduce(
    (acc, r) => ({ ...acc, [r.state]: acc[r.state] + 1 }),
    { MISMATCH: 0, MISSING: 0, PARTIAL: 0, MATCH: 0 } as Record<FieldState, number>,
  );

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Panel className="rounded-md border bg-card p-5">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-5">
            <div className="flex flex-col items-center">
              <ScoreRing value={result.overallScore} label={null} size={92} />
              <span className="text-2xs font-semibold uppercase text-muted-foreground mt-1">Consistency</span>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">Record consistency</h3>
                <Badge
                  variant={isConsistent ? "default" : isCritical ? "destructive" : "secondary"}
                  className={cn(
                    "font-semibold text-xs",
                    isConsistent && "bg-emerald-600 hover:bg-emerald-700 text-white",
                    !isConsistent && !isCritical && "bg-amber-100 text-amber-900 border-amber-300",
                  )}
                >
                  {isConsistent ? (
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                      Consistent Cross-Reference
                    </span>
                  ) : isCritical ? (
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                      Critical Conflict Detected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                      Discrepancies Flagged
                    </span>
                  )}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Compares what the institution declared, the record held by AICTE, and the values read from uploaded
                documents (area measurements, validity periods, names and particulars) to surface contradictions or
                altered values. Advisory only.
              </p>

              <p className="pt-2 text-xs text-muted-foreground">
                <strong className="text-foreground tabular">{result.totalDocumentsAnalyzed}</strong> documents analysed,{" "}
                <strong className="text-foreground tabular">{result.fieldsChecked.length}</strong> parameters checked:{" "}
                <span className={counts.MISMATCH > 0 ? "font-semibold text-red-700" : ""}>{counts.MISMATCH} mismatch</span>,{" "}
                {counts.MISSING} missing, {counts.PARTIAL} partial, {counts.MATCH} match. Discrepancies:{" "}
                <strong className={cn("tabular", result.discrepanciesCount > 0 ? "text-red-700" : "text-emerald-700")}>
                  {result.discrepanciesCount}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex md:flex-col justify-end gap-2 shrink-0">
            <AdvisoryTag />
          </div>
        </div>
      </Panel>

      {/* Comparison table */}
      <section className="space-y-3" aria-labelledby="cv-compare-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h4 id="cv-compare-heading" className="text-lg font-semibold text-foreground">
            Declared vs. record vs. document
          </h4>
          <span className="text-xs text-slate-500">Mismatches first. Open a row for per-document detail.</span>
        </div>

        <div className="rounded-lg border bg-card shadow-sm">
          <div
            className={cn(
              "hidden md:grid gap-3 border-b bg-muted/40 px-4 py-2 text-2xs font-semibold uppercase text-muted-foreground",
              ROW_GRID,
            )}
          >
            <span>Parameter</span>
            <span>Declared / AICTE record</span>
            <span>Document value</span>
            <span>Result</span>
            <span />
          </div>
          <ul className="divide-y">
            {rows.map(({ f, state }) => (
              <FieldRow
                key={f.field}
                field={f}
                state={state}
                discrepancies={discByField.get(f.field) ?? []}
                onOpenDocument={onOpenDocument}
              />
            ))}
          </ul>
        </div>
      </section>

      {/* Discrepancies not tied to a listed parameter */}
      {orphanDiscs.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-lg font-semibold text-foreground">Other flagged inconsistencies ({orphanDiscs.length})</h4>
          <div className="grid grid-cols-1 gap-3">
            {orphanDiscs.map((disc) => (
              <DiscrepancyCard key={disc.id} disc={disc} onOpenDocument={onOpenDocument} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StateMark({ state }: { state: FieldState }) {
  const cfg = {
    MATCH: { Icon: CheckCircle2, text: "Match", cls: "text-emerald-700" },
    PARTIAL: { Icon: AlertTriangle, text: "Partial match", cls: "text-amber-700" },
    MISMATCH: { Icon: XCircle, text: "Mismatch", cls: "text-red-700" },
    MISSING: { Icon: CircleDashed, text: "Missing", cls: "text-slate-600" },
  }[state];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", cfg.cls)}>
      <cfg.Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {cfg.text}
    </span>
  );
}

function FieldRow({
  field,
  state,
  discrepancies,
  onOpenDocument,
}: {
  field: CrossVerificationField;
  state: FieldState;
  discrepancies: CrossVerificationDiscrepancy[];
  onOpenDocument: OpenDoc;
}) {
  // Summarise the document side with the first value that disagrees (else the first value).
  const lead =
    field.documents.find((d) => d.status !== "MATCH" && !isBlank(d.value)) ??
    field.documents.find((d) => !isBlank(d.value));
  const extra = field.documents.length - 1;

  return (
    <li>
      <details className="group" open={state === "MISMATCH"}>
        <summary
          className={cn(
            "grid cursor-pointer list-none grid-cols-1 gap-1 px-4 py-3 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring md:items-center md:gap-3 [&::-webkit-details-marker]:hidden",
            ROW_GRID,
          )}
        >
          <span className="text-sm font-medium text-foreground">{field.label}</span>
          <span className="min-w-0 text-xs">
            <span className="text-muted-foreground md:hidden">Declared / record: </span>
            <span className="break-words font-mono text-foreground">
              {isBlank(field.referenceValue) ? "Not provided" : field.referenceValue}
            </span>
          </span>
          <span className="min-w-0 text-xs">
            <span className="text-muted-foreground md:hidden">Document: </span>
            {lead ? (
              <>
                <span className="break-words font-mono text-foreground">{String(lead.value)}</span>
                {extra > 0 && <span className="ml-1.5 text-2xs text-muted-foreground">+{extra} more</span>}
              </>
            ) : (
              <span className="text-muted-foreground">No document value</span>
            )}
          </span>
          <StateMark state={state} />
          <ChevronDown
            className="hidden h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 md:block"
            aria-hidden
          />
        </summary>

        <div className="space-y-3 border-t bg-muted/10 px-4 py-3">
          {field.documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No uploaded document supplied a value for this parameter.</p>
          ) : (
            <ul className="space-y-2">
              {field.documents.map((d) => {
                const ds: FieldState = isBlank(d.value)
                  ? "MISSING"
                  : d.status === "MATCH"
                    ? "MATCH"
                    : d.status === "PARTIAL_MATCH"
                      ? "PARTIAL"
                      : "MISMATCH";
                return (
                  <li
                    key={`${d.docId}-${d.docType}`}
                    className="flex flex-col gap-2 rounded border bg-background p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-medium text-foreground">{d.docTypeLabel || d.docType}</div>
                      <div className="truncate font-mono text-2xs text-muted-foreground">{d.fileName}</div>
                      <div className="break-words font-mono text-xs">
                        <span className="font-medium text-foreground">
                          {isBlank(d.value) ? "No value found" : String(d.value)}
                        </span>
                        {d.similarity !== undefined && (
                          <span className="ml-1.5 text-2xs text-muted-foreground">
                            ({Math.round(d.similarity * 100)}% sim)
                          </span>
                        )}
                        {d.diffPct !== undefined && d.diffPct > 0 && (
                          <span className="ml-1.5 text-2xs text-amber-700">(Δ {d.diffPct}%)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StateMark state={ds} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-2xs"
                        onClick={() => onOpenDocument(d.docId, d.page)}
                      >
                        View
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {discrepancies.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Flagged inconsistencies ({discrepancies.length})</p>
              {discrepancies.map((disc) => (
                <DiscrepancyCard key={disc.id} disc={disc} onOpenDocument={onOpenDocument} />
              ))}
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

function DiscrepancyCard({
  disc,
  onOpenDocument,
}: {
  disc: CrossVerificationDiscrepancy;
  onOpenDocument: OpenDoc;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 bg-card shadow-sm transition-all",
        disc.severity === "CRITICAL"
          ? "border-red-300 bg-red-50/20"
          : "border-amber-300 bg-amber-50/20",
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={disc.severity} />
            <span className="font-semibold text-sm text-foreground">{disc.fieldLabel}</span>
            <Badge variant="outline" className="font-mono text-2xs">
              {disc.id}
            </Badge>
          </div>

          <p className="text-xs text-foreground/90 font-medium">{disc.description}</p>

          {disc.clause && <p className="text-2xs text-muted-foreground italic">Clause: {disc.clause}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 max-w-2xl">
            {[disc.docA, disc.docB].map((doc, i) => (
              <div key={i} className="rounded border bg-background/90 p-2 text-xs">
                <div className="text-2xs font-semibold text-muted-foreground uppercase flex items-center justify-between gap-2">
                  <span>{doc.type}</span>
                  <span className="truncate max-w-[150px]">{doc.fileName}</span>
                </div>
                <div className="mt-1 font-mono font-medium text-foreground text-xs break-words">{doc.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-row flex-wrap md:flex-col gap-2 shrink-0 pt-2 md:pt-0">
          {[disc.docA, disc.docB].map(
            (doc, i) =>
              Number(doc.id) > 0 && (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="h-7 text-2xs gap-1"
                  onClick={() => onOpenDocument(doc.id)}
                >
                  <FileSearch className="h-3 w-3" aria-hidden />
                  <span>Inspect {doc.type}</span>
                </Button>
              ),
          )}
        </div>
      </div>
    </div>
  );
}
