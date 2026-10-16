import * as React from "react";
import { ArrowLeft, Copy, ExternalLink, Github, Info, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useMatrix } from "@/lib/store";
import { applyChanges, clone, dumpYaml, expandCodes, same, siteEntry } from "@/lib/profile";
import { explain, type Commit } from "@/lib/github";
import { fmtDate, MILESTONES, parseDate, REG_ROWS, regText, regValue, type FormRow, type SiteView } from "@/lib/model";
import { countryName } from "@/lib/countries";
import { CountrySelect, OrgSelect } from "./pickers";
import type { Identifier, Milestone, Need, Profile, SiteStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { STATUS_LABEL, StatusBadge } from "./chip";
import { Dhis2Text, formsProgress, NextStep, relDays } from "./site-bits";
import { siteTasks, type PlanTask } from "@/lib/plan";

const STATUS_TEXT = STATUS_LABEL as Record<SiteStatus, string>;
const REG_HINT: Record<string, string> = { id_prefix: "The start of every patient number (MSF ID)" };

export function SitePage({ id, tab, onTab, onBack, onSignIn }: { id: string; tab: string; onTab: (t: string) => void; onBack: () => void; onSignIn: () => void }) {
  const { view, canEdit, source, pending } = useMatrix();
  const s = view.sites.find((x) => x.id === id);
  if (!s) {
    return (
      <div className="grid gap-4">
        <BackButton onBack={onBack} />
        <p className="text-muted-foreground">{source === "loading" ? "Loading…" : "This site does not exist."}</p>
      </div>
    );
  }
  const p = formsProgress(s);
  const unsaved = Object.keys(pending[id] || {}).filter((k) => k !== "__new").length;
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <BackButton onBack={onBack} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1.5">
            <StatusBadge status={s.status} />
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{s.name}</h1>
            <p className="text-muted-foreground">{[countryName(s.country), s.phase].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="grid w-full max-w-xs gap-1.5 text-sm">
            <span className="text-muted-foreground"><NextStep s={s} /></span>
            <Progress value={p.pct} className="h-1.5" aria-label={`${p.on} of ${p.total} forms ready`} />
            <span className="text-muted-foreground">{p.total ? `${p.on} of ${p.total} forms ready` : "No forms chosen yet"}{unsaved ? ` · ${unsaved} unsaved change${unsaved === 1 ? "" : "s"}` : ""}</span>
          </div>
        </div>
      </div>

      {!canEdit && (
        <Alert>
          <Info />
          <AlertTitle>You are viewing this site</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            {source === "github" ? "To change anything, sign in with GitHub. Every change is saved under your name." : "GitHub cannot be reached right now, so this is a saved copy and changes are off."}
            {source === "github" && <Button size="sm" onClick={onSignIn}><Github /> Sign in</Button>}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={onTab} className="gap-5">
        <TabsList className="h-10 w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="overview" className="px-4">Overview</TabsTrigger>
          <TabsTrigger value="forms" className="px-4">Forms</TabsTrigger>
          <TabsTrigger value="modules" className="px-4">Modules</TabsTrigger>
          <TabsTrigger value="history" className="px-4">History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview s={s} /></TabsContent>
        <TabsContent value="forms"><Forms s={s} /></TabsContent>
        <TabsContent value="modules"><Modules s={s} /></TabsContent>
        <TabsContent value="history"><History s={s} /></TabsContent>
      </Tabs>
    </div>
  );
}

const BackButton = ({ onBack }: { onBack: () => void }) => (
  <Button variant="ghost" size="sm" className="-ml-2.5 w-fit text-muted-foreground" onClick={onBack}><ArrowLeft /> All sites</Button>
);

// ---------------------------------------------------------------- overview

function Overview({ s }: { s: SiteView }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <WorkCard s={s} />
      <DatesCard s={s} />
      <RegistrationCard s={s} />
      <IntegrationCards s={s} />
      <NotesCard s={s} />
    </div>
  );
}

const GROUP: Record<string, string> = {
  "site/create": "Create the site in the repo",
  "form/add": "Add forms",
  "form/remove": "Remove forms",
  "custom_form/build": "Build site-specific forms",
  "module/enable": "Turn on modules",
  "module/disable": "Turn off modules",
};

/** What is left: answers the site team owes, then config changes for the implementers (same list as gaps.py). */
function WorkCard({ s }: { s: SiteView }) {
  const { lib } = useMatrix();
  const tasks = siteTasks(s, lib, {});
  const asks = tasks.filter((t) => t.owner === "site_team");
  const groups = new Map<string, PlanTask[]>();
  for (const t of tasks.filter((x) => x.owner === "implementer")) {
    const k = GROUP[`${t.kind}/${t.action}`] ? `${t.kind}/${t.action}` : t.id;
    groups.set(k, [...(groups.get(k) || []), t]);
  }
  return (
    <Card className="gap-4 lg:col-span-2" data-testid="work-card">
      <CardHeader>
        <CardTitle className="text-base">Work left</CardTitle>
        <CardDescription>
          {tasks.length ? "What this page asks for that the site's configuration does not have yet."
            : s.detected?.site_folder ? "Nothing left: the configuration matches everything decided on this page."
            : "Nothing planned yet. Once the status is Preparing, the work to set the site up is listed here."}
        </CardDescription>
      </CardHeader>
      {!!tasks.length && (
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {!!asks.length && (
            <div className="grid content-start gap-2">
              <h3 className="text-sm font-medium">Questions for the site team</h3>
              <ul className="grid gap-1.5 text-sm">
                {asks.map((t) => <li key={t.id} className="flex gap-2"><span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-hold" />{t.title}</li>)}
              </ul>
              <p className="text-xs text-muted-foreground">Answer them on this page; the implementers need them to start.</p>
            </div>
          )}
          {!!groups.size && (
            <div className="grid content-start gap-2">
              <h3 className="text-sm font-medium">For the implementers</h3>
              <ul className="grid gap-1.5 text-sm">
                {[...groups].map(([k, list]) => (
                  <li key={k} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-todo" />
                    <span>
                      {GROUP[k] && list.length > 1 ? <>{GROUP[k]} <span className="text-muted-foreground">({list.length}): {list.map((t) => (t.kind === "custom_form" ? s.forms?.[t.item]?.name : null) || t.item).join(", ")}</span></> : list[0].title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

function Field({ id, label, hint, children, className }: { id: string; label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Text input that writes on blur, only when the text changed. */
function BlurInput({ id, value, onCommit, disabled, ...props }: Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue"> & { id: string; value: string; onCommit: (text: string) => void }) {
  return (
    <Input key={`${id}:${value}`} id={id} defaultValue={value} disabled={disabled}
      onBlur={(e) => { if (e.target.value.trim() !== value.trim()) onCommit(e.target.value.trim()); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} {...props} />
  );
}

function DatesCard({ s }: { s: SiteView }) {
  const { set, canEdit } = useMatrix();
  return (
    <Section title="Status and key dates" description="Dates can be a day (2026-11-30), a month (2026-11) or a year.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="f-status" label="Status">
          <Select value={s.status} onValueChange={(v) => set(s.id, "status", v)} disabled={!canEdit}>
            <SelectTrigger id="f-status" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(STATUS_TEXT) as SiteStatus[]).map((st) => <SelectItem key={st} value={st}>{STATUS_TEXT[st]}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field id="f-phase" label="Current step">
          <BlurInput id="f-phase" value={s.phase || ""} disabled={!canEdit} placeholder="e.g. UAT preparation" onCommit={(t) => set(s.id, "phase", t || null)} />
        </Field>
      </div>
      <div className="grid gap-3">
        {MILESTONES.map(([key, label, hint]) => <MilestoneRow key={key} s={s} k={key} label={label} hint={hint} />)}
      </div>
    </Section>
  );
}

function MilestoneRow({ s, k, label, hint }: { s: SiteView; k: string; label: string; hint: string }) {
  const { set, canEdit } = useMatrix();
  const m: Milestone = s.milestones?.[k] || {};
  const [error, setError] = React.useState("");
  const save = (patch: Partial<Milestone>) => {
    const next: Record<string, unknown> = { ...m, ...patch };
    if (!next.done) delete next.done;
    if (!next.note) delete next.note;
    if (!next.date) { next.date = null; delete next.approx; }
    set(s.id, `milestones.${k}`, !next.date && !next.done && !next.note ? null : next);
  };
  const pd = parseDate(m.date);
  const d = pd && pd.prec === 3 && !m.done ? Math.round((pd.date.getTime() - new Date(new Date().toDateString()).getTime()) / 864e5) : null;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t pt-3 sm:grid-cols-[1fr_9.5rem_auto]">
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor={`ms-${k}`} className="font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}{d !== null && <span className={cn("ml-1", d < 0 ? "text-destructive" : d <= 14 ? "text-hold" : "")}>· {relDays(d)}</span>}{m.note && <> · {m.note}</>}</p>
      </div>
      <BlurInput id={`ms-${k}`} value={m.date || ""} disabled={!canEdit} placeholder="Not set" className="font-mono" aria-invalid={!!error}
        onCommit={(t) => { if (t && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(t)) { setError("Use YYYY-MM-DD, YYYY-MM or YYYY."); return; } setError(""); save({ date: t || null }); }} />
      <Label className="font-normal text-muted-foreground"><Checkbox checked={!!m.done} disabled={!canEdit} onCheckedChange={(c) => save({ done: c === true })} aria-label={`${label} done`} /> Done</Label>
      {error && <p className="col-span-full text-xs text-destructive">{error}</p>}
    </div>
  );
}

function RegistrationCard({ s }: { s: SiteView }) {
  const { set, canEdit } = useMatrix();
  return (
    <Section title="Patient ID and registration" description="What the registration screen asks for. Values from the site's current setup are filled in.">
      {REG_ROWS.map(([key, label, hint, kind, path]) => {
        const v = regValue(s, key);
        const differs = v.plan != null && v.det != null && !same(v.plan, v.det) && !(Array.isArray(v.plan) && !v.plan.length);
        const note = differs && <span className="text-hold">The site's setup still says {regText(key, v.det)}.</span>;
        if (key === "identifiers") {
          return (
            <div key={key} className="grid gap-1.5">
              <Label>{label}</Label>
              <IdentifiersEditor value={(v.value as Identifier[] | null) || []} disabled={!canEdit} onChange={(list) => set(s.id, path, list.length ? list : null)} />
              <p className="text-xs text-muted-foreground">Besides the MSF ID. {note}</p>
            </div>
          );
        }
        const isAddress = key === "address";
        const example = key === "id_prefix" && v.value === s.detected?.registration?.id_prefix ? s.detected?.registration?.id_example : null;
        const help = key === "languages" ? "Language codes separated by commas, e.g. en, fr, ar. " : kind === "list" ? (isAddress ? "Levels from top to bottom, separated by ›. " : "Separate with commas. ") : (REG_HINT[key] || hint) + ". ";
        return (
          <Field key={key} id={`reg-${key}`} label={label}
            hint={<>{help}{example && <>Example: <span className="font-mono">{example}</span>. </>}{note}</>}>
            <BlurInput id={`reg-${key}`} value={regText(key, v.value)} disabled={!canEdit} placeholder="Not set" className={key === "id_prefix" || key === "languages" ? "font-mono" : ""}
              onCommit={(t) => set(s.id, path, !t ? null : kind === "list" ? t.split(isAddress ? /\s*[›>]\s*/ : /\s*,\s*/).filter(Boolean) : t)} />
          </Field>
        );
      })}
    </Section>
  );
}

/** Identifiers asked at registration: name, required or not, format shown to users. */
function IdentifiersEditor({ value, onChange, disabled }: { value: Identifier[]; onChange: (v: Identifier[]) => void; disabled?: boolean }) {
  const update = (i: number, patch: Partial<Identifier>) => {
    const next = value.map((x, j) => (j === i ? { ...x, ...patch } : x)).map((x) => Object.fromEntries(Object.entries(x).filter(([, y]) => y !== "" && y !== undefined)) as unknown as Identifier);
    if (!same(next, value)) onChange(next);
  };
  return (
    <div className="grid gap-2">
      {value.map((x, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <BlurInput id={`idn-${i}`} value={x.name} disabled={disabled} placeholder="Name" aria-label="Identifier name" onCommit={(t) => t ? update(i, { name: t }) : onChange(value.filter((_, j) => j !== i))} />
          <BlurInput id={`idf-${i}`} value={x.format || ""} disabled={disabled} placeholder="Format, e.g. 5 digits" aria-label="Identifier format" className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto" onCommit={(t) => update(i, { format: t || undefined })} />
          <Label className="font-normal text-muted-foreground"><Checkbox checked={!!x.required} disabled={disabled} onCheckedChange={(c) => update(i, { required: c === true })} /> Required</Label>
          <Button variant="ghost" size="icon-sm" aria-label="Remove identifier" disabled={disabled} onClick={() => onChange(value.filter((_, j) => j !== i))}><X /></Button>
        </div>
      ))}
      {!value.length && <p className="text-sm text-muted-foreground">None.</p>}
      {!disabled && <Button variant="outline" size="sm" className="w-fit" onClick={() => onChange([...value, { name: "New identifier", required: false }])}><Plus /> Add an identifier</Button>}
    </div>
  );
}

/** One card per integration listed in `vocab.integrations`; DHIS2 also shows what the repo runs. */
function IntegrationCards({ s }: { s: SiteView }) {
  const { set, canEdit, vocab } = useMatrix();
  return (
    <>
      {vocab.integrations.map((v) => {
        const cur = s.integrations?.[v.id] || {};
        const i = v.id === "dhis2" ? s.detected?.integration : null;
        const workflows = i?.workflows || [];
        return (
          <Section key={v.id} title={v.label} description={v.hint}>
            {v.id === "dhis2" && <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm"><span className="text-muted-foreground">Today</span><Dhis2Text s={s} className="font-medium" /></div>}
            <NeedRow label="Does this site need it?" value={cur.need || null} disabled={!canEdit} onChange={(n) => set(s.id, `integrations.${v.id}.need`, n)} />
            <Field id={`f-int-${v.id}`} label="Where data goes">
              <BlurInput id={`f-int-${v.id}`} value={cur.target || ""} disabled={!canEdit} placeholder={v.id === "dhis2" ? "e.g. Mental Health tracker program" : "Not set"} onCommit={(t) => set(s.id, `integrations.${v.id}.target`, t || null)} />
            </Field>
            <Field id={`f-intn-${v.id}`} label="Note">
              <BlurInput id={`f-intn-${v.id}`} value={cur.note || ""} disabled={!canEdit} placeholder="Not set" onCommit={(t) => set(s.id, `integrations.${v.id}.note`, t || null)} />
            </Field>
            {i && (
              <ul className="grid gap-1 text-sm text-muted-foreground">
                <li>{expandCodes(i.synced_forms).length} forms sent every day{i.staging_forms?.length ? `, ${expandCodes(i.staging_forms).length} more being tested` : ""}.</li>
                {workflows.length > 0 && <li>{workflows.filter((w) => w.enabled).length} of {workflows.length} automatic jobs switched on.</li>}
                {i.identical_to?.length ? <li>Its OpenFn setup is a copy of {i.identical_to.join(", ")} and was not adapted yet.</li> : null}
                {i.version && <li>OpenFn configuration version {i.version}{i.version_date ? ` (${fmtDate(parseDate(i.version_date)!)})` : ""}.</li>}
              </ul>
            )}
          </Section>
        );
      })}
    </>
  );
}

const DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

function NotesCard({ s }: { s: SiteView }) {
  const { set, canEdit } = useMatrix();
  const [reviewError, setReviewError] = React.useState("");
  const setUrl = (id: string, path: string, t: string) => set(id, path, !t ? null : /^https?:\/\//.test(t) ? t : "https://" + t);
  return (
    <Section title="Site details and notes">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="f-name" label="Site name"><BlurInput id="f-name" value={s.name} disabled={!canEdit} onCommit={(t) => set(s.id, "name", t || null)} /></Field>
        <Field id="f-country" label="Country"><CountrySelect id="f-country" value={s.country} disabled={!canEdit} onChange={(c) => set(s.id, "country", c)} /></Field>
        <Field id="f-org" label="Organisation"><OrgSelect id="f-org" value={s.org} disabled={!canEdit} onChange={(o) => set(s.id, "org", o)} /></Field>
        <Field id="f-focal" label="Focal point"><BlurInput id="f-focal" value={s.focal_point || ""} disabled={!canEdit} placeholder="Name and role" onCommit={(t) => set(s.id, "focal_point", t || null)} /></Field>
        <Field id="f-uat" label="UAT server"><BlurInput id="f-uat" value={s.environments?.uat || ""} disabled={!canEdit} placeholder="https://" onCommit={(t) => setUrl(s.id, "environments.uat", t)} /></Field>
        <Field id="f-prod" label="Production server"><BlurInput id="f-prod" value={s.environments?.prod || ""} disabled={!canEdit} placeholder="https://" onCommit={(t) => setUrl(s.id, "environments.prod", t)} /></Field>
        <Field id="f-reviewed" label="Requirements last reviewed" hint={reviewError || "A day, a month or a year."}>
          <BlurInput id="f-reviewed" value={s.reviewed || ""} disabled={!canEdit} placeholder="2026-10-13" className="font-mono" aria-invalid={!!reviewError}
            onCommit={(t) => { if (t && !DATE.test(t)) { setReviewError("Use YYYY-MM-DD, YYYY-MM or YYYY."); return; } setReviewError(""); set(s.id, "reviewed", t || null); }} />
        </Field>
      </div>
      <Field id="f-open" label="Open questions" hint="One per line.">
        <Textarea id="f-open" key={`o-${(s.open_items || []).join("|")}`} rows={5} defaultValue={(s.open_items || []).join("\n")} disabled={!canEdit}
          onBlur={(e) => { const v = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean); if (!same(v, s.open_items || [])) set(s.id, "open_items", v); }} />
      </Field>
      <Field id="f-notes" label="Notes">
        <Textarea id="f-notes" key={`t-${s.notes}`} rows={4} defaultValue={s.notes || ""} disabled={!canEdit}
          onBlur={(e) => { if (e.target.value.trim() !== (s.notes || "").trim()) set(s.id, "notes", e.target.value.trim() || null); }} />
      </Field>
    </Section>
  );
}

// ---------------------------------------------------------------- needs

const CHOICES: [Need, string][] = [["needed", "Needed"], ["not_needed", "Not needed"], ["on_hold", "Later"]];

/** Needed / Not needed / Later. Clicking the selected choice again clears it. */
function NeedChoice({ label, value, onChange, disabled }: { label: string; value: Need | null; onChange: (n: Need | null) => void; disabled?: boolean }) {
  return (
    <ToggleGroup type="single" variant="outline" size="sm" aria-label={label} value={value || ""} disabled={disabled}
      onValueChange={(v) => onChange((v || null) as Need | null)} className="shrink-0">
      {CHOICES.map(([v, text]) => (
        <ToggleGroupItem key={v} value={v} aria-label={`${label}: ${text}`}
          className={cn("px-2.5 text-xs", v === "needed" && "data-[state=on]:bg-todo-bg data-[state=on]:text-todo", v === "not_needed" && "data-[state=on]:bg-muted data-[state=on]:text-foreground", v === "on_hold" && "data-[state=on]:bg-hold-bg data-[state=on]:text-hold")}>
          {text}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function NeedRow({ label, value, onChange, disabled }: { label: string; value: Need | null; onChange: (n: Need | null) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-medium">{label}</span>
      <NeedChoice label={label} value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/** Plain-words state of one form or module at the site. */
function BuildState({ built, need }: { built: boolean; need: Need | null }) {
  if (built && need === "not_needed") return <span className="text-hold">In the setup, not needed</span>;
  if (built) return <span className="text-on">In the setup</span>;
  if (need === "needed") return <span className="text-todo">To build</span>;
  return null;
}

interface ItemRow { key: string; name: string; code?: string; built: boolean; need: Need | null; note?: string | null; sync?: "live" | "staging" | null; custom?: boolean; form?: FormRow }

function ItemLine({ item, onChange, disabled }: { item: ItemRow; onChange: (n: Need | null) => void; disabled: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5">
      <div className="min-w-0 flex-[1_1_240px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{item.name}</span>
          {item.code && !item.custom && <span className="font-mono text-xs text-muted-foreground">{item.code}</span>}
          {item.custom && <Badge variant="outline" className="border-new/30 bg-new-bg text-new">Made for this site</Badge>}
          {item.sync === "live" && <Badge variant="outline" className="text-brand">Sent to DHIS2</Badge>}
        </div>
        <p className="text-xs text-muted-foreground"><BuildState built={item.built} need={item.need} />{item.note && <>{item.built || item.need === "needed" ? " · " : ""}{item.note}</>}</p>
      </div>
      <NeedChoice label={item.name} value={item.need} onChange={onChange} disabled={disabled} />
    </li>
  );
}

type Show = "chosen" | "all";
const chosen = (i: ItemRow) => i.built || i.need === "needed" || i.need === "on_hold";

function Forms({ s }: { s: SiteView }) {
  const { view, set, setMany, canEdit } = useMatrix();
  const built = React.useMemo(() => new Set(expandCodes(s.detected?.forms)), [s.detected?.forms]);
  const programs = React.useMemo(() => view.programs.map((p) => ({
    name: p.name,
    items: p.forms.filter((f) => !f.custom || f.ownerId === s.id).map((f): ItemRow => {
      const isBuilt = !f.custom && built.has(f.code);
      const d = s.forms?.[f.code];
      const need = f.custom ? (d?.need || "needed") : (d?.need ?? (isBuilt ? null : s.forms_default ?? null));
      const cell = s.formCells[f.code];
      return { key: f.code, name: f.name, code: f.code, built: isBuilt, need, note: cell?.note, sync: cell?.sync as ItemRow["sync"], custom: f.custom, form: f };
    }),
  })).filter((p) => p.items.length), [view.programs, s, built]);
  const anyChosen = programs.some((p) => p.items.some(chosen));
  const [show, setShow] = React.useState<Show>(anyChosen ? "chosen" : "all");
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const visible = programs
    .map((p) => ({ ...p, rows: p.items.filter((i) => (show === "all" || chosen(i)) && (!query || `${i.code} ${i.name} ${p.name}`.toLowerCase().includes(query))) }))
    .filter((p) => p.rows.length);

  const change = (item: ItemRow, need: Need | null) => {
    set(s.id, `forms.${item.key}.need`, item.custom ? need || "needed" : need);
  };
  const setProgram = (rows: ItemRow[], need: Need) => setMany(s.id, Object.fromEntries(rows.filter((r) => !r.custom).map((r) => [`forms.${r.key}.need`, need])));

  return (
    <div className="grid gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">For each form, say whether this site needs it. "In the setup" means the form is already configured for the site; "To build" means it is needed but not set up yet.</p>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" aria-label="Which forms to show" value={show} onValueChange={(v) => v && setShow(v as Show)}>
          <ToggleGroupItem value="chosen" className="px-3">This site's forms</ToggleGroupItem>
          <ToggleGroupItem value="all" className="px-3">All forms</ToggleGroupItem>
        </ToggleGroup>
        <div className="relative min-w-0 flex-[1_1_200px] sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a form" className="pl-8" aria-label="Find a form" />
        </div>
        <CopyFromSite s={s} />
      </div>
      {!visible.length && (
        <Card className="items-center py-10 text-center">
          <p className="text-muted-foreground">{show === "chosen" ? "No forms chosen for this site yet." : "No form matches."}</p>
          {show === "chosen" && <Button variant="outline" onClick={() => setShow("all")}>Show all forms</Button>}
        </Card>
      )}
      {visible.length > 0 && (
        <Card className="py-0">
          <Accordion type="multiple" defaultValue={visible.length <= 4 || query ? visible.map((p) => p.name) : []} key={`${show}:${query}`}>
            {visible.map((p) => {
              const ready = p.items.filter((i) => i.built && i.need !== "not_needed").length;
              const todo = p.items.filter((i) => !i.built && i.need === "needed").length;
              return (
                <AccordionItem key={p.name} value={p.name} className="px-5">
                  <AccordionTrigger className="items-center hover:no-underline">
                    <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 pr-2">
                      <span className="text-[15px] font-semibold">{p.name}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {[ready && `${ready} in the setup`, todo && `${todo} to build`].filter(Boolean).join(" · ") || `${p.items.length} form${p.items.length === 1 ? "" : "s"}`}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {canEdit && p.rows.filter((r) => !r.custom).length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 border-b pb-3 text-sm text-muted-foreground">
                        Set all {p.rows.filter((r) => !r.custom).length} to
                        <Button variant="outline" size="xs" onClick={() => setProgram(p.rows, "needed")}>Needed</Button>
                        <Button variant="outline" size="xs" onClick={() => setProgram(p.rows, "not_needed")}>Not needed</Button>
                      </div>
                    )}
                    <ul className="divide-y">
                      {p.rows.map((i) => <ItemLine key={i.key} item={i} disabled={!canEdit} onChange={(n) => change(i, n)} />)}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </Card>
      )}
    </div>
  );
}

function Modules({ s }: { s: SiteView }) {
  const { lib, set, canEdit } = useMatrix();
  const built = new Set(s.detected?.modules || []);
  const items: ItemRow[] = lib.modules.map((m) => ({ key: m.id, name: m.name, built: built.has(m.id), need: s.modules?.[m.id] ?? null }));
  return (
    <div className="grid gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">The main parts of the EMR. Say which ones this site needs.</p>
      <Card className="py-0">
        <ul className="divide-y px-5">
          {items.map((i) => <ItemLine key={i.key} item={i} disabled={!canEdit} onChange={(n) => set(s.id, `modules.${i.key}`, n)} />)}
        </ul>
      </Card>
    </div>
  );
}

function CopyFromSite({ s }: { s: SiteView }) {
  const { view, lib, setMany, canEdit } = useMatrix();
  const [open, setOpen] = React.useState(false);
  const [src, setSrc] = React.useState("");
  const source = view.sites.find((x) => x.id === src);
  const active = (st?: string) => st === "on" || st === "todo";
  const changes: Record<string, string> = {};
  if (source) {
    for (const f of lib.forms) if (active(source.formCells[f.code]?.st) && !active(s.formCells[f.code]?.st)) changes[`forms.${f.code}.need`] = "needed";
    for (const m of lib.modules) if (active(source.moduleCells[m.id]?.st) && !active(s.moduleCells[m.id]?.st)) changes[`modules.${m.id}`] = "needed";
  }
  const n = Object.keys(changes).length;
  if (!canEdit) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="sm:ml-auto"><Copy /> Copy from another site</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start from another site</DialogTitle>
          <DialogDescription>Every form and module that the other site uses or needs becomes Needed here. You can change any of them afterwards.</DialogDescription>
        </DialogHeader>
        <Select value={src} onValueChange={setSrc}>
          <SelectTrigger className="w-full" aria-label="Copy from"><SelectValue placeholder="Choose a site" /></SelectTrigger>
          <SelectContent>{view.sites.filter((x) => x.id !== s.id).map((x) => <SelectItem key={x.id} value={x.id}>{x.name} ({x.stats.forms.on} forms)</SelectItem>)}</SelectContent>
        </Select>
        {source && <p className="text-sm text-muted-foreground">{n ? `${n} forms and modules will be marked Needed.` : `${s.name} already has everything ${source.name} uses.`}</p>}
        <Button className="w-fit" disabled={!n} onClick={() => { setMany(s.id, changes); setOpen(false); toast.success(`${n} items copied from ${source!.name}`, { description: "Check them, then save." }); }}>Copy</Button>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- history

const HISTORY_SIZE = 30;
const HISTORY_PAGES = 5;

function History({ s }: { s: SiteView }) {
  const { gh, cfg } = useMatrix();
  const [state, setState] = React.useState<{ loading: boolean; error?: string; items: Commit[] }>({ loading: true, items: [] });
  React.useEffect(() => {
    let live = true;
    // Saves to sites.yaml name the sites in the title: "site-matrix(mombasa,bunia): ...".
    // Older changes were made to one file per site (docs/site-matrix/profiles/<id>.md).
    const mine = (c: Commit) => (/^site-matrix\(([^)]*)\)/.exec(c.commit.message)?.[1] || "").split(",").includes(s.id);
    // Page back through the shared file's history until enough of this site's changes are found.
    const ofSite = async () => {
      const found: Commit[] = [];
      for (let page = 1; page <= HISTORY_PAGES && found.length < HISTORY_SIZE; page++) {
        const list = await gh.commits(cfg.file, 100, page);
        found.push(...list.filter(mine));
        if (list.length < 100) break;
      }
      return found;
    };
    Promise.all([
      ofSite(),
      gh.commits(`docs/site-matrix/profiles/${s.id}.md`, 25).catch(() => [] as Commit[]),
    ]).then(([a, b]) => {
      const seen = new Set<string>();
      const items = [...a, ...b].filter((c) => !seen.has(c.sha) && seen.add(c.sha))
        .sort((x, y) => (y.commit.author?.date || "").localeCompare(x.commit.author?.date || "")).slice(0, HISTORY_SIZE);
      if (live) setState({ loading: false, items });
    }, (e) => live && setState({ loading: false, items: [], error: explain(e, cfg) }));
    return () => { live = false; };
  }, [gh, cfg, s.id]);
  return (
    <div className="grid max-w-3xl gap-5">
      <p className="text-sm text-muted-foreground">Every saved change, newest first, with who made it.</p>
      {state.loading && <div className="grid gap-3" aria-label="Loading history">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      {!state.loading && !state.error && !state.items.length && <p className="text-sm text-muted-foreground">No changes saved yet.</p>}
      {state.items.length > 0 && (
        <Card className="py-0">
          <ol className="divide-y">
            {state.items.map((c) => {
              const d = c.commit.author?.date ? new Date(c.commit.author.date) : null;
              const { title, lines } = describeCommit(c.commit.message, s.name);
              return (
                <li key={c.sha} className="grid gap-1 px-5 py-3.5">
                  <a href={c.html_url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-3">
                    <span className="font-medium group-hover:underline">{title.replace(/^site-matrix\([^)]*\):\s*/, "")}</span>
                    <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                  {lines.length > 0 && <p className="text-sm text-muted-foreground">{lines.join(" ")}</p>}
                  <span className="text-xs text-muted-foreground">{c.author?.login ? "@" + c.author.login : c.commit.author?.name} · {d ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : ""}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
      <ProfileFile id={s.id} />
    </div>
  );
}

/**
 * A commit as this site's history shows it. Saves from the app list changes as "- Label: from -> to",
 * grouped under "Site name:" when several sites were saved together; only this site's part is shown.
 */
function describeCommit(message: string, siteName: string) {
  const [head, ...blocks] = message.split(/\n\s*\n/);
  const title = head.replace(/^site-matrix\([^)]*\):\s*/, "");
  const keep = (b: string) => b && !b.startsWith("Edited in the") && !/^Co-Authored-By|^Claude-Session/im.test(b);
  const section = blocks.find((b) => b.startsWith(siteName + ":\n"));
  const multi = blocks.some((b) => /^[^\n-][^\n]*:\n- /.test(b));
  if (!multi) return { title, lines: blocks.filter(keep).map((b) => b.replace(/\n/g, " ")) };
  const items = (section || "").split("\n").slice(1);
  const short = items.slice(0, 2).map((l) => l.replace(/^- /, "").replace(/: .* -> /, ": ")).join("; ") + (items.length > 2 ? ` and ${items.length - 2} more` : "");
  const notes = blocks.filter((b) => keep(b) && !/^[^\n-][^\n]*:\n- /.test(b));
  return { title: short || title, lines: [items.join(" "), ...notes].filter(Boolean) };
}

function ProfileFile({ id }: { id: string }) {
  const { base, pending, cfg } = useMatrix();
  const text = dumpYaml({ [id]: siteEntry(applyChanges(clone(base[id]) || ({ id } as Profile), pending[id] || {})) });
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="file" className="border-b-0">
        <AccordionTrigger className="text-sm text-muted-foreground">Show this site in {cfg.file}</AccordionTrigger>
        <AccordionContent className="grid gap-2">
          <p className="text-sm text-muted-foreground">This site's entry under <code>sites:</code>, as it will be saved, unsaved changes included.</p>
          <Button variant="outline" size="sm" className="w-fit" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Copied"), () => toast.error("Copy failed"))}><Copy /> Copy</Button>
          <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted p-3 font-mono text-[11.5px] leading-relaxed">{text}</pre>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

