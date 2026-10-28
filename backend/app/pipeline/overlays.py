"""Locate the values the system checked on the page itself, so the viewer can draw them.

Pure function, no database access. For text PDFs the exact rectangle comes from the PDF's own text layer; for
scans (and as a fallback) it is estimated from the OCR line that contains the value. Rectangles are returned
normalised to 0-1 of the page, so the same boxes work at any zoom or render size.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

# Fields the pipeline derives rather than reads off the page.
SKIP_FIELDS = {"derivedExpiry", "derivedExpiryDate"}

_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def humanize(key: str) -> str:
    s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", key).replace("_", " ").strip()
    return s[:1].upper() + s[1:].lower() if s else key


def _candidates(value: Any, source_text: str) -> list[str]:
    """Strings the value may be printed as, most specific first."""
    out: list[str] = []
    for seg in re.split(r"\s{2,}", source_text or ""):
        if ":" in seg:
            tail = seg.split(":", 1)[1].strip()
            if tail:
                out.append(tail)
    if isinstance(value, bool) or value is None:
        pass
    elif isinstance(value, (int, float)):
        v = float(value)
        out += [f"{v:.2f}", f"{v:g}"]
        if v == int(v):
            out += [f"{int(v):,}", str(int(v))]
    else:
        text = str(value).strip()
        m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text)
        if m:
            y, mo, d = m.groups()
            out += [f"{d}/{mo}/{y}", f"{d}-{mo}-{y}", f"{d}.{mo}.{y}", f"{int(d)} {_MONTHS[int(mo) - 1]} {y}", f"{d} {_MONTHS[int(mo) - 1][:3]} {y}"]
        out.append(text)
    seen: set[str] = set()
    uniq = []
    for c in out:
        c = c.strip()
        if len(c) >= 2 and c not in seen:
            seen.add(c)
            uniq.append(c)
    return uniq


def _from_blocks(cands: list[str], blocks: list[dict], page_no: int, w: float, h: float) -> list[float] | None:
    """Estimate a value's rectangle inside the OCR line that contains it."""
    for c in cands:
        nc = _norm(c)
        if len(nc) < 2:
            continue
        for b in blocks:
            if int(b.get("page") or 1) != page_no or not b.get("bbox"):
                continue
            nt = _norm(str(b.get("text", "")))
            i = nt.find(nc)
            if i < 0:
                continue
            x0, y0, x1, y1 = (float(n) for n in b["bbox"])
            span = max(len(nt), 1)
            bx0 = x0 + (x1 - x0) * (i / span)
            bx1 = x0 + (x1 - x0) * ((i + len(nc)) / span)
            return [bx0 / w, y0 / h, bx1 / w, y1 / h]
    return None


def compute_overlays(path: str, mime: str, blocks: list[dict] | None, fields: dict | None, comparisons: list[dict] | None) -> dict:
    blocks = blocks or []
    fields = fields or {}
    cmp_by_field = {_norm(str(c.get("field", ""))): c for c in (comparisons or []) if c.get("field")}
    is_pdf = "pdf" in (mime or "").lower() or str(path).lower().endswith(".pdf")

    pdf = None
    sizes: dict[int, tuple[float, float]] = {}
    page_count = 1
    try:
        if is_pdf:
            import pymupdf
            pdf = pymupdf.open(path)
            page_count = pdf.page_count
            for i in range(page_count):
                r = pdf[i].rect
                sizes[i + 1] = (float(r.width), float(r.height))
        else:
            from PIL import Image
            with Image.open(path) as im:
                sizes[1] = (float(im.width), float(im.height))
    except Exception:  # unreadable file: no overlays, the viewer still shows the document
        return {"pageCount": 1, "boxes": []}

    boxes: list[dict] = []
    try:
        for key, f in fields.items():
            if key in SKIP_FIELDS or not isinstance(f, dict):
                continue
            value = f.get("value")
            page_no = int(f.get("page") or 1)
            if page_no not in sizes or value in (None, ""):
                continue
            w, h = sizes[page_no]
            cands = _candidates(value, str(f.get("sourceText") or ""))
            rect = None
            if pdf is not None:
                page = pdf[page_no - 1]
                for c in cands:
                    hits = page.search_for(c)
                    if hits:
                        r = hits[0]
                        rect = [r.x0 / w, r.y0 / h, r.x1 / w, r.y1 / h]
                        break
            if rect is None:
                rect = _from_blocks(cands, blocks, page_no, w, h)
            if rect is None:
                continue
            rect = [min(1.0, max(0.0, n)) for n in rect]
            cmp = cmp_by_field.get(_norm(key))
            status = "field" if cmp is None else ("match" if cmp.get("match") else "mismatch")
            note = None
            if status == "mismatch":
                note = f"Source record says {cmp.get('source')}"
            elif status == "match":
                note = "Matches the source record"
            boxes.append({
                "page": page_no, "rect": [round(n, 5) for n in rect], "field": key, "label": humanize(key),
                "value": str(value), "status": status, "confidence": f.get("confidence"), "note": note,
            })
    finally:
        if pdf is not None:
            pdf.close()
    return {"pageCount": page_count, "boxes": boxes}


def render_page(path: str, page_no: int, dpi: int = 120) -> bytes | None:
    """PNG of one PDF page, or None when the page does not exist."""
    import pymupdf
    pdf = pymupdf.open(path)
    try:
        if page_no < 1 or page_no > pdf.page_count:
            return None
        return pdf[page_no - 1].get_pixmap(dpi=dpi).tobytes("png")
    finally:
        pdf.close()
