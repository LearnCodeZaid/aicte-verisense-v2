import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, LogIn } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { NAV } from "../data/content";
import { Container } from "./Section";
import { cn } from "@/lib/utils";

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-3 text-[15px] font-medium transition-colors",
    isActive ? "bg-[#F5F7FA] text-[#0B2E59]" : "text-slate-700 hover:bg-slate-50",
  );

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-sm"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded" aria-label="AICTE VeriSense home">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "relative rounded px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "text-[#0B2E59]" : "text-slate-600 hover:text-[#0B2E59]",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {n.label}
                  {isActive && <span className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-[#E8772E]" aria-hidden />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/portal/login"
            className="hidden items-center gap-2 rounded-md bg-[#0B2E59] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4E89] sm:inline-flex"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Login to Portal
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
            aria-expanded={open}
            aria-controls="site-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </Container>

      {/* Overlays the page (absolute) so opening it never shifts content. */}
      {open && (
        <div
          id="site-mobile-nav"
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-slate-200 bg-white shadow-sm lg:hidden"
        >
          <Container className="py-3">
            <nav aria-label="Mobile" className="flex flex-col gap-0.5">
              <NavLink to="/" end className={mobileLink}>
                Overview
              </NavLink>
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={mobileLink}>
                  {n.label}
                </NavLink>
              ))}
              <Link
                to="/portal/login"
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-md bg-[#0B2E59] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#1D4E89]"
              >
                <LogIn className="h-4 w-4" aria-hidden />
                Login to Portal
              </Link>
            </nav>
          </Container>
        </div>
      )}
    </header>
  );
}
