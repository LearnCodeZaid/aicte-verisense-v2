// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(() => cleanup());
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/hooks", () => ({
  useDecision: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null }),
  useObservation: () => ({ mutate: vi.fn(), isPending: false }),
  useRectification: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { DecisionDialog } from "@/app/pages/application/ActionDialogs";

const app = (findings: any[]): any => ({
  id: 1, applicationNo: "APP-1", institution: { name: "Inst" }, findings,
});
const crit = (status: string) => ({ id: 1, severity: "CRITICAL", status, title: "Forged seal" });

function setup(findings: any[], mode: "decide" | "recommend" = "decide") {
  render(<DecisionDialog app={app(findings)} open onOpenChange={() => {}} mode={mode} />);
}
const pick = (a: string) => fireEvent.click(document.getElementById(`act-${a}`)!);
const next = () => screen.getByRole("button", { name: /Review & confirm/ });
function fill(note: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: note } });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("DecisionDialog guard", () => {
  it("blocks approval while a CRITICAL finding is unresolved", () => {
    setup([crit("OPEN")]);
    pick("APPROVE_FOR_EOA");
    fill("A sufficiently long note");
    expect(screen.getByText(/Approval is blocked/)).toBeInTheDocument();
    expect(next()).toBeDisabled();
  });

  it("blocks recommending approval too, and ACKNOWLEDGED does not resolve", () => {
    setup([crit("ACKNOWLEDGED")], "recommend");
    pick("RECOMMEND_APPROVE_FOR_EOA");
    fill("A sufficiently long note");
    expect(next()).toBeDisabled();
  });

  it("still allows other actions with unresolved critical findings", () => {
    setup([crit("OPEN")]);
    pick("REJECT");
    fill("A sufficiently long note");
    expect(next()).toBeEnabled();
  });

  it("enables approval when critical findings are rectified/dismissed", () => {
    setup([crit("RECTIFIED"), { ...crit("DISMISSED"), id: 2 }]);
    pick("APPROVE_FOR_EOA");
    fill("A sufficiently long note");
    expect(screen.queryByText(/Approval is blocked/)).toBeNull();
    expect(next()).toBeEnabled();
  });

  it("requires a note of at least 10 characters", () => {
    setup([]);
    pick("APPROVE_FOR_EOA");
    fill("too short");
    expect(next()).toBeDisabled();
    expect(screen.getByText("Please write at least 10 characters.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "0123456789" } });
    expect(next()).toBeEnabled();
  });
});
