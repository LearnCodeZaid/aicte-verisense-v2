import { cn } from "@/lib/utils";

interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Kept for compatibility: removes body spacing/padding handling for edge-to-edge content. */
  flush?: boolean;
  id?: string;
}

/** Minimal section: optional title/description on the left, action slot on the right, no card chrome. */
export function Panel({ title, description, actions, children, className, bodyClassName, flush, id, ...rest }: PanelProps) {
  return (
    <section id={id} {...rest} className={cn("flex min-w-0 flex-col gap-3", className)}>
      {(title || description || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(flush ? "overflow-hidden rounded-md border" : "", "min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KV({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="kv-label">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}
