import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, FilePlus2, FileStack, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBandPill } from "@/components/common/SeverityBadge";
import { StatusBadge, getStatusDef } from "@/components/common/StatusBadge";
import { useApplications, useMeta } from "@/lib/hooks";
import { CATEGORY_LABEL, CATEGORY_SHORT, categoryLabel, REGION_LABEL } from "@/lib/labels";
import type { Application, ApplicationStatus, Id } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isInstitution, useAuth } from "../auth";
import { TableSkeleton } from "../components/Skeletons";
import { NEEDS_RESPONSE, StageBar } from "../components/StageBar";

const STATUSES: ApplicationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_VALIDATION",
  "DEFICIENCIES_FLAGGED",
  "RECTIFICATION_REQUESTED",
  "SOURCE_VERIFICATION_PENDING",
  "UNDER_REVIEW",
  "INSPECTION_ORDERED",
  "RECOMMENDED",
  "DECIDED",
];

type SortKey = "applicationNo" | "institution" | "status" | "complianceScore" | "riskScore" | "critical" | "updatedAt";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "riskScore", label: "Risk" },
  { value: "critical", label: "Critical / major findings" },
  { value: "updatedAt", label: "Last updated" },
  { value: "complianceScore", label: "Compliance" },
  { value: "status", label: "Status" },
  { value: "applicationNo", label: "Application no." },
  { value: "institution", label: "Institution" },
];

function sortVal(a: Application, k: SortKey): string | number {
  switch (k) {
    case "institution":
      return a.institution?.name ?? "";
    case "critical":
      return (a.counts?.critical ?? 0) * 1000 + (a.counts?.major ?? 0);
    case "updatedAt":
      return +new Date(a.updatedAt);
    case "status":
      return STATUSES.indexOf(a.status);
    default:
      return (a as any)[k] ?? 0;
  }
}

export default function ApplicationsPage({ mine = false }: { mine?: boolean }) {
  const { user } = useAuth();
  const inst = isInstitution(user?.role);
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const filters = {
    status: sp.get("status") ?? undefined,
    category: sp.get("category") ?? undefined,
    region: sp.get("region") ?? undefined,
    riskBand: sp.get("riskBand") ?? undefined,
    q: sp.get("q") ?? undefined,
  };
  const [qDraft, setQDraft] = useState(filters.q ?? "");
  useEffect(() => setQDraft(filters.q ?? ""), [filters.q]);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: inst ? "updatedAt" : "riskScore", dir: -1 });
  const meta = useMeta();
  const apps = useApplications(filters);

  const rows = useMemo(() => {
    const list = [...(apps.data ?? [])];
    list.sort((a, b) => {
      const va = sortVal(a, sort.k);
      const vb = sortVal(b, sort.k);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
    return list;
  }, [apps.data, sort]);

  function setFilter(k: string, v: string | undefined) {
    const next = new URLSearchParams(sp);
    if (!v || v === "ALL") next.delete(k);
    else next.set(k, v);
    setSp(next, { replace: true });
  }

  const hasFilters = Object.values(filters).some(Boolean);
  const categories = useMemo(
    () =>
      meta.data?.categories?.length
        ? meta.data.categories
        : (Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map((id) => ({ id, label: CATEGORY_LABEL[id] })),
    [meta.data],
  );
  const moreCount = (filters.category ? 1 : 0) + (!inst && filters.region ? 1 : 0);

  const toggleSort = useCallback(
    (k: SortKey) => setSort((s) => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : -1 })),
    [],
  );
  const openApp = useCallback((id: Id) => nav(`/portal/applications/${id}`), [nav]);

  const header = (k: SortKey, label: string, cls?: string) => (
    <TableHead className={cls} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => toggleSort(k)}
      >
        {label}
        {sort.k === k ? sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={mine ? "My applications" : "Applications"}
        description={
          inst
            ? "Approval applications submitted by your institution, with their validation status and open findings."
            : "Applications in your jurisdiction. Sort by risk or findings to prioritise scrutiny."
        }
        actions={
          inst && (
            <Button asChild size="sm">
              <Link to="/portal/applications/new">
                <FilePlus2 className="mr-1.5 h-4 w-4" /> New application
              </Link>
            </Button>
          )
        }
      />

      <div className="card-surface">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <form
            className="relative min-w-[220px] flex-1"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setFilter("q", qDraft.trim() || undefined);
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onBlur={() => qDraft.trim() !== (filters.q ?? "") && setFilter("q", qDraft.trim() || undefined)}
              placeholder="Search application no., institution, permanent ID"
              className="h-9 pl-8"
              aria-label="Search applications"
            />
          </form>
          <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter("status", v)}
            options={STATUSES.map((s) => ({ value: s, label: getStatusDef(s, "application").label }))} />
          {!inst && (
            <FilterSelect label="Risk" value={filters.riskBand} onChange={(v) => setFilter("riskBand", v)}
              options={["HIGH", "MEDIUM", "LOW"].map((r) => ({ value: r, label: r.charAt(0) + r.slice(1).toLowerCase() }))} />
          )}
          {!inst && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <SlidersHorizontal className="mr-1.5 h-4 w-4" /> More filters
                {moreCount > 0 && <span className="ml-1.5 rounded-full bg-primary-600 px-1.5 text-xs text-white">{moreCount}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <FilterSelect block label="Category" value={filters.category} onChange={(v) => setFilter("category", v)}
                options={categories.map((c) => ({ value: c.id, label: c.label }))} />
              {!inst && (
                <FilterSelect block label="Region" value={filters.region} onChange={(v) => setFilter("region", v)}
                  options={Object.entries(REGION_LABEL).map(([k, v]) => ({ value: k, label: `${k} · ${v}` }))} />
              )}
            </PopoverContent>
          </Popover>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQDraft("");
                setSp(new URLSearchParams(), { replace: true });
              }}
            >
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
          <div className={cn("w-full items-center gap-2 md:hidden", inst ? "hidden" : "flex")}>
            <label htmlFor="apps-sort" className="text-xs text-muted-foreground">Sort by</label>
            <select
              id="apps-sort"
              className="h-9 flex-1 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={sort.k}
              onChange={(e) => setSort({ k: e.target.value as SortKey, dir: -1 })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label={sort.dir === 1 ? "Ascending, switch to descending" : "Descending, switch to ascending"}
              onClick={() => setSort((s) => ({ ...s, dir: (-s.dir) as 1 | -1 }))}
            >
              {sort.dir === 1 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div aria-live="polite">
          {apps.isLoading ? (
            <TableSkeleton rows={8} cols={4} />
          ) : apps.isError ? (
            <ErrorState error={apps.error} onRetry={() => apps.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileStack}
              title={hasFilters ? "No applications match these filters" : "No applications yet"}
              description={
                hasFilters
                  ? "Try removing a filter or searching with a different term."
                  : inst
                    ? "Start a new application to upload documents and run a pre-submission check."
                    : "Applications in your jurisdiction will appear here once institutions submit them."
              }
              action={
                inst && !hasFilters ? (
                  <Button asChild size="sm">
                    <Link to="/portal/applications/new">New application</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {inst ? (
                <ul className="divide-y">
                  {rows.map((a) => (
                    <InstitutionRow key={a.id} a={a} />
                  ))}
                </ul>
              ) : (
                <>
                  <ul className="divide-y md:hidden">
                    {rows.map((a) => (
                      <ApplicationCard key={a.id} a={a} />
                    ))}
                  </ul>
                  <Table className="hidden md:table">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        {header("institution", "Application")}
                        {header("status", "Status")}
                        {header("riskScore", "Risk")}
                        {header("critical", "Issues", "text-right")}
                        <TableHead className="w-8">
                          <span className="sr-only">Open</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((a) => (
                        <ApplicationRow key={a.id} a={a} onOpen={openApp} />
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
              <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                {rows.length} application{rows.length === 1 ? "" : "s"}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FindingCounts({ a }: { a: Application }) {
  return (
    <>
      <span className={cn("font-semibold", (a.counts?.critical ?? 0) > 0 ? "text-red-700" : "text-muted-foreground")}>
        {a.counts?.critical ?? 0}
      </span>
      <span className="text-muted-foreground"> / </span>
      <span className={cn((a.counts?.major ?? 0) > 0 ? "font-medium text-orange-700" : "text-muted-foreground")}>
        {a.counts?.major ?? 0}
      </span>
    </>
  );
}

const ApplicationRow = memo(function ApplicationRow({ a, onOpen }: { a: Application; onOpen: (id: Id) => void }) {
  return (
    <TableRow className="cursor-pointer" onClick={() => onOpen(a.id)}>
      <TableCell className="min-w-[260px]">
        <Link
          to={`/portal/applications/${a.id}`}
          onClick={(e) => e.stopPropagation()}
          className="block rounded-sm font-semibold leading-snug text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {a.institution?.name}
        </Link>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {CATEGORY_SHORT[a.category] ?? categoryLabel(a.category)} · <span className="mono">{a.applicationNo}</span>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={a.status} kind="application" />
      </TableCell>
      <TableCell>
        <RiskBandPill band={a.riskBand} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-right text-sm">
        {(a.counts?.critical ?? 0) > 0 ? (
          <span className="font-semibold text-red-700">{a.counts.critical} critical</span>
        ) : (a.counts?.major ?? 0) > 0 ? (
          <span className="font-medium text-orange-700">{a.counts.major} major</span>
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </TableCell>
      <TableCell className="w-8 pl-0">
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </TableCell>
    </TableRow>
  );
});

const InstitutionRow = memo(function InstitutionRow({ a }: { a: Application }) {
  return (
    <li>
      <Link
        to={`/portal/applications/${a.id}`}
        className="flex items-start gap-4 px-4 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug text-foreground">
            {CATEGORY_SHORT[a.category] ?? categoryLabel(a.category)} · AY {a.academicYear}
          </span>
          <span className="mono mt-0.5 block text-xs text-muted-foreground">{a.applicationNo}</span>
          <span className="mt-3 block max-w-sm">
            <StageBar status={a.status} />
            {NEEDS_RESPONSE.has(a.status) && <span className="mt-2 block text-xs font-medium text-red-700">Needs your response</span>}
          </span>
        </span>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
});

const ApplicationCard = memo(function ApplicationCard({ a }: { a: Application }) {
  return (
    <li>
      <Link
        to={`/portal/applications/${a.id}`}
        className="block space-y-2 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="mono font-medium text-primary-600">{a.applicationNo}</span>
          <RiskBandPill band={a.riskBand} score={a.riskScore} />
        </div>
        <div className="truncate text-sm font-medium">{a.institution?.name}</div>
        <div className="text-xs text-muted-foreground">
          {CATEGORY_SHORT[a.category] ?? categoryLabel(a.category)} · AY {a.academicYear}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusBadge status={a.status} kind="application" />
          <span className="text-xs text-muted-foreground">
            Critical / major:{" "}
            <span className="tabular">
              <FindingCounts a={a} />
            </span>
          </span>
        </div>
      </Link>
    </li>
  );
});

function FilterSelect({
  label,
  value,
  onChange,
  options,
  block,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  options: { value: string; label: string }[];
  block?: boolean;
}) {
  const select = (
    <Select value={value ?? "ALL"} onValueChange={(v) => onChange(v === "ALL" ? undefined : v)}>
      <SelectTrigger
        className={cn("h-9 gap-2 text-sm", block ? "w-full" : "w-auto min-w-[140px]", value && "border-primary-600/50 bg-navy-50")}
        aria-label={label}
      >
        {!block && <span className="text-muted-foreground">{label}:</span>}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  if (!block) return select;
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {select}
    </div>
  );
}
