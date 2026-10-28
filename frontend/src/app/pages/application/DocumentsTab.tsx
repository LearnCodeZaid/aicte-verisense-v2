import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileImage, FileText, FlagTriangleRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge, getStatusDef, TONE_DOT } from "@/components/common/StatusBadge";
import { useVerifyDocument } from "@/lib/hooks";
import { humanize } from "@/lib/labels";
import type { ApplicationDetail, DocumentT } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isOfficerPlus, useAuth } from "../../auth";
import DocumentAnalysis from "../../components/DocumentAnalysis";
import { DocumentViewer, type Box } from "../../components/DocumentViewer";

export function regionBoxesFor(doc: DocumentT, app?: ApplicationDetail): Box[] {
  const boxes: Box[] = [];
  const f = doc.forensics ?? ({} as DocumentT["forensics"]);
  (f.regions ?? []).forEach((r: any) => r?.bbox && boxes.push({ bbox: r.bbox, label: r.label ?? "ELA region", tone: "red" }));
  (f.flags ?? []).forEach((fl) => {
    const ev = fl.evidence;
    if (ev && typeof ev === "object") {
      if (Array.isArray(ev.bbox)) boxes.push({ bbox: ev.bbox, label: fl.code, tone: "red" });
      if (Array.isArray(ev.regions)) ev.regions.forEach((r: any) => boxes.push({ bbox: r.bbox ?? r, label: fl.code, tone: "red" }));
    }
  });
  (app?.findings ?? []).forEach((fi) =>
    fi.evidence?.forEach((e) => {
      if (e.type === "IMAGE_REGION" && e.bbox && String(e.documentId) === String(doc.id)) boxes.push({ bbox: e.bbox, label: e.label, tone: "amber" });
    }),
  );
  return boxes;
}

type RowProps = { d: DocumentT; selected: boolean; flags: number; onSelect: (d: DocumentT) => void };

const DocRow = memo(function DocRow({ d, selected, flags, onSelect }: RowProps) {
  const def = getStatusDef(d.verification?.status ?? "VERIFICATION_PENDING", "verification");
  const Icon = d.mimeType?.startsWith("image/") ? FileImage : FileText;
  return (
    <li style={{ contentVisibility: "auto", containIntrinsicSize: "auto 56px" }}>
      <button
        type="button"
        onClick={() => onSelect(d)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-2 border-b border-l-2 px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          selected ? "border-l-saffron bg-navy-50/70" : "border-l-transparent",
        )}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{d.docTypeLabel || humanize(d.docType)}</span>
          {d.fileName && <span className="block truncate text-2xs text-muted-foreground">{d.fileName}</span>}
          <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[def.tone])} aria-hidden />
            {def.label}
            {flags > 0 && (
              <span
                className="ml-auto inline-flex items-center gap-0.5 rounded bg-red-100 px-1 font-semibold text-red-800"
                title={`${flags} risk flag${flags === 1 ? "" : "s"}`}
              >
                <FlagTriangleRight className="h-2.5 w-2.5" aria-hidden />
                {flags}
                <span className="sr-only"> risk flag{flags === 1 ? "" : "s"}</span>
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
});

export default function DocumentsTab({ app }: { app: ApplicationDetail }) {
  const { user } = useAuth();
  const officer = isOfficerPlus(user?.role);
  const [sp, setSp] = useSearchParams();
  const docs = useMemo(() => app.documents ?? [], [app.documents]);
  const selId = sp.get("doc");
  const page = Number(sp.get("page")) || null;
  const idx = Math.max(0, docs.findIndex((d) => String(d.id) === selId));
  const doc = docs[idx];
  const verify = useVerifyDocument(app.id);
  // A page reference (from a finding) means the reviewer wants to see the document itself.
  const [view, setView] = useState<"analysis" | "document">(page ? "document" : "analysis");
  useEffect(() => {
    if (page) setView("document");
  }, [page]);

  useEffect(() => {
    if (docs.length && !selId) {
      const n = new URLSearchParams(sp);
      n.set("doc", String(docs[0].id));
      setSp(n, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs.length, selId]);

  const select = useCallback(
    (d: DocumentT) => {
      setSp(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("doc", String(d.id));
          n.delete("page");
          return n;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  // Risk flags per document: open/escalated findings plus forensic flags raised on the file itself.
  const flagsByDoc = useMemo(() => {
    const m = new Map<string, number>();
    (app.findings ?? []).forEach((f) => {
      if (f.documentId && (f.status === "OPEN" || f.status === "ESCALATED")) m.set(String(f.documentId), (m.get(String(f.documentId)) ?? 0) + 1);
    });
    docs.forEach((d) => {
      const n = d.forensics?.flags?.length ?? 0;
      if (n) m.set(String(d.id), (m.get(String(d.id)) ?? 0) + n);
    });
    return m;
  }, [app.findings, docs]);

  const boxes = useMemo(() => (doc ? regionBoxesFor(doc, app) : []), [doc, app]);

  if (!docs.length) return <EmptyState icon={FolderOpen} title="No documents uploaded" description="Documents appear here once the institution uploads them. Nothing to review yet." />;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Document list (laptop & desktop screens) */}
      <nav aria-label="Documents" className="card-surface hidden max-h-[calc(100vh-160px)] overflow-y-auto lg:block">
        <p className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">{docs.length} documents</p>
        <ul>
          {docs.map((d) => (
            <DocRow key={d.id} d={d} selected={d.id === doc?.id} flags={flagsByDoc.get(String(d.id)) ?? 0} onSelect={select} />
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-3">
        {/* Compact picker (mobile & tablet screens) */}
        <div className="flex items-center gap-2 lg:hidden">
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={idx <= 0} onClick={() => select(docs[idx - 1])} aria-label="Previous document">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={String(doc?.id)} onValueChange={(v) => select(docs.find((d) => String(d.id) === v)!)}>
            <SelectTrigger className="h-9 min-w-0 flex-1" aria-label="Select document">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {docs.map((d, i) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {i + 1}. {d.docTypeLabel || humanize(d.docType)} — {getStatusDef(d.verification?.status ?? "", "verification").label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={idx >= docs.length - 1}
            onClick={() => select(docs[idx + 1])}
            aria-label="Next document"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {doc && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{doc.docTypeLabel || humanize(doc.docType)}</h2>
              <StatusBadge status={doc.verification?.status ?? "VERIFICATION_PENDING"} kind="verification" />
              {page && <span className="text-xs text-muted-foreground">· showing page {page}</span>}
            </div>
            <div role="tablist" aria-label="Document view" className="inline-flex gap-1 rounded-lg bg-muted p-1 2xl:hidden">
              {(["analysis", "document"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "analysis" ? "What we found" : "View document"}
                </button>
              ))}
            </div>
            <div className="grid gap-4 2xl:grid-cols-2">
              <div className={cn("min-w-0", view === "document" ? "block" : "hidden", "2xl:block")}>
                <DocumentViewer key={doc.id} doc={doc} page={page} canSeeEla={officer} regionBoxes={boxes} />
              </div>
              <div className={cn("min-w-0", view === "analysis" ? "block" : "hidden", "2xl:block")}>
                <DocumentAnalysis
                  key={`a-${doc.id}`}
                  doc={doc}
                  onReverify={officer ? () => verify.mutate(doc.id) : undefined}
                  reverifying={verify.isPending}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
