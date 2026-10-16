// The work still to do per site, as in scripts/site-profiles/gaps.py (same tasks, same ids).
// tests/plan.test.ts checks both against the same fixture.
import type { Library, Profile, Vocab } from "./types";
import type { SitesDoc } from "./profile";

export interface PlanTask {
  id: string;
  site: string;
  kind: "decision" | "site" | "form" | "custom_form" | "module" | "registration" | "location" | "integration";
  item: string;
  action: string;
  owner: "site_team" | "implementer";
  title: string;
  how: string | null;
  done_when: string;
  depends_on?: string[];
  note?: string;
  program?: string;
  current?: unknown;
  spec?: unknown;
}
export interface PlanMilestone { id: string; label: string; date: string; days: number; overdue: boolean }
export interface SitePlan { id: string; name?: string; org?: string; status?: string; next_milestone: PlanMilestone | null; tasks: PlanTask[] }
export interface Plan { format: 1; date: string; sites: SitePlan[] }

const ASK = "Answered by the site team on the site page of the Site Matrix app.";

function expand(codes?: string[]) {
  const out = new Set<string>();
  for (const c of codes || []) {
    const m = /^F(\d+)-F(\d+)$/.exec(c);
    if (!m) { out.add(c); continue; }
    for (let i = +m[1]; i <= +m[2]; i++) out.add("F" + String(i).padStart(2, "0"));
  }
  return out;
}
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const set = (v: unknown) => !!v && !(Array.isArray(v) && !v.length);

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function milestones(s: Profile, labels: Record<string, string>, today: string): PlanMilestone[] {
  const out: PlanMilestone[] = [];
  for (const [id, m] of Object.entries(s.milestones || {})) {
    const date = m?.date;
    if (m?.done || !date || date.length !== 10) continue;
    const days = day(date) - day(today);
    out.push({ id, label: labels[id] || id, date, days, overdue: days < 0 });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function siteTasks(s: Profile, lib: Library, how: Record<string, string>): PlanTask[] {
  const names = Object.fromEntries(lib.forms.map((f) => [f.code, f.name]));
  const mods = Object.fromEntries(lib.modules.map((m) => [m.id, m.name]));
  const sid = s.id;
  const det = s.detected || {};
  const hasFolder = !!det.site_folder;
  const forms = s.forms || {};
  const fneeds: Record<string, string | null | undefined> = {};
  for (const [c, d] of Object.entries(forms)) if (!d.custom) fneeds[c] = d.need;
  const builtF = expand(det.forms), builtM = new Set(det.modules || []);
  const reg = s.registration || {}, dreg = det.registration || {};
  const out: PlanTask[] = [];
  const h = (k: string) => how[k] ?? null;

  const task = (kind: PlanTask["kind"], item: string, action: string, title: string, howText: string | null, doneWhen: string, extra: Partial<PlanTask> = {}) => {
    const t: PlanTask = { id: `${sid}/${kind}/${item}`, site: sid, kind, item, action, owner: kind === "decision" ? "site_team" : "implementer", title, how: howText, done_when: doneWhen };
    if (!hasFolder && kind !== "site" && kind !== "decision") t.depends_on = [`${sid}/site/folder`];
    for (const [k, v] of Object.entries(extra)) if (set(v)) (t as unknown as Record<string, unknown>)[k] = v;
    out.push(t);
  };

  if (s.status === "preparation") {
    const live = s.milestones?.live || {}, prod = s.milestones?.prod || {};
    if (!s.country) task("decision", "country", "decide", "Choose the country", ASK, "country is set in sites.yaml");
    if (!reg.id_prefix && !dreg.id_prefix) task("decision", "id_prefix", "decide", "Choose the MSF ID prefix", ASK, "registration.id_prefix is set in sites.yaml");
    if (!set(reg.languages) && !set(dreg.languages)) task("decision", "languages", "decide", "Choose the languages offered", ASK, "registration.languages is set in sites.yaml");
    if (!prod.date && !live.done) task("decision", "golive", "decide", "Set the planned go-live date", ASK, "milestones.prod.date is set in sites.yaml");
    if (!Object.keys(forms).length && !builtF.size) task("decision", "forms", "decide", "Choose the forms", ASK, "forms is set in sites.yaml");
  }

  if ((s.status === "preparation" || s.status === "live") && !hasFolder) {
    const note = s.forms_default === "not_needed" ? "forms_default is not_needed: in the new pom.xml exclude every form and include only the needed ones." : undefined;
    const after = out.some((t) => t.id === `${sid}/decision/id_prefix`) ? [`${sid}/decision/id_prefix`] : undefined;
    task("site", "folder", "create", `Create the sites/${sid} folder`, h("new_site"), "detected.site_folder is set", { note, depends_on: after });
  }

  for (const c of Object.keys(fneeds).sort()) {
    if (fneeds[c] === "needed" && !builtF.has(c)) task("form", c, "add", `Add form ${c} ${names[c] || ""}`, h("forms"), `${c} is in detected.forms`, { note: forms[c].note || undefined });
  }
  for (const [c, d] of Object.entries(forms)) {
    if (d.custom && (d.need || "needed") === "needed") {
      task("custom_form", c, "build", `Build the site-specific form ${d.name}`, h("custom_forms"), `${c} is replaced by a library code that is in detected.forms`, { note: d.note || undefined, program: d.program });
    }
  }
  if (hasFolder) {
    for (const c of [...builtF].sort()) {
      const n = fneeds[c] || (c in forms ? null : s.forms_default);
      if (n === "not_needed") task("form", c, "remove", `Remove form ${c} ${names[c] || ""} (built, marked not needed)`, h("forms"), `${c} is not in detected.forms`, { note: forms[c]?.note || undefined });
    }
  }

  const mneeds = s.modules || {};
  for (const m of Object.keys(mneeds).sort()) {
    const n = mneeds[m];
    if (n === "needed" && hasFolder && !builtM.has(m)) task("module", m, "enable", `Enable module ${mods[m] || m}`, h("modules"), `${m} is in detected.modules`);
    if (n === "not_needed" && (builtM.has(m) || !hasFolder)) task("module", m, "disable", `Turn off module ${mods[m] || m}`, h("modules"), `${m} is not in detected.modules`);
  }

  if (reg.id_prefix && reg.id_prefix !== dreg.id_prefix) {
    task("registration", "id_prefix", "set", `Set the MSF ID prefix to ${reg.id_prefix}`, h("registration.id_prefix"), `detected.registration.id_prefix is ${reg.id_prefix}`, { current: dreg.id_prefix });
  }
  const langs = reg.languages || [];
  if (langs.some((x) => !(dreg.languages || []).includes(x))) {
    task("registration", "languages", "set", `Offer the languages ${langs.join(", ")}`, h("registration.languages"), `detected.registration.languages has ${langs.join(", ")}`, { current: dreg.languages });
  }
  const known = new Set((dreg.identifiers || []).map((i) => i.name));
  for (const i of reg.identifiers || []) {
    if (!known.has(i.name)) task("registration", "identifier-" + slug(i.name), "add", `Ask for the identifier ${i.name} at registration`, h("registration.identifiers"), `${i.name} is in detected.registration.identifiers`, { spec: i });
  }
  if (reg.custom_form && !hasFolder) {
    task("registration", "custom_form", "build", "Build the site's own registration form", h("registration.extra_fields"), `the registration config in sites/${sid} is site-specific (checked by a person)`, { note: (reg.extra_fields || []).join("; ") });
  }
  const have = det.locations || [];
  for (const loc of s.locations || []) {
    if (!have.some((x) => x === loc || x.startsWith(loc + " "))) task("location", slug(loc), "add", `Add the location ${loc}`, h("locations"), `${loc} is in detected.locations`);
  }

  for (const [iid, i] of Object.entries(s.integrations || {})) {
    if (iid === "dhis2" && i?.need === "needed" && det.integration?.status !== "live") {
      task("integration", iid, "set_up", "Set up DHIS2 reporting (OpenFn)" + (i.target ? ": " + i.target : ""), h("integrations.dhis2"), "detected.integration.status is live", { note: i.note });
    }
  }
  return out;
}

export function buildPlan(sites: Record<string, Profile>, doc: SitesDoc, lib: Library, vocab: Vocab, today = todayIso()): Plan {
  const how = (doc.how_to_apply || {}) as Record<string, string>;
  const labels = Object.fromEntries(vocab.milestones.map((v) => [v.id, v.label]));
  const out: SitePlan[] = [];
  for (const s of Object.values(sites)) {
    const tasks = siteTasks(s, lib, how);
    if (!tasks.length) continue;
    const ms = milestones(s, labels, today);
    out.push({ id: s.id, name: s.name, org: s.org, status: s.status, next_milestone: ms[0] || null, tasks });
  }
  const key = (p: SitePlan) => p.next_milestone?.date || "9999";
  out.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  return { format: 1, date: today, sites: out };
}
