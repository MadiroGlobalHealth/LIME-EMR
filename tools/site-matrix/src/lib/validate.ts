// Same checks as scripts/site-profiles/profiles.py problems(): the JSON Schema in
// docs/site-matrix/sites.schema.json, then references to forms or modules missing from the catalog.
import Ajv2020 from "ajv/dist/2020";
import schema from "../../../../docs/site-matrix/sites.schema.json";
import type { SitesDoc } from "./profile";

const check = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

export function problems(doc: SitesDoc): string[] {
  const out: string[] = [];
  if (!check(doc)) {
    for (const e of check.errors || []) {
      const where = e.instancePath.replace(/^\//, "") || "(top)";
      const allowed = (e.params as { allowedValues?: unknown[] }).allowedValues;
      out.push(`${where}: ${e.message}${allowed ? ` (${allowed.join(", ")})` : ""}`);
    }
  }
  const forms = new Set((doc.catalog?.forms || []).map((f) => f.code));
  const modules = new Set((doc.catalog?.modules || []).map((m) => m.id));
  for (const [id, s] of Object.entries(doc.sites || {})) {
    for (const code of [...Object.keys(s?.needs?.forms || {}), ...Object.keys(s?.form_notes || {})])
      if (!forms.has(code)) out.push(`sites/${id}: form ${code} is not in catalog.forms`);
    for (const m of Object.keys(s?.needs?.modules || {}))
      if (!modules.has(m)) out.push(`sites/${id}: module ${m} is not in catalog.modules`);
  }
  return out;
}
