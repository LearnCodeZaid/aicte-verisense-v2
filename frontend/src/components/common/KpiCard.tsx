import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "danger" | "warning" | "success" | "info";
  to?: string;
}

// Tone only tints the small icon; the number itself stays neutral so the page stays calm.
const TONE = {
  default: "text-slate-500",
  danger: "text-red-700",
  warning: "text-amber-700",
  success: "text-green-700",
  info: "text-blue-700",
};

export function KpiCard({ label, value, hint, icon: Icon, tone = "default", to }: KpiCardProps) {
  const body = (
    <div className="h-full p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium leading-5 text-muted-foreground">
        {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", TONE[tone])} aria-hidden />}
        <span className="truncate">{label}</span>
      </p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
  const cls = "card-surface block h-full transition-colors";
  return to ? (
    <Link to={to} className={cn(cls, "hover:border-primary-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default KpiCard;
