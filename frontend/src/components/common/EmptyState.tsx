import { AlertCircle, Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
  role?: "status" | "alert";
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact, role = "status" }: EmptyStateProps) {
  return (
    <div role={role} className={cn("flex flex-col items-center justify-center text-center", compact ? "py-5" : "py-10", className)}>
      <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Something went wrong. Please try again.";
  return (
    <EmptyState
      icon={AlertCircle}
      title="We could not load this"
      description={msg}
      className={className}
      role="alert"
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}

export default EmptyState;
