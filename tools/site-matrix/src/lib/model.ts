// Turns profiles (repo facts in `detected` + decisions) into what the matrix shows.
import { applyChanges, clone, expandCodes } from "./profile";
import type { CellState, Library, LibraryForm, Need, Pending, Profile, SiteStatus } from "./types";

export interface Cell {
  st: CellState;
  title: string;
  sync?: "live" | "staging" | null;
  note?: string | null;
}
export interface Counts { on: number; todo: number; hold: number; remove: number }
export interface SiteView extends Profile {
  name: string;
  status: SiteStatus;
  formCells: Record<string, Cell>;
  moduleCells: Record<string, Cell>;
  integrationCell: Cell & { label: string; sub: string };
  stats: { forms: Counts; modules: Counts; reuse: number | null };
}
export interface FormRow extends LibraryForm {
  custom?: boolean;
  owner?: string;
  ownerId?: string;
}
export interface Program { name: string; forms: FormRow[] }

export const STATUS_ORDER: Record<string, number> = { live: 0, preparation: 1, planned: 2, closed: 3 };
export const LABEL: Record<CellState, string> = { on: "On", todo: "Needed", hold: "Hold", remove: "Remove?", no: "–", unk: "·", template: "Template" };
export const NEED_TEXT: Record<Need, string> = { needed: "Needed", not_needed: "Not needed", on_hold: "On hold" };

export const MILESTONES: [string, string, string][] = [
  ["requirements", "Requirements complete", "Activities, forms and metadata signed off"],
  ["uat", "UAT ready", "Test server available to users"],
  ["prod", "Production target", "Planned go-live"],
  ["live", "Live since", "Actual go-live"],
  ["handover", "Handover / closure", "Handover or decommission"],
];
// [key, label, hint, editor, profile path]
export const REG_ROWS: [string, string, string, "text" | "list", string][] = [
  ["id_prefix", "MSF ID prefix", "idgen generator", "text", "registration.id_prefix"],
  ["other_ids", "Other identifiers", "Shown at registration", "list", "registration.other_ids"],
  ["extra_fields", "Extra fields", "Beyond name, sex, birth date", "list", "registration.extra_fields"],
  ["address", "Address hierarchy", "Levels, top down", "list", "registration.address"],
  ["languages", "Languages", "UI locales", "list", "registration.languages"],
  ["locations", "Locations", "Login and visit locations", "list", "locations"],
];

export function cellState(need: Need | null | undefined, built: boolean, inRepo: boolean): Cell {
  if (built) {
    if (need === "not_needed") return { st: "remove", title: "Built, but marked not needed" };
    if (need === "on_hold") return { st: "hold", title: "Built, on hold" };
    return { st: "on", title: "In the site build" };
  }
  if (need === "needed") return { st: "todo", title: "Needed, not built yet" };
  if (need === "on_hold") return { st: "hold", title: "On hold" };
  if (need === "not_needed") return { st: "no", title: "Not needed" };
  return inRepo ? { st: "no", title: "Not in the site build" } : { st: "unk", title: "No decision yet" };
}

const empty = (): Counts => ({ on: 0, todo: 0, hold: 0, remove: 0 });

function derive(s: Profile, rows: FormRow[], lib: Library): SiteView {
  const det = s.detected || {};
  const needs = s.needs || {};
  const inRepo = !!s.detected;
  const built = new Set(expandCodes(det.forms));
  const integ = det.integration || null;
  const sync: Record<string, "live" | "staging"> = {};
  if (integ) {
    for (const c of expandCodes(integ.staging_forms)) sync[c] = "staging";
    for (const c of expandCodes(integ.synced_forms)) sync[c] = "live";
  }
  const fNeeds = needs.forms || {};
  const notes = s.form_notes || {};
  const customs = Object.fromEntries((s.custom_forms || []).map((c) => [c.code, c]));
  const formCells: Record<string, Cell> = {};
  const forms = empty();
  let fromLib = 0, fresh = 0;
  for (const r of rows) {
    let need: Need | null | undefined;
    const isBuilt = built.has(r.code);
    if (r.custom) {
      if (r.ownerId !== s.id) { formCells[r.code] = { st: "unk", title: "Site-specific form of " + r.owner }; continue; }
      need = customs[r.code]?.need || "needed";
    } else need = fNeeds[r.code] || (isBuilt ? null : needs.forms_default);
    const x = cellState(need, isBuilt, inRepo);
    const note = notes[r.code] || (r.custom ? customs[r.code]?.note : null) || null;
    formCells[r.code] = { st: x.st, title: x.title + (note ? ". " + note : ""), sync: sync[r.code] || null, note };
    if (x.st in forms) forms[x.st as keyof Counts]++;
    if (x.st === "on" || x.st === "todo") (r.in_library !== false ? fromLib++ : fresh++);
  }
  if (s.registration?.custom_form) fresh++;

  const mBuilt = new Set(det.modules || []);
  const mNeeds = needs.modules || {};
  const moduleCells: Record<string, Cell> = {};
  const modules = empty();
  for (const m of lib.modules) {
    const x = cellState(mNeeds[m.id], mBuilt.has(m.id), inRepo);
    moduleCells[m.id] = x;
    if (x.st in modules) modules[x.st as keyof Counts]++;
  }

  const need = s.integration?.need;
  let integrationCell: SiteView["integrationCell"];
  if (integ?.status === "live") {
    integrationCell = need === "not_needed"
      ? { st: "remove", label: "Remove?", title: "Live, but marked not needed", sub: "" }
      : { st: "on", label: "Live", title: "Production OpenFn workflow enabled", sub: expandCodes(integ.synced_forms).length + " forms synced" };
  } else if (integ) {
    const twin = integ.identical_to?.length ? "Copy, same as " + integ.identical_to.join(", ") : "Triggers off";
    integrationCell = need === "needed"
      ? { st: "todo", label: "Needed", title: "Needed: the OpenFn project is not adapted or its triggers are off", sub: twin }
      : { st: "template", label: "Template", title: "OpenFn project present but not adapted or triggers off", sub: twin };
  } else if (need) {
    const st: CellState = need === "needed" ? "todo" : need === "on_hold" ? "hold" : "no";
    integrationCell = { st, label: LABEL[st], title: NEED_TEXT[need], sub: need === "needed" ? "To set up" : "" };
  } else integrationCell = { st: "unk", label: "·", title: "No decision", sub: "" };

  return {
    ...s,
    name: s.name || s.id,
    status: (s.status || "planned") as SiteStatus,
    formCells, moduleCells, integrationCell,
    stats: { forms, modules, reuse: fromLib + fresh ? Math.round((100 * fromLib) / (fromLib + fresh)) : null },
  };
}

export interface MatrixView { sites: SiteView[]; rows: FormRow[]; programs: Program[] }

export function buildView(base: Record<string, Profile>, pending: Pending, lib: Library): MatrixView {
  const ids = Object.keys(base);
  for (const id of Object.keys(pending)) if (!base[id] && pending[id].__new) ids.push(id);
  const effective = ids.map((id) => applyChanges(clone(base[id]) || ({ id } as Profile), pending[id] || {}));
  // Columns follow the saved status so they do not jump while someone edits.
  const rank = (p: Profile) => STATUS_ORDER[(base[p.id]?.status || p.status || "planned") as string] ?? 9;
  effective.sort((a, b) => rank(a) - rank(b) || String(a.name || a.id).localeCompare(String(b.name || b.id)));

  const rows: FormRow[] = lib.forms.map((f) => ({ ...f, in_library: f.in_library !== false }));
  for (const s of effective) for (const cf of s.custom_forms || []) rows.push({ code: cf.code, name: cf.name, program: cf.program || "Other", custom: true, owner: s.name || s.id, ownerId: s.id, in_library: false });
  const byProg = new Map<string, FormRow[]>();
  for (const r of rows) byProg.set(r.program, [...(byProg.get(r.program) || []), r]);
  const last = (p: string) => (p === "Unassigned" ? 2 : p === "Other" ? 1 : 0);
  const programs = [...byProg.keys()].sort((a, b) => last(a) - last(b) || a.localeCompare(b)).map((name) => ({ name, forms: byProg.get(name)! }));

  return { sites: effective.map((s) => derive(s, rows, lib)), rows, programs };
}

export function programCell(s: SiteView, p: Program): Cell & { label: string } {
  let on = 0, todo = 0, hold = 0, no = 0;
  for (const f of p.forms) {
    const c = s.formCells[f.code];
    if (!c) continue;
    if (c.st === "on") on++; else if (c.st === "todo") todo++; else if (c.st === "hold") hold++; else if (c.st === "no") no++;
  }
  const tot = p.forms.length;
  if (on + todo) return { st: on ? "on" : "todo", label: `${on + todo}/${tot}`, title: `${on} on, ${todo} needed, of ${tot}` };
  if (hold) return { st: "hold", label: "Hold", title: `${hold} on hold` };
  return no ? { st: "no", label: "–", title: "Not needed" } : { st: "unk", label: "·", title: "No decision" };
}

export function regValue(s: Profile, key: string) {
  const plan = key === "locations" ? s.locations : (s.registration as Record<string, unknown> | undefined)?.[key];
  const det = key === "locations" ? s.detected?.locations : (s.detected?.registration as Record<string, unknown> | undefined)?.[key];
  const has = plan != null && plan !== "" && !(Array.isArray(plan) && !plan.length);
  return { plan, det, value: has ? plan : det };
}

// ---- dates
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export interface PDate { date: Date; prec: number }
export function parseDate(d?: string | null): PDate | null {
  if (!d) return null;
  const p = String(d).split("-");
  if (!/^\d{4}$/.test(p[0])) return null;
  return { date: new Date(+p[0], p[1] ? +p[1] - 1 : 0, p[2] ? +p[2] : 1), prec: p.length };
}
export function fmtDate(pd: PDate) {
  const d = pd.date;
  return pd.prec === 1 ? String(d.getFullYear()) : pd.prec === 2 ? `${MON[d.getMonth()]} ${d.getFullYear()}` : `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}
export function daysFromToday(d: Date) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 864e5);
}
export function nextMilestone(s: Profile) {
  let best: { pd: PDate; key: string; label: string } | null = null;
  for (const [key, label] of MILESTONES) {
    const m = s.milestones?.[key];
    if (!m || m.done) continue;
    const pd = parseDate(m.date);
    if (pd && (!best || pd.date < best.pd.date)) best = { pd, key, label };
  }
  return best;
}

export function show(v: unknown): string {
  if (v == null || v === "") return "not set";
  if (Array.isArray(v)) return v.length ? (typeof v[0] === "object" ? `${v.length} item(s)` : v.join(", ")) : "empty";
  if (typeof v === "object") {
    const m = v as { date?: string; done?: boolean; note?: string };
    return [m.date, m.done ? "done" : "", m.note].filter(Boolean).join(", ") || "not set";
  }
  if (typeof v === "boolean") return v ? "yes" : "no";
  return NEED_TEXT[v as Need] || String(v);
}

export function pathLabel(path: string, lib: Library): string {
  let m: RegExpExecArray | null;
  if ((m = /^needs\.forms\.(F\d+)$/.exec(path))) return `${m[1]} ${lib.forms.find((f) => f.code === m![1])?.name || ""}`.trim();
  if ((m = /^needs\.modules\.(.+)$/.exec(path))) return "Module " + (lib.modules.find((x) => x.id === m![1])?.name || m[1]);
  if ((m = /^milestones\.(\w+)$/.exec(path))) return MILESTONES.find((x) => x[0] === m![1])?.[1] || m[1];
  const reg = REG_ROWS.find((r) => r[4] === path);
  if (reg) return reg[1];
  const named: Record<string, string> = {
    status: "Status", phase: "Phase", name: "Site name", country: "Country", open_items: "Open items", notes: "Notes",
    "integration.need": "DHIS2 integration", "integration.dhis2_target": "DHIS2 target", custom_forms: "Site-specific forms",
  };
  return named[path] || path;
}

export function commitMessage(id: string, changes: Record<string, unknown>, before: Profile | undefined, lib: Library, note: string) {
  const items = Object.keys(changes).filter((k) => k !== "__new").map((k) => ({ label: pathLabel(k, lib), from: show(getPathSafe(before, k)), to: show(changes[k]) }));
  const created = changes.__new && !before;
  const title = created
    ? "Add site " + ((changes.__new as Profile).name || id)
    : items.slice(0, 2).map((c) => `${c.label}: ${c.to}`).join("; ") + (items.length > 2 ? ` and ${items.length - 2} more` : "");
  const lines = [`site-matrix(${id}): ${title}`, ""];
  for (const c of items) lines.push(`- ${c.label}: ${c.from} -> ${c.to}`);
  if (note.trim()) lines.push("", note.trim());
  lines.push("", "Edited in the LIME Site Matrix app.");
  return lines.join("\n");
}
function getPathSafe(o: unknown, p: string) {
  let cur: unknown = o;
  for (const k of p.split(".")) { if (cur == null || typeof cur !== "object") return undefined; cur = (cur as Record<string, unknown>)[k]; }
  return cur;
}
