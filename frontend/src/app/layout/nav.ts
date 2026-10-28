import {
  Bell,
  Building2,
  FilePlus2,
  FileStack,
  LayoutDashboard,
  type LucideIcon,
  RadioTower,
  ScrollText,
  SlidersHorizontal,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  badge?: "alerts";
}

const STAFF: Role[] = ["SCRUTINY_OFFICER", "REGIONAL_DIRECTOR", "ADMIN"];

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Work",
    items: [
      { to: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: STAFF },
      { to: "/portal/applications", label: "Applications", icon: FileStack, roles: STAFF },
      { to: "/portal/institutions", label: "Institutions", icon: Building2, roles: [...STAFF, "INSTITUTION"] },
      { to: "/portal/my-applications", label: "My applications", icon: FileStack, roles: ["INSTITUTION"] },
      { to: "/portal/applications/new", label: "New application", icon: FilePlus2, roles: ["INSTITUTION"] },
      { to: "/portal/alerts", label: "Alerts", icon: Bell, roles: [...STAFF, "INSTITUTION"], badge: "alerts" },
    ],
  },
  {
    title: "Settings",
    items: [
      { to: "/portal/rules", label: "Rules and checklists", icon: SlidersHorizontal, roles: STAFF },
      { to: "/portal/sources", label: "Record sources", icon: RadioTower, roles: STAFF },
      { to: "/portal/audit", label: "Activity log", icon: ScrollText, roles: STAFF },
    ],
  },
];

export const CRUMB_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  applications: "Applications",
  institutions: "Institutions",
  "my-applications": "My applications",
  new: "New application",
  edit: "Edit",
  rules: "Rules and checklists",
  sources: "Record sources",
  alerts: "Alerts",
  audit: "Activity log",
};
