import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ApplicationCategory } from "@/lib/types";

export interface Programme {
  level: string;
  programme: string;
  course: string;
  shift: string;
  intake: number | "";
}

export interface FormState {
  programmes: Programme[];
  proposedIntake: number | "";
  facultyCount: number | "";
  studentCount: number | "";
  landAreaAcres: number | "";
  builtUpAreaSqm: number | "";
  locationType: string;
  terTxnId: string;
  nbaAccredited: boolean;
  naacAccredited: boolean;
  cadre: { professor: number | ""; associateProfessor: number | ""; assistantProfessor: number | "" };
  [k: string]: any;
}

export const EMPTY_FORM: FormState = {
  programmes: [{ level: "UG", programme: "Engineering & Technology", course: "", shift: "1", intake: "" }],
  proposedIntake: "",
  facultyCount: "",
  studentCount: "",
  landAreaAcres: "",
  builtUpAreaSqm: "",
  locationType: "URBAN",
  terTxnId: "",
  nbaAccredited: false,
  naacAccredited: false,
  cadre: { professor: "", associateProfessor: "", assistantProfessor: "" },
};

export function formFromData(d: Record<string, any> | undefined): FormState {
  if (!d) return EMPTY_FORM;
  return {
    ...EMPTY_FORM,
    ...d,
    programmes: Array.isArray(d.programmes) && d.programmes.length ? d.programmes : EMPTY_FORM.programmes,
    cadre: { ...EMPTY_FORM.cadre, ...(d.cadre ?? {}) },
    nbaAccredited: d.nbaAccredited === true || d.nbaAccredited === "true",
    naacAccredited: d.naacAccredited === true || d.naacAccredited === "true",
  };
}

const n = (v: any) => (v === "" || v === null || v === undefined ? undefined : Number(v));

export function formToData(f: FormState): Record<string, unknown> {
  const programmes = f.programmes
    .filter((p) => p.course.trim())
    .map((p) => ({ ...p, intake: n(p.intake) ?? 0 }));
  const totalIntake = programmes.reduce((s, p) => s + (Number(p.intake) || 0), 0);
  const cadre = {
    professor: n(f.cadre.professor),
    associateProfessor: n(f.cadre.associateProfessor),
    assistantProfessor: n(f.cadre.assistantProfessor),
  };
  const out: Record<string, unknown> = {
    ...Object.fromEntries(Object.entries(f).filter(([k]) => !(k in EMPTY_FORM))),
    programmes,
    totalIntake: totalIntake || undefined,
    proposedIntake: n(f.proposedIntake),
    facultyCount: n(f.facultyCount),
    studentCount: n(f.studentCount),
    landAreaAcres: n(f.landAreaAcres),
    builtUpAreaSqm: n(f.builtUpAreaSqm),
    locationType: f.locationType || undefined,
    terTxnId: f.terTxnId.trim() || undefined,
    nbaAccredited: f.nbaAccredited,
    naacAccredited: f.naacAccredited,
    cadre: Object.values(cadre).some((x) => x !== undefined) ? cadre : undefined,
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

const NEW_PROGRAMME: Programme = { level: "UG", programme: "Engineering & Technology", course: "", shift: "1", intake: "" };

// Shared message slot: fixed height so showing/hiding help or an error never shifts the layout.
function Msg({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  return (
    <p id={id} className={`min-h-4 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`} role={error ? "alert" : undefined}>
      {error ?? hint}
    </p>
  );
}

function Section({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

const negative = (v: number | "") => v !== "" && Number(v) < 0;

function NumField({ id, label, value, onChange, hint, step, error, onBlur }: { id: string; label: string; value: number | ""; onChange: (v: number | "") => void; hint?: string; step?: string; error?: string; onBlur?: () => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={step ?? "1"}
        value={value}
        aria-invalid={!!error}
        aria-describedby={`${id}-msg`}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
      <Msg id={`${id}-msg`} error={error} hint={hint} />
    </div>
  );
}

export default function StepDetails({ form, setForm, category }: { form: FormState; setForm: (f: FormState) => void; category: ApplicationCategory }) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v });
  const setProg = (i: number, patch: Partial<Programme>) => set("programmes", form.programmes.map((p, j) => (i === j ? { ...p, ...patch } : p)));
  const total = form.programmes.reduce((s, p) => s + (Number(p.intake) || 0), 0);

  // Inline validation: shown once a field has been visited; it never blocks navigation here.
  const numErr = (k: string, v: number | "") => (touched[k] && negative(v) ? "Enter 0 or more." : undefined);
  const cadreTotal = [form.cadre.professor, form.cadre.associateProfessor, form.cadre.assistantProfessor].reduce<number>((s, x) => s + (Number(x) || 0), 0);
  const cadreErr =
    touched.cadre && form.facultyCount !== "" && cadreTotal > Number(form.facultyCount)
      ? `Cadre adds up to ${cadreTotal}, more than the ${form.facultyCount} faculty entered above.`
      : undefined;
  const progErr = (p: Programme, i: number): { course?: string; intake?: string } => {
    if (!touched[`course${i}`] && !touched[`intake${i}`]) return {};
    return {
      course: !p.course.trim() && (p.intake !== "" || form.programmes.length > 1) ? "Enter the course name." : undefined,
      intake: negative(p.intake) ? "Enter 0 or more." : p.course.trim() && p.intake === "" ? "Enter the approved intake." : undefined,
    };
  };

  return (
    <div className="space-y-6">
      <Section
        title="Programmes and intake"
        description="List each programme you are applying for. These figures are compared with AICTE records."
        actions={
          <Button size="sm" variant="outline" onClick={() => set("programmes", [...form.programmes, { ...NEW_PROGRAMME }])}>
            <Plus className="mr-1 h-4 w-4" /> Add programme
          </Button>
        }
      >
        <div className="space-y-3">
          <div aria-hidden className="hidden grid-cols-[90px_minmax(0,1fr)_minmax(0,1.3fr)_80px_100px_36px] gap-2 text-xs font-semibold text-muted-foreground md:grid">
            <span>Level</span>
            <span>Programme</span>
            <span>Course</span>
            <span>Shift</span>
            <span>Intake</span>
            <span />
          </div>
          {form.programmes.map((p, i) => {
            const e = progErr(p, i);
            const lab = "text-xs text-muted-foreground md:sr-only";
            return (
              <div key={i} role="group" aria-label={`Programme ${i + 1}`} className="grid grid-cols-2 gap-2 rounded-md border p-2 md:grid-cols-[90px_minmax(0,1fr)_minmax(0,1.3fr)_80px_100px_36px] md:items-start md:border-0 md:p-0">
                <div className="space-y-1">
                  <Label htmlFor={`lvl${i}`} className={lab}>Level</Label>
                  <Select value={p.level} onValueChange={(v) => setProg(i, { level: v })}>
                    <SelectTrigger id={`lvl${i}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["DIPLOMA", "UG", "PG", "PGDM"].map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`prog${i}`} className={lab}>Programme</Label>
                  <Input id={`prog${i}`} value={p.programme} onChange={(ev) => setProg(i, { programme: ev.target.value })} placeholder="Engineering & Technology" />
                </div>
                <div className="col-span-2 space-y-1 md:col-span-1">
                  <Label htmlFor={`course${i}`} className={lab}>Course</Label>
                  <Input
                    id={`course${i}`}
                    value={p.course}
                    aria-invalid={!!e.course}
                    aria-describedby={`course${i}-msg`}
                    onBlur={() => touch(`course${i}`)}
                    onChange={(ev) => setProg(i, { course: ev.target.value })}
                    placeholder="e.g. Computer Science and Engineering"
                  />
                  <Msg id={`course${i}-msg`} error={e.course} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`shift${i}`} className={lab}>Shift</Label>
                  <Select value={String(p.shift)} onValueChange={(v) => setProg(i, { shift: v })}>
                    <SelectTrigger id={`shift${i}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1st</SelectItem>
                      <SelectItem value="2">2nd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`intake${i}`} className={lab}>Intake</Label>
                  <Input
                    id={`intake${i}`}
                    type="number"
                    min={0}
                    value={p.intake}
                    aria-invalid={!!e.intake}
                    aria-describedby={`intake${i}-msg`}
                    onBlur={() => touch(`intake${i}`)}
                    onChange={(ev) => setProg(i, { intake: ev.target.value === "" ? "" : Number(ev.target.value) })}
                  />
                  <Msg id={`intake${i}-msg`} error={e.intake} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="col-span-2 h-10 w-full md:col-span-1 md:w-9"
                  disabled={form.programmes.length === 1}
                  onClick={() => set("programmes", form.programmes.filter((_, j) => j !== i))}
                  aria-label={`Remove programme ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <p className="text-right text-sm text-muted-foreground" aria-live="polite">
            Total intake <span className="tabular font-semibold text-foreground">{total}</span>
          </p>
        </div>
        {category === "INTAKE_INCREASE" && (
          <div className="max-w-xs">
            <NumField
              id="proposedIntake"
              label="Intake after the increase"
              value={form.proposedIntake}
              onChange={(v) => set("proposedIntake", v)}
              onBlur={() => touch("proposedIntake")}
              error={numErr("proposedIntake", form.proposedIntake)}
              hint="Total intake you are asking for."
            />
          </div>
        )}
      </Section>

      <Section title="Faculty and students">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField id="facultyCount" label="Regular faculty (total)" value={form.facultyCount} onChange={(v) => set("facultyCount", v)} onBlur={() => touch("facultyCount")} error={numErr("facultyCount", form.facultyCount)} />
          <NumField id="studentCount" label="Sanctioned students (total)" value={form.studentCount} onChange={(v) => set("studentCount", v)} onBlur={() => touch("studentCount")} error={numErr("studentCount", form.studentCount)} />
        </div>
        <fieldset className="space-y-1.5" aria-describedby="cadre-msg">
          <legend className="text-sm font-medium">
            Faculty by cadre <span className="font-normal text-muted-foreground">(optional)</span>
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumField id="prof" label="Professors" value={form.cadre.professor} onChange={(v) => set("cadre", { ...form.cadre, professor: v })} onBlur={() => touch("cadre")} error={numErr("cadre", form.cadre.professor)} />
            <NumField id="assoc" label="Associate professors" value={form.cadre.associateProfessor} onChange={(v) => set("cadre", { ...form.cadre, associateProfessor: v })} onBlur={() => touch("cadre")} error={numErr("cadre", form.cadre.associateProfessor)} />
            <NumField id="asst" label="Assistant professors" value={form.cadre.assistantProfessor} onChange={(v) => set("cadre", { ...form.cadre, assistantProfessor: v })} onBlur={() => touch("cadre")} error={numErr("cadre", form.cadre.assistantProfessor)} />
          </div>
          <Msg id="cadre-msg" error={cadreErr} />
        </fieldset>
      </Section>

      <Section title="Land and building">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField id="land" label="Land area (acres)" step="0.01" value={form.landAreaAcres} onChange={(v) => set("landAreaAcres", v)} onBlur={() => touch("land")} error={numErr("land", form.landAreaAcres)} />
          <NumField id="built" label="Built-up area (sq m)" value={form.builtUpAreaSqm} onChange={(v) => set("builtUpAreaSqm", v)} onBlur={() => touch("built")} error={numErr("built", form.builtUpAreaSqm)} />
          <div className="space-y-1.5">
            <Label htmlFor="loc">Location type</Label>
            <Select value={form.locationType} onValueChange={(v) => set("locationType", v)}>
              <SelectTrigger id="loc">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["METRO", "URBAN", "RURAL", "HILLY"].map((l) => (
                  <SelectItem key={l} value={l}>
                    {l.charAt(0) + l.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Msg id="loc-msg" />
          </div>
        </div>
      </Section>

      <Section title="Fee and accreditation">
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="ter">Processing fee transaction ID (TER)</Label>
          <Input id="ter" className="mono" value={form.terTxnId} aria-describedby="ter-msg" onChange={(e) => set("terTxnId", e.target.value)} placeholder="e.g. TER2026WR00123" />
          <Msg id="ter-msg" hint="Find this on your fee payment receipt." />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
            <span>
              <span className="block text-sm font-medium">NBA accredited programme(s)</span>
              <span id="nba-help" className="block text-xs text-muted-foreground">Adds the NBA certificate to your checklist.</span>
            </span>
            <Switch checked={form.nbaAccredited} onCheckedChange={(v) => set("nbaAccredited", v)} aria-describedby="nba-help" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
            <span>
              <span className="block text-sm font-medium">NAAC accredited</span>
              <span id="naac-help" className="block text-xs text-muted-foreground">Adds the NAAC certificate to your checklist.</span>
            </span>
            <Switch checked={form.naacAccredited} onCheckedChange={(v) => set("naacAccredited", v)} aria-describedby="naac-help" />
          </label>
        </div>
      </Section>
    </div>
  );
}
