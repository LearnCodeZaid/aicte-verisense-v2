import { Component, lazy, Suspense } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { AuthProvider, homePathFor, useAuth } from "./auth";
import AppShell from "./layout/AppShell";
import { PageSkeleton } from "./components/Skeletons";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/types";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage"));
const InstitutionsPage = lazy(() => import("./pages/InstitutionsPage"));
const ApplicationDetailPage = lazy(() => import("./pages/application/ApplicationDetailPage"));
const NewApplicationPage = lazy(() => import("./pages/wizard/NewApplicationPage"));
const RulesPage = lazy(() => import("./pages/RulesPage"));
const SourcesPage = lazy(() => import("./pages/SourcesPage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageSkeleton />;
  if (!user) return <Navigate to="/portal/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to={homePathFor(user?.role)} replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? homePathFor(user.role) : "/portal/login"} replace />;
}

/** Catches render errors and failed lazy-chunk loads; "Try again" re-renders the page. */
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Portal page failed to render", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunkFailed = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(
      this.state.error.message,
    );
    return (
      <div role="alert" className="mx-auto max-w-md space-y-3 py-16 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-slate-500" aria-hidden />
        <h2 className="text-lg font-semibold text-slate-900">This page could not be loaded</h2>
        <p className="text-sm text-slate-500">
          {chunkFailed
            ? "A new version may have been released or the connection dropped. Reload to continue."
            : "Something went wrong while showing this page. Your data has not been changed."}
        </p>
        <div className="flex justify-center gap-2">
          {/* Lazy imports that failed stay rejected, so a full reload is the reliable retry for them. */}
          <Button onClick={() => (chunkFailed ? window.location.reload() : this.setState({ error: null }))}>
            {chunkFailed ? "Reload" : "Try again"}
          </Button>
          <Button variant="outline" onClick={() => window.location.assign(homePathFor())}>
            Go to home
          </Button>
        </div>
      </div>
    );
  }
}

/** Lazy page: Suspense skeleton + error boundary (reset when the route changes). */
function Page({ el, roles }: { el: ReactNode; roles?: Role[] }) {
  const loc = useLocation();
  const content = (
    <PageErrorBoundary key={loc.pathname}>
      <Suspense fallback={<PageSkeleton />}>{el}</Suspense>
    </PageErrorBoundary>
  );
  return roles ? <RequireRole roles={roles}>{content}</RequireRole> : content;
}

const OFFICER_PLUS: Role[] = ["SCRUTINY_OFFICER", "REGIONAL_DIRECTOR", "ADMIN"];
const INSTITUTION_ONLY: Role[] = ["INSTITUTION"];

export default function PortalApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Page el={<LoginPage />} />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Page roles={OFFICER_PLUS} el={<DashboardPage />} />} />
          <Route path="applications" element={<Page el={<ApplicationsPage />} />} />
          <Route path="institutions" element={<Page el={<InstitutionsPage />} />} />
          <Route path="my-applications" element={<Page roles={INSTITUTION_ONLY} el={<ApplicationsPage mine />} />} />
          <Route path="applications/new" element={<Page roles={INSTITUTION_ONLY} el={<NewApplicationPage />} />} />
          <Route path="applications/:id/edit" element={<Page roles={INSTITUTION_ONLY} el={<NewApplicationPage />} />} />
          <Route path="applications/:id" element={<Page el={<ApplicationDetailPage />} />} />
          <Route path="rules" element={<Page roles={OFFICER_PLUS} el={<RulesPage />} />} />
          <Route path="sources" element={<Page roles={OFFICER_PLUS} el={<SourcesPage />} />} />
          <Route path="alerts" element={<Page el={<AlertsPage />} />} />
          <Route path="audit" element={<Page roles={OFFICER_PLUS} el={<AuditPage />} />} />
          <Route path="*" element={<Page el={<NotFoundPage />} />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
