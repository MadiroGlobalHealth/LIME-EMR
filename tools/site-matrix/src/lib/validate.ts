// Same checks as scripts/site-profiles/profiles.py problems(): the JSON Schema in
// docs/site-matrix/sites.schema.json, then references the schema cannot check (catalog, orgs, vocab).
import Ajv2020 from "ajv/dist/2020";
import schema from "../../../../docs/site-matrix/sites.schema.json";
import { siteEntry, type SitesDoc } from "./profile";
import type { Profile } from "./types";

const check = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

export function problems(doc: SitesDoc): string[] {
  const out: string[] = [];
  // Check the file as written (short form decisions, no `id`).
  const file = { ...doc, sites: Object.fromEntries(Object.entries(doc.sites || {}).map(([id, s]) => [id, siteEntry(s)])) };
  if (!check(file)) {
    for (const e of check.errors || []) {
      if (e.keyword === "oneOf" || e.keyword === "if") continue; // the branch errors below say more
      const where = e.instancePath.replace(/^\//, "") || "(top)";
      const allowed = (e.params as { allowedValues?: unknown[] }).allowedValues;
      out.push(`${where}: ${e.message}${allowed ? ` (${allowed.join(", ")})` : ""}`);
    }
  }
  const forms = new Set((doc.catalog?.forms || []).map((f) => f.code));
  const modules = new Set((doc.catalog?.modules || []).map((m) => m.id));
  const orgs = new Set(Object.keys(doc.orgs || {}));
  const milestones = new Set((doc.vocab?.milestones || []).map((v) => v.id));
  const integrations = new Set((doc.vocab?.integrations || []).map((v) => v.id));
  for (const [id, s] of Object.entries(doc.sites || {}) as [string, Profile][]) {
    if (s.org && !orgs.has(s.org)) out.push(`sites/${id}: org ${s.org} is not in orgs`);
    for (const [code, d] of Object.entries(s.forms || {})) {
      if (!d?.custom && !forms.has(code)) out.push(`sites/${id}: form ${code} is not in catalog.forms (site-specific forms need custom: true)`);
      if (d?.custom && forms.has(code)) out.push(`sites/${id}: site-specific form ${code} uses a library code`);
    }
    for (const m of Object.keys(s.modules || {})) if (!modules.has(m)) out.push(`sites/${id}: module ${m} is not in catalog.modules`);
    for (const m of Object.keys(s.milestones || {})) if (!milestones.has(m)) out.push(`sites/${id}: milestone ${m} is not in vocab.milestones`);
    for (const i of Object.keys(s.integrations || {})) if (!integrations.has(i)) out.push(`sites/${id}: integration ${i} is not in vocab.integrations`);
  }
  return [...new Set(out)];
}
