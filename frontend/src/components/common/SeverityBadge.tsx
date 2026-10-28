import { AlertCircle, AlertTriangle, Info, OctagonAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const SEVERITY: Record<string, { label: string; cls: string; dot: string; icon?: LucideIcon }> = {
  CRITICAL: { label: "Critical", cls: "bg-red-700 text-white border-red-700", dot: "bg-red-700", icon: OctagonAlert },
  MAJOR: { label: "Major", cls: "bg-orange-50 text-orange-800 border-orange-300", dot: "bg-orange-500", icon: AlertTriangle },
  MINOR: { label: "Minor", cls: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-400", icon: AlertCircle },
  INFO: { label: "Info", cls: "bg-blue-50 text-blue-800 border-blue-200", dot: "bg-blue-500", icon: Info },
};

export const SEVERITY_CHART_COLOR: Record<string, string> = {
  CRITICAL: "#B91C1C",
  MAJOR: "#EA580C",
  MINOR: "#D97706",
  INFO: "#1D4ED8",
};

export function severityDot(sev: string) {
  return SEVERITY[sev]?.dot ?? "bg-gray-400";
}

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const s = SEVERITY[severity] ?? { label: severity, cls: "bg-gray-50 text-gray-700 border-gray-200", icon: undefined };
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide",
        s.cls,
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {s.label}
    </span>
  );
}

const RISK: Record<string, string> = {
  LOW: "bg-green-50 text-green-800 border-green-200",
  MEDIUM: "bg-amber-50 text-amber-800 border-amber-300",
  HIGH: "bg-red-50 text-red-800 border-red-300",
};

export function RiskBandPill({ band, score, className }: { band: string; score?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        RISK[band] ?? "bg-gray-50 text-gray-700 border-gray-200",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", band === "HIGH" ? "bg-red-600" : band === "MEDIUM" ? "bg-amber-500" : "bg-green-600")} />
      {band ? band.charAt(0) + band.slice(1).toLowerCase() : "—"} risk
      {score !== undefined && score !== null && <span className="tabular opacity-70">· {Math.round(score)}</span>}
    </span>
  );
}

export default SeverityBadge;
