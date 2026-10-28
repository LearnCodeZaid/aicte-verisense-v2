import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ChevronDown, CircleMinus, FileText, Info, XCircle } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtNumber, fmtValue } from "@/lib/format";
import { humanize, SEVERITY_ORDER } from "@/lib/labels";
import type { ApplicationDetail, Id, InstitutionalRecords } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KV } from "../../components/Panel";

type Cmp = { label: string; declared: unknown; record: unknown; state: "match" | "mismatch" | "na" | "change"; note?: string; unit?: string };

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function within(a: number, b: number, tol: number) {
  if (b === 0) return a === 0;
  return Math.abs(a - b) / Math.abs(b) <= tol;
}

function truthy(v: unknown) {
  return v === true || v === "true" || v === "yes" || v === "Yes" || v === 1;
}

export function buildComparisons(app: ApplicationDetail): Cmp[] {
  const f = app.formData ?? {};
  const r = app.records as InstitutionalRecords | null;
  if (!r) return [];
  const out: Cmp[] = [];
  const numCmp = (label: string, declared: unknown, record: number | null, tol: number, unit?: string, allowChange = false) => {
    const d = num(declared);
    if (d === null || record === null) {
      out.push({ label, declared, record, state: "na", unit });
      return;
    }
    const ok = within(d, record, tol);
    out.push({
      label,
      declared: d,
      record,
      unit,
      state: ok ? "match" : allowChange && d > record ? "change" : "mismatch",
      note: ok ? (tol ? `within ${Math.round(tol * 100)}% tolerance` : undefined) : allowChange && d > record ? "Increase requested" : undefined,
    });
  };

  const programmes = Array.isArray(f.programmes) ? f.programmes : [];
  const declaredIntake = f.totalIntake ?? (programmes.length ? programmes.reduce((s: number, p: any) => s + (num(p?.intake) ?? 0), 0) : null);
  const recordIntake = (r.approvedProgrammes ?? []).reduce((s, p) => s + (num(p.intake) ?? 0), 0);
  numCmp("Total approved intake", declaredIntake, r.approvedProgrammes?.length ? recordIntake : null, 0, "seats", app.category === "INTAKE_INCREASE" || app.category === "NEW_COURSE");
  numCmp("Faculty count", f.facultyCount, r.faculty ? r.faculty.length : null, 0.1, "faculty");
  numCmp("Land area", f.landAreaAcres, num(r.landAndBuilding?.landAreaAcres), 0.02, "acres");
  numCmp("Built-up area", f.builtUpAreaSqm, num(r.landAndBuilding?.builtUpAreaSqm), 0.05, "sq m");

  if (f.terTxnId !== undefined) {
    const pay = (r.terPayments ?? []).find((p) => p.txnId === f.terTxnId) ?? (r.terPayments ?? []).find((p) => p.year === app.academicYear);
    const ok = !!pay && pay.txnId === f.terTxnId && pay.status === "PAID";
    out.push({
      label: "TER payment",
      declared: f.terTxnId,
      record: pay ? `${pay.txnId} (${pay.status})` : "No payment on record",
      state: ok ? "match" : "mismatch",
    });
  }
  for (const body of ["NBA", "NAAC"]) {
    const key = body === "NBA" ? "nbaAccredited" : "naacAccredited";
    if (f[key] === undefined) continue;
    const today = new Date();
    const acc = (r.accreditations ?? []).filter((a) => a.body === body);
    const valid = acc.find((a) => new Date(a.validTo) >= today);
    const claimed = truthy(f[key]);
    out.push({
      label: `${body} accreditation`,
      declared: claimed ? "Claimed" : "Not claimed",
      record: valid ? `Valid to ${fmtDate(valid.validTo)}${valid.grade ? ` · ${valid.grade}` : ""}` : acc.length ? `Lapsed ${fmtDate(acc[0].validTo)}` : "None on record",
      state: claimed === !!valid ? "match" : claimed ? "mismatch" : "na",
    });
  }
  return out;
}

function CmpIcon({ state }: { state: Cmp["state"] }) {
  if (state === "match") return <CheckCircle2 className="h-4 w-4 text-green-700" aria-label="Match" />;
  if (state === "mismatch") return <XCircle className="h-4 w-4 text-red-700" aria-label="Mismatch" />;
  if (state === "change") return <Info className="h-4 w-4 text-blue-700" aria-label="Change requested" />;
  return <CircleMinus className="h-4 w-4 text-slate-400" aria-label="Not comparable" />;
}

export default function OverviewTab({ app, onOpenDocument }: { app: ApplicationDetail; onOpenDocument: (id: Id) => void }) {
  const cmps = buildComparisons(app);
  const checklist = app.checklist ?? [];
  const present = checklist.filter((c) => c.status === "PRESENT").length;
  const required = checklist.filter((c) => c.mandatory && c.status !== "NOT_REQUIRED").length;
  const requiredMissing = checklist.filter((c) => c.mandatory && (c.status === "MISSING" || c.status === "EXPIRED" || c.status === "INVALID")).length;
  const topFindings = [...(app.findings ?? [])]
    .filter((f) => f.status === "OPEN" || f.status === "ESCALATED")
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    .slice(0, 4);
  const docsById = new Map((app.documents ?? []).map((d) => [String(d.id), d]));
  const inst = app.institution;
  const programmes: any[] = Array.isArray(app.formData?.programmes) ? app.formData.programmes : [];

  const mismatches = cmps.filter((c) => c.state === "mismatch").length;
  const openFindings = app.counts?.findingsOpen ?? 0;

  return (
    <div className="space-y-6">
      <section aria-label="Top issues" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {openFindings > 0 ? `${openFindings} open ${openFindings === 1 ? "issue" : "issues"}` : "No open issues"}
          </h2>
          {openFindings > topFindings.length && (
            <Link to="?tab=findings" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              See all {openFindings} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
        {topFindings.length > 0 && (
          <ul className="divide-y rounded-lg border bg-card">
            {topFindings.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <SeverityBadge severity={f.severity} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1 leading-snug">{f.title}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {present} of {checklist.length} checklist documents present
          {requiredMissing > 0 ? `, ${requiredMissing} mandatory ${requiredMissing === 1 ? "item" : "items"} missing, expired or invalid` : ""}.{" "}
          {app.counts?.verified ?? 0} of {app.counts?.documents ?? 0} documents verified at source. Advisory only.
        </p>
      </section>

      <section aria-label="Review details" className="space-y-3">
        <h2 className="text-lg font-semibold">Details</h2>
        <div className="divide-y overflow-hidden rounded-lg border bg-card">
          <Disclosure
            title="Declared vs. AICTE records"
            hint={mismatches > 0 ? `${mismatches} ${mismatches === 1 ? "value does" : "values do"} not match` : "All compared values match"}
            alert={mismatches > 0}
          >
            {!app.records ? (
              <EmptyState compact title="No institutional records" description="This institution has no prior records (e.g. a new institution)." />
            ) : cmps.length === 0 ? (
              <EmptyState compact title="Nothing to compare" />
            ) : (
              <ul className="divide-y rounded-md border bg-white">
                {cmps.map((c) => (
                  <li key={c.label} className={cn("px-3 py-2.5 text-sm", c.state === "mismatch" && "bg-red-50/50")}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{c.label}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-600">
                        <CmpIcon state={c.state} />
                        {CMP_TEXT[c.state]}
                      </span>
                    </div>
                    <dl className="mt-1 grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">Declared</dt>
                        <dd className="tabular break-words">
                          {fmtValue(c.declared)} {c.unit && typeof c.declared === "number" ? <span className="text-xs text-slate-500">{c.unit}</span> : null}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">AICTE record</dt>
                        <dd className="tabular break-words">
                          {fmtValue(c.record)} {c.unit && typeof c.record === "number" ? <span className="text-xs text-slate-500">{c.unit}</span> : null}
                        </dd>
                      </div>
                    </dl>
                    {c.note && <p className="mt-1 text-xs text-slate-500">{c.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Disclosure>

          <Disclosure
            title="Document checklist"
            hint={`${present} of ${checklist.length} required documents present`}
            alert={requiredMissing > 0}
          >
            {checklist.length === 0 ? (
              <EmptyState compact title="No checklist yet" description="The checklist is generated during validation." />
            ) : (
              <>
                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" role="presentation">
                  <div className="h-full bg-primary-600" style={{ width: `${Math.round((present / checklist.length) * 100)}%` }} />
                </div>
                <ul className="divide-y rounded-md border bg-white">
                  {checklist.map((c) => {
                    const doc = c.documentId ? docsById.get(String(c.documentId)) : undefined;
                    return (
                      <li key={c.docType} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">{c.label}</span>
                            {!c.mandatory && <span className="rounded bg-muted px-1 text-2xs text-muted-foreground">Optional</span>}
                          </div>
                          {doc && (
                            <button
                              type="button"
                              onClick={() => onOpenDocument(doc.id)}
                              className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate rounded text-xs text-primary-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
                            >
                              <FileText className="h-3 w-3 shrink-0" /> <span className="truncate">{doc.fileName}</span>
                            </button>
                          )}
                          {c.clause && (
                            <details className="mt-0.5">
                              <summary className="cursor-pointer text-xs text-slate-500">Rule reference (illustrative)</summary>
                              <p className="mt-0.5 text-xs text-slate-500">{c.clause}</p>
                            </details>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <StatusBadge status={c.status ?? "MISSING"} kind="checklist" />
                          {doc && <StatusBadge status={doc.verification?.status ?? "VERIFICATION_PENDING"} kind="verification" />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Disclosure>

          {programmes.length > 0 && (
            <Disclosure title="Declared programmes" hint={`${programmes.length} ${programmes.length === 1 ? "programme" : "programmes"}`}>
              <div className="overflow-x-auto rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Level</TableHead>
                      <TableHead>Programme / course</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead className="text-right">Declared intake</TableHead>
                      <TableHead className="text-right">AICTE record</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {programmes.map((p, i) => {
                      const rec = (app.records?.approvedProgrammes ?? []).find(
                        (a) => String(a.course).toLowerCase() === String(p.course).toLowerCase() && String(a.shift ?? "1") === String(p.shift ?? a.shift ?? "1"),
                      );
                      const ok = rec ? Number(rec.intake) === Number(p.intake) : null;
                      return (
                        <TableRow key={i}>
                          <TableCell>{p.level ?? "—"}</TableCell>
                          <TableCell>
                            <div className="font-medium">{p.course ?? "—"}</div>
                            {p.programme && <div className="text-xs text-muted-foreground">{p.programme}</div>}
                          </TableCell>
                          <TableCell>{p.shift ?? "—"}</TableCell>
                          <TableCell className="tabular text-right font-medium">{fmtNumber(p.intake)}</TableCell>
                          <TableCell className="tabular text-right">
                            <span className="inline-flex items-center gap-1.5">
                              {rec ? fmtNumber(rec.intake) : <span className="text-muted-foreground">Not approved</span>}
                              {ok !== null && <CmpIcon state={ok ? "match" : app.category === "INTAKE_INCREASE" ? "change" : "mismatch"} />}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Disclosure>
          )}

          <Disclosure title="Institution profile">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <KV label="Permanent ID">
                <span className="mono">{inst?.permanentId || "—"}</span>
              </KV>
              <KV label="Type">{inst?.type || "—"}</KV>
              <KV label="Established">{inst?.establishedYear || "—"}</KV>
              <KV label="Society / Trust" className="col-span-2">
                {inst?.trustName || "—"}
              </KV>
              <KV label="Address" className="col-span-2">
                {inst?.address || "—"}
              </KV>
              {inst?.campusGps && (
                <KV label="Campus GPS" className="col-span-2">
                  <span className="mono">
                    {inst.campusGps.lat.toFixed(4)}, {inst.campusGps.lng.toFixed(4)}
                  </span>
                </KV>
              )}
            </dl>
          </Disclosure>
          {app.records && <RecordsSnapshot r={app.records} />}
          <DeclaredData formData={app.formData ?? {}} />
        </div>
      </section>
    </div>
  );
}

const CMP_TEXT: Record<Cmp["state"], string> = {
  match: "Matches",
  mismatch: "Does not match",
  change: "Change requested",
  na: "Not comparable",
};

function Disclosure({ title, hint, alert, children }: { title: string; hint?: string; alert?: boolean; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          {hint && <span className={cn("block text-xs", alert ? "font-medium text-red-700" : "text-muted-foreground")}>{hint}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t bg-muted/20 px-4 py-4">{children}</div>
    </details>
  );
}

function RecordsSnapshot({ r }: { r: InstitutionalRecords }) {
  const latest = [...(r.previousApprovals ?? [])].sort((a, b) => String(b.year).localeCompare(String(a.year)))[0];
  const openDef = (r.deficiencyHistory ?? []).filter((d) => d.status === "OPEN");
  return (
    <Disclosure title="Institutional records snapshot (already in AICTE systems)">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <KV label="Latest approval">
          {latest ? (
            <>
              {latest.year} · {humanize(latest.status)}
              <span className="mono block text-xs text-muted-foreground">{latest.letterRef}</span>
            </>
          ) : (
            "—"
          )}
        </KV>
        <KV label="Approved programmes">{r.approvedProgrammes?.length ?? 0}</KV>
        <KV label="Faculty on record">{r.faculty?.length ?? 0}</KV>
        <KV label="Accreditations">
          {(r.accreditations ?? []).length
            ? r.accreditations.map((a) => (
                <span key={a.ref} className="block text-xs">
                  {a.body}
                  {a.programme ? ` · ${a.programme}` : ""} — to {fmtDate(a.validTo)}
                </span>
              ))
            : "None"}
        </KV>
        <KV label="TER payments">
          {(r.terPayments ?? []).slice(-2).map((p) => (
            <span key={p.txnId} className="block text-xs">
              {p.year}: {p.status}
            </span>
          ))}
          {!(r.terPayments ?? []).length && "—"}
        </KV>
        <KV label="Open deficiencies">
          <span className={cn(openDef.length > 0 && "font-semibold text-red-700")}>{openDef.length}</span>
          {openDef.slice(0, 2).map((d, i) => (
            <span key={i} className="block text-xs text-muted-foreground">
              {d.year}: {d.item}
            </span>
          ))}
        </KV>
      </dl>
    </Disclosure>
  );
}

function DeclaredData({ formData }: { formData: Record<string, any> }) {
  const entries = Object.entries(formData).filter(([k, v]) => k !== "programmes" && k !== "faculty" && v !== null && v !== undefined && v !== "");
  if (!entries.length) return null;
  return (
    <Disclosure title="Declared form data">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {entries.map(([k, v]) => (
          <KV key={k} label={humanize(k)}>
            {typeof v === "object" && v && !Array.isArray(v)
              ? Object.entries(v).map(([kk, vv]) => (
                  <span key={kk} className="block text-xs">
                    {humanize(kk)}: {fmtValue(vv)}
                  </span>
                ))
              : fmtValue(v)}
          </KV>
        ))}
      </dl>
    </Disclosure>
  );
}
