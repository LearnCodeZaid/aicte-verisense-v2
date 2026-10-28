import { useCallback, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookText,
  Check,
  ChevronRight,
  CircleSlash,
  Database,
  FileSearch,
  FileText,
  Image as ImageIcon,
  Loader2,
  type LucideIcon,
  MoreHorizontal,
  Radio,
  ShieldAlert,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdvisoryNote, AdvisoryTag } from "@/components/common/AdvisoryNote";
import { EmptyState } from "@/components/common/EmptyState";
import { SeverityBadge, severityDot } from "@/components/common/SeverityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useUpdateFinding } from "@/lib/hooks";
import { fmtDateTime, fmtValue } from "@/lib/format";
import { FINDING_KIND_LABEL, humanize, SEVERITY_ORDER } from "@/lib/labels";
import type { ApplicationDetail, Evidence, Finding, FindingStatus, Id } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isInstitution, isReviewer, useAuth } from "../../auth";

const EVIDENCE_ICON: Record<string, LucideIcon> = {
  DOCUMENT: FileText,
  FIELD: FileSearch,
  RECORD: Database,
  SOURCE_RESPONSE: Radio,
  IMAGE_REGION: ImageIcon,
  METADATA: ShieldAlert,
  RULE: BookText,
};

const ACTIONS: { status: FindingStatus; label: string; icon: LucideIcon; officer: boolean; inst: boolean }[] = [
  { status: "ACKNOWLEDGED", label: "Acknowledge", icon: Check, officer: true, inst: true },
  { status: "RECTIFIED", label: "Confirm rectified", icon: Wrench, officer: true, inst: false },
  { status: "ESCALATED", label: "Escalate", icon: TriangleAlert, officer: true, inst: false },
  { status: "DISMISSED", label: "Dismiss", icon: CircleSlash, officer: true, inst: false },
];

type StatusFilter = "active" | "all" | "OPEN" | "ACKNOWLEDGED" | "ESCALATED" | "closed";
const ACTIVE: FindingStatus[] = ["OPEN", "ESCALATED", "ACKNOWLEDGED"];
const PAGE = 15;

const matchesStatus = (f: Finding, s: StatusFilter) =>
  s === "all" ? true : s === "active" ? ACTIVE.includes(f.status) : s === "closed" ? !ACTIVE.includes(f.status) : f.status === s;

export default function FindingsTab({ app, onOpenDocument }: { app: ApplicationDetail; onOpenDocument: (id: Id, page?: number | null) => void }) {
  const [sev, setSev] = useState<string>("ALL");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [limit, setLimit] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<{ f: Finding; status: FindingStatus } | null>(null);
  const findings = useMemo(() => app.findings ?? [], [app.findings]);
  const docs = useMemo(() => new Map((app.documents ?? []).map((d) => [String(d.id), d])), [app.documents]);
  const docName = useCallback((id: Id) => docs.get(String(id))?.docTypeLabel, [docs]);

  const sevCounts = useMemo(() => {
    const c: Record<string, number> = {};
    findings.filter((f) => matchesStatus(f, status)).forEach((f) => (c[f.severity] = (c[f.severity] ?? 0) + 1));
    return c;
  }, [findings, status]);

  // Critical first.
  const groups = useMemo(() => {
    const m = new Map<string, Finding[]>();
    SEVERITY_ORDER.forEach((k) => m.set(k, []));
    findings
      .filter((f) => matchesStatus(f, status) && (sev === "ALL" || f.severity === sev))
      .forEach((f) => {
        if (!m.has(f.severity)) m.set(f.severity, []);
        m.get(f.severity)!.push(f);
      });
    return [...m.entries()].filter(([, l]) => l.length > 0);
  }, [findings, sev, status]);

  const activeCount = findings.filter((f) => ACTIVE.includes(f.status)).length;
  const resolved = findings.length - activeCount;
  const canAct = app.status !== "DECIDED";
  const selectCls = "h-8 rounded-md border bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="f-sev" className="text-xs text-muted-foreground">
              Priority
            </Label>
            <select
              id="f-sev"
              className={selectCls}
              value={sev}
              onChange={(e) => {
                setSev(e.target.value);
                setLimit({});
              }}
            >
              <option value="ALL">All priorities</option>
              {SEVERITY_ORDER.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)} ({sevCounts[s] ?? 0})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-status" className="text-xs text-muted-foreground">
              Status
            </Label>
            <select
              id="f-status"
              className={selectCls}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter);
                setLimit({});
              }}
            >
              <option value="active">Needs attention ({activeCount})</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="ESCALATED">Escalated</option>
              <option value="closed">Rectified or dismissed ({resolved})</option>
              <option value="all">All ({findings.length})</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {findings.length} indicators · {activeCount} need review · {resolved} resolved or dismissed
        </p>
      </div>

      <AdvisoryNote>
        These are indicators that need review, not conclusions. Confirm against the original documents before acting.
      </AdvisoryNote>

      {groups.length === 0 ? (
        <EmptyState
          icon={Check}
          title={findings.length ? "Nothing matches these filters" : "No findings"}
          description={findings.length ? "Change the priority or status filter to see other findings." : "Validation did not raise any findings for this application."}
        />
      ) : (
        groups.map(([key, list]) => {
          const shown = limit[key] ?? PAGE;
          return (
            <section key={key} aria-labelledby={`grp-${key}`}>
              <h3 id={`grp-${key}`} className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span className={cn("h-2.5 w-2.5 rounded-sm", severityDot(key))} aria-hidden />
                {humanize(key)}
                <span className="tabular rounded-full bg-muted px-1.5 text-2xs text-muted-foreground">{list.length}</span>
              </h3>
              <div className="space-y-3">
                {list.slice(0, shown).map((f) => (
                  <FindingCard key={f.id} f={f} docName={docName} onOpenDocument={onOpenDocument} onAction={canAct ? (s) => setPending({ f, status: s }) : undefined} />
                ))}
              </div>
              {list.length > shown && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setLimit((l) => ({ ...l, [key]: shown + PAGE }))}>
                  Show more ({list.length - shown} remaining)
                </Button>
              )}
            </section>
          );
        })
      )}

      <FindingActionDialog appId={app.id} pending={pending} onClose={() => setPending(null)} />
    </div>
  );
}

const SEV_BORDER: Record<string, string> = {
  CRITICAL: "border-l-red-700",
  MAJOR: "border-l-orange-500",
  MINOR: "border-l-amber-400",
  INFO: "border-l-blue-500",
};

export function FindingCard({
  f,
  docName,
  onOpenDocument,
  onAction,
  compact,
}: {
  f: Finding;
  docName: (id: Id) => string | undefined;
  onOpenDocument: (id: Id, page?: number | null) => void;
  onAction?: (s: FindingStatus) => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const officer = isReviewer(user?.role);
  const inst = isInstitution(user?.role);
  const actions = ACTIONS.filter((a) => a.status !== f.status && ((officer && a.officer) || (inst && a.inst && !["RECTIFIED", "DISMISSED"].includes(f.status))));
  const closed = f.status === "DISMISSED" || f.status === "RECTIFIED";
  const ruleLine = (f.ruleId || f.clause) && (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {f.ruleId && (
        <span>
          Rule <span className="mono text-foreground">{f.ruleId}</span>
        </span>
      )}
      {f.clause && (
        <span className="inline-flex items-center gap-1">
          <BookText className="h-3 w-3" /> {f.clause}
        </span>
      )}
    </p>
  );
  const [primaryAction, ...moreActions] = actions;
  return (
    <article className={cn("card-surface border-l-4", SEV_BORDER[f.severity] ?? "border-l-slate-300", closed && "opacity-75")}>
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={f.severity} />
          <span className="text-xs text-muted-foreground">{FINDING_KIND_LABEL[f.kind] ?? humanize(f.kind)}</span>
          <span className="ml-auto flex items-center gap-1.5">
            {compact && f.advisory !== false && <AdvisoryTag />}
            {f.status !== "OPEN" && <StatusBadge status={f.status} kind="finding" />}
            {onAction && primaryAction && (
              <>
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => onAction(primaryAction.status)}>
                  <primaryAction.icon className="mr-1 h-3.5 w-3.5" aria-hidden /> {primaryAction.label}
                </Button>
                {moreActions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 px-0" aria-label="More actions for this issue">
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {moreActions.map((a) => (
                        <DropdownMenuItem key={a.status} onSelect={() => onAction(a.status)}>
                          <a.icon className="mr-2 h-4 w-4" aria-hidden /> {a.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
          </span>
        </div>
        <h4 className="mt-2 text-sm font-semibold leading-snug">{f.title}</h4>
        <p className="mt-1 text-sm leading-snug text-foreground/80">{f.reason}</p>

        {compact ? (
          ruleLine && <div className="mt-2">{ruleLine}</div>
        ) : (
          (f.ruleId || f.clause || f.evidence?.length > 0) && (
            <details className="group mt-2">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden />
                Rule and evidence
                {f.evidence?.length > 0 && <span className="font-normal text-muted-foreground">({f.evidence.length})</span>}
              </summary>
              <div className="mt-2 space-y-3 border-l-2 pl-3">
                <p className="text-2xs text-muted-foreground">Updated {fmtDateTime(f.updatedAt)}</p>
                {ruleLine}
                {f.evidence?.length > 0 && (
                  <ul className="divide-y rounded-md border bg-white">
                    {f.evidence.map((e, i) => (
                      <EvidenceRow key={i} e={e} docName={docName} onOpenDocument={onOpenDocument} />
                    ))}
                  </ul>
                )}
              </div>
            </details>
          )
        )}

        {f.reviewerNote && (
          <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs">
            <span className="font-semibold">Reviewer note:</span> {f.reviewerNote}
          </p>
        )}
      </div>
    </article>
  );
}

function EvidenceRow({ e, docName, onOpenDocument }: { e: Evidence; docName: (id: Id) => string | undefined; onOpenDocument: (id: Id, page?: number | null) => void }) {
  const Icon = EVIDENCE_ICON[e.type] ?? FileText;
  const jump = e.documentId !== undefined && e.documentId !== null;
  const content = (
    <>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium">
          {e.label}
          <span className="ml-1.5 font-normal text-muted-foreground">
            {humanize(e.type)}
            {jump && docName(e.documentId!) ? ` · ${docName(e.documentId!)}` : ""}
            {e.page ? ` · p. ${e.page}` : ""}
          </span>
        </span>
        {e.excerpt && <span className="mt-0.5 line-clamp-2 block text-xs italic text-muted-foreground">“{e.excerpt}”</span>}
        {(e.submitted !== undefined && e.submitted !== null) || (e.reference !== undefined && e.reference !== null) ? (
          <span className="mt-1 grid grid-cols-2 gap-2 text-xs">
            <span>
              <span className="text-muted-foreground">Submitted: </span>
              <span className="font-medium">{fmtValue(e.submitted)}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Reference: </span>
              <span className="font-medium">{fmtValue(e.reference)}</span>
            </span>
          </span>
        ) : null}
      </span>
      {jump && <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />}
    </>
  );
  return (
    <li>
      {jump ? (
        <button
          type="button"
          onClick={() => onOpenDocument(e.documentId!, e.page)}
          className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-navy-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          title="Open document"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-start gap-2 px-3 py-2">{content}</div>
      )}
    </li>
  );
}

function FindingActionDialog({ appId, pending, onClose }: { appId: Id; pending: { f: Finding; status: FindingStatus } | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const m = useUpdateFinding(appId);
  const label = pending ? ACTIONS.find((a) => a.status === pending.status)?.label : "";
  const needsLong = pending?.status === "DISMISSED" || pending?.status === "ESCALATED";
  const valid = note.trim().length >= (needsLong ? 10 : 3);
  return (
    <Dialog
      open={!!pending}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setNote("");
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription className="line-clamp-2">{pending?.f.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="finding-note">
            Note <span className="text-red-700">*</span>
          </Label>
          <Textarea
            id="finding-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              pending?.status === "DISMISSED"
                ? "Why is this finding not applicable? (e.g. verified original during hearing)"
                : pending?.status === "RECTIFIED"
                  ? "What was corrected? Reference the re-uploaded document."
                  : "Add context for the record."
            }
          />
          <p className="text-xs text-muted-foreground">Status changes and notes are written to the audit trail.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || m.isPending}
            onClick={() =>
              pending &&
              m.mutate(
                { id: pending.f.id, status: pending.status, note: note.trim() },
                {
                  onSuccess: () => {
                    setNote("");
                    onClose();
                  },
                },
              )
            }
          >
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
