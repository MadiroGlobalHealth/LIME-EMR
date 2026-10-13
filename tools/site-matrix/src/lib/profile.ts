// Read and write docs/site-matrix/sites.yaml exactly like scripts/site-profiles/profiles.py, so
// commits from the app only touch the lines that changed.
import yaml from "js-yaml";
import type { Library, Pending, Profile, SiteChanges } from "./types";

export const DOC_ORDER = ["version", "how_to_apply", "sites", "catalog"];
export const ORDER = [
  "name", "country", "status", "phase", "milestones", "registration", "locations", "services",
  "needs", "form_notes", "custom_forms", "integration", "open_items", "notes",
];
export const HEADER = `# LIME EMR site matrix: the setup and plans of every site, in one file.
#
# Written by the Site Matrix app (tools/site-matrix), where each save is a commit by the person who
# made it, and by scripts/site-profiles/extract.py, which refreshes each site's \`detected\` block.
#
# Under \`sites\`, one entry per site, keyed by its id (the folder name under sites/ once it exists):
#   - everything above \`detected\` is decided by people: status, dates, patient ID and registration,
#     needed forms and modules (\`needs\`), DHIS2 reporting, notes;
#   - \`detected\` is what the repo configures today. It is generated: do not edit it by hand.
# Work still to do for a site = what its decisions ask for that \`detected\` does not show yet.
# \`how_to_apply\` says where each item is configured in the repo. \`catalog\` lists the shared forms
# (distro ampathforms) with their program, and the key modules with their frontend apps.
`;

export type SitesDoc = Record<string, unknown> & { sites?: Record<string, Profile>; catalog?: Library };

export function clone<T>(v: T): T {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}
export function same(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
export function getPath(o: unknown, path: string): unknown {
  let cur: unknown = o;
  for (const k of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
export function setPath(o: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = o;
  for (const k of keys.slice(0, -1)) {
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (value == null) delete cur[last];
  else cur[last] = value;
}

/** YAML dates become ISO strings, like the Python side. */
function plain(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
}

export function parseDoc(text: string): { doc: SitesDoc; sites: Record<string, Profile>; library: Library } {
  const doc = (plain(yaml.load(text.replace(/\r\n/g, "\n"))) || {}) as SitesDoc;
  const sites: Record<string, Profile> = {};
  for (const [id, s] of Object.entries(doc.sites || {})) sites[id] = { ...(s || {}), id };
  const lib = doc.catalog || ({} as Library);
  return { doc, sites, library: { forms: lib.forms || [], modules: lib.modules || [] } };
}

/** One site's entry as written in the file: `id` is the key, `detected` goes last. */
export function siteEntry(meta: Profile): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of ORDER) if (k in meta) o[k] = meta[k];
  for (const k of Object.keys(meta)) if (!(k in o) && k !== "detected" && k !== "id" && k !== "body") o[k] = meta[k];
  if ("detected" in meta) o.detected = meta.detected;
  return o;
}

export function dumpYaml(o: unknown) {
  return yaml.dump(o, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false });
}

export function renderDoc(doc: SitesDoc): string {
  const o: Record<string, unknown> = {};
  for (const k of DOC_ORDER) if (k in doc) o[k] = doc[k];
  for (const k of Object.keys(doc)) if (!(k in o)) o[k] = doc[k];
  o.sites = Object.fromEntries(Object.entries(doc.sites || {}).map(([id, s]) => [id, siteEntry(s)]));
  return HEADER + dumpYaml(o);
}

/** Apply every site's unsaved changes to a parsed file. Returns the ids that changed. */
export function applyPending(doc: SitesDoc, pending: Pending): string[] {
  const sites = (doc.sites ||= {});
  const changed: string[] = [];
  for (const [id, changes] of Object.entries(pending)) {
    const before = sites[id];
    if (!before && !changes.__new) continue;
    const next = applyChanges(clone(before) || ({} as Profile), changes);
    delete (next as Partial<Profile>).id;
    if (!same(siteEntry(next), before ? siteEntry(before) : null)) { sites[id] = next; changed.push(id); }
  }
  return changed;
}

/** Apply unsaved changes to a profile (never touches `detected`). */
export function applyChanges(meta: Profile, changes: SiteChanges) {
  for (const [k, v] of Object.entries(changes)) {
    if (k === "__new") {
      for (const [f, x] of Object.entries(v as object)) if ((meta as Record<string, unknown>)[f] == null) (meta as Record<string, unknown>)[f] = x;
      continue;
    }
    if (k.startsWith("detected")) continue;
    setPath(meta as Record<string, unknown>, k, clone(v));
  }
  if (meta.milestones) for (const m of Object.keys(meta.milestones)) if (!Object.keys(meta.milestones[m] || {}).length) delete meta.milestones[m];
  return meta;
}

export function expandCodes(list?: string[] | null): string[] {
  const out: string[] = [];
  for (const x of list || []) {
    const m = /^F(\d+)-F(\d+)$/.exec(x);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push("F" + String(i).padStart(2, "0"));
    else out.push(x);
  }
  return out;
}

export function slugify(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
