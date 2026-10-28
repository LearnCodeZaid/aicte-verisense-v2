from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..db import get_db
from ..engine.verification_summary import CRITERION_IDS, NOTE_ACTION, build_summary
from ..models import Application, AuditEvent, User, ValidationRun
from ..schemas import CamelModel
from ..security import OFFICER_PLUS, get_current_user, require_roles
from ._common import get_app

router = APIRouter(prefix="/applications", tags=["verification-summary"])


class CriterionNoteRequest(CamelModel):
    note: str = Field(min_length=1, max_length=2000)


def _latest_report(db: Session, app: Application) -> dict | None:
    run = db.execute(select(ValidationRun).where(ValidationRun.application_id == app.id)
                     .order_by(ValidationRun.id.desc()).limit(1)).scalar_one_or_none()
    return run.report if run else None


def _notes(db: Session, app: Application) -> dict[str, dict]:
    """Latest reviewer note per criterion, read from the append-only audit chain."""
    evs = db.execute(select(AuditEvent).where(AuditEvent.action == NOTE_ACTION, AuditEvent.entity_type == "Application",
                                              AuditEvent.entity_id == str(app.id)).order_by(AuditEvent.id)).scalars().all()
    names = {}
    if evs:
        names = {u.username: u.full_name for u in db.execute(
            select(User).where(User.username.in_({e.actor for e in evs}))).scalars()}
    out: dict[str, dict] = {}
    for e in evs:  # ascending: later events overwrite earlier ones
        d = e.details or {}
        if d.get("criterionId") in CRITERION_IDS:
            out[d["criterionId"]] = {"note": d.get("note", ""), "by": names.get(e.actor, e.actor), "at": e.ts}
    return out


@router.get("/{app_id}/verification-summary")
def get_verification_summary(app_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app = get_app(db, app_id, user)
    # Reviewer notes are internal to AICTE staff; institutions see the results only.
    notes = _notes(db, app) if user.role in OFFICER_PLUS else {}
    return build_summary(app, _latest_report(db, app), notes)


@router.post("/{app_id}/verification-summary/{criterion_id}/note")
def add_criterion_note(app_id: int, criterion_id: str, body: CriterionNoteRequest, db: Session = Depends(get_db),
                       user: User = Depends(require_roles(*OFFICER_PLUS))):
    app = get_app(db, app_id, user)
    if criterion_id not in CRITERION_IDS:
        raise HTTPException(404, "Unknown verification criterion")
    note = body.note.strip()
    if not note:
        raise HTTPException(422, "Note must not be blank")
    audit.record(db, user, NOTE_ACTION, "Application", app.id, {"criterionId": criterion_id, "note": note})
    summary = build_summary(app, _latest_report(db, app), _notes(db, app))
    return next(c for c in summary["criteria"] if c["id"] == criterion_id)
