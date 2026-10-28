import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileWarning, Minus, Plus, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useBlobUrl, useDocumentOverlays } from "@/lib/hooks";
import type { DocumentT, OverlayBox } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Box {
  bbox: number[];
  label?: string;
  tone?: "red" | "blue" | "green" | "amber";
}

const TONE: Record<string, string> = {
  red: "border-red-600 bg-red-500/10",
  blue: "border-blue-600 bg-blue-500/10",
  green: "border-green-600 bg-green-500/10",
  amber: "border-amber-500 bg-amber-400/10",
};

/** Normalise a bbox to percentages. Accepts [x1,y1,x2,y2] in px or 0-1, or {x,y,w,h}. */
export function bboxToPct(b: any, natural: { w: number; h: number } | null): { left: number; top: number; width: number; height: number } | null {
  if (!b) return null;
  let x1: number, y1: number, x2: number, y2: number;
  if (Array.isArray(b) && b.length >= 4) {
    if (Array.isArray(b[0])) {
      // polygon [[x,y],...]
      const xs = b.map((p: number[]) => p[0]);
      const ys = b.map((p: number[]) => p[1]);
      [x1, y1, x2, y2] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    } else [x1, y1, x2, y2] = b.map(Number);
  } else if (typeof b === "object" && "x" in b) {
    x1 = b.x;
    y1 = b.y;
    x2 = b.x + (b.w ?? b.width);
    y2 = b.y + (b.h ?? b.height);
  } else return null;
  const normalised = Math.max(x1, y1, x2, y2) <= 1.0001;
  // Some producers send [x, y, w, h]; if x2 < x1 treat as width/height.
  if (x2 < x1 || y2 < y1) {
    x2 = x1 + x2;
    y2 = y1 + y2;
  }
  const W = normalised ? 1 : natural?.w;
  const H = normalised ? 1 : natural?.h;
  if (!W || !H) return null;
  return { left: (x1 / W) * 100, top: (y1 / H) * 100, width: ((x2 - x1) / W) * 100, height: ((y2 - y1) / H) * 100 };
}

export function ImageWithBoxes({
  src,
  alt,
  boxes = [],
  overlaySrc,
  overlayOpacity = 0.6,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  boxes?: Box[];
  overlaySrc?: string | null;
  overlayOpacity?: number;
  className?: string;
  imgClassName?: string;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  return (
    <div className={cn("relative inline-block max-w-full", className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn("block max-h-[70vh] max-w-full", imgClassName)}
        onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
      />
      {overlaySrc && (
        <img
          src={overlaySrc}
          alt="Error level analysis heatmap"
          className="pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply"
          style={{ opacity: overlayOpacity }}
        />
      )}
      {boxes.map((b, i) => {
        const p = bboxToPct(b.bbox, natural);
        if (!p) return null;
        return (
          <div
            key={i}
            className={cn("pointer-events-none absolute border-2", TONE[b.tone ?? "red"])}
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, height: `${p.height}%` }}
          >
            {b.label && (
              <span
                className={cn(
                  "absolute -top-5 left-[-2px] whitespace-nowrap rounded-sm px-1 text-[10px] font-medium leading-4 text-white",
                  b.tone === "blue" ? "bg-blue-600" : b.tone === "green" ? "bg-green-600" : b.tone === "amber" ? "bg-amber-500" : "bg-red-600",
                )}
              >
                {b.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}


const STATUS_BOX: Record<OverlayBox["status"], { box: string; chip: string; dot: string; label: string }> = {
  mismatch: { box: "border-red-600 bg-red-500/15", chip: "bg-red-600", dot: "bg-red-600", label: "Differs from the record" },
  match: { box: "border-emerald-600 bg-emerald-500/10", chip: "bg-emerald-600", dot: "bg-emerald-600", label: "Matches the record" },
  field: { box: "border-blue-500 bg-blue-500/10", chip: "bg-blue-600", dot: "bg-blue-500", label: "Checked value" },
};

const BOX_TONE: Record<OverlayBox["status"], Box["tone"]> = { mismatch: "red", match: "green", field: "blue" };

function FieldBox({ b }: { b: OverlayBox }) {
  const st = STATUS_BOX[b.status];
  const [x0, y0, x1, y1] = b.rect;
  return (
    <div
      tabIndex={0}
      role="img"
      aria-label={`${b.label}: ${b.value}. ${st.label}${b.note ? `. ${b.note}` : ""}`}
      className={cn("group absolute rounded-[2px] border-2 outline-none focus-visible:ring-2 focus-visible:ring-ring", st.box)}
      style={{ left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` }}
    >
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm px-1.5 text-[10px] font-medium leading-4 text-white shadow-sm",
          st.chip,
          x1 > 0.7 ? "right-full mr-1" : "left-full ml-1",
          b.status === "mismatch" ? "block" : "hidden group-hover:block group-focus:block",
        )}
      >
        {b.status === "mismatch" ? (b.note ?? b.label) : b.label}
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-56 rounded-md border bg-white p-2 text-xs text-slate-800 shadow-md group-hover:block group-focus:block">
        <span className="block font-semibold">{b.label}</span>
        <span className="block break-words">{b.value}</span>
        <span className={cn("mt-1 block font-medium", b.status === "mismatch" ? "text-red-700" : b.status === "match" ? "text-emerald-700" : "text-blue-700")}>
          {b.note ?? st.label}
        </span>
      </span>
    </div>
  );
}

function FieldLegend({ boxes }: { boxes: OverlayBox[] }) {
  const n = (k: OverlayBox["status"]) => boxes.filter((b) => b.status === k).length;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-white px-3 py-1.5 text-xs text-slate-600" aria-label="Legend">
      {(["mismatch", "match", "field"] as const).map((k) =>
        n(k) > 0 ? (
          <li key={k} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-sm", STATUS_BOX[k].dot)} aria-hidden />
            {STATUS_BOX[k].label} <span className="font-semibold text-slate-800">{n(k)}</span>
          </li>
        ) : null,
      )}
    </ul>
  );
}

/** A PDF drawn page by page as an image, with the checked values marked on it. */
function PdfPages({
  doc,
  pageCount,
  page,
  onPage,
  boxes,
  showFields,
  onFail,
}: {
  doc: DocumentT;
  pageCount: number;
  page: number;
  onPage: (n: number) => void;
  boxes: OverlayBox[];
  showFields: boolean;
  onFail: () => void;
}) {
  const img = useBlobUrl(`/documents/${doc.id}/page/${page}`);
  useEffect(() => {
    if (img.error) onFail();
  }, [img.error, onFail]);
  return (
    <div className="w-full">
      {pageCount > 1 && (
        <div className="mb-2 flex items-center justify-center gap-2 text-xs text-slate-600">
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span aria-live="polite">
            Page {page} of {pageCount}
          </span>
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Next page">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div className="relative mx-auto w-full max-w-[880px] bg-white shadow-sm">
        {img.url ? (
          <>
            <img src={img.url} alt={`${doc.fileName}, page ${page}`} className="block h-auto w-full" />
            {showFields && boxes.filter((b) => b.page === page).map((b) => <FieldBox key={b.field} b={b} />)}
          </>
        ) : (
          <div className="aspect-[1/1.414] w-full" role="status">
            <Skeleton className="h-full w-full rounded" />
            <span className="sr-only">Loading page</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** True once the element is near the viewport (then stays true), so files are fetched lazily. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
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

// Fixed stage height in every state so the layout never shifts while loading.
const STAGE = "h-[72dvh] min-h-[320px]";

function StageSkeleton({ label }: { label: string }) {
  return (
    <div className={cn("w-full", STAGE)} role="status" aria-live="polite">
      <Skeleton className="h-full w-full rounded" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function StageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={cn("flex w-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-600", STAGE)} role="alert">
      <FileWarning className="h-6 w-6" aria-hidden />
      <p>{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Try again
      </Button>
    </div>
  );
}

export function DocumentViewer({
  doc,
  page,
  canSeeEla,
  regionBoxes = [],
}: {
  doc: DocumentT;
  page?: number | null;
  canSeeEla: boolean;
  regionBoxes?: Box[];
}) {
  const [hostRef, near] = useNearViewport<HTMLDivElement>();
  // Bumping a counter changes the request URL so the blob hook refetches (retry).
  const [fileTry, setFileTry] = useState(0);
  const [elaTry, setElaTry] = useState(0);
  const file = useBlobUrl(near ? `/documents/${doc.id}/file${fileTry ? `?retry=${fileTry}` : ""}` : null);
  const [ela, setEla] = useState(false);
  const [opacity, setOpacity] = useState(60);
  const [zoom, setZoom] = useState(100);
  const overlays = useDocumentOverlays(doc.id, near);
  const [showFields, setShowFields] = useState(true);
  const [pdfFailed, setPdfFailed] = useState(false);
  const [curPage, setCurPage] = useState(page ?? 1);
  useEffect(() => {
    if (page) setCurPage(page);
  }, [page]);
  const fieldBoxes = overlays.data?.boxes ?? [];
  const elaAvailable = canSeeEla && doc.forensics?.hasElaHeatmap;
  const elaBlob = useBlobUrl(ela && elaAvailable ? `/documents/${doc.id}/ela${elaTry ? `?retry=${elaTry}` : ""}` : null);
  const mime = file.type || doc.mimeType || "";
  const isPdf = mime.includes("pdf") || doc.fileName.toLowerCase().endsWith(".pdf");
  const isImage = mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(doc.fileName);
  const waiting = !near || file.loading;
  const changeZoom = (d: number) => setZoom((z) => Math.min(300, Math.max(50, z + d)));

  return (
    <div ref={hostRef} className="card-surface flex min-h-[320px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={doc.fileName}>
          {doc.fileName}
        </p>
        {isImage && !waiting && !file.error && (
          <div className="flex items-center gap-1" role="group" aria-label="Zoom">
            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => changeZoom(-25)} disabled={zoom <= 50} aria-label="Zoom out">
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-10 text-center text-xs tabular-nums text-slate-600" aria-live="polite">
              {zoom}%
            </span>
            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => changeZoom(25)} disabled={zoom >= 300} aria-label="Zoom in">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {fieldBoxes.length > 0 && !ela && (
          <div className="flex items-center gap-2">
            <Switch id={`fields-${doc.id}`} checked={showFields} onCheckedChange={setShowFields} />
            <Label htmlFor={`fields-${doc.id}`} className="cursor-pointer text-xs font-medium">
              Show checked values
            </Label>
          </div>
        )}
        {elaAvailable && (
          <div className="flex items-center gap-2">
            <Switch id={`ela-${doc.id}`} checked={ela} onCheckedChange={setEla} />
            <Label
              htmlFor={`ela-${doc.id}`}
              className="cursor-pointer text-xs font-medium"
              title="Error level analysis (ELA) highlights areas compressed differently, which can indicate edits. It is a hint, not proof."
            >
              Show edit-detection overlay
            </Label>
            {ela && isImage && (
              <Slider
                value={[opacity]}
                onValueChange={(v) => setOpacity(v[0])}
                min={10}
                max={100}
                step={5}
                className="w-20"
                aria-label="Overlay strength"
              />
            )}
          </div>
        )}
        {file.url && (
          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
            <a href={file.url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
            </a>
          </Button>
        )}
      </div>
      {fieldBoxes.length > 0 && showFields && !ela && <FieldLegend boxes={fieldBoxes} />}
      <div className="relative flex flex-1 items-start justify-center overflow-auto bg-slate-100 p-3">
        {waiting ? (
          <StageSkeleton label="Loading document" />
        ) : file.error ? (
          <StageError message={`Could not load this document. ${file.error}`} onRetry={() => setFileTry((n) => n + 1)} />
        ) : ela && isPdf ? (
          elaBlob.loading ? (
            <StageSkeleton label="Preparing overlay" />
          ) : elaBlob.url ? (
            <div className="w-full text-center">
              <ImageWithBoxes src={elaBlob.url} alt="Edit-detection overlay of the first page" boxes={regionBoxes} className="bg-white shadow-sm" />
              <p className="mt-2 text-xs text-slate-500">Overlay of the first page. Bright areas were compressed differently, which can indicate an edit.</p>
            </div>
          ) : (
            <StageError message={elaBlob.error ?? "Overlay unavailable."} onRetry={() => setElaTry((n) => n + 1)} />
          )
        ) : isPdf && file.url && !pdfFailed ? (
          <PdfPages
            doc={doc}
            pageCount={overlays.data?.pageCount ?? doc.ocr?.pageCount ?? 1}
            page={curPage}
            onPage={setCurPage}
            boxes={fieldBoxes}
            showFields={showFields}
            onFail={() => setPdfFailed(true)}
          />
        ) : isPdf && file.url ? (
          <iframe
            key={`${file.url}-${page ?? 1}`}
            src={`${file.url}#page=${page ?? 1}&view=FitH`}
            title={`Original document: ${doc.fileName}`}
            loading="lazy"
            className={cn("w-full rounded bg-white shadow-sm", STAGE)}
          />
        ) : isImage && file.url ? (
          <div style={{ width: `${zoom}%`, maxWidth: zoom > 100 ? "none" : "100%" }}>
            <ImageWithBoxes
              src={file.url}
              alt={doc.fileName}
              boxes={ela ? regionBoxes : showFields ? fieldBoxes.map((b) => ({ bbox: b.rect, label: b.label, tone: BOX_TONE[b.status] })) : []}
              overlaySrc={ela ? elaBlob.url : null}
              overlayOpacity={opacity / 100}
              className="block w-full bg-white shadow-sm"
              imgClassName="h-auto max-h-none w-full"
            />
            {ela && elaBlob.error && (
              <p className="mt-2 text-xs text-slate-600" role="alert">
                Overlay unavailable.{" "}
                <button type="button" className="text-primary-600 underline" onClick={() => setElaTry((n) => n + 1)}>
                  Try again
                </button>
              </p>
            )}
          </div>
        ) : (
          <div className={cn("flex w-full flex-col items-center justify-center text-sm text-slate-600", STAGE)}>
            Preview not available for this file type.
            {file.url && (
              <a href={file.url} download={doc.fileName} className="mt-2 text-primary-600 hover:underline">
                Download file
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
