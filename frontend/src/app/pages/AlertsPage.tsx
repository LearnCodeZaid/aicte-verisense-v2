import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { SeverityBadge, severityDot } from "@/components/common/SeverityBadge";
import { useAlerts, useMarkAlertRead } from "@/lib/hooks";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { humanize, SEVERITY_ORDER } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function AlertsPage() {
  const q = useAlerts();
  const mark = useMarkAlertRead();
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [sev, setSev] = useState<string>("ALL");

  // Highest severity first, then newest first.
  const all = useMemo(() => {
    const rank = (s: string) => {
      const i = SEVERITY_ORDER.indexOf(s as (typeof SEVERITY_ORDER)[number]);
      return i < 0 ? SEVERITY_ORDER.length : i;
    };
    return [...(q.data ?? [])].sort(
      (a, b) => rank(a.severity) - rank(b.severity) || +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  }, [q.data]);
  const unread = useMemo(() => all.filter((a) => !a.read), [all]);
  const shown = useMemo(
    () => all.filter((a) => (filter === "all" || !a.read) && (sev === "ALL" || a.severity === sev)),
    [all, filter, sev],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Things that need your attention, most serious first."
        actions={
          (
            <Button size="sm" variant="outline" disabled={q.isLoading || unread.length === 0 || mark.isPending} onClick={() => unread.forEach((a) => mark.mutate(a.id))}>
              <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all read
            </Button>
          )
        }
      />
      <div className="card-surface">
        <div className="flex flex-wrap items-center gap-2 border-b p-3 sm:gap-3">
          <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as "all" | "unread")} className="rounded-md border p-0.5" aria-label="Read status">
            <ToggleGroupItem value="unread" className="h-8 px-2.5 text-xs tabular-nums data-[state=on]:bg-navy data-[state=on]:text-white">
              Unread ({unread.length})
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="h-8 px-2.5 text-xs tabular-nums data-[state=on]:bg-navy data-[state=on]:text-white">
              All ({all.length})
            </ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup type="single" value={sev} onValueChange={(v) => v && setSev(v)} className="max-w-full flex-wrap rounded-md border p-0.5" aria-label="Severity">
            {["ALL", ...SEVERITY_ORDER].map((s) => (
              <ToggleGroupItem key={s} value={s} className="h-8 px-2.5 text-xs data-[state=on]:bg-navy data-[state=on]:text-white">
                {s === "ALL" ? "Any severity" : humanize(s)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {q.isLoading ? (
          <ul className="divide-y" aria-busy="true" aria-label="Loading alerts">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index} className="h-[88px] space-y-2 px-4 py-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-28" />
              </li>
            ))}
          </ul>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === "unread" ? "You're all caught up" : "No alerts"}
            description={
              filter === "unread" && all.length > 0
                ? 'Choose "All" to review alerts you have already read.'
                : "New alerts will appear here when an application needs attention."
            }
          />
        ) : (
          <ul className="divide-y" aria-live="polite">
            {shown.map((a) => (
              <li key={a.id} className={cn("flex items-start gap-3 px-4 py-3", !a.read && "bg-navy-50/40")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", severityDot(a.severity))} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-xs text-muted-foreground">{humanize(a.type)}</span>
                    <span className="ml-auto text-xs text-muted-foreground" title={fmtDateTime(a.createdAt)}>
                      {fmtRelative(a.createdAt)}
                    </span>
                  </div>
                  <p className={cn("mt-1 break-words text-sm", !a.read && "font-medium")}>{a.message}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <Link
                      to={`/portal/applications/${a.applicationId}`}
                      className="mono rounded-sm text-primary-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                      onClick={() => !a.read && mark.mutate(a.id)}
                    >
                      View application {a.applicationNo}
                    </Link>
                    {!a.read && (
                      <button
                        type="button"
                        className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                        onClick={() => mark.mutate(a.id)}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
