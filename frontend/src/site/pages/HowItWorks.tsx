import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Container, Section, PageHero, AdvisoryMarker } from "../components/Section";
import { FindingCard, EXAMPLE_FINDINGS } from "../components/FindingCard";
import { HOW_STEPS, RULE_EXAMPLE, SCORING, STEP_SUMMARY } from "../data/howItWorks";

const SUMMARY_CLS =
  "flex cursor-pointer items-center justify-between gap-3 rounded py-3 text-sm font-medium text-[#1D4E89] hover:text-[#0B2E59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1D4E89]";

function StepNav() {
  return (
    <nav aria-label="Steps" className="sticky top-16 z-30 border-b border-slate-200 bg-white">
      <Container className="flex gap-1 overflow-x-auto py-2 text-sm [scrollbar-width:none]">
        {HOW_STEPS.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="shrink-0 rounded px-3 py-1.5 font-medium text-slate-600 transition-colors hover:bg-[#F5F7FA] hover:text-[#0B2E59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1D4E89]"
          >
            <span className="mr-1.5 text-xs text-slate-400">{i + 1}</span>
            {s.nav}
          </a>
        ))}
        <a
          href="#findings"
          className="shrink-0 rounded px-3 py-1.5 font-medium text-slate-600 transition-colors hover:bg-[#F5F7FA] hover:text-[#0B2E59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1D4E89]"
        >
          Findings
        </a>
      </Container>
    </nav>
  );
}

export default function HowItWorks() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="What happens to an application, step by step"
        intro="Each document is read and checked, then the application is compared against the checklist and the records AICTE already holds. The result is a list of findings, each linked to its evidence, for an officer to review."
      />
      <StepNav />

      <Section className="py-10 sm:py-12">
        <ol className="max-w-3xl divide-y divide-slate-200">
          {HOW_STEPS.map((s, i) => (
            <li key={s.id} id={s.id} className="scroll-mt-32 py-6 first:pt-0">
              <p className="text-xs font-medium text-slate-500">Step {i + 1}</p>
              <h2 className="mt-1 text-lg font-semibold text-[#0B2E59]">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{STEP_SUMMARY[s.id] ?? s.body}</p>

              <details className="group mt-2 border-t border-slate-100">
                <summary className={SUMMARY_CLS}>
                  Technical detail
                  <ChevronDown className="vs-chevron h-4 w-4 shrink-0 transition-transform" aria-hidden />
                </summary>
                <div className="space-y-4 pb-2 text-sm">
                  <p className="leading-relaxed text-slate-600">{s.body}</p>
                  {s.output && (
                    <p className="border-l-2 border-slate-300 pl-3 text-slate-700">
                      <span className="font-medium text-slate-900">Produces: </span>
                      {s.output}
                    </p>
                  )}
                  <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {s.checks.map((c) => (
                      <li key={c.name} className="px-3 py-2.5">
                        <p className="font-medium text-slate-900">{c.name}</p>
                        <p className="mt-0.5 text-slate-600">{c.detail}</p>
                      </li>
                    ))}
                  </ul>

                  {s.id === "verification" && (
                    <p className="text-xs text-slate-500">
                      Methods: signed QR payloads (Ed25519), registry lookups by reference number, and consent-based
                      retrieval from the issuer's repository, then a fallback to manual review. In this prototype every
                      issuing authority is a simulated service, so results are demonstrations and not official
                      authentication. Real integrations would need authorisation from each authority.
                    </p>
                  )}

                  {s.id === "rules" && (
                    <div className="space-y-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-500">A rule, as configured</p>
                        <pre className="vs-mono mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
                          {RULE_EXAMPLE}
                        </pre>
                        <p className="mt-2 text-xs text-slate-500">
                          Administrators can enable or disable a rule and change its parameters and severity. Each
                          change bumps the ruleset version and is written to the audit log.
                        </p>
                      </div>
                      {SCORING.map((sc) => (
                        <div key={sc.name}>
                          <p className="font-medium text-slate-900">{sc.name}</p>
                          <p className="vs-mono mt-1 break-words text-xs text-slate-700">{sc.formula}</p>
                          <p className="mt-1 text-slate-600">{sc.note}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.id === "review" && (
                    <div>
                      <p className="font-medium text-slate-900">If something needs fixing (rectification)</p>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
                        <li>The officer selects findings and requests rectification with a note. The institution is alerted.</li>
                        <li>The institution uploads corrected documents and marks findings rectified, with its own note.</li>
                        <li>The checks run again on the new uploads against the current ruleset.</li>
                        <li>The officer closes or escalates each finding. The full exchange stays in the audit trail.</li>
                      </ol>
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="findings"
        tone="canvas"
        title="What a finding looks like"
        intro="A finding says what was found, why it matters and where the evidence is. These are illustrative examples."
        className="py-10 sm:py-12"
      >
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {EXAMPLE_FINDINGS.map((f) => (
            <FindingCard key={f.ruleId} f={f} />
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <AdvisoryMarker />
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Forensic and infrastructure findings are preliminary pointers to where a closer look is needed. They are
              not conclusions about authenticity or compliance.
            </p>
          </div>
          <Link
            to="/portal/login"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#0B2E59] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4E89] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4E89]"
          >
            Open the portal <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Section>
    </>
  );
}
