import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Container, Section, Eyebrow, Pill } from "../components/Section";
import { MODULES, VERIFICATION_STATES, TECH_STACK, FAQ } from "../data/content";
import { SCENARIOS } from "../data/scenarios";

const DETAILS_SUMMARY =
  "flex cursor-pointer items-center justify-between gap-4 rounded py-4 text-left font-medium text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1D4E89]";

export default function About() {
  return (
    <>
      {/* Problem */}
      <Section
        eyebrow="The problem"
        title="Many documents and sources, checked by hand"
        intro="An application bundles certificates from many issuers, alongside data the institution has already filed with AICTE. Today an officer reconciles these by reading each document and comparing it with the others. The figures in this prototype are configurable and are not official AICTE statistics."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["Missed expiries and gaps", "A Fire NOC that lapsed shortly before submission is easy to overlook in a long bundle."],
            ["Inconsistencies", "Declared intake, faculty or land area may not match approved records or the documents."],
            ["Altered or reused documents", "Edited scans and reused certificates need a closer look than a quick glance."],
          ].map(([t, b]) => (
            <div key={t} className="border-l-2 border-[#E8772E] pl-4">
              <h3 className="font-semibold text-slate-900">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{b}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Modules */}
      <Section
        id="modules"
        tone="canvas"
        eyebrow="What VeriSense does"
        title="Five modules, one evidence trail"
        intro="Together they turn an uploaded bundle into a structured, explainable preliminary review for an officer."
      >
        <ol className="divide-y divide-slate-200 border-y border-slate-200">
          {MODULES.map((m, i) => (
            <li key={m.key} className="py-5">
              <details className="group">
                <summary className={DETAILS_SUMMARY.replace("py-4", "py-0")}>
                  <span>
                    <span className="mr-3 text-xs text-slate-400">{i + 1}</span>
                    <span className="text-base font-semibold text-[#0B2E59]">{m.title}</span>
                    <span className="mt-1 block pl-6 text-sm font-normal leading-relaxed text-slate-600">{m.summary}</span>
                  </span>
                  <ChevronDown className="vs-chevron h-4 w-4 shrink-0 text-slate-500 transition-transform" aria-hidden />
                </summary>
                <ul className="mt-3 space-y-1.5 pl-6 text-sm text-slate-700">
                  {m.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ol>
        <Link
          to="/architecture#ps-mapping"
          className="mt-6 inline-flex items-center gap-1 rounded text-sm font-semibold text-[#1D4E89] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1D4E89]"
        >
          See how this maps to the problem statement <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Section>

      {/* Verification states */}
      <Section
        id="states"
        eyebrow="Issuing-authority verification"
        title="Six outcomes, recorded with source and time"
        intro="A document is never silently passed. Every check ends in one of six states, and anything inconclusive goes to an officer. In this prototype the issuing authorities are simulated."
      >
        <ul className="divide-y divide-slate-200 border-y border-slate-200">
          {VERIFICATION_STATES.map((s) => (
            <li key={s.id} className="grid gap-2 py-4 md:grid-cols-[14rem,1fr] md:gap-6">
              <div>
                <StatusBadge status={s.id} kind="verification" size="md" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-900">{s.meaning}</p>
                <p className="mt-1 text-slate-600">
                  <span className="text-slate-500">When: </span>
                  {s.trigger}
                </p>
                <p className="text-slate-600">
                  <span className="text-slate-500">Then: </span>
                  {s.next}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Demo scenarios */}
      <Section
        id="scenarios"
        tone="canvas"
        eyebrow="Try it"
        title="Demo scenarios"
        intro="The portal is seeded with synthetic institutions and applications. Log in with any demo account (password Demo@2026)."
      >
        <ul className="divide-y divide-slate-200 border-y border-slate-200">
          {SCENARIOS.map((s) => (
            <li key={s.key}>
              <details className="group">
                <summary className={DETAILS_SUMMARY}>
                  <span>
                    <span className="block">{s.title}</span>
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      {s.institution} · {s.category} · login <span className="vs-mono">{s.login}</span>
                    </span>
                  </span>
                  <ChevronDown className="vs-chevron h-4 w-4 shrink-0 text-slate-500 transition-transform" aria-hidden />
                </summary>
                <div className="pb-4 text-sm">
                  <p className="leading-relaxed text-slate-600">{s.description}</p>
                  <ul className="mt-2 space-y-1 text-slate-700">
                    {s.expect.map((e) => (
                      <li key={e} className="flex gap-2">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <Link
          to="/portal/login"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-[#0B2E59] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4E89] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4E89]"
        >
          Open the portal <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Section>

      {/* Tech stack */}
      <Section
        id="stack"
        eyebrow="Technology"
        title="Open-source components"
        intro="Built on open-source components that run on a single container host. Document data stays inside the deployment."
      >
        <details className="group max-w-3xl border-y border-slate-200">
          <summary className={DETAILS_SUMMARY}>
            Show the technology stack
            <ChevronDown className="vs-chevron h-4 w-4 shrink-0 text-slate-500 transition-transform" aria-hidden />
          </summary>
          <dl className="space-y-3 pb-5 text-sm">
            {TECH_STACK.map((g) => (
              <div key={g.group} className="grid gap-1 sm:grid-cols-[10rem,1fr] sm:gap-4">
                <dt className="font-medium text-slate-900">{g.group}</dt>
                <dd className="text-slate-600">{g.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </details>
      </Section>

      {/* SIH strip */}
      <section className="border-y border-slate-200 bg-white">
        <Container className="flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Eyebrow>Smart India Hackathon 2026</Eyebrow>
            <p className="mt-2 max-w-2xl text-base font-semibold text-[#0B2E59]">
              Problem Statement 26261: AI-powered application validation, document authentication and regulatory
              compliance verification
            </p>
            <p className="mt-1 text-sm text-slate-600">
              AICTE, Regulation Bureau · Software · Smart Automation
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill>Team VeriSense</Pill>
            <Pill>Open source · MIT</Pill>
            <Pill>Synthetic data only</Pill>
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <Section id="faq" eyebrow="Questions" title="Frequently asked questions">
        <div className="max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
          {FAQ.map((f) => (
            <details key={f.q} className="group">
              <summary className={DETAILS_SUMMARY}>
                {f.q}
                <ChevronDown className="vs-chevron h-4 w-4 shrink-0 text-slate-500 transition-transform" aria-hidden />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
