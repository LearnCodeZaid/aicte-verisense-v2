from datetime import datetime
from types import SimpleNamespace as NS

from app.engine.verification_summary import CRITERION_IDS, build_summary


def _app(**kw):
    base = dict(id=1, checklist=[], documents=[], findings=[], last_validated_at=None)
    base.update(kw)
    return NS(**base)


def _doc(i, status=None, trust="SIMULATED", forensics=None):
    v = {"status": status, "source": "nba", "sourceName": "NBA (simulated)", "method": "API", "trustLevel": trust} if status else {}
    return NS(id=i, doc_type="FIRE_NOC", verification=v, forensics=forensics if forensics is not None else {}, pipeline_errors=[])


def _find(i, kind, sev="MAJOR", status="OPEN", fp="X"):
    return NS(id=i, kind=kind, severity=sev, status=status, title=f"t{i}", reason="r", document_id=None, rule_id=None, fingerprint=fp)


def _by_id(s):
    return {c["id"]: c for c in s["criteria"]}


def test_empty_application_is_not_evaluated():
    s = build_summary(_app())
    assert [c["id"] for c in s["criteria"]] == CRITERION_IDS
    assert all(c["state"] == "NOT_EVALUATED" and c["basis"] == "NONE" for c in s["criteria"])
    assert s["counts"] == {"passed": 0, "failed": 0, "needsReview": 0, "notEvaluated": 6}


def test_missing_mandatory_doc_is_confirmed_failure():
    cl = [{"docType": "FIRE_NOC", "label": "Fire NOC", "mandatory": True, "status": "MISSING", "clause": "c", "documentId": None}]
    c = _by_id(build_summary(_app(checklist=cl)))["completeness"]
    assert (c["state"], c["basis"]) == ("FAILED", "CONFIRMED") and c["evidence"]


def test_verified_is_labelled_simulated_and_unavailable_is_distinct():
    c = _by_id(build_summary(_app(documents=[_doc(1, "VERIFIED")])))["document_validity"]
    assert c["state"] == "PASSED" and "simulated" in c["explanation"].lower()
    c = _by_id(build_summary(_app(documents=[_doc(1, "SOURCE_UNAVAILABLE")])))["document_validity"]
    assert (c["state"], c["basis"]) == ("NEEDS_REVIEW", "SOURCE_UNAVAILABLE")
    c = _by_id(build_summary(_app(documents=[_doc(1, "MISMATCH_DETECTED")])))["document_validity"]
    assert (c["state"], c["basis"]) == ("FAILED", "CONFIRMED")


def test_forensics_is_preliminary_never_failed_and_dismissed_ignored():
    d = _doc(1, "VERIFIED", forensics={"flags": [1]})
    c = _by_id(build_summary(_app(documents=[d], findings=[_find(1, "ANOMALY", "CRITICAL")])))["alteration_duplication"]
    assert (c["state"], c["basis"]) == ("NEEDS_REVIEW", "PRELIMINARY_AI")
    c = _by_id(build_summary(_app(documents=[d], findings=[_find(1, "ANOMALY", "CRITICAL", status="DISMISSED")])))["alteration_duplication"]
    assert c["state"] == "PASSED" and c["basis"] == "PRELIMINARY_AI"
    c = _by_id(build_summary(_app(documents=[d], findings=[_find(2, "DUPLICATE", "CRITICAL")])))["alteration_duplication"]
    assert c["state"] == "FAILED"


def test_rule_driven_pass_requires_evaluated_rules():
    rep = {"rulesApplied": [{"ruleId": "R-THR-001", "name": "n", "result": "SKIPPED", "detail": "x"}]}
    assert _by_id(build_summary(_app(), rep))["regulatory_compliance"]["state"] == "NOT_EVALUATED"
    rep = {"rulesApplied": [{"ruleId": "R-THR-001", "name": "n", "result": "PASS", "detail": "ok"}]}
    assert _by_id(build_summary(_app(), rep))["regulatory_compliance"]["state"] == "PASSED"


def test_further_verification_follows_other_criteria():
    app = _app(last_validated_at=datetime(2026, 1, 1), findings=[_find(1, "COMPLIANCE_GAP")])
    s = _by_id(build_summary(app, {"rulesApplied": []}))
    assert s["regulatory_compliance"]["state"] == "FAILED" and s["further_verification"]["state"] == "FAILED"


# ------------------------------------------------------------------ API
def _new_app(client, tokens):
    r = client.post("/api/applications", json={"category": "EOA", "academicYear": "2026-27", "formData": {"totalIntake": 60}},
                    headers=tokens["inst.piat"])
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_api_scoping_validation_and_notes(client, tokens):
    aid = _new_app(client, tokens)
    url = f"/api/applications/{aid}/verification-summary"
    assert client.get(url).status_code == 401
    for u in ("inst.apex", "officer.nro"):
        assert client.get(url, headers=tokens[u]).status_code == 404
    for u in ("inst.piat", "officer.wro", "rd.wro", "admin"):
        assert client.get(url, headers=tokens[u]).status_code == 200
    s = client.get(url, headers=tokens["officer.wro"]).json()
    assert s["applicationId"] == aid and len(s["criteria"]) == 6
    assert _by_id(s)["further_verification"]["state"] == "NOT_EVALUATED"  # never validated

    assert client.post(f"/api/applications/{aid}/validate", headers=tokens["officer.wro"]).status_code == 200
    s = client.get(url, headers=tokens["inst.piat"]).json()
    c = _by_id(s)["completeness"]
    assert (c["state"], c["basis"]) == ("FAILED", "CONFIRMED")
    assert sum(s["counts"].values()) == 6

    note = f"{url}/completeness/note"
    assert client.post(note, json={"note": "x"}, headers=tokens["inst.piat"]).status_code == 403
    assert client.post(note, json={"note": "x"}, headers=tokens["officer.nro"]).status_code == 404
    assert client.post(note, json={"note": ""}, headers=tokens["officer.wro"]).status_code == 422
    assert client.post(note, json={"note": "x" * 2001}, headers=tokens["officer.wro"]).status_code == 422
    assert client.post(f"{url}/bogus/note", json={"note": "x"}, headers=tokens["officer.wro"]).status_code == 404
    r = client.post(note, json={"note": "Chased institution for NOC"}, headers=tokens["officer.wro"])
    assert r.status_code == 200 and r.json()["reviewNote"]["note"] == "Chased institution for NOC"
    # notes are internal: visible to AICTE staff, never to the institution; recorded in the audit chain
    got = _by_id(client.get(url, headers=tokens["rd.wro"]).json())["completeness"]["reviewNote"]
    assert got["note"].startswith("Chased") and got["by"]
    assert _by_id(client.get(url, headers=tokens["inst.piat"]).json())["completeness"]["reviewNote"] is None
    from app.db import SessionLocal
    from app.models import AuditEvent
    from app.audit import verify_chain
    from sqlalchemy import select
    with SessionLocal() as db:
        evs = db.execute(select(AuditEvent).where(AuditEvent.action == "VERIFICATION_NOTE_ADDED",
                                                  AuditEvent.entity_id == str(aid))).scalars().all()
        assert len(evs) == 1 and evs[0].details["criterionId"] == "completeness"
        assert verify_chain(db)["valid"]
