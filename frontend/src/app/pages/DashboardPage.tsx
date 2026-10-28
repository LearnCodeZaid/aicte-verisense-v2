import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBandPill } from "@/components/common/SeverityBadge";
import { getStatusDef } from "@/components/common/StatusBadge";
import { useApplications } from "@/lib/hooks";
import { CATEGORY_SHORT, REGION_LABEL } from "@/lib/labels";
import type { Application } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { ListSkeleton } from "../components/Skeletons";
import { NEEDS_RESPONSE, StageBar } from "../components/StageBar";

const REVIEW_STATUSES = new Set([
  "DEFICIENCIES_FLAGGED",
  "SOURCE_VERIFICATION_PENDING",
  "UNDER_REVIEW",
  "SUBMITTED",
  "UNDER_VALIDATION",
  "INSPECTION_ORDERED",
]);

const SHOWN = 5;

function priority(a: Application) {
  const c = a.counts ?? ({} as Application["counts"]);
  return (c.critical ?? 0) * 100 + (c.major ?? 0) * 10 + (a.riskScore ?? 0);
}

function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}

const RISK_BARS = [
  { band: "HIGH", label: "High risk", color: "bg-red-600" },
  { band: "MEDIUM", label: "Medium risk", color: "bg-amber-500" },
  { band: "LOW", label: "Low risk", color: "bg-emerald-600" },
] as const;

/** One bar showing how the applications split by risk. Counts are written out so colour is never the only cue. */
function RiskSplit({ apps }: { apps: Application[] }) {
  const counts = RISK_BARS.map((r) => ({ ...r, n: apps.filter((a) => a.riskBand === r.band).length }));
  const total = counts.reduce((s, c) => s + c.n, 0);
  if (!total) return null;
  return (
    <section aria-label="Applications by risk">
      <div
        role="img"
        aria-label={counts.map((c) => `${c.n} ${c.label.toLowerCase()}`).join(", ")}
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        {counts.map((c) => (c.n ? <div key={c.band} className={c.color} style={{ width: `${(c.n / total) * 100}%` }} /> : null))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        {counts.map((c) => (
          <li key={c.band} className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", c.color)} aria-hidden />
            <span className="font-medium text-foreground">{c.n}</span> {c.label.toLowerCase()}
          </li>
        ))}
      </ul>
    </section>
  );
}

function reason(a: Application, mode: "staff" | "director") {
  const c = a.counts ?? ({} as Application["counts"]);
  const issues =
    (c.critical ?? 0) > 0
      ? plural(c.critical, "critical issue")
      : (c.major ?? 0) > 0
        ? plural(c.major, "major issue")
        : "No serious issues";
  const state = mode === "director" ? "Waiting for your decision" : getStatusDef(a.status, "application").label;
  return `${state} · ${issues}`;
}

function Row({ a, mode }: { a: Application; mode: "staff" | "director" | "institution" }) {
  return (
    <li>
      <Link
        to={`/portal/applications/${a.id}`}
        className="flex items-start gap-4 px-4 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug text-foreground">{a.institution?.name}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {CATEGORY_SHORT[a.category] ?? a.category} · <span className="mono">{a.applicationNo}</span>
          </span>
          {mode === "institution" ? (
            <span className="mt-3 block max-w-sm">
              <StageBar status={a.status} />
              {NEEDS_RESPONSE.has(a.status) && <span className="mt-2 block text-xs font-medium text-red-700">Needs your response</span>}
            </span>
          ) : (
            <span className="mt-1.5 block text-sm text-foreground">{reason(a, mode)}</span>
          )}
        </span>
        {mode !== "institution" && <RiskBandPill band={a.riskBand} />}
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

const ADMIN_LINKS = [
  { to: "/portal/rules", title: "Rules and checklists", body: "Change what the system checks" },
  { to: "/portal/sources", title: "Record sources", body: "See which sources are available" },
  { to: "/portal/audit", title: "Activity log", body: "Who did what, and when" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const apps = useApplications({});
  const role = user?.role;
  const isDirector = role === "REGIONAL_DIRECTOR";
  const isInstitution = role === "INSTITUTION";
  const isAdmin = role === "ADMIN";
  const mode = isInstitution ? "institution" : isDirector ? "director" : "staff";

  const all = useMemo(() => apps.data ?? [], [apps.data]);

  const queue = useMemo(() => {
    if (isDirector) return all.filter((a) => a.status === "RECOMMENDED").sort((x, y) => priority(y) - priority(x));
    if (isInstitution) return all.filter((a) => a.status !== "DECIDED");
    return all
      .filter(
        (a) =>
          REVIEW_STATUSES.has(a.status) &&
          ((a.counts?.critical ?? 0) > 0 || (a.counts?.major ?? 0) > 0 || a.riskBand === "HIGH" || a.status === "SOURCE_VERIFICATION_PENDING"),
      )
      .sort((x, y) => priority(y) - priority(x));
  }, [all, isDirector, isInstitution]);

  const highRisk = queue.filter((a) => a.riskBand === "HIGH").length;
  const needResponse = queue.filter((a) => NEEDS_RESPONSE.has(a.status)).length;

  const headline = isDirector
    ? queue.length
      ? `${plural(queue.length, "decision")} waiting for you.`
      : "No decisions are waiting for you."
    : isInstitution
      ? queue.length
        ? `You have ${plural(queue.length, "open application")}${needResponse ? `. ${needResponse} need${needResponse === 1 ? "s" : ""} your response.` : "."}`
        : "You have no open applications."
      : queue.length
        ? `${plural(queue.length, "application")} need${queue.length === 1 ? "s" : ""} attention${highRisk ? `, ${highRisk} high risk.` : "."}`
        : "Nothing needs your attention right now.";

  const listTitle = isDirector ? "Waiting for your decision" : isInstitution ? "Your applications" : "Needs your attention";
  const primary = isInstitution
    ? { to: "/portal/applications/new", label: "New application" }
    : isDirector
      ? { to: "/portal/applications?status=RECOMMENDED", label: "Review decisions" }
      : { to: "/portal/applications", label: "All applications" };
  const viewAll = isInstitution ? "/portal/my-applications" : primary.to;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        className="mb-0"
        eyebrow={user?.region ? REGION_LABEL[user.region] ?? user.region : undefined}
        title="Dashboard"
        description={apps.isLoading ? "Loading your work…" : headline}
        actions={
          <Button asChild size="sm">
            <Link to={primary.to}>
              {primary.label} <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      {!isInstitution && !apps.isLoading && !apps.isError && <RiskSplit apps={all} />}

      <section aria-label={listTitle}>
        <h2 className="text-lg font-semibold">{listTitle}</h2>
        {apps.isLoading ? (
          <div className="mt-3">
            <ListSkeleton rows={4} />
          </div>
        ) : apps.isError ? (
          <ErrorState error={apps.error} onRetry={() => apps.refetch()} />
        ) : queue.length === 0 ? (
          <EmptyState
            compact
            title="All clear"
            description={isInstitution ? "Start a new application when you are ready." : "Applications that need you will appear here."}
          />
        ) : (
          <>
            <ul className="mt-3 divide-y rounded-lg border bg-card">
              {queue.slice(0, SHOWN).map((a) => (
                <Row key={a.id} a={a} mode={mode} />
              ))}
            </ul>
            {queue.length > SHOWN && (
              <Link to={viewAll} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                See all {queue.length} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </>
        )}
      </section>

      {isAdmin && (
        <section aria-label="Settings">
          <h2 className="text-lg font-semibold">Settings</h2>
          <ul className="mt-3 divide-y rounded-lg border bg-card">
            {ADMIN_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span>
                    <span className="block text-sm font-semibold">{l.title}</span>
                    <span className="block text-xs text-muted-foreground">{l.body}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground">Scores and risk levels help prioritise work. Final decisions rest with the competent authority.</p>
    </div>
  );
}
