import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/common/Logo";
import { errorMessage } from "@/lib/api";
import { homePathFor, useAuth } from "../auth";

const DEMO_PASSWORD = "Demo@2026";

const DEMO_GROUPS = [
  {
    role: "Institution",
    about: "Uploads documents and sees what needs correcting",
    users: [
      { username: "inst.nvie", name: "Narmada Valley", hint: "Complete, clean application" },
      { username: "inst.piat", name: "Pragati", hint: "Hidden rule violations" },
      { username: "inst.apex", name: "Apex Valley", hint: "Tampered documents" },
    ],
  },
  {
    role: "Scrutiny officer",
    about: "Reviews applications and recommends an action",
    users: [
      { username: "officer.wro", name: "Western region", hint: "Narmada, Pragati" },
      { username: "officer.nro", name: "Northern region", hint: "Apex" },
    ],
  },
  {
    role: "Regional Director",
    about: "Records the final decision",
    users: [{ username: "rd.wro", name: "Western region", hint: "" }],
  },
  {
    role: "Administrator",
    about: "Rules, sources and the activity log",
    users: [{ username: "admin", name: "Administrator", hint: "" }],
  },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={from && from !== "/portal/login" ? from : homePathFor(user.role)} replace />;

  async function doLogin(u: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      const me = await login(u, p);
      nav(from && from !== "/portal/login" ? from : homePathFor(me.role), { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FA]">
      <header className="flex items-center justify-between px-6 py-4">
        <Logo />
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to website
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-6 sm:items-center sm:px-6">
        <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your departmental credentials to open the scrutiny portal.</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              doLogin(username.trim(), password);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={!!error}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                required
              />
            </div>
            <div aria-live="polite">
              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Sign in
            </Button>
            <span className="sr-only" aria-live="polite">
              {busy ? "Signing in" : ""}
            </span>
          </form>

          <details className="group mt-6 border-t pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              Try the demo
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              Demonstration accounts with synthetic data. Every account uses the same password,{" "}
              <span className="mono rounded bg-muted px-1 py-0.5 text-foreground">{DEMO_PASSWORD}</span>. Pick who you want to be, then press Sign in.
            </p>
            <div className="mt-4 space-y-4">
              {DEMO_GROUPS.map((g) => (
                <div key={g.role}>
                  <p className="text-sm font-semibold text-foreground">{g.role}</p>
                  <p className="text-xs text-muted-foreground">{g.about}</p>
                  <ul className="mt-2 divide-y rounded-md border">
                    {g.users.map((d) => {
                      const selected = username === d.username;
                      return (
                        <li key={d.username}>
                          <button
                            type="button"
                            disabled={busy}
                            aria-pressed={selected}
                            onClick={() => {
                              setUsername(d.username);
                              setPassword(DEMO_PASSWORD);
                              setError(null);
                            }}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60 ${
                              selected ? "bg-slate-50" : ""
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block font-medium text-foreground">{d.name}</span>
                              {d.hint && <span className="block text-xs text-muted-foreground">{d.hint}</span>}
                            </span>
                            <span className="mono shrink-0 text-xs text-muted-foreground">{selected ? "Selected" : d.username}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </details>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Prototype using synthetic institutions and documents; not an official AICTE system. Automated outputs are advisory and require
            officer review.
          </p>
        </div>
      </main>
    </div>
  );
}
