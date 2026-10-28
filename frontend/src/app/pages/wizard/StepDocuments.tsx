import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, FileText, Loader2, RotateCw, Trash2, UploadCloud, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdvisoryTag } from "@/components/common/AdvisoryNote";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { api, errorMessage } from "@/lib/api";
import { useInvalidateApp, useMeta } from "@/lib/hooks";
import { confPct, fmtBytes } from "@/lib/format";
import { humanize } from "@/lib/labels";
import type { ApplicationDetail, ChecklistItem, DocumentT } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Panel } from "../../components/Panel";

interface UploadJob {
  key: string;
  file: File;
  docType?: string;
  state: "uploading" | "done" | "error";
  doc?: DocumentT;
  error?: string;
  stage: number;
}

const STAGES = ["Uploading", "Reading text (OCR)", "Classifying", "Extracting fields", "Forensic checks", "Verifying with issuer"];

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXT = /\.(pdf|jpe?g|png)$/i;
const OTHER_SLOT = "__other__";

/** Plain-language file check; returns null when the file is acceptable. */
function checkFile(f: File): string | null {
  if (!ALLOWED_EXT.test(f.name)) return `"${f.name}" is not a supported file type. Please upload a PDF, JPG or PNG.`;
  if (f.size > MAX_BYTES) return `"${f.name}" is ${fmtBytes(f.size)}, which is over the 20 MB limit. Please upload a smaller file.`;
  if (f.size === 0) return `"${f.name}" is empty. Please choose a different file.`;
  return null;
}

function Dropzone({
  onFiles,
  compact,
  actionLabel,
  describedBy,
}: {
  onFiles: (f: File[]) => void;
  compact?: boolean;
  actionLabel?: string;
  describedBy?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length) onFiles(files);
      }}
      className={cn(
        "flex items-center justify-center rounded-md border-2 border-dashed text-center transition-colors",
        compact ? "gap-2 px-3 py-2" : "flex-col gap-2 px-6 py-8",
        over ? "border-primary-600 bg-navy-50" : "border-input bg-background",
      )}
    >
      <UploadCloud className={cn("text-muted-foreground", compact ? "h-4 w-4" : "h-7 w-7")} aria-hidden />
      <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
        {over ? "Drop to upload" : compact ? "Drop a file or" : "Drag and drop files here, or"}{" "}
        <Button type="button" variant={compact ? "outline" : "default"} size="sm" onClick={() => ref.current?.click()} aria-describedby={describedBy}>
          {actionLabel ?? "Upload"}
        </Button>
      </p>
      {!compact && <p className="text-xs text-muted-foreground">PDF, JPG or PNG, up to 20 MB each</p>}
      <input
        ref={ref}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        multiple={!compact}
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function evaluateChecklist(items: ChecklistItem[] | undefined, formData: Record<string, any>): ChecklistItem[] {
  return (items ?? []).filter((it: any) => {
    const cond = it.when;
    if (!cond) return true;
    const field = String(cond.field ?? "").replace(/^formData\./, "");
    const v = formData?.[field];
    if ("truthy" in cond) return !!v === !!cond.truthy;
    if ("equals" in cond) return v === cond.equals;
    return true;
  });
}

export default function StepDocuments({ app, checklist }: { app: ApplicationDetail; checklist: ChecklistItem[] }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [fileErrors, setFileErrors] = useState<Record<string, string[]>>({});
  const inv = useInvalidateApp();
  const meta = useMeta();
  const docs = app.documents ?? [];
  const docTypeLabel = (id: string) => meta.data?.docTypes?.find((t) => t.id === id)?.label ?? humanize(id);

  async function runUpload(file: File, docType?: string) {
    const key = `${Date.now()}-${Math.random()}`;
    const job: UploadJob = { key, file, docType, state: "uploading", stage: 0 };
    setJobs((j) => [job, ...j]);
    const timer = setInterval(() => setJobs((js) => js.map((x) => (x.key === key && x.stage < STAGES.length - 1 ? { ...x, stage: x.stage + 1 } : x))), 700);
    try {
      const doc = await api.uploadDocument(app.id, file, docType);
      setJobs((js) => js.map((x) => (x.key === key ? { ...x, state: "done", doc } : x)));
      inv(app.id);
    } catch (e) {
      setJobs((js) => js.map((x) => (x.key === key ? { ...x, state: "error", error: errorMessage(e) } : x)));
      toast.error(`Upload failed: ${file.name}`, { description: errorMessage(e) });
    } finally {
      clearInterval(timer);
    }
  }

  async function upload(files: File[], docType?: string) {
    const slot = docType ?? OTHER_SLOT;
    const errs: string[] = [];
    const valid: File[] = [];
    for (const f of files) {
      const err = checkFile(f);
      if (err) errs.push(err);
      else valid.push(f);
    }
    setFileErrors((m) => ({ ...m, [slot]: errs }));
    for (const file of valid) await runUpload(file, docType);
  }

  function retry(job: UploadJob) {
    setJobs((js) => js.filter((j) => j.key !== job.key));
    void runUpload(job.file, job.docType);
  }

  function dismiss(job: UploadJob) {
    setJobs((js) => js.filter((j) => j.key !== job.key));
  }

  async function remove(d: DocumentT) {
    try {
      await api.deleteDocument(d.id);
      setJobs((js) => js.filter((j) => j.doc?.id !== d.id));
      inv(app.id);
      toast.success("Document removed");
    } catch (e) {
      toast.error("Could not remove document", { description: errorMessage(e) });
    }
  }

  const { byType, others, mandatoryDone, mandatoryTotal } = useMemo(() => {
    const byType = new Map<string, DocumentT[]>();
    docs.forEach((d) => byType.set(d.docType, [...(byType.get(d.docType) ?? []), d]));
    const checklistTypes = new Set(checklist.map((c) => c.docType));
    return {
      byType,
      others: docs.filter((d) => !checklistTypes.has(d.docType)),
      mandatoryDone: checklist.filter((c) => c.mandatory && byType.has(c.docType)).length,
      mandatoryTotal: checklist.filter((c) => c.mandatory).length,
    };
  }, [docs, checklist]);

  const activeJobs = (slot: string | undefined) => jobs.filter((j) => j.docType === slot && j.state !== "done");
  const otherJobs = jobs.filter((j) => !j.docType && j.state !== "done");

  return (
    <div className="space-y-6">
      <Panel
        title="Required documents"
        description={`${mandatoryDone} of ${mandatoryTotal} required documents uploaded. Each file is checked as soon as it is uploaded.`}
        actions={<AdvisoryTag />}
        flush
      >
        <ul className="divide-y">
          {checklist.map((c) => {
            const have = byType.get(c.docType) ?? [];
            const running = activeJobs(c.docType);
            const uploading = running.some((j) => j.state === "uploading");
            const status: RowStatus = uploading ? "uploading" : have.some(needsCorrection) ? "needs" : have.length ? "analysed" : "none";
            const hintId = `hint-${c.docType}`;
            return (
              <li key={c.docType} className="space-y-2 px-4 py-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {c.label || humanize(c.docType)}{" "}
                      <span className={cn("ml-1 rounded px-1.5 py-0.5 text-2xs font-medium", c.mandatory ? "bg-navy-50 text-primary-600" : "bg-muted text-muted-foreground")}>
                        {c.mandatory ? "Required" : "Optional"}
                      </span>
                    </p>
                    {c.clause && (
                      <p id={hintId} className="text-xs text-muted-foreground">
                        {c.clause}
                      </p>
                    )}
                    <RowStatusLine status={status} />
                  </div>
                  <div className="w-full sm:w-64">
                    <Dropzone
                      compact
                      actionLabel={have.length ? "Replace" : "Upload"}
                      describedBy={c.clause ? hintId : undefined}
                      onFiles={(f) => upload(f.slice(0, 1), c.docType)}
                    />
                  </div>
                </div>
                <FileErrors errors={fileErrors[c.docType] ?? []} />
                {running.map((j) => (
                  <JobCard key={j.key} job={j} onRetry={() => retry(j)} onDismiss={() => dismiss(j)} />
                ))}
                {have.map((d) => (
                  <DocLine key={d.id} d={d} onRemove={() => remove(d)} docTypeLabel={docTypeLabel} slot={c.docType} />
                ))}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Other documents" description="Optional. Upload anything else that supports your application; VeriSense will work out what it is.">
        <Dropzone onFiles={(f) => upload(f)} actionLabel="Choose files" />
        <FileErrors errors={fileErrors[OTHER_SLOT] ?? []} />
        {(otherJobs.length > 0 || others.length > 0) && (
          <div className="mt-3 space-y-2">
            {otherJobs.map((j) => (
              <JobCard key={j.key} job={j} onRetry={() => retry(j)} onDismiss={() => dismiss(j)} />
            ))}
            {others.map((d) => (
              <DocLine key={d.id} d={d} onRemove={() => remove(d)} docTypeLabel={docTypeLabel} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

type RowStatus = "none" | "uploading" | "analysed" | "needs";

function needsCorrection(d: DocumentT) {
  const s = d.verification?.status;
  return s === "MISMATCH_DETECTED" || s === "EXPIRED";
}

function RowStatusLine({ status }: { status: RowStatus }) {
  const map = {
    none: { icon: <CircleDashed className="h-3.5 w-3.5" aria-hidden />, text: "Not uploaded", cls: "text-slate-600" },
    uploading: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />, text: "Uploading and analysing", cls: "text-primary-600" },
    analysed: { icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />, text: "Analysed", cls: "text-green-700" },
    needs: { icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />, text: "Needs correction", cls: "text-amber-800" },
  }[status];
  return (
    <p className={cn("mt-1 flex items-center gap-1.5 text-xs font-medium", map.cls)} role="status" aria-live="polite">
      {map.icon}
      {map.text}
    </p>
  );
}

function FileErrors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div role="alert" className="mt-2 space-y-0.5 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
      {errors.map((e) => (
        <p key={e}>{e}</p>
      ))}
    </div>
  );
}

function DocLine({ d, onRemove, docTypeLabel, slot }: { d: DocumentT; onRemove: () => void; docTypeLabel: (id: string) => string; slot?: string }) {
  return (
    <details className="group rounded border bg-slate-50 text-xs">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600">
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{d.fileName}</span>
        <StatusBadge status={d.verification?.status ?? "VERIFICATION_PENDING"} kind="verification" />
        {(d.forensics?.flags?.length ?? 0) > 0 && <span className="rounded bg-red-50 px-1 text-2xs font-medium text-red-800">{d.forensics.flags.length} flag(s)</span>}
        <span className="font-medium text-primary-600 group-open:hidden">View analysis</span>
        <span className="hidden font-medium text-primary-600 group-open:inline">Hide analysis</span>
      </summary>
      <div className="space-y-2 border-t px-2 py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-muted-foreground">Classified as</span>
          <span className="font-medium">{docTypeLabel(d.classification?.docType ?? d.docType)}</span>
          <span className="tabular text-muted-foreground">({confPct(d.classification?.confidence)}%)</span>
          {slot && d.classification?.docType && d.classification.docType !== slot && (
            <span className="rounded bg-amber-50 px-1 text-amber-800">differs from this slot: {docTypeLabel(slot)}</span>
          )}
        </div>
        {needsCorrection(d) && <p className="text-amber-800">This document needs correction. Replace it with a corrected copy.</p>}
        {d.verification?.reason && <p className="text-muted-foreground">{d.verification.reason}</p>}
        {(d.forensics?.flags ?? []).map((f, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <SeverityBadge severity={String(f.severity)} />
            <span>{f.reason}</span>
          </div>
        ))}
        {Object.keys(d.extractedFields ?? {}).length > 0 && (
          <p className="text-muted-foreground">
            Extracted: {Object.keys(d.extractedFields).slice(0, 5).map(humanize).join(", ")}
            {Object.keys(d.extractedFields).length > 5 ? "…" : ""}
          </p>
        )}
        <Button variant="ghost" size="sm" className="h-7 text-red-700" onClick={onRemove} aria-label={`Remove ${d.fileName}`}>
          <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Remove
        </Button>
      </div>
    </details>
  );
}

function JobCard({ job, onRetry, onDismiss }: { job: UploadJob; onRetry: () => void; onDismiss: () => void }) {
  const pct = Math.round(((job.stage + 1) / STAGES.length) * 100);
  return (
    <div className="rounded-md border p-3" aria-live="polite">
      <div className="flex items-start gap-2">
        {job.state === "uploading" ? (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary-600" aria-hidden />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{job.file.name}</p>
          <p className="text-xs text-muted-foreground">{fmtBytes(job.file.size)}</p>
        </div>
      </div>
      {job.state === "uploading" && (
        <div className="mt-2 pl-6">
          <div className="h-1.5 w-full overflow-hidden rounded bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Progress for ${job.file.name}`}>
            <div className="h-full bg-primary-600 transition-[width] duration-150" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {STAGES[job.stage]} ({pct}%)
          </p>
        </div>
      )}
      {job.state === "error" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
          <p className="min-w-0 flex-1 text-xs text-red-700">Upload failed: {job.error}</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCw className="mr-1 h-3.5 w-3.5" aria-hidden /> Try again
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
