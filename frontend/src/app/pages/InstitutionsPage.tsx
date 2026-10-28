import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, ExternalLink, MapPin, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBandPill } from "@/components/common/SeverityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  useCreateInstitution,
  useInstitution,
  useInstitutionOverview,
  useInstitutions,
  useUpdateInstitution,
} from "@/lib/hooks";
import { REGION_LABEL } from "@/lib/labels";
import type { Institution, InstitutionalRecords, Region } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isAdmin, useAuth } from "../auth";
import { Panel } from "../components/Panel";

const REGIONS: Region[] = ["NR", "WR", "SR", "ER", "CR", "SWR", "SER", "NWR"];

const INST_TYPES = [
  "Private-Self Financing",
  "Government",
  "Govt Aided",
  "University Managed-Govt",
  "Deemed to be University",
];

function DirectorySkeleton() {
  return (
    <Panel className="space-y-3 p-4" aria-busy="true" aria-label="Loading institutions">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading institution">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export default function InstitutionsPage() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const qRegion = sp.get("region") ?? undefined;
  const qType = sp.get("type") ?? undefined;
  const qSearch = sp.get("q") ?? "";

  const [search, setSearch] = useState(qSearch);
  const [selectedInstId, setSelectedInstId] = useState<string | number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editInst, setEditInst] = useState<Institution | null>(null);

  const overview = useInstitutionOverview();
  const institutionsQ = useInstitutions({
    region: qRegion,
    type: qType,
    q: qSearch || undefined,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(sp);
    if (search.trim()) next.set("q", search.trim());
    else next.delete("q");
    setSp(next, { replace: true });
  };

  const setFilter = (key: string, val: string | null) => {
    const next = new URLSearchParams(sp);
    if (!val || val === "ALL") next.delete(key);
    else next.set(key, val);
    setSp(next, { replace: true });
  };

  const clearFilters = () => {
    setSearch("");
    setSp(new URLSearchParams(), { replace: true });
  };

  const insts = institutionsQ.data ?? [];
  const canManage = isAdmin(user?.role) || user?.role === "REGIONAL_DIRECTOR";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutions"
        description="Find a registered institution and open its profile, records and application history."
        eyebrow={
          <Badge variant="outline" className="font-mono text-xs">
            {insts.length} {insts.length === 1 ? "Institution" : "Institutions"}
          </Badge>
        }
        actions={
          canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Register Institution
            </Button>
          )
        }
      />

      {/* One-line summary (replaces repeated stat tiles) */}
      {overview.data && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-semibold tabular text-foreground">{overview.data.totalInstitutions}</span> institutions ·{" "}
          <span className="font-semibold tabular text-foreground">{overview.data.totalApprovedProgrammes}</span> approved programmes ·{" "}
          <span className="font-semibold tabular text-foreground">{overview.data.totalSanctionedIntake.toLocaleString()}</span> sanctioned seats ·{" "}
          <span className="font-semibold tabular text-foreground">{overview.data.totalRecordedFaculty.toLocaleString()}</span> recorded faculty ·{" "}
          <span className={cn("font-semibold tabular", overview.data.highRiskInstitutions > 0 ? "text-red-700" : "text-foreground")}>
            {overview.data.highRiskInstitutions}
          </span>{" "}
          high risk
        </p>
      )}

      {/* Search and filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2" role="search">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, permanent ID or city"
              aria-label="Search institutions"
              className="pl-9 text-sm"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin(user?.role) && (
            <Select value={qRegion ?? "ALL"} onValueChange={(v) => setFilter("region", v)}>
              <SelectTrigger className="h-9 w-[140px] text-xs" aria-label="Filter by region">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Regions</SelectItem>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r} — {REGION_LABEL[r] ?? r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={qType ?? "ALL"} onValueChange={(v) => setFilter("type", v)}>
            <SelectTrigger className="h-9 w-[160px] text-xs" aria-label="Filter by institution type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {INST_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(qRegion || qType || qSearch) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground">
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Directory */}
      {institutionsQ.isLoading ? (
        <DirectorySkeleton />
      ) : institutionsQ.isError ? (
        <ErrorState error={institutionsQ.error} onRetry={() => institutionsQ.refetch()} />
      ) : insts.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No institutions found"
          description="Try a different name, ID or city, or clear the filters."
          action={
            (qRegion || qType || qSearch) && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <Panel className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Institution</TableHead>
                  <TableHead className="hidden text-xs font-semibold md:table-cell">Location</TableHead>
                  <TableHead className="hidden text-xs font-semibold sm:table-cell">Applications</TableHead>
                  <TableHead className="text-xs font-semibold">Risk</TableHead>
                  <TableHead className="text-right text-xs font-semibold">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insts.map((i) => {
                  const s = i.stats;
                  return (
                    <TableRow key={i.id} className="hover:bg-muted/30">
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSelectedInstId(i.id)}
                          className="text-left text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {i.name}
                        </button>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          <span className="font-mono">{i.permanentId}</span> · {i.type}
                          {s?.naacGrade && <span className="font-medium text-emerald-700"> · NAAC {s.naacGrade}</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground md:hidden">
                          {i.city}, {i.state}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-xs font-medium text-foreground">
                          {i.city}, {i.state}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-2xs text-muted-foreground">
                          <MapPin className="h-3 w-3" aria-hidden />
                          <span>Region {i.region}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-xs">
                          <span className="font-semibold tabular">{s?.applicationsCount ?? 0}</span> total
                        </div>
                        {s?.latestStatus && s.latestStatus !== "NO_APPLICATIONS" && (
                          <div className="mt-1">
                            <StatusBadge status={s.latestStatus as any} size="sm" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <RiskBandPill band={s?.riskBand ?? "LOW"} />
                        {s?.openFindings && s.openFindings > 0 ? (
                          <div className="mt-1 text-2xs font-medium text-amber-700">
                            {s.openFindings} open finding{s.openFindings > 1 ? "s" : ""}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setSelectedInstId(i.id)}
                          >
                            View
                          </Button>
                          {isAdmin(user?.role) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditInst(i)}
                              title="Edit Institution Profile"
                              aria-label={`Edit ${i.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

      {selectedInstId && (
        <InstitutionDetailDialog
          institutionId={selectedInstId}
          open={!!selectedInstId}
          onClose={() => setSelectedInstId(null)}
        />
      )}

      {createOpen && <CreateInstitutionDialog open={createOpen} onClose={() => setCreateOpen(false)} />}

      {editInst && <EditInstitutionDialog inst={editInst} open={!!editInst} onClose={() => setEditInst(null)} />}
    </div>
  );
}

/* ----------------------------- Detail view ----------------------------- */

function Field({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function InstitutionDetailDialog({
  institutionId,
  open,
  onClose,
}: {
  institutionId: string | number;
  open: boolean;
  onClose: () => void;
}) {
  const q = useInstitution(institutionId);
  const inst = q.data;
  const records = ((inst as any)?.records ?? null) as InstitutionalRecords | null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {q.isError ? (
          <>
            <DialogHeader>
              <DialogTitle>Institution</DialogTitle>
              <DialogDescription>The institution profile could not be loaded.</DialogDescription>
            </DialogHeader>
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          </>
        ) : q.isLoading || !inst ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Loading institution</DialogTitle>
              <DialogDescription>Please wait.</DialogDescription>
            </DialogHeader>
            <DetailSkeleton />
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs text-primary">
                      {inst.permanentId}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {inst.region} Region
                    </Badge>
                  </div>
                  <DialogTitle className="mt-2 text-xl font-semibold text-foreground">{inst.name}</DialogTitle>
                  <DialogDescription className="mt-1 text-xs text-slate-500">
                    {inst.type} · Established {inst.establishedYear} · Trust: {inst.trustName || "—"}
                  </DialogDescription>
                </div>
                {inst.stats && <RiskBandPill band={inst.stats.riskBand} />}
              </div>
            </DialogHeader>

            {/* Radix mounts only the active tab, so heavy record tables render lazily. */}
            <Tabs defaultValue="overview" className="mt-2">
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 text-xs">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="programmes">Programmes ({inst.stats?.programmesCount ?? 0})</TabsTrigger>
                <TabsTrigger value="faculty">Faculty ({inst.stats?.facultyCount ?? 0})</TabsTrigger>
                <TabsTrigger value="records">Other records</TabsTrigger>
                <TabsTrigger value="applications">Applications ({inst.stats?.applicationsCount ?? 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-5 pt-4">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field
                    label="Campus location"
                    value={`${inst.city}, ${inst.state}`}
                    hint={inst.address}
                  />
                  <Field
                    label="Campus GPS"
                    value={
                      <span className="font-mono">
                        {inst.campusGps ? `${inst.campusGps.lat.toFixed(4)}, ${inst.campusGps.lng.toFixed(4)}` : "Not tagged"}
                      </span>
                    }
                  />
                  <Field
                    label="Land area"
                    value={inst.stats?.landAreaAcres ? `${inst.stats.landAreaAcres} acres` : "—"}
                    hint="As recorded in the title deed"
                  />
                </dl>
                <div className="border-t pt-4">
                  <h3 className="mb-3 text-sm font-semibold">Scrutiny summary</h3>
                  <dl className="grid grid-cols-3 gap-4">
                    <Field label="Average compliance" value={<span className="tabular">{inst.stats?.averageCompliance ?? 0}%</span>} />
                    <Field
                      label="Open deficiencies"
                      value={<span className="tabular text-amber-700">{inst.stats?.openFindings ?? 0}</span>}
                    />
                    <Field label="Sanctioned seats" value={<span className="tabular">{inst.stats?.totalIntake?.toLocaleString() ?? 0}</span>} />
                  </dl>
                </div>
              </TabsContent>

              <TabsContent value="programmes" className="pt-4">
                <ProgrammesList records={records} />
              </TabsContent>

              <TabsContent value="faculty" className="pt-4">
                <FacultyList records={records} />
              </TabsContent>

              <TabsContent value="records" className="pt-4">
                <OtherRecords records={records} />
              </TabsContent>

              <TabsContent value="applications" className="pt-4">
                <ApplicationsList inst={inst} />
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-4 border-t pt-3">
              <Button variant="outline" onClick={onClose} size="sm">
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProgrammesList({ records }: { records: InstitutionalRecords | null }) {
  const progs = records?.approvedProgrammes ?? [];

  if (progs.length === 0) {
    return <EmptyState title="No approved programmes on record" description="Programmes appear here once approvals are recorded." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="text-xs">Level</TableHead>
            <TableHead className="text-xs">Programme / Course</TableHead>
            <TableHead className="text-xs">Shift</TableHead>
            <TableHead className="text-right text-xs">Approved intake</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {progs.map((p, idx) => (
            <TableRow key={idx}>
              <TableCell className="text-xs font-semibold">{p.level}</TableCell>
              <TableCell className="text-xs">
                <div className="font-medium text-foreground">{p.course}</div>
                <div className="text-2xs text-muted-foreground">{p.programme}</div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{p.shift || "Regular"}</TableCell>
              <TableCell className="tabular text-right font-mono text-xs font-semibold">{p.intake} seats</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FacultyList({ records }: { records: InstitutionalRecords | null }) {
  const faculty = records?.faculty ?? [];

  if (faculty.length === 0) {
    return <EmptyState title="No faculty records registered" description="Faculty on the official roster will be listed here." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="text-xs">Faculty ID</TableHead>
            <TableHead className="text-xs">Name & designation</TableHead>
            <TableHead className="text-xs">Department</TableHead>
            <TableHead className="text-xs">PAN (masked)</TableHead>
            <TableHead className="text-right text-xs">Joining date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {faculty.map((f, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-mono text-2xs text-muted-foreground">{f.facultyId}</TableCell>
              <TableCell className="text-xs">
                <div className="font-medium text-foreground">{f.name}</div>
                <div className="text-2xs text-muted-foreground">{f.designation}</div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{f.department}</TableCell>
              <TableCell className="font-mono text-xs">{f.panMasked || "—"}</TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">{f.joiningDate}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Small table used by the collapsible record sections. */
function RecordTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            {head.map((h) => (
              <TableHead key={h} className="text-xs">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((c, j) => (
                <TableCell key={j} className="text-xs">
                  {c}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RecordSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <span>{title}</span>
        <span className="text-xs font-normal text-slate-500">{count} record{count === 1 ? "" : "s"}</span>
      </summary>
      <div className="border-t">
        {count === 0 ? <p className="px-3 py-3 text-xs text-slate-500">Nothing on record.</p> : children}
      </div>
    </details>
  );
}

function OtherRecords({ records }: { records: InstitutionalRecords | null }) {
  if (!records) {
    return <EmptyState title="No institutional records on file" description="Records appear once they are registered for this institution." />;
  }
  const land = records.landAndBuilding;
  return (
    <div className="space-y-2">
      <RecordSection title="Previous approvals" count={records.previousApprovals?.length ?? 0}>
        <RecordTable
          head={["Year", "Status", "Letter ref", "Date"]}
          rows={(records.previousApprovals ?? []).map((a) => [a.year, a.status, <span className="font-mono">{a.letterRef}</span>, a.date])}
        />
      </RecordSection>
      <RecordSection title="Accreditation" count={records.accreditations?.length ?? 0}>
        <RecordTable
          head={["Body", "Programme", "Grade", "Valid", "Ref"]}
          rows={(records.accreditations ?? []).map((a) => [
            a.body,
            a.programme || "Institution",
            a.grade || "—",
            `${a.validFrom} to ${a.validTo}`,
            <span className="font-mono">{a.ref}</span>,
          ])}
        />
      </RecordSection>
      <RecordSection title="Land and building" count={land ? 1 : 0}>
        {land && (
          <RecordTable
            head={["Land (acres)", "Built-up (sq m)", "Ownership", "Registry ref"]}
            rows={[[land.landAreaAcres, land.builtUpAreaSqm?.toLocaleString(), land.ownership, <span className="font-mono">{land.registryRef}</span>]]}
          />
        )}
      </RecordSection>
      <RecordSection title="Fee payments (TER)" count={records.terPayments?.length ?? 0}>
        <RecordTable
          head={["Year", "Amount", "Transaction", "Status", "Paid on"]}
          rows={(records.terPayments ?? []).map((t) => [
            t.year,
            <span className="tabular">{t.amount?.toLocaleString()}</span>,
            <span className="font-mono">{t.txnId}</span>,
            t.status,
            t.paidOn || "—",
          ])}
        />
      </RecordSection>
      <RecordSection title="Deficiency history" count={records.deficiencyHistory?.length ?? 0}>
        <RecordTable
          head={["Year", "Item", "Status"]}
          rows={(records.deficiencyHistory ?? []).map((d) => [d.year, d.item, d.status])}
        />
      </RecordSection>
      <RecordSection title="Affidavits" count={records.affidavits?.length ?? 0}>
        <RecordTable
          head={["Year", "Type", "Ref", "Notarised on"]}
          rows={(records.affidavits ?? []).map((a) => [a.year, a.type, <span className="font-mono">{a.ref}</span>, a.notarisedOn])}
        />
      </RecordSection>
    </div>
  );
}

function ApplicationsList({ inst }: { inst: Institution }) {
  const latestId = inst.stats?.latestAppId;
  const count = inst.stats?.applicationsCount ?? 0;

  if (count === 0) {
    return <EmptyState title="No applications yet" description="Applications submitted by this institution will be listed here." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
        <div>
          <div className="text-sm font-medium text-foreground">
            {count} application{count === 1 ? "" : "s"} on file
          </div>
          {inst.stats?.latestAcademicYear && (
            <div className="mt-0.5 text-xs text-slate-500">Latest academic year: {inst.stats.latestAcademicYear}</div>
          )}
        </div>
        {latestId && (
          <Button asChild size="sm" className="gap-1.5 text-xs">
            <Link to={`/portal/applications/${latestId}`}>
              <span>Open latest</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        )}
      </div>
      <div className="text-center text-xs">
        <Link to={`/portal/applications?q=${inst.permanentId}`} className="font-medium text-primary hover:underline">
          View all in the applications queue →
        </Link>
      </div>
    </div>
  );
}

function CreateInstitutionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = useCreateInstitution();
  const [permanentId, setPermanentId] = useState("");
  const [name, setName] = useState("");
  const [instType, setInstType] = useState("Private-Self Financing");
  const [region, setRegion] = useState<Region>("WR");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [trust, setTrust] = useState("");
  const [address, setAddress] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!permanentId.trim() || !name.trim()) {
      toast.error("Permanent ID and Name are required");
      return;
    }
    m.mutate(
      {
        permanentId: permanentId.trim(),
        name: name.trim(),
        type: instType,
        region,
        state: state.trim(),
        city: city.trim(),
        establishedYear: Number(year),
        trustName: trust.trim(),
        address: address.trim(),
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register New Institution</DialogTitle>
          <DialogDescription>
            Add a new technical institution to the regulatory jurisdiction.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Permanent ID *</Label>
              <Input
                placeholder="1-XXXXXXXXXX"
                value={permanentId}
                onChange={(e) => setPermanentId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Region *</Label>
              <Select value={region} onValueChange={(v) => setRegion(v as Region)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r} — {REGION_LABEL[r] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Institution Name *</Label>
            <Input
              placeholder="e.g. Apex Institute of Technology"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Institution Type</Label>
              <Select value={instType} onValueChange={setInstType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INST_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Established Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Trust / Society Name</Label>
            <Input value={trust} onChange={(e) => setTrust(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Address</Label>
            <Textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Campus postal address"
            />
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} size="sm">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={m.isPending}>
              {m.isPending ? "Registering..." : "Register Institution"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditInstitutionDialog({
  inst,
  open,
  onClose,
}: {
  inst: Institution;
  open: boolean;
  onClose: () => void;
}) {
  const m = useUpdateInstitution(inst.id);
  const [name, setName] = useState(inst.name);
  const [instType, setInstType] = useState(inst.type);
  const [state, setState] = useState(inst.state);
  const [city, setCity] = useState(inst.city);
  const [trust, setTrust] = useState(inst.trustName);
  const [address, setAddress] = useState(inst.address);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    m.mutate(
      {
        name: name.trim(),
        type: instType,
        state: state.trim(),
        city: city.trim(),
        trustName: trust.trim(),
        address: address.trim(),
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Institution Profile</DialogTitle>
          <DialogDescription>
            Update details for {inst.permanentId} ({inst.name}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUpdate} className="space-y-3.5 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Institution Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Institution Type</Label>
            <Select value={instType} onValueChange={setInstType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Trust / Society Name</Label>
            <Input value={trust} onChange={(e) => setTrust(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Campus Address</Label>
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} size="sm">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={m.isPending}>
              {m.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
