import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { AdvisoryNote } from "@/components/common/AdvisoryNote";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { useDecision, useObservation, useRectification } from "@/lib/hooks";
import { DECISION_LABEL, SEVERITY_ORDER } from "@/lib/labels";
import type { ApplicationDetail, Id } from "@/lib/types";
import { cn } from "@/lib/utils";

const MIN_NOTE = 10;

function NoteField({ value, onChange, label, placeholder, id }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; id: string }) {
  const short = value.trim().length > 0 && value.trim().length < MIN_NOTE;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-red-700">*</span>
      </Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} aria-invalid={short} />
      <p className={cn("text-xs", short ? "text-red-700" : "text-muted-foreground")}>
        {short ? `Please write at least ${MIN_NOTE} characters.` : "Recorded verbatim in the tamper-evident audit trail."}
      </p>
    </div>
  );
}

export function ObservationDialog({ app, open, onOpenChange }: { app: ApplicationDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [note, setNote] = useState("");
  const m = useObservation(app.id);
  useEffect(() => {
    if (open) setNote("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add observation</DialogTitle>
          <DialogDescription>Record a scrutiny observation for {app.applicationNo}. Observations are visible in the audit trail.</DialogDescription>
        </DialogHeader>
        <NoteField id="obs-note" label="Observation" value={note} onChange={setNote} placeholder="e.g. Fire NOC validity confirmed telephonically with district fire office." />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={note.trim().length < MIN_NOTE || m.isPending}
            onClick={() => m.mutate(note.trim(), { onSuccess: () => onOpenChange(false) })}
          >
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save observation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RectificationDialog({ app, open, onOpenChange }: { app: ApplicationDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const openFindings = (app.findings ?? [])
    .filter((f) => f.status === "OPEN" || f.status === "ESCALATED" || f.status === "ACKNOWLEDGED")
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  const [note, setNote] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const m = useRectification(app.id);
  useEffect(() => {
    if (open) {
      setNote("");
      setSel(new Set(openFindings.filter((f) => f.severity === "CRITICAL" || f.severity === "MAJOR").map((f) => String(f.id))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const toggle = (id: Id) =>
    setSel((s) => {
      const n = new Set(s);
      const k = String(id);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request rectification</DialogTitle>
          <DialogDescription>
            The institution will be asked to respond to the selected findings. The application moves to “Rectification requested”.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Findings to include</Label>
              <span className="text-xs text-muted-foreground">
                {sel.size} of {openFindings.length} selected
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border">
              {openFindings.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No open findings. You can still send a general request.</p>
              ) : (
                openFindings.map((f) => (
                  <label key={f.id} className="flex cursor-pointer items-start gap-3 border-b px-3 py-2 last:border-0 hover:bg-muted/40">
                    <Checkbox checked={sel.has(String(f.id))} onCheckedChange={() => toggle(f.id)} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <SeverityBadge severity={f.severity} />
                        <span className="truncate text-sm font-medium">{f.title}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">{f.reason}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          <NoteField
            id="rect-note"
            label="Instructions to the institution"
            value={note}
            onChange={setNote}
            placeholder="Describe what must be corrected or re-submitted, and by when."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={note.trim().length < MIN_NOTE || m.isPending}
            onClick={() =>
              m.mutate(
                { note: note.trim(), findingIds: openFindings.filter((f) => sel.has(String(f.id))).map((f) => f.id) },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const RD_ACTIONS = ["APPROVE_FOR_EOA", "ISSUE_DEFICIENCY_LETTER", "ORDER_INSPECTION", "REJECT"];
const ACTION_HINT: Record<string, string> = {
  APPROVE_FOR_EOA: "Grant approval for the academic year.",
  ISSUE_DEFICIENCY_LETTER: "Formally list the gaps; the institution must fix them.",
  ORDER_INSPECTION: "An expert committee checks the institution in person before a decision.",
  REJECT: "Decline the application and give reasons.",
};
const ACTION_CONSEQUENCE: Record<string, string> = {
  APPROVE_FOR_EOA: "The application is approved for the academic year.",
  ISSUE_DEFICIENCY_LETTER: "A deficiency letter is issued and the institution is asked to comply.",
  ORDER_INSPECTION: "A physical inspection is ordered before any final decision.",
  REJECT: "The application is declined.",
};

export function DecisionDialog({
  app,
  open,
  onOpenChange,
  mode,
}: {
  app: ApplicationDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "decide" | "recommend";
}) {
  const actions = mode === "decide" ? RD_ACTIONS : RD_ACTIONS.map((a) => `RECOMMEND_${a}`);
  const [action, setAction] = useState<string>("");
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const m = useDecision(app.id);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) {
      setAction("");
      setNote("");
      setAck(false);
      setConfirming(false);
      m.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // Move focus to the summary when the confirmation step appears so keyboard/screen-reader users land on it.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);
  const noun = mode === "decide" ? "decision" : "recommendation";
  const blockingFindings = app.findings.filter((f) => f.severity === "CRITICAL" && !["RECTIFIED", "DISMISSED"].includes(f.status));
  const critical = blockingFindings.length;
  const blocked = critical > 0 && action.endsWith("APPROVE_FOR_EOA");
  const valid = !!action && note.trim().length >= MIN_NOTE && ack && !blocked;
  const base = action.replace(/^RECOMMEND_/, "");
  const missing = [!action && "choose an action", note.trim().length < MIN_NOTE && "write a note", !ack && "tick the confirmation"].filter(Boolean) as string[];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "decide" ? "Record decision" : "Record recommendation"}</DialogTitle>
          <DialogDescription>
            {app.applicationNo} · {app.institution?.name}
            {mode === "recommend" ? ". Your recommendation goes to the Regional Director, who makes the final decision." : ""}
          </DialogDescription>
        </DialogHeader>
        {!confirming ? (
          <div className="space-y-4">
            <RadioGroup value={action} onValueChange={setAction} className="grid gap-2 sm:grid-cols-2" aria-label="Action">
              {actions.map((a) => {
                const b = a.replace(/^RECOMMEND_/, "");
                return (
                  <Label
                    key={a}
                    htmlFor={`act-${a}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-md border p-3 font-normal transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring",
                      action === a && "border-primary-600 bg-navy-50",
                    )}
                  >
                    <RadioGroupItem id={`act-${a}`} value={a} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium">{DECISION_LABEL[a] ?? a}</span>
                      <span className="block text-xs text-muted-foreground">{ACTION_HINT[b]}</span>
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
            {critical > 0 && (
              <div
                role={blocked ? "alert" : undefined}
                className={cn("rounded-md border px-3 py-2 text-xs", blocked ? "border-red-300 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900")}
              >
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {blocked ? "Approval is blocked" : "Critical findings are still unresolved"}: {critical} critical finding{critical === 1 ? "" : "s"}
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {blockingFindings.map((f) => (
                    <li key={f.id}>{f.title}</li>
                  ))}
                </ul>
                <p className="mt-1.5">
                  Approval stays blocked until a reviewer confirms each one is rectified or dismisses it with an evidence-based reason.
                  Acknowledging or escalating a finding does not resolve it. Other actions are still available.
                </p>
              </div>
            )}
            <NoteField
              id="dec-note"
              label={`Reasoned note (required, at least ${MIN_NOTE} characters)`}
              value={note}
              onChange={setNote}
              placeholder="Summarise the evidence considered and the basis for this action."
            />
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
              <span>
                I have reviewed the documents and evidence myself. I understand that VeriSense findings and scores are advisory and do not
                determine this {noun}.
              </span>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 ref={confirmRef} tabIndex={-1} className="text-sm font-semibold outline-none">
              Please check before you record
            </h3>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="kv-label">Action</p>
              <p className="mt-0.5 font-semibold">{DECISION_LABEL[action] ?? action}</p>
              <p className="kv-label mt-3">What happens next</p>
              <p className="mt-0.5">
                {mode === "decide"
                  ? ACTION_CONSEQUENCE[base]
                  : "Your recommendation is sent to the Regional Director. Nothing is approved or rejected until they decide."}
              </p>
              <p className="kv-label mt-3">Your note</p>
              <p className="mt-0.5 whitespace-pre-wrap">{note.trim()}</p>
            </div>
            <AdvisoryNote>
              AI outputs are advisory. This {noun} is yours and will be recorded under your name in the audit trail. It cannot be edited
              afterwards.
            </AdvisoryNote>
            <div aria-live="polite">
              {m.isError && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  Could not record the {noun}. {m.error instanceof Error ? m.error.message : "Please try again."} Nothing was saved.
                </p>
              )}
            </div>
          </div>
        )}
        <DialogFooter className="items-center">
          {confirming ? (
            <>
              <Button variant="outline" disabled={m.isPending} onClick={() => setConfirming(false)}>
                Back
              </Button>
              <Button disabled={m.isPending || !valid} onClick={() => m.mutate({ action, note: note.trim() }, { onSuccess: () => onOpenChange(false) })}>
                {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                {m.isPending ? "Recording…" : m.isError ? "Try again" : "Confirm and record"}
              </Button>
            </>
          ) : (
            <>
              {!valid && !blocked && missing.length > 0 && (action || note || ack) && (
                <span className="mr-auto text-xs text-muted-foreground">To continue: {missing.join(", ")}.</span>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!valid} onClick={() => setConfirming(true)}>
                Review &amp; confirm
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
