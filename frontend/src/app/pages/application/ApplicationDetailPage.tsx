import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ClipboardList,
  FileDown,
  FileText,
  Gavel,
  History,
  ImageIcon,
  Loader2,
  MessageSquarePlus,
  PenLine,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Undo2,
  AlertTriangle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/common/EmptyState";
import { RiskBandPill } from "@/components/common/SeverityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { downloadBlob, errorMessage } from "@/lib/api";
import { useApplication, useValidate } from "@/lib/hooks";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { categoryLabel, DECISION_LABEL, REGION_LABEL } from "@/lib/labels";
import type { ApplicationDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { canDecide, isInstitution, isOfficerPlus, isReviewer, useAuth } from "../../auth";
import { useSetCrumb } from "../../layout/crumbs";
import { PageSkeleton } from "../../components/Skeletons";
import { DecisionDialog, ObservationDialog, RectificationDialog } from "./ActionDialogs";
import OverviewTab from "./OverviewTab";
import DocumentsTab from "./DocumentsTab";
import FindingsTab from "./FindingsTab";
import VerificationTab from "./VerificationTab";
import InfraTab from "./InfraTab";
import AuditTab from "./AuditTab";
import ReportTab from "./ReportTab";
import CrossVerificationTab from "./CrossVerificationTab";
import SummaryTab from "./SummaryTab";
import VerificationSummaryPanel from "./VerificationSummaryPanel";

// Visible tabs. Legacy ids ("summary", "cross-verification") stay valid in the URL and
// resolve to the tab that now hosts their content as a sub-section.
const TABS = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "findings", label: "Issues found", icon: AlertTriangle },
  { id: "verification", label: "Checks", icon: ShieldCheck },
  { id: "infrastructure", label: "Facilities", icon: ImageIcon },
  { id: "audit", label: "History", icon: History },
  { id: "report", label: "Report", icon: ScrollText },
] as const;

const TAB_ALIAS: Record<string, string> = { summary: "overview", "cross-verification": "verification" };

const EDITABLE = new Set(["DRAFT", "RECTIFICATION_REQUESTED"]);

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const q = useApplication(id);
  useSetCrumb(q.data?.applicationNo);
  const [sp, setSp] = useSearchParams();
  const rawTab = sp.get("tab") ?? "overview";
  const tab = TAB_ALIAS[rawTab] ?? rawTab;
  const { user: me } = useAuth();
  const canReview = isOfficerPlus(me?.role);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorState error={q.error ?? "Application not found"} onRetry={() => q.refetch()} />;
  const app = q.data;

  const setTab = (t: string) => {
    const n = new URLSearchParams(sp);
    n.set("tab", t);
    if (t !== "documents") {
      n.delete("doc");
      n.delete("page");
    }
    setSp(n, { replace: true });
  };

  /** Jump to a document (optionally a page) from anywhere in the page. */
  const openDocument = (docId: string | number, page?: number | null) => {
    const n = new URLSearchParams(sp);
    n.set("tab", "documents");
    n.set("doc", String(docId));
    if (page) n.set("page", String(page));
    else n.delete("page");
    setSp(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openFindings = (app.findings ?? []).filter((f) => f.status === "OPEN" || f.status === "ESCALATED").length;
  const infraCount = (app.documents ?? []).filter((d) => d.infra || d.docType.startsWith("INFRA_PHOTO")).length;

  return (
    <div>
      <Header app={app} />

      <Tabs value={tab} onValueChange={setTab} className="mt-5">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-auto w-max justify-start gap-1 rounded-none border-b bg-transparent p-0">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className={cn(
                  "relative gap-1.5 rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-2 text-sm font-medium text-muted-foreground",
                  "data-[state=active]:border-navy data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
                )}
              >
                <t.icon className="h-4 w-4" aria-hidden />
                {t.label}
                {t.id === "findings" && openFindings > 0 && (
                  <span className="tabular rounded-full bg-red-100 px-1.5 text-2xs font-semibold leading-4 text-red-800">{openFindings}</span>
                )}
                {t.id === "documents" && (
                  <span className="tabular rounded-full bg-muted px-1.5 text-2xs font-semibold leading-4 text-muted-foreground">
                    {app.documents?.length ?? 0}
                  </span>
                )}
                {t.id === "infrastructure" && infraCount > 0 && (
                  <span className="tabular rounded-full bg-muted px-1.5 text-2xs font-semibold leading-4 text-muted-foreground">{infraCount}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="mt-5">
          <TabsContent value="overview" className="mt-0 space-y-6">
            <VerificationSummaryPanel applicationId={app.id} canReview={canReview} />
            <OverviewTab app={app} onOpenDocument={openDocument} />
            <details className="rounded-md border bg-card" open={rawTab === "summary"}>
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Processing summary</summary>
              <div className="border-t p-4">
                <SummaryTab app={app} onOpenDocument={openDocument} onSelectTab={setTab} />
              </div>
            </details>
          </TabsContent>
          <TabsContent value="documents" className="mt-0">
            <DocumentsTab app={app} />
          </TabsContent>
          <TabsContent value="findings" className="mt-0">
            <FindingsTab app={app} onOpenDocument={openDocument} />
          </TabsContent>
          <TabsContent value="verification" className="mt-0 space-y-6">
            <VerificationTab app={app} onOpenDocument={openDocument} />
            <details className="rounded-md border bg-card" open={rawTab === "cross-verification"}>
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Cross-document checks</summary>
              <div className="border-t p-4">
                <CrossVerificationTab app={app} onOpenDocument={openDocument} />
              </div>
            </details>
          </TabsContent>
          <TabsContent value="infrastructure" className="mt-0">
            <InfraTab app={app} onOpenDocument={openDocument} />
          </TabsContent>
          <TabsContent value="audit" className="mt-0">
            <AuditTab app={app} />
          </TabsContent>
          <TabsContent value="report" className="mt-0">
            <ReportTab app={app} onOpenDocument={openDocument} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function Header({ app }: { app: ApplicationDetail }) {
  const { user } = useAuth();
  const role = user?.role;
  const validate = useValidate(app.id);
  const [dlg, setDlg] = useState<null | "obs" | "rect" | "decide" | "recommend">(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const inst = app.institution;
  const decided = app.status === "DECIDED";
  const counts = app.counts ?? ({} as ApplicationDetail["counts"]);

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      await downloadBlob(`/applications/${app.id}/report.pdf`, `VeriSense_${app.applicationNo}_report.pdf`);
    } catch (e) {
      toast.error("Could not download report", { description: errorMessage(e) });
    } finally {
      setPdfBusy(false);
    }
  }

  const primary =
    role === "SCRUTINY_OFFICER" ? (
      <Button size="sm" onClick={() => setDlg("recommend")} disabled={decided}>
        <Gavel className="mr-1.5 h-4 w-4" /> Record recommendation
      </Button>
    ) : canDecide(role) ? (
      <Button size="sm" onClick={() => setDlg("decide")} disabled={decided}>
        <Gavel className="mr-1.5 h-4 w-4" /> Record decision
      </Button>
    ) : isInstitution(role) && EDITABLE.has(app.status) ? (
      <Button size="sm" asChild>
        <Link to={`/portal/applications/${app.id}/edit`}>
          {app.status === "DRAFT" ? <PenLine className="mr-1.5 h-4 w-4" /> : <Send className="mr-1.5 h-4 w-4" />}
          {app.status === "DRAFT" ? "Continue application" : "Fix deficiencies & resubmit"}
        </Link>
      </Button>
    ) : null;

  return (
    <section className="space-y-4 border-b pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono rounded bg-navy-50 px-1.5 py-0.5 text-xs font-medium text-navy">{app.applicationNo}</span>
            <StatusBadge status={app.status} kind="application" />
            <RiskBandPill band={app.riskBand} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{inst?.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {categoryLabel(app.category)} · AY {app.academicYear} · {inst?.city}, {inst?.state} · {REGION_LABEL[app.region] ?? app.region}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {app.submittedAt ? <>Submitted {fmtDate(app.submittedAt)} · </> : null}
            Checked {app.lastValidatedAt ? fmtDateTime(app.lastValidatedAt) : "never"}
            {app.assignedOfficer ? <> · Assigned to {app.assignedOfficer}</> : null}
          </p>
          <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">Compliance</dt>
              <dd className="tabular font-semibold">{Math.round(app.complianceScore ?? 0)}/100</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dd className={cn("tabular font-semibold", (counts.critical ?? 0) > 0 ? "text-red-700" : "text-foreground")}>{counts.critical ?? 0}</dd>
              <dt className="text-muted-foreground">critical</dt>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dd className={cn("tabular font-semibold", (counts.major ?? 0) > 0 ? "text-orange-700" : "text-foreground")}>{counts.major ?? 0}</dd>
              <dt className="text-muted-foreground">major</dt>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dd className="tabular font-semibold">{counts.minor ?? 0}</dd>
              <dt className="text-muted-foreground">minor</dt>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primary}
          <Button size="sm" variant="outline" onClick={downloadPdf} disabled={pdfBusy}>
            {pdfBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
            Download report
          </Button>
        </div>
      </div>

      {app.decision && (
        <div className="rounded-md bg-navy-50/60 px-4 py-3 text-sm">
          <span className="font-semibold text-navy">{DECISION_LABEL[app.decision.action] ?? app.decision.action}</span>
          <span className="text-muted-foreground">
            {" "}
            · by {app.decision.decidedBy} on {fmtDateTime(app.decision.decidedAt)}
          </span>
          <p className="mt-1 text-foreground/90">“{app.decision.note}”</p>
        </div>
      )}

      {isOfficerPlus(role) && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => validate.mutate()} disabled={validate.isPending || decided}>
            {validate.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Re-run checks
          </Button>
          {isReviewer(role) && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setDlg("rect")} disabled={decided}>
                <Undo2 className="mr-1.5 h-4 w-4" /> Request rectification
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDlg("obs")}>
                <MessageSquarePlus className="mr-1.5 h-4 w-4" /> Add observation
              </Button>
            </>
          )}
        </div>
      )}

      {isReviewer(role) && (
        <>
          <ObservationDialog app={app} open={dlg === "obs"} onOpenChange={(o) => setDlg(o ? "obs" : null)} />
          <RectificationDialog app={app} open={dlg === "rect"} onOpenChange={(o) => setDlg(o ? "rect" : null)} />
          <DecisionDialog
            app={app}
            mode={canDecide(role) ? "decide" : "recommend"}
            open={dlg === "decide" || dlg === "recommend"}
            onOpenChange={(o) => setDlg(o ? (canDecide(role) ? "decide" : "recommend") : null)}
          />
        </>
      )}
    </section>
  );
}
