import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  GitCompareArrows,
  Landmark,
  Link2,
  Lightbulb,
  Lock,
  ScanSearch,
  ShieldAlert,
  SlidersHorizontal,
  UserCheck,
  KeyRound,
} from "lucide-react";
import { Container, Section } from "../components/Section";
import { PipelineDiagram } from "../components/PipelineDiagram";
import { SAFEGUARDS, PIPELINE_STEPS } from "../data/content";

const SAFEGUARD_ICONS = [UserCheck, KeyRound, Link2, Lightbulb, SlidersHorizontal, Lock];

const SIX_QUESTIONS = [
  { Icon: ClipboardCheck, q: "Is the application complete?", a: "Every document and field the category requires, checked against its checklist." },
  { Icon: FileCheck2, q: "Are the documents valid and relevant?", a: "Type, expiry and issuer, confirmed against the issuing authority where a source exists." },
  { Icon: GitCompareArrows, q: "Does the information match other records?", a: "Declared values compared with AICTE's records and across the documents themselves." },
  { Icon: ScanSearch, q: "Has anything been altered or duplicated?", a: "Edit, signature and duplicate indicators. Always shown as indicators, never as verdicts." },
  { Icon: Landmark, q: "Do regulatory requirements appear satisfied?", a: "Configurable Handbook norms, each finding tied to its rule and clause." },
  { Icon: ShieldAlert, q: "Does anything need further verification?", a: "What to confirm, rectify or inspect in person. Routed to the officer, never decided." },
];

export default function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#071B36] text-white">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(60rem 30rem at 85% -10%, rgba(232,119,46,0.18), transparent 60%), radial-gradient(50rem 30rem at -10% 110%, rgba(29,78,137,0.55), transparent 60%)",
          }}
        />
        <Container className="relative grid grid-cols-1 items-center gap-12 py-14 sm:py-20 lg:grid-cols-[0.95fr,1.05fr] lg:gap-12 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F4A66F]" aria-hidden />
              Smart India Hackathon 2026 · PS 26261 · AICTE
            </p>
            <h1 className="mt-5 text-[2.3rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Approval documents, checked against the <span className="text-[#F4A66F]">evidence.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-blue-100/90 sm:text-lg">
              VeriSense reads every document an institution submits, compares it with AICTE's records and the issuing authority, and
              marks exactly what does not match, on the page itself. Officers decide.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link
                to="/portal/login"
                className="group rounded-xl bg-white p-4 text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF3FA] text-[#0B2E59]">
                  <FileSearch className="h-5 w-5" aria-hidden />
                </span>
                <span className="mt-3 block font-semibold">I review applications</span>
                <span className="mt-0.5 block text-sm text-slate-600">See what was found, problem by problem, and decide.</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#C25E1B]">
                  Open officer workspace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
              <Link
                to="/portal/login"
                className="group rounded-xl border border-white/15 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
                <span className="mt-3 block font-semibold">I am an institution</span>
                <span className="mt-0.5 block text-sm text-blue-100/80">Upload documents and fix gaps before you submit.</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#F4A66F]">
                  Check my application <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </div>
            <p className="mt-4 text-xs text-blue-200/70">Prototype with synthetic data. Automated results are advisory; AICTE officials make every decision.</p>
          </div>

          <figure className="relative">
            <div className="overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-white/10">
              <div className="flex items-center gap-2 border-b bg-slate-50 px-3 py-2">
                <span className="flex gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                </span>
                <span className="ml-1 truncate text-[11px] font-medium text-slate-600">Land document · sale deed extract</span>
                <span className="ml-auto shrink-0 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                  Mismatch detected
                </span>
              </div>
              <img
                src="/landing/evidence.png"
                alt="A sale deed with the survey number and land area outlined in red, each labelled with what the official record says."
                width={1638}
                height={1120}
                className="block h-auto w-full"
                fetchPriority="high"
              />
            </div>
            <figcaption className="mt-3 text-xs text-blue-200/80">
              Real output on a synthetic, deliberately altered document. Red values differ from the record; green values match it.
            </figcaption>
          </figure>
        </Container>
      </section>

      {/* The six questions */}
      <Section
        id="questions"
        eyebrow="What it answers"
        title="The six questions every scrutiny starts with"
        intro="Each answer carries its evidence, says how sure the system is, and never approves or rejects anything on its own."
      >
        <div className="grid items-start gap-10 lg:grid-cols-[1fr,1.05fr]">
          <ol className="grid gap-4 sm:grid-cols-2">
            {SIX_QUESTIONS.map(({ Icon, q, a }, i) => (
              <li key={q} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EEF3FA] text-[#0B2E59]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="vs-mono text-xs text-slate-400">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-snug text-slate-900">{q}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{a}</p>
              </li>
            ))}
          </ol>
          <figure>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <img
                src="/landing/summary.png"
                alt="The Application Verification Summary: six questions, each with a status, a one-line reason and its basis."
                loading="lazy"
                className="block h-auto w-full"
              />
            </div>
            <figcaption className="mt-3 text-xs text-slate-500">The summary an officer sees first, from a real application in the demo data.</figcaption>
          </figure>
        </div>
      </Section>

      {/* Flow */}
      <Section
        id="flow"
        eyebrow="End to end"
        title="From application to decision"
        intro="Steps one to six run automatically on submission. Steps seven and eight belong to AICTE officials."
      >
        <PipelineDiagram />
        <ol className="mt-8 hidden gap-x-6 gap-y-5 lg:grid lg:grid-cols-4">
          {PIPELINE_STEPS.map((s, i) => (
            <li key={s.short} className="text-sm">
              <span className="vs-mono text-xs text-slate-400">{String(i + 1).padStart(2, "0")}</span>
              <p className="font-semibold text-slate-900">{s.label}</p>
              <p className="mt-1 text-slate-600">{s.detail}</p>
            </li>
          ))}
        </ol>
        <Link to="/how-it-works" className="mt-6 inline-flex items-center gap-1 rounded text-sm font-semibold text-[#1D4E89] hover:underline">
          Walk through each step <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Section>

      {/* Safeguards */}
      <Section
        id="safeguards"
        tone="navy"
        eyebrow="Safeguards"
        title="Built to support officials, not to replace them"
        intro="Configurability, authorised access, data protection, explainability and human authority over decisions are part of the design."
      >
        <div className="grid gap-px overflow-hidden rounded-lg bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {SAFEGUARDS.map((s, i) => {
            const Icon = SAFEGUARD_ICONS[i];
            return (
              <div key={s.title} className="bg-[#0B2E59] p-6">
                <Icon className="h-5 w-5 text-[#F4A66F]" aria-hidden />
                <h3 className="mt-3 font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-blue-100">{s.body}</p>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
