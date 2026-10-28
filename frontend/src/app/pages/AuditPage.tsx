import { useMemo, useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { useAudit } from "@/lib/hooks";
import { humanize } from "@/lib/labels";
import { AuditTimeline, ChainVerifyButton } from "../components/AuditTimeline";
import { Panel } from "../components/Panel";
import { TableSkeleton } from "../components/Skeletons";

export default function AuditPage() {
  const [entityId, setEntityId] = useState("");
  const [applied, setApplied] = useState("");
  const [action, setAction] = useState("ALL");
  const [actor, setActor] = useState("");
  const [limit, setLimit] = useState(200);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const q = useAudit({ entityId: applied || undefined, action: action === "ALL" ? undefined : action, limit });
  const all = q.data ?? [];
  const actions = useMemo(() => [...new Set(all.map((e) => e.action))].sort(), [all]);
  const events = useMemo(() => {
    const from = dateFrom ? +new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? +new Date(`${dateTo}T23:59:59.999`) : null;
    const needle = actor.trim().toLowerCase();
    return all
      .filter((e) => !needle || `${e.actor} ${e.actorRole}`.toLowerCase().includes(needle))
      .filter((e) => {
        const t = +new Date(e.ts);
        return (from === null || t >= from) && (to === null || t <= to);
      })
      .sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
  }, [all, actor, dateFrom, dateTo]);

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="A record of who did what, when, and on which application. Entries cannot be edited: each is linked to the one before it, so any change breaks the chain. Open Technical details on an entry to see its hashes and raw data."
        actions={<ChainVerifyButton />}
      />
      <Panel
        flush
        title={
          <span className="flex flex-wrap items-center gap-2">
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                setApplied(entityId.trim());
              }}
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                onBlur={() => setApplied(entityId.trim())}
                placeholder="Application / record ID"
                className="h-8 w-48 pl-8 font-normal"
                aria-label="Filter by application or record ID"
              />
            </form>
            <Input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Person or role" className="h-8 w-36 font-normal" aria-label="Filter by person or role" />
            <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-auto font-normal" aria-label="From date" />
            <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-auto font-normal" aria-label="To date" />
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-8 w-auto min-w-[180px] font-normal" aria-label="Filter by event type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All event types</SelectItem>
                {(action !== "ALL" && !actions.includes(action) ? [action, ...actions] : actions).map((a) => (
                  <SelectItem key={a} value={a}>
                    {humanize(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="h-8 w-auto font-normal" aria-label="How many recent events to load">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[100, 200, 500, 1000].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Last {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        }
        actions={<span className="text-xs text-muted-foreground" aria-live="polite">{events.length} events</span>}      >
        <div className="p-4">
          {q.isLoading ? (
            <TableSkeleton rows={8} cols={1} />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : events.length === 0 ? (
            <EmptyState icon={ScrollText} title="No events match" description="Try clearing a filter or widening the date range." />
          ) : (
            <AuditTimeline events={events} showEntity />
          )}
        </div>
      </Panel>
    </div>
  );
}
