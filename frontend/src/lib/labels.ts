import type { ApplicationCategory, Role, Severity, VerificationStatus } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  INSTITUTION: "Institution",
  SCRUTINY_OFFICER: "Scrutiny Officer",
  REGIONAL_DIRECTOR: "Regional Director",
  ADMIN: "Administrator",
};

export const REGION_LABEL: Record<string, string> = {
  NR: "Northern Region",
  WR: "Western Region",
  SR: "Southern Region",
  ER: "Eastern Region",
  CR: "Central Region",
  SWR: "South-Western Region",
  SER: "South-Eastern Region",
  NWR: "North-Western Region",
};

export const CATEGORY_LABEL: Record<ApplicationCategory, string> = {
  EOA: "Extension of Approval",
  NEW_INSTITUTION: "New Institution",
  INTAKE_INCREASE: "Increase in Intake",
  NEW_COURSE: "New Course / Programme",
  CHANGE_OF_NAME: "Change of Name",
  CHANGE_OF_SITE: "Change of Site",
  CLOSURE: "Closure",
};

export const CATEGORY_SHORT: Record<ApplicationCategory, string> = {
  EOA: "Extension of approval",
  NEW_INSTITUTION: "New institution",
  INTAKE_INCREASE: "Intake increase",
  NEW_COURSE: "New course",
  CHANGE_OF_NAME: "Name change",
  CHANGE_OF_SITE: "Site change",
  CLOSURE: "Closure",
};

/** The six official verification outcome states (NOT_APPLICABLE is excluded from distributions). */
export const VERIFICATION_STATES: VerificationStatus[] = [
  "VERIFIED",
  "MISMATCH_DETECTED",
  "EXPIRED",
  "VERIFICATION_PENDING",
  "SOURCE_UNAVAILABLE",
  "MANUAL_REVIEW_REQUIRED",
];

export const VERIFICATION_DESCRIPTION: Record<VerificationStatus, string> = {
  VERIFIED: "Details match the issuing authority's record or a valid signed QR code.",
  MISMATCH_DETECTED: "Some submitted values differ from the issuing authority's record.",
  EXPIRED: "The document's validity period has ended, per the source record or the expiry date on the document.",
  VERIFICATION_PENDING: "The check is queued or still running.",
  SOURCE_UNAVAILABLE: "The issuing authority's service could not be reached. Try again later or check manually.",
  MANUAL_REVIEW_REQUIRED: "No automated source exists for this document type, or the result was unclear. An officer should check it.",
  NOT_APPLICABLE: "Source checks do not apply to this document.",
};

export const SEVERITY_ORDER: Severity[] = ["CRITICAL", "MAJOR", "MINOR", "INFO"];

export const FINDING_KIND_LABEL: Record<string, string> = {
  MISSING_DOCUMENT: "Missing document",
  MISSING_FIELD: "Missing field",
  EXPIRED_DOCUMENT: "Expired document",
  INCONSISTENCY: "Inconsistent details",
  RECORD_MISMATCH: "Record mismatch",
  ANOMALY: "Possible alteration (automated)",
  DUPLICATE: "Duplicate",
  VERIFICATION: "Source check",
  COMPLIANCE_GAP: "Compliance gap",
  INFRASTRUCTURE: "Infrastructure",
};

export const METHOD_LABEL: Record<string, string> = {
  API: "Authority service",
  QR_SIGNATURE: "Signed QR",
  DIGILOCKER: "DigiLocker",
  PORTAL: "Portal lookup",
  MANUAL: "Manual",
};

export const DECISION_LABEL: Record<string, string> = {
  APPROVE_FOR_EOA: "Approve for EoA",
  ISSUE_DEFICIENCY_LETTER: "Issue deficiency letter",
  ORDER_INSPECTION: "Order an inspection",
  REJECT: "Reject",
  RECOMMEND_APPROVE_FOR_EOA: "Recommend: approve for EoA",
  RECOMMEND_ISSUE_DEFICIENCY_LETTER: "Recommend: issue deficiency letter",
  RECOMMEND_ORDER_INSPECTION: "Recommend: order inspection",
  RECOMMEND_REJECT: "Recommend: reject",
};

export function humanize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_.]+/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function categoryLabel(c: string | null | undefined): string {
  if (!c) return "";
  return CATEGORY_LABEL[c as ApplicationCategory] ?? humanize(c);
}

export function roleLabel(r: string | null | undefined): string {
  if (!r) return "";
  return ROLE_LABEL[r as Role] ?? humanize(r);
}
