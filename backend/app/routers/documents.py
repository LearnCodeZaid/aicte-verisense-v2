from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import audit
from ..db import get_db
from ..engine.ingest import reverify_document
from ..models import User
from ..pipeline.overlays import compute_overlays, render_page
from ..schemas import document_out
from ..security import INSTITUTION, OFFICER_PLUS, get_current_user, require_roles
from ._common import EDITABLE_BY_INSTITUTION, get_doc

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/{doc_id}")
def get_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return document_out(get_doc(db, doc_id, user))


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(INSTITUTION))):
    doc = get_doc(db, doc_id, user)
    app = doc.application
    if app.status not in EDITABLE_BY_INSTITUTION:
        raise HTTPException(409, f"Documents cannot be removed in status {app.status}")
    for f in [f for f in app.findings if f.document_id == doc.id]:
        if f.human_modified or f.status != "OPEN":
            f.document_id = None  # keep human-reviewed history
        else:
            app.findings.remove(f)
            db.delete(f)
    path = doc.file_path
    info = {"applicationId": app.id, "fileName": doc.file_name, "docType": doc.doc_type, "sha256": doc.sha256}
    app.documents.remove(doc)
    db.delete(doc)
    audit.record(db, user, "DOCUMENT_DELETED", "Document", doc_id, info)
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        pass
    return Response(status_code=204)


@router.get("/{doc_id}/file")
def get_file(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = get_doc(db, doc_id, user)
    if not Path(doc.file_path).exists():
        raise HTTPException(404, "Stored file missing")
    return FileResponse(doc.file_path, media_type=doc.mime_type, filename=doc.file_name,
                        content_disposition_type="inline")


@router.get("/{doc_id}/overlays")
def get_overlays(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Where each checked value sits on its page (normalised 0-1), with its match status against the source."""
    doc = get_doc(db, doc_id, user)
    if not Path(doc.file_path).exists():
        raise HTTPException(404, "Stored file missing")
    comparisons = (doc.verification or {}).get("comparisons") or []
    return compute_overlays(doc.file_path, doc.mime_type, doc.ocr_blocks, doc.extracted_fields, comparisons)


@router.get("/{doc_id}/page/{page_no}")
def get_page(doc_id: int, page_no: int, dpi: int = Query(120, ge=60, le=220),
             db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """One PDF page rendered as an image, so the viewer can draw overlays on it. Same access rules as the file."""
    doc = get_doc(db, doc_id, user)
    if not Path(doc.file_path).exists():
        raise HTTPException(404, "Stored file missing")
    if "pdf" not in (doc.mime_type or "").lower():
        raise HTTPException(415, "Only PDF documents are rendered page by page")
    png = render_page(doc.file_path, page_no, dpi)
    if png is None:
        raise HTTPException(404, "No such page")
    return Response(png, media_type="image/png", headers={"Cache-Control": "private, max-age=300"})


@router.get("/{doc_id}/text")
def get_text(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = get_doc(db, doc_id, user)
    return {"text": doc.ocr_text or "", "blocks": doc.ocr_blocks or []}


@router.get("/{doc_id}/ela")
def get_ela(doc_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(*OFFICER_PLUS))):
    doc = get_doc(db, doc_id, user)
    if not doc.ela_path or not Path(doc.ela_path).exists():
        raise HTTPException(404, "No ELA heatmap for this document")
    return FileResponse(doc.ela_path, media_type="image/png")


@router.post("/{doc_id}/verify")
def verify(doc_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(*OFFICER_PLUS))):
    doc = get_doc(db, doc_id, user)
    if doc.application.status == "DECIDED":
        raise HTTPException(409, "Finalized evidence cannot be reverified")
    return document_out(reverify_document(db, doc, user))
