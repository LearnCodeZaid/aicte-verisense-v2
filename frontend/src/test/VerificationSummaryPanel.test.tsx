// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(() => cleanup());
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state: { summary: any } = { summary: null };
vi.mock("@/lib/hooks", () => ({
  useVerificationSummary: () => ({ data: state.summary, isLoading: false, isError: false, refetch: vi.fn() }),
  useSaveCriterionNote: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));

import VerificationSummaryPanel from "@/app/pages/application/VerificationSummaryPanel";

const mk = (id: string, question: string, st: string, basis: string, explanation = "Because.") => ({
  id, question, state: st, basis, explanation, evidence: [], reviewNote: null,
});

beforeEach(() => {
  state.summary = {
    applicationId: 1,
    evaluatedAt: "2026-01-01T00:00:00Z",
    counts: { passed: 2, failed: 1, needsReview: 2, notEvaluated: 1 },
    criteria: [
      mk("completeness", "Q-completeness", "PASSED", "CONFIRMED"),
      mk("document_validity", "Q-validity", "FAILED", "CONFIRMED", "Certificate expired."),
      mk("record_consistency", "Q-records", "NEEDS_REVIEW", "SOURCE_UNAVAILABLE", "Registry is unavailable."),
      mk("alteration_duplication", "Q-alteration", "NEEDS_REVIEW", "PRELIMINARY_AI", "Possible edit."),
      mk("regulatory_compliance", "Q-regulatory", "PASSED", "CONFIRMED", "Checked against simulated source."),
      mk("further_verification", "Q-further", "NOT_EVALUATED", "NONE"),
    ],
  };
});

const renderPanel = (canReview: boolean) =>
  render(<MemoryRouter><VerificationSummaryPanel applicationId={1} canReview={canReview} /></MemoryRouter>);

describe("VerificationSummaryPanel", () => {
  it("renders six criteria with state labels", () => {
    renderPanel(false);
    expect(screen.getByRole("heading", { level: 2, name: /Application Verification Summary/ })).toBeInTheDocument();
    expect(document.querySelectorAll("details > summary")).toHaveLength(6);
    expect(screen.getAllByText("Passed")).toHaveLength(2);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getAllByText("Needs review")).toHaveLength(2);
    expect(screen.getByText("Not evaluated")).toBeInTheDocument();
    expect(screen.getByText("2 passed")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.getByText("3 need attention")).toBeInTheDocument();
  });

  it("distinguishes Confirmed, Preliminary AI and Source unavailable", () => {
    renderPanel(false);
    expect(screen.getAllByText("Confirmed").length).toBe(2);
    expect(screen.getByText("Preliminary AI warning")).toBeInTheDocument();
    expect(screen.getByText("Source unavailable")).toBeInTheDocument();
    expect(screen.getByText("Confirmed (simulated source)")).toBeInTheDocument();
  });

  it("offers notes only when canReview, and only after Add note is pressed", () => {
    const { unmount } = renderPanel(false);
    expect(screen.queryByRole("button", { name: /Add note/ })).toBeNull();
    expect(screen.queryByText("Reviewer note")).toBeNull();
    unmount();
    renderPanel(true);
    expect(screen.queryByLabelText("Reviewer note")).toBeNull();
    const add = screen.getAllByRole("button", { name: /Add note/ });
    expect(add).toHaveLength(6);
    fireEvent.click(add[0]);
    expect(screen.getAllByLabelText("Reviewer note")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Save note" })).toBeDisabled();
  });

  it("shows the never approves or rejects footer", () => {
    renderPanel(false);
    expect(screen.getByText(/never approves or rejects/i)).toBeInTheDocument();
  });
});
