"""The locator that marks checked values on the page itself."""
from __future__ import annotations

import pymupdf

from app.pipeline.overlays import _candidates, compute_overlays, render_page


def _pdf(tmp_path, lines):
    path = tmp_path / "doc.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    y = 100
    for line in lines:
        page.insert_text((72, y), line, fontsize=12)
        y += 30
    doc.save(str(path))
    doc.close()
    return str(path)


def test_candidates_cover_printed_forms():
    assert "16/06/2009" in _candidates("2009-06-16", "Date of Registration: 16/06/2009")
    assert "12.50" in _candidates(12.5, "Total Area:  12.50 Acres")
    assert "148/2" in _candidates("148/2", "Survey No.:  148/2")
    assert _candidates(True, "") == []


def test_values_are_found_and_status_follows_the_source_comparison(tmp_path):
    path = _pdf(tmp_path, ["Survey No.: 148/2", "Village: Tilapta", "Registration No.: GN/SR/2009/7731"])
    fields = {
        "surveyNo": {"value": "148/2", "sourceText": "Survey No.:  148/2", "page": 1, "confidence": 0.9},
        "village": {"value": "Tilapta", "sourceText": "Village:  Tilapta", "page": 1, "confidence": 0.85},
        "referenceNo": {"value": "GN/SR/2009/7731", "sourceText": "Registration No.: GN/SR/2009/7731", "page": 1},
        "ghost": {"value": "not printed anywhere", "sourceText": "", "page": 1},
    }
    comparisons = [
        {"field": "surveyNo", "submitted": "148/2", "source": "118/2", "match": False},
        {"field": "village", "submitted": "Tilapta", "source": "Tilapta", "match": True},
    ]
    out = compute_overlays(path, "application/pdf", [], fields, comparisons)
    by = {b["field"]: b for b in out["boxes"]}
    assert out["pageCount"] == 1
    assert set(by) == {"surveyNo", "village", "referenceNo"}  # a value that is not on the page is left out, never guessed
    assert by["surveyNo"]["status"] == "mismatch" and by["surveyNo"]["note"] == "Source record says 118/2"
    assert by["village"]["status"] == "match"
    assert by["referenceNo"]["status"] == "field"
    for b in out["boxes"]:
        x0, y0, x1, y1 = b["rect"]
        assert 0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1


def test_scan_falls_back_to_the_ocr_line(tmp_path):
    from PIL import Image
    path = str(tmp_path / "scan.png")
    Image.new("RGB", (1000, 500), "white").save(path)
    blocks = [{"text": "Survey No.: 148/2", "bbox": [100, 200, 500, 230], "page": 1}]
    fields = {"surveyNo": {"value": "148/2", "sourceText": "Survey No.: 148/2", "page": 1}}
    out = compute_overlays(path, "image/png", blocks, fields, [])
    assert len(out["boxes"]) == 1
    x0, y0, x1, y1 = out["boxes"][0]["rect"]
    assert 0.1 <= x0 < x1 <= 0.5 and abs(y0 - 0.4) < 0.01  # inside the OCR line, not the whole page


def test_unreadable_file_gives_no_boxes_instead_of_an_error(tmp_path):
    bad = tmp_path / "bad.pdf"
    bad.write_bytes(b"not a pdf")
    assert compute_overlays(str(bad), "application/pdf", [], {"a": {"value": "x", "page": 1}}, []) == {"pageCount": 1, "boxes": []}


def test_render_page_bounds(tmp_path):
    path = _pdf(tmp_path, ["hello"])
    assert render_page(path, 1, 80)[:4] == b"\x89PNG"
    assert render_page(path, 2) is None and render_page(path, 0) is None
