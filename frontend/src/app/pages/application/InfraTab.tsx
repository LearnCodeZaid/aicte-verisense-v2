import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowUpRight, Camera, Eye, EyeOff, ImageOff, Loader2, ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdvisoryNote, AdvisoryTag } from "@/components/common/AdvisoryNote";
import { EmptyState } from "@/components/common/EmptyState";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { useBlobUrl } from "@/lib/hooks";
import { fmtDateTime, fmtNumber, fmtValue } from "@/lib/format";
import { humanize } from "@/lib/labels";
import type { ApplicationDetail, DocumentT, Finding, Id } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ImageWithBoxes } from "../../components/DocumentViewer";
import { ConfidenceMeter } from "../../components/DocumentAnalysis";

function flagText(f: any): { code: string; reason: string; severity?: string } {
  if (typeof f === "string") return { code: f, reason: humanize(f) };
  return { code: f.code ?? "", reason: f.reason ?? humanize(f.code), severity: f.severity };
}

/** Flips to true once the element nears the viewport, so thumbnails are fetched lazily. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

function gpsText(gps: any): string | null {
  if (!gps) return null;
  if (typeof gps !== "object") return String(gps);
  const lat = Number(gps.lat ?? gps[0]);
  const lng = Number(gps.lng ?? gps.lon ?? gps[1]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : null;
}

export default function InfraTab({ app, onOpenDocument }: { app: ApplicationDetail; onOpenDocument: (id: Id) => void }) {
  const docs = (app.documents ?? []).filter((d) => d.infra || d.docType.startsWith("INFRA_PHOTO"));
  const infraFindings = (app.findings ?? []).filter((f) => f.kind === "INFRASTRUCTURE");
  const general = infraFindings.filter((f) => !f.documentId);
  const suggestInspection =
    infraFindings.some((f) => (f.severity === "CRITICAL" || f.severity === "MAJOR") && (f.status === "OPEN" || f.status === "ESCALATED")) ||
    docs.some((d) => (d.infra?.flags ?? []).length > 0);

  if (!docs.length)
    return (
      <EmptyState
        icon={Camera}
        title="No infrastructure photos yet"
        description="Upload clear, geo-tagged photographs of classrooms, laboratories, the library and accessibility features (ramps, toilets). Switch on location and date on the camera so each photo can be checked against the campus address."
      />
    );

  return (
    <div className="space-y-6">
      {suggestInspection && (
        <div className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
          <ScanEye className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-violet-900">Physical inspection suggested</p>
            <p className="mt-0.5 text-sm text-violet-900/80">
              Photographic evidence does not fully support the declared infrastructure (counts below norm, quality or metadata concerns). An
              expert-committee visit may be warranted.
            </p>
          </div>
          <AdvisoryTag className="ml-auto shrink-0" />
        </div>
      )}

      {general.length > 0 && (
        <div className="card-surface divide-y">
          {general.map((f) => (
            <InfraFindingRow key={f.id} f={f} />
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((d) => (
          <InfraCard
            key={d.id}
            doc={d}
            findings={infraFindings.filter((f) => String(f.documentId) === String(d.id))}
            onOpen={() => onOpenDocument(d.id)}
          />
        ))}
      </div>
      <AdvisoryNote>
        Photo checks (object counts, sharpness, lighting, date and location) are automated estimates from a single photograph. They are advisory
        only and do not replace physical verification.
      </AdvisoryNote>
    </div>
  );
}

function InfraFindingRow({ f }: { f: Finding }) {
  return (
    <div className="flex items-start gap-2 px-4 py-2.5">
      <SeverityBadge severity={f.severity} className="mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{f.title}</p>
        <p className="text-xs text-muted-foreground">{f.reason}</p>
      </div>
    </div>
  );
}

function InfraCard({ doc, findings, onOpen }: { doc: DocumentT; findings: Finding[]; onOpen: () => void }) {
  const [tileRef, near] = useNearViewport<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const img = useBlobUrl(near ? `/documents/${doc.id}/file` : null);
  const [boxes, setBoxes] = useState(true);
  const infra = doc.infra;
  const detections = infra?.detections ?? [];
  const counts = Object.entries(infra?.counts ?? {});
  const required: Record<string, any> = infra?.required ?? infra?.requirement ?? infra?.requirements ?? {};
  const quality = infra?.quality ?? {};
  const exif = infra?.exif ?? {};
  const flags = (infra?.flags ?? []).map(flagText);
  const isImage = (img.type || doc.mimeType || "").startsWith("image/");
  const gps = gpsText(exif.gps);
  const distance = infra?.gpsDistanceKm ?? infra?.distanceKm ?? exif.distanceKm ?? exif.gpsDistanceKm;
  const hasDistance = distance !== undefined && distance !== null && Number.isFinite(Number(distance));
  const concerns = flags.length + findings.length;
  const title = doc.docTypeLabel || humanize(doc.docType);

  return (
    <article className="card-surface flex flex-col overflow-hidden">
      <div ref={tileRef} className="relative aspect-[4/3] w-full bg-slate-100">
        {img.url && isImage ? (
          <img src={img.url} alt={title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-xs text-muted-foreground">
            {img.loading || !near ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading photo" />
            ) : (
              <>
                <ImageOff className="mb-1 h-5 w-5" /> {img.error ?? "Preview not available"}
              </>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            <p className="truncate text-xs text-muted-foreground">{humanize(infra?.evidenceType ?? doc.docType)}</p>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Open <ArrowUpRight className="h-3 w-3" aria-hidden />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {concerns > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {concerns} {concerns === 1 ? "point" : "points"} to check
            </span>
          ) : (
            "No concerns raised by the automated check"
          )}
        </p>

        <details className="text-xs" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            Photo check details <AdvisoryTag />
          </summary>
          {open && (
            <div className="mt-3 space-y-3">
              {img.url && isImage && (
                <div className="relative">
                  <ImageWithBoxes
                    src={img.url}
                    alt={`${title} with detections`}
                    imgClassName="max-h-72"
                    boxes={
                      boxes
                        ? detections.map((d) => ({ bbox: d.bbox, label: `${d.label} ${Math.round(d.conf <= 1 ? d.conf * 100 : d.conf)}%`, tone: "blue" as const }))
                        : []
                    }
                  />
                  {detections.length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute right-2 top-2 h-7 bg-white/90 px-2 text-xs shadow-sm"
                      onClick={() => setBoxes((b) => !b)}
                      aria-pressed={boxes}
                    >
                      {boxes ? <EyeOff className="mr-1 h-3.5 w-3.5" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
                      {boxes ? "Hide" : "Show"} detections
                    </Button>
                  )}
                </div>
              )}

              {counts.length > 0 && (
                <div>
                  <p className="kv-label mb-1">Objects counted</p>
                  <ul className="divide-y rounded-md border text-sm">
                    {counts.map(([k, v]) => {
                      const req = Number(required?.[k] ?? required?.minCount?.[k] ?? NaN);
                      const short = Number.isFinite(req) && Number(v) < req;
                      return (
                        <li key={k} className={cn("flex items-center justify-between gap-2 px-2.5 py-1.5", short && "bg-red-50/60")}>
                          <span>{humanize(k)}</span>
                          <span className="tabular">
                            <span className={cn("font-semibold", short && "text-red-700")}>{fmtNumber(v)}</span>
                            {Number.isFinite(req) && <span className="text-muted-foreground"> / {req} required</span>}
                            {short && <span className="ml-1 text-red-700">(below)</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div>
                  <dt className="kv-label">Blur (sharpness)</dt>
                  <dd className="tabular mt-0.5">{quality.blurScore !== undefined ? fmtValue(quality.blurScore) : "Not measured"}</dd>
                </div>
                <div>
                  <dt className="kv-label">Lighting (brightness)</dt>
                  <dd className="tabular mt-0.5">{quality.brightness !== undefined ? fmtValue(quality.brightness) : "Not measured"}</dd>
                </div>
                <div>
                  <dt className="kv-label">Date taken</dt>
                  <dd className="mt-0.5">{exif.takenAt ? fmtDateTime(exif.takenAt) : <span className="text-amber-700">No date in photo</span>}</dd>
                </div>
                <div>
                  <dt className="kv-label">GPS location</dt>
                  <dd className="mono mt-0.5 break-words">{gps ?? <span className="font-sans text-amber-700">Not tagged</span>}</dd>
                </div>
                <div>
                  <dt className="kv-label">Distance from campus</dt>
                  <dd className="tabular mt-0.5">{hasDistance ? `${Number(distance).toFixed(2)} km` : "Not available"}</dd>
                </div>
                {exif.device && (
                  <div>
                    <dt className="kv-label">Device</dt>
                    <dd className="mt-0.5 break-words">{exif.device}</dd>
                  </div>
                )}
              </dl>

              {detections.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-medium text-muted-foreground">{detections.length} individual detections</summary>
                  <ul className="mt-1.5 space-y-1">
                    {detections.slice(0, 30).map((d, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span>{humanize(d.label)}</span>
                        <ConfidenceMeter value={d.conf} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {concerns > 0 && (
                <ul className="space-y-1.5">
                  {flags.map((f, i) => (
                    <li key={`f${i}`} className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-900">
                      <span className="mono mr-1 text-2xs">{f.code}</span>
                      {f.reason}
                    </li>
                  ))}
                  {findings.map((f) => (
                    <li key={f.id} className="flex items-start gap-1.5 rounded-md border px-2.5 py-1.5">
                      <SeverityBadge severity={f.severity} />
                      <span>{f.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </details>
      </div>
    </article>
  );
}
