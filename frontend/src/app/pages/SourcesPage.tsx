import { ChevronDown, CloudOff, Radio, RadioTower } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { useMeta, useSources, useToggleSource } from "@/lib/hooks";
import { fmtNumber } from "@/lib/format";
import { humanize, METHOD_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { isAdmin, useAuth } from "../auth";

function ListSkeleton() {
  return (
    <div className="divide-y rounded-md border bg-card" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-200" />
          <div className="hidden h-4 w-24 animate-pulse rounded bg-slate-200 sm:block" />
        </div>
      ))}
    </div>
  );
}

export default function SourcesPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const q = useSources();
  const meta = useMeta();
  const toggle = useToggleSource();
  const label = (id: string) => meta.data?.docTypes?.find((d) => d.id === id)?.label ?? humanize(id);
  const sources = q.data ?? [];
  const online = sources.filter((s) => s.online).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification sources"
        description="Services used to check documents with the issuing authority. In this prototype every source is SIMULATED, so a result from one is not an official confirmation."
        actions={
          sources.length > 0 && (
            <span className="rounded-md border bg-card px-2.5 py-1 text-xs text-muted-foreground" aria-live="polite">
              <span className="font-semibold text-foreground">{online}</span> of {sources.length} available
            </span>
          )
        }
      />
      {q.isLoading ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : sources.length === 0 ? (
        <EmptyState icon={RadioTower} title="No sources configured" description="Verification sources will be listed here once they are set up." />
      ) : (
        <ul className="divide-y rounded-md border bg-card">
          {sources.map((s) => {
            const rate =
              s.successRate !== null && s.successRate !== undefined ? `${Math.round(s.successRate <= 1 ? s.successRate * 100 : s.successRate)}%` : "—";
            return (
              <li key={s.id} className={cn(!s.online && "bg-slate-50")}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                      s.online ? "bg-green-50 text-green-700" : "bg-slate-200 text-slate-600",
                    )}
                    aria-hidden="true"
                  >
                    {s.online ? <Radio className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold leading-snug">
                      {s.name}
                      <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-amber-800">
                        Simulated
                      </span>
                    </h2>
                    <p className="text-xs text-muted-foreground">{s.issuer}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                      s.online ? "border-green-200 bg-green-50 text-green-800" : "border-slate-300 bg-slate-100 text-slate-700",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", s.online ? "bg-green-600" : "bg-slate-500")} />
                    {s.online ? "Available" : "Unavailable"}
                  </span>
                  <dl className="flex gap-6 text-xs">
                    <div>
                      <dt className="kv-label">Mode</dt>
                      <dd className="mt-0.5 font-medium">{METHOD_LABEL[s.method] ?? s.method}</dd>
                    </div>
                    <div>
                      <dt className="kv-label">Last check</dt>
                      <dd className="tabular mt-0.5 font-medium">
                        {s.lastLatencyMs !== null && s.lastLatencyMs !== undefined ? `Responded in ${fmtNumber(s.lastLatencyMs)} ms` : "Not reported"}
                      </dd>
                    </div>
                  </dl>
                  {admin && (
                    <label className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Simulate outage</span>
                      <Switch
                        checked={!s.online}
                        disabled={toggle.isPending}
                        onCheckedChange={() => toggle.mutate(s.id)}
                        aria-label={`Simulate an outage for ${s.name}`}
                      />
                    </label>
                  )}
                </div>
                <details className="group border-t border-dashed px-4 py-2 text-xs">
                  <summary className="flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                    Technical details
                  </summary>
                  <dl className="mt-2 grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="kv-label">Source ID</dt>
                      <dd className="mt-0.5 break-all font-mono">{s.id}</dd>
                    </div>
                    <div>
                      <dt className="kv-label">Success rate</dt>
                      <dd className="tabular mt-0.5 font-medium">{rate}</dd>
                    </div>
                    <div>
                      <dt className="kv-label">Document types checked</dt>
                      <dd className="mt-1 flex flex-wrap gap-1">
                        {s.docTypes.map((d) => (
                          <span key={d} className="rounded border bg-background px-1.5 py-0.5 text-2xs text-muted-foreground">
                            {label(d)}
                          </span>
                        ))}
                      </dd>
                    </div>
                  </dl>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
