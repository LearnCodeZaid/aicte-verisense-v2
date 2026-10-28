import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Gavel,
  Printer,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { ScoreRing } from "@/components/common/ScoreBar";
import { RiskBandPill, SeverityBadge } from "@/components/common/SeverityBadge";
import { downloadBlob, errorMessage } from "@/lib/api";
import { useProcessingSummary } from "@/lib/hooks";
import type { ApplicationDetail, Finding } from "@/lib/types";
import { cn } from "@/lib/utils";
import { canDecide, isOfficerPlus, useAuth } from "../../auth";
import { PageSkeleton } from "../../components/Skeletons";

export default function SummaryTab({
  app,
  onOpenDocument,
  onOpenDecision,
  onOpenRectification,
  onSelectTab,
}: {
  app: ApplicationDetail;
  onOpenDocument: (docId: string | number, page?: number | null) => void;
  onOpenDecision?: () => void;
  onOpenRectification?: () => void;
  onSelectTab?: (tab: string) => void;
}) {
  const { user } = useAuth();
  const q = useProcessingSummary(app.id);
  const [downloading, setDownloading] = useState(false);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const s = q.data;
  if (!s) return <EmptyState title="No processing summary available" />;

  const isLowRisk = s.scores.riskBand === "LOW";
  const isHighRisk = s.scores.riskBand === "HIGH";

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const fname = `${s.applicationNo.replace(/\//g, "_")}_scrutiny_summary.pdf`;
      await downloadBlob(`/applications/${s.applicationId}/report.pdf`, fname);
      toast.success("Validation report PDF downloaded");
    } catch (e) {
      toast.error("Download failed", { description: errorMessage(e) });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const { critical, major, minor } = s.findingsDigest;
  const ordered = [...critical, ...major, ...minor];
  // Lead with critical findings; fall back to the highest severity present.
  const topFindings = (critical.length > 0 ? critical : ordered).slice(0, 3);
  const pm = s.processingMetrics;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* At-a-glance risk and compliance */}
      <section aria-labelledby="summary-glance" className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h2 id="summary-glance" className="text-lg font-semibold text-foreground">
              Risk and compliance at a glance
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Overall risk</span>
              <RiskBandPill band={s.scores.riskBand} />
              <span className="text-sm text-muted-foreground">
                {s.findingsDigest.totalActive} open finding(s): {critical.length} critical, {major.length} major
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {s.lastValidatedAt ? `Last validated ${new Date(s.lastValidatedAt).toLocaleString()}. ` : ""}
              Scores are automated and advisory.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-5">
            <div className="flex flex-col items-center">
              <ScoreRing value={s.scores.complianceScore} label={null} size={76} />
              <span className="mt-1 text-xs text-slate-500">Compliance score</span>
            </div>
            <div className="flex flex-col gap-2 print:hidden">
              <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={downloading} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                <span>Export PDF</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={handlePrint} className="gap-1.5 text-xs">
                <Printer className="h-3.5 w-3.5" />
                <span>Print</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Next recommended human action (advisory) */}
      <section
        aria-labelledby="summary-next"
        className={cn(
          "rounded-lg border p-4",
          isLowRisk
            ? "border-emerald-300 bg-emerald-50/40"
            : isHighRisk
            ? "border-red-300 bg-red-50/40"
            : "border-amber-300 bg-amber-50/40",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {isLowRisk ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            ) : isHighRisk ? (
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="summary-next" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Suggested next step
                </h3>
                <Badge variant="outline" className="text-2xs font-semibold">
                  {s.advisoryRecommendation.recommendedAction}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm font-semibold text-foreground">{s.advisoryRecommendation.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{s.advisoryRecommendation.reason}</p>
              <p className="mt-1 text-xs text-slate-500">Advisory only. A person decides.</p>
            </div>
          </div>

          {isOfficerPlus(user?.role) && (
            <div className="flex shrink-0 items-center gap-2 print:hidden">
              {onOpenRectification && s.findingsDigest.totalActive > 0 && (
                <Button size="sm" variant="outline" onClick={onOpenRectification} className="text-xs">
                  Request Rectification
                </Button>
              )}
              {onOpenDecision && canDecide(user?.role) && app.status !== "DECIDED" && (
                <Button size="sm" onClick={onOpenDecision} className="gap-1 text-xs">
                  <Gavel className="h-3.5 w-3.5" />
                  <span>Record Decision</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Top findings with evidence links */}
      {s.findingsDigest.totalActive > 0 ? (
        <section aria-labelledby="summary-findings" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="summary-findings" className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
              <AlertCircle className="h-4 w-4 text-red-600" aria-hidden />
              {critical.length > 0 ? "Top critical findings" : "Top findings"}
            </h3>
            {onSelectTab && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-primary"
                onClick={() => onSelectTab("findings")}
              >
                View all {s.findingsDigest.totalActive} findings
              </Button>
            )}
          </div>

          <ul className="divide-y rounded-lg border bg-card">
            {topFindings.map((f) => (
              <FindingRow key={f.id} f={f} onOpenDocument={onOpenDocument} />
            ))}
          </ul>
        </section>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 text-center">
          <CheckCircle2 className="mx-auto mb-1 h-6 w-6 text-emerald-600" aria-hidden />
          <h4 className="text-sm font-semibold text-emerald-950">No Open Deficiencies</h4>
          <p className="mt-0.5 text-xs text-emerald-800">
            Application complies with all verified handbook rules and statutory requirements.
          </p>
        </div>
      )}

      {/* Secondary detail, collapsed by default */}
      <details className="rounded-lg border bg-card">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          Processing details
          <span className="ml-2 text-xs font-normal text-slate-500">
            {pm.totalDocuments} documents, {pm.verified} verified with authority, {pm.mismatch} mismatch,{" "}
            {pm.forensicFlagsCount} tampering flag(s)
          </span>
        </summary>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t px-4 py-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Uploaded documents" value={pm.totalDocuments} />
          <Metric label="Text read (OCR)" value={`${pm.ocrCompleted}/${pm.totalDocuments}`} />
          <Metric label="Authority verified" value={pm.verified} />
          <Metric
            label="Cross-document score"
            value={`${s.crossVerificationSummary.score}%`}
            note={`${s.crossVerificationSummary.discrepanciesCount} disparity flag(s)`}
          />
          <Metric
            label="Possible alteration"
            value={pm.forensicFlagsCount === 0 ? "None flagged" : `${pm.forensicFlagsCount} flag(s)`}
            note="Advisory scan"
          />
          <Metric label="Cross-document consistency" value={s.scores.crossDocScore} />
        </dl>
      </details>

      <details className="rounded-lg border bg-card">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          Document checks
          <span className="ml-2 text-xs font-normal text-slate-500">
            {s.issuingAuthorityBreakdown.length} document(s) evaluated
          </span>
        </summary>
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow className="h-9">
                <TableHead className="text-xs font-semibold">Document Type</TableHead>
                <TableHead className="text-xs font-semibold">Filename</TableHead>
                <TableHead className="text-xs font-semibold">Issuing Authority</TableHead>
                <TableHead className="text-xs font-semibold">Verification Method</TableHead>
                <TableHead className="text-center text-xs font-semibold">Status</TableHead>
                <TableHead className="text-right text-xs font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.issuingAuthorityBreakdown.map((doc) => {
                const isDocVerified = doc.status === "VERIFIED";
                const isMismatch = doc.status === "MISMATCH_DETECTED";
                return (
                  <TableRow key={doc.documentId} className="h-10 hover:bg-muted/20">
                    <TableCell className="py-2 text-xs font-medium text-foreground">{doc.docType}</TableCell>
                    <TableCell className="py-2 font-mono text-2xs text-muted-foreground">{doc.fileName}</TableCell>
                    <TableCell className="py-2 text-xs text-foreground/80">{doc.source}</TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">{doc.method}</TableCell>
                    <TableCell className="py-2 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-2xs font-semibold",
                          isDocVerified && "border-emerald-400 bg-emerald-50 text-emerald-800",
                          isMismatch && "border-red-400 bg-red-50 text-red-800",
                          !isDocVerified && !isMismatch && "border-amber-300 bg-amber-50 text-amber-800",
                        )}
                      >
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onOpenDocument(doc.documentId)}
                      >
                        View Document
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </details>

      {ordered.length > topFindings.length && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            Other open findings
            <span className="ml-2 text-xs font-normal text-slate-500">
              {ordered.length - topFindings.length} more
            </span>
          </summary>
          <ul className="divide-y border-t">
            {ordered
              .filter((f) => !topFindings.some((t) => t.id === f.id))
              .map((f) => (
                <FindingRow key={f.id} f={f} onOpenDocument={onOpenDocument} />
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground tabular">{value}</dd>
      {note && <dd className="text-2xs text-slate-500">{note}</dd>}
    </div>
  );
}

function FindingRow({
  f,
  onOpenDocument,
}: {
  f: Finding;
  onOpenDocument: (docId: string | number, page?: number | null) => void;
}) {
  // Evidence links that point at a document location; fall back to the finding's own document.
  const links = (f.evidence ?? []).filter((e) => e.documentId != null);
  return (
    <li className="flex flex-col gap-2 p-3 text-xs sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={f.severity} />
          <span className="text-sm font-semibold text-foreground">{f.title}</span>
        </div>
        <p className="text-xs text-slate-500">{f.reason}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5 print:hidden">
        {links.slice(0, 2).map((e, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-2xs"
            onClick={() => onOpenDocument(e.documentId!, e.page ?? null)}
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            <span>
              {e.label || "Evidence"}
              {e.page ? ` (p.${e.page})` : ""}
            </span>
          </Button>
        ))}
        {links.length === 0 && f.documentId && (
          <Button variant="outline" size="sm" className="h-7 text-2xs" onClick={() => onOpenDocument(f.documentId!)}>
            View Doc
          </Button>
        )}
      </div>
    </li>
  );
}
