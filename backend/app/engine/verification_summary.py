"""Application verification summary: six plain-language questions derived from stored data only.

Nothing here is hard-coded or decisive: each criterion is computed from the checklist, documents (verification
results, forensics, infra CV, pipeline errors), findings and the latest validation run. Inputs that were never
produced give NOT_EVALUATED. Basis separates CONFIRMED facts from PRELIMINARY_AI indicators and
SOURCE_UNAVAILABLE gaps. Simulated authority sources are always labelled as simulated.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..models import Application, Finding
from ..workflow import ACTIVE_FINDING_STATUSES
from .rules_loader import doc_type_label

CRITERIA: list[tuple[str, str]] = [
    ("completeness", "Is the application complete?"),
    ("document_validity", "Are the submitted documents valid?"),
    ("record_consistency", "Is the information consistent with AICTE records and across documents?"),
    ("alteration_duplication", "Is there any sign of alteration or duplication?"),
    ("regulatory_compliance", "Does the application meet regulatory requirements?"),
    ("further_verification", "Is further verification needed?"),
]
CRITERION_IDS = [c[0] for c in CRITERIA]
_QUESTION = dict(CRITERIA)
NOTE_ACTION = "VERIFICATION_NOTE_ADDED"

_RECORD_RULE_PREFIXES = ("R-REC-", "R-DOC-", "R-XDOC-")
_COMPLIANCE_RULE_PREFIXES = ("R-THR-", "R-CAD-", "R-TER-", "R-INF-")
_PASS_RESULTS = ("PASS", "PASSED")


def _ev(label: str, detail: str, finding_id: int | None = None, document_id: int | None = None,
        rule_id: str | None = None) -> dict:
    return {"label": label, "detail": detail, "findingId": finding_id, "documentId": document_id, "ruleId": rule_id}


def _fev(f: Finding) -> dict:
    return _ev(f.title, f.reason or "", f.id, f.document_id, f.rule_id)


def _active(findings: list[Finding], kinds: tuple[str, ...]) -> list[Finding]:
    return [f for f in findings if f.kind in kinds and f.status in ACTIVE_FINDING_STATUSES]


def _is_simulated(v: dict) -> bool:
    return (v.get("trustLevel") or "SIMULATED") == "SIMULATED"


def _evaluated_rules(report: dict | None, prefixes: tuple[str, ...]) -> list[dict]:
    rules = [r for r in (report or {}).get("rulesApplied", []) if str(r.get("ruleId", "")).startswith(prefixes)]
    return [r for r in rules if r.get("result") not in (None, "SKIPPED")]


def _crit(cid: str, state: str, basis: str, explanation: str, evidence: list[dict]) -> dict:
    return {"id": cid, "question": _QUESTION[cid], "state": state, "basis": basis,
            "explanation": explanation, "evidence": evidence, "reviewNote": None}


def _not_evaluated(cid: str, why: str) -> dict:
    return _crit(cid, "NOT_EVALUATED", "NONE", why, [])


def _rule_ev(rules: list[dict]) -> list[dict]:
    return [_ev(r.get("name") or r["ruleId"], r.get("detail") or "", None, None, r["ruleId"]) for r in rules[:12]]


# ------------------------------------------------------------------ individual criteria
def _completeness(app: Application, findings: list[Finding]) -> dict:
    checklist = app.checklist or []
    if not checklist:
        return _not_evaluated("completeness", "No document checklist has been generated for this application yet.")
    mandatory = [c for c in checklist if c.get("mandatory")]
    if not mandatory:
        return _not_evaluated("completeness", "No mandatory documents are defined for this application category.")
    missing = [c for c in mandatory if c.get("status") == "MISSING"]
    fields = _active(findings, ("MISSING_FIELD",))
    ev = [_ev(f"Missing: {c.get('label') or c.get('docType')}", c.get("clause") or "Mandatory document not uploaded.",
              None, c.get("documentId"), "R-CHK-001") for c in missing]
    ev += [_fev(f) for f in fields]
    if ev:
        parts = [f"{len(missing)} of {len(mandatory)} mandatory document(s) are missing"]
        if fields:
            parts.append(f"{len(fields)} required field(s) are absent")
        return _crit("completeness", "FAILED", "CONFIRMED", "; ".join(parts) + ".", ev)
    return _crit("completeness", "PASSED", "CONFIRMED",
                 f"All {len(mandatory)} mandatory document(s) are present and the required fields are filled.",
                 [_ev(c.get("label") or c.get("docType"), f"Status: {c.get('status')}", None, c.get("documentId"))
                  for c in mandatory[:12]])


def _document_validity(app: Application, findings: list[Finding]) -> dict:
    docs = list(app.documents or [])
    if not docs:
        return _not_evaluated("document_validity", "No documents have been uploaded, so validity cannot be assessed.")
    fail: list[dict] = []
    unavail: list[dict] = []
    manual: list[dict] = []
    ok: list[dict] = []
    seen_status = False
    simulated = False
    for d in docs:
        v = d.verification or {}
        st = v.get("status")
        label = doc_type_label(d.doc_type)
        src = v.get("sourceName") or v.get("source") or "issuing authority"
        seen_status = seen_status or bool(st)
        if st == "EXPIRED":
            fail.append(_ev(f"{label} expired", v.get("reason") or f"{src} reports it expired or revoked.", None, d.id, "R-SRC-001"))
        elif st == "MISMATCH_DETECTED":
            bad = ", ".join(str(c.get("field")) for c in (v.get("comparisons") or []) if isinstance(c, dict) and c.get("match") is False)
            fail.append(_ev(f"{label} does not match {src}", (v.get("reason") or "Mismatch with source record.")
                            + (f" Fields: {bad}." if bad else ""), None, d.id, "R-SRC-001"))
        elif st in ("SOURCE_UNAVAILABLE", "VERIFICATION_PENDING"):
            unavail.append(_ev(f"{label}: source check pending", f"{src} could not be reached; verification not completed.", None, d.id, "R-SRC-001"))
        elif st == "MANUAL_REVIEW_REQUIRED":
            manual.append(_ev(f"{label}: manual verification needed", v.get("reason") or "Automatic verification not possible.", None, d.id, "R-SRC-001"))
        elif st == "VERIFIED":
            sim = _is_simulated(v)
            simulated = simulated or sim
            ok.append(_ev(f"{label} verified", f"Checked via {src} ({v.get('method') or 'n/a'})"
                          + (" - simulated source, not official authentication." if sim else "."), None, d.id))
    for f in _active(findings, ("EXPIRED_DOCUMENT",)):
        if not any(e["findingId"] == f.id or (f.document_id is not None and e["documentId"] == f.document_id) for e in fail):
            fail.append(_fev(f))
    for c in app.checklist or []:
        if c.get("status") == "EXPIRED" and not any(e["documentId"] == c.get("documentId") for e in fail):
            fail.append(_ev(f"{c.get('label')} expired", "Printed validity date has passed.", None, c.get("documentId")))
    if fail:
        any_sim = any(_is_simulated(d.verification or {}) for d in docs if (d.verification or {}).get("status"))
        return _crit("document_validity", "FAILED", "CONFIRMED",
                     f"{len(fail)} document(s) are expired or do not match the issuing-authority record"
                     + (" (authority checks are simulated in this environment)." if any_sim else "."),
                     fail + unavail + manual)
    if unavail:
        return _crit("document_validity", "NEEDS_REVIEW", "SOURCE_UNAVAILABLE",
                     f"{len(unavail)} document(s) could not be checked at source; validity is unconfirmed.", unavail + manual)
    if manual:
        return _crit("document_validity", "NEEDS_REVIEW", "CONFIRMED",
                     f"{len(manual)} document(s) need manual verification by an officer.", manual)
    if not seen_status:
        return _not_evaluated("document_validity", "Document verification has not run yet.")
    if not ok:
        return _not_evaluated("document_validity", "No uploaded document is of a type verifiable with an issuing authority.")
    return _crit("document_validity", "PASSED", "CONFIRMED",
                 f"{len(ok)} document(s) verified against the source and none are expired"
                 + (" (sources are simulated, not official authentication)." if simulated else "."), ok)


def _record_consistency(findings: list[Finding], report: dict | None) -> dict:
    rules = _evaluated_rules(report, _RECORD_RULE_PREFIXES)
    act = _active(findings, ("RECORD_MISMATCH", "INCONSISTENCY"))
    confirmed = [f for f in act if not (f.fingerprint or "").startswith("CLS:") and f.severity in ("CRITICAL", "MAJOR")]
    prelim = [f for f in act if f not in confirmed]
    if confirmed:
        return _crit("record_consistency", "FAILED", "CONFIRMED",
                     f"{len(confirmed)} discrepancy(ies) found between the application, uploaded documents and AICTE records.",
                     [_fev(f) for f in confirmed + prelim])
    if prelim:
        return _crit("record_consistency", "NEEDS_REVIEW", "PRELIMINARY_AI",
                     f"{len(prelim)} minor or automated-classification inconsistency(ies) need an officer to judge.",
                     [_fev(f) for f in prelim])
    if not report or not rules:
        return _not_evaluated("record_consistency", "Record and cross-document checks have not been run for this application.")
    ok = [r for r in rules if r.get("result") in _PASS_RESULTS]
    return _crit("record_consistency", "PASSED", "CONFIRMED",
                 f"{len(ok)} of {len(rules)} record/cross-document check(s) passed with no open discrepancy.", _rule_ev(rules))


def _alteration_duplication(app: Application, findings: list[Finding]) -> dict:
    docs = list(app.documents or [])
    if not docs:
        return _not_evaluated("alteration_duplication", "No documents have been uploaded to screen.")
    dups = _active(findings, ("DUPLICATE",))
    anomalies = _active(findings, ("ANOMALY",))
    screened = [d for d in docs if d.forensics]
    if dups:
        return _crit("alteration_duplication", "FAILED", "CONFIRMED",
                     f"{len(dups)} duplicate(s) detected across applications or institutions.",
                     [_fev(f) for f in dups + anomalies])
    if anomalies:
        return _crit("alteration_duplication", "NEEDS_REVIEW", "PRELIMINARY_AI",
                     f"Automated image/metadata screening raised {len(anomalies)} indicator(s). These are not proof of tampering and need officer review.",
                     [_fev(f) for f in anomalies])
    if not screened:
        return _not_evaluated("alteration_duplication", "Forensic screening has not produced results for the uploaded documents.")
    ev = [_ev(doc_type_label(d.doc_type), f"Forensic screening completed (ELA score {d.forensics.get('elaScore', 'n/a')}).", None, d.id)
          for d in screened[:12]]
    if len(screened) < len(docs):
        return _crit("alteration_duplication", "NEEDS_REVIEW", "PRELIMINARY_AI",
                     f"No indicators in {len(screened)} screened document(s), but {len(docs) - len(screened)} document(s) were not screened.", ev)
    return _crit("alteration_duplication", "PASSED", "PRELIMINARY_AI",
                 f"Automated screening found no alteration or duplicate indicators in {len(screened)} document(s); this is not a guarantee of authenticity.", ev)


def _regulatory(findings: list[Finding], report: dict | None) -> dict:
    rules = _evaluated_rules(report, _COMPLIANCE_RULE_PREFIXES)
    gaps = _active(findings, ("COMPLIANCE_GAP",))
    infra = _active(findings, ("INFRASTRUCTURE",))
    if gaps:
        return _crit("regulatory_compliance", "FAILED", "CONFIRMED",
                     f"{len(gaps)} regulatory requirement(s) are not met (norms, faculty cadre, fees).",
                     [_fev(f) for f in gaps + infra])
    if infra:
        return _crit("regulatory_compliance", "NEEDS_REVIEW", "PRELIMINARY_AI",
                     f"Image analysis of infrastructure evidence raised {len(infra)} indicator(s); an officer must confirm.",
                     [_fev(f) for f in infra])
    if not report or not rules:
        return _not_evaluated("regulatory_compliance", "Regulatory norm checks have not been run for this application.")
    ok = [r for r in rules if r.get("result") in _PASS_RESULTS]
    return _crit("regulatory_compliance", "PASSED", "CONFIRMED",
                 f"{len(ok)} of {len(rules)} regulatory check(s) passed with no open gap.", _rule_ev(rules))


def _further(app: Application, findings: list[Finding], others: list[dict]) -> dict:
    if app.last_validated_at is None:
        return _not_evaluated("further_verification", "The application has not been validated yet.")
    ev: list[dict] = []
    for d in app.documents or []:
        if d.pipeline_errors:
            stages = ", ".join(str(e.get("stage", "?")) for e in d.pipeline_errors)
            ev.append(_ev(f"Automated processing incomplete ({doc_type_label(d.doc_type)})", f"Stages not completed: {stages}.", None, d.id))
    blockers = [f for f in findings if f.severity == "CRITICAL" and f.status in ACTIVE_FINDING_STATUSES]
    ev += [_fev(f) for f in blockers]
    ev += [_fev(f) for f in findings if f.status == "ESCALATED" and f not in blockers]
    for o in others:
        if o["state"] in ("FAILED", "NEEDS_REVIEW"):
            ev.append(_ev(f"Open: {o['question']}", o["explanation"]))
        elif o["state"] == "NOT_EVALUATED":
            ev.append(_ev(f"Not evaluated: {o['question']}", o["explanation"]))
    if blockers or any(o["state"] == "FAILED" for o in others):
        return _crit("further_verification", "FAILED", "CONFIRMED",
                     "Confirmed problems remain open; the officer should consider rectification or physical inspection.", ev)
    if ev:
        basis = "SOURCE_UNAVAILABLE" if any(o["basis"] == "SOURCE_UNAVAILABLE" for o in others) else "PRELIMINARY_AI"
        return _crit("further_verification", "NEEDS_REVIEW", basis,
                     "Some checks are unconfirmed, pending or not evaluated; an officer should review before relying on the outcome.", ev)
    return _crit("further_verification", "PASSED", "CONFIRMED",
                 "All other checks passed and nothing is outstanding. A human decision is still required.", [])


# ------------------------------------------------------------------ assembly
def build_summary(app: Application, report: dict | None = None, notes: dict[str, dict] | None = None) -> dict:
    findings = list(app.findings or [])
    first = [
        _completeness(app, findings),
        _document_validity(app, findings),
        _record_consistency(findings, report),
        _alteration_duplication(app, findings),
        _regulatory(findings, report),
    ]
    criteria = first + [_further(app, findings, first)]
    for c in criteria:
        c["reviewNote"] = (notes or {}).get(c["id"])
    counts = {
        "passed": sum(c["state"] == "PASSED" for c in criteria),
        "failed": sum(c["state"] == "FAILED" for c in criteria),
        "needsReview": sum(c["state"] == "NEEDS_REVIEW" for c in criteria),
        "notEvaluated": sum(c["state"] == "NOT_EVALUATED" for c in criteria),
    }
    return {"applicationId": app.id, "evaluatedAt": datetime.now(timezone.utc).isoformat(),
            "counts": counts, "criteria": criteria}
