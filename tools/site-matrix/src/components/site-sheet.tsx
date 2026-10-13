import * as React from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useMatrix } from "@/lib/store";
import { applyChanges, clone, renderProfile } from "@/lib/profile";
import { explain, type Commit } from "@/lib/github";
import type { Profile } from "@/lib/types";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Skeleton } from "./ui/skeleton";
import { StatusBadge } from "./chip";

export function SiteSheet({ siteId, tab, onTab, onClose }: { siteId: string | null; tab: string; onTab: (t: string) => void; onClose: () => void }) {
  const store = useMatrix();
  const s = store.view.sites.find((x) => x.id === siteId);
  return (
    <Sheet open={!!s} onOpenChange={(o) => !o && onClose()}>
      {s && (
        <SheetContent aria-describedby={undefined} className="w-full gap-0 sm:max-w-xl">
          <SheetHeader className="p-5 pr-12">
            <StatusBadge status={s.status} />
            <SheetTitle className="text-2xl font-semibold tracking-tight">{s.name}</SheetTitle>
            <SheetDescription>
              {[s.country, `${s.stats.forms.on} forms on`, `${s.stats.forms.todo} needed`, s.stats.reuse === null ? "no forms scoped" : `${s.stats.reuse}% from library`].filter(Boolean).join(" · ")}
            </SheetDescription>
          </SheetHeader>
          <Tabs value={tab} onValueChange={onTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="reuse">Reuse</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <TabsContent value="overview"><Overview id={s.id} /></TabsContent>
              <TabsContent value="reuse"><Reuse id={s.id} /></TabsContent>
              <TabsContent value="history"><History id={s.id} /></TabsContent>
              <TabsContent value="profile"><ProfileYaml id={s.id} /></TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      )}
    </Sheet>
  );
}

function Overview({ id }: { id: string }) {
  const { view, set, canEdit } = useMatrix();
  const s = view.sites.find((x) => x.id === id)!;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field id="f-name" label="Site name"><Input id="f-name" key={`n-${s.name}`} defaultValue={s.name} disabled={!canEdit} onBlur={(e) => set(id, "name", e.target.value.trim() || null)} /></Field>
        <Field id="f-country" label="Country"><Input id="f-country" key={`c-${s.country}`} defaultValue={s.country || ""} disabled={!canEdit} onBlur={(e) => set(id, "country", e.target.value.trim() || null)} /></Field>
        <Field id="f-phase" label="Current phase" className="col-span-2"><Input id="f-phase" key={`p-${s.phase}`} defaultValue={s.phase || ""} disabled={!canEdit} onBlur={(e) => set(id, "phase", e.target.value.trim() || null)} /></Field>
      </div>
      <Field id="f-open" label="Open items, one per line">
        <Textarea id="f-open" key={`o-${(s.open_items || []).join("|")}`} rows={6} defaultValue={(s.open_items || []).join("\n")} disabled={!canEdit}
          onBlur={(e) => set(id, "open_items", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
      </Field>
      <Field id="f-notes" label="Notes"><Textarea id="f-notes" key={`t-${s.notes}`} rows={4} defaultValue={s.notes || ""} disabled={!canEdit} onBlur={(e) => set(id, "notes", e.target.value.trim() || null)} /></Field>
      <p className="text-xs text-muted-foreground">Status, dates, patient ID and needs are edited directly in the matrix.{!canEdit && " Sign in to edit."}</p>
    </div>
  );
}

function Reuse({ id }: { id: string }) {
  const { view, lib, setMany, canEdit } = useMatrix();
  const [src, setSrc] = React.useState("");
  const [forms, setForms] = React.useState(true);
  const [mods, setMods] = React.useState(true);
  const dst = view.sites.find((x) => x.id === id)!;
  const source = view.sites.find((x) => x.id === src);
  const changes: Record<string, string> = {};
  const active = (st?: string) => st === "on" || st === "todo";
  if (source) {
    if (forms) for (const f of lib.forms) if (active(source.formCells[f.code]?.st) && !active(dst.formCells[f.code]?.st)) changes[`needs.forms.${f.code}`] = "needed";
    if (mods) for (const m of lib.modules) if (active(source.moduleCells[m.id]?.st) && !active(dst.moduleCells[m.id]?.st)) changes[`needs.modules.${m.id}`] = "needed";
  }
  const n = Object.keys(changes).length;
  return (
    <div className="grid gap-4">
      <p className="text-sm">Start from a site that already runs what this one needs. Every form and module on or needed at the source becomes needed here; remove what does not apply before saving.</p>
      <Field id="f-src" label="Copy from">
        <Select value={src} onValueChange={setSrc}>
          <SelectTrigger id="f-src" className="w-full"><SelectValue placeholder="Choose a site" /></SelectTrigger>
          <SelectContent>
            {view.sites.filter((x) => x.id !== id).map((x) => <SelectItem key={x.id} value={x.id}>{x.name} ({x.stats.forms.on} forms on)</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <div className="flex gap-6">
        <Label className="font-normal"><Checkbox checked={forms} onCheckedChange={(c) => setForms(c === true)} /> Forms</Label>
        <Label className="font-normal"><Checkbox checked={mods} onCheckedChange={(c) => setMods(c === true)} /> Modules</Label>
      </div>
      {source && <p className="rounded-md bg-muted px-3 py-2 text-sm">{n} forms and modules from {source.name} will be set to Needed. Those already on or needed here are skipped.</p>}
      <Button className="w-fit" disabled={!canEdit || !n} onClick={() => { setMany(id, changes); toast.success(`${n} needs copied from ${source!.name}`, { description: "Review them, then save." }); }}>Copy needs</Button>
      {!canEdit && <p className="text-xs text-muted-foreground">Sign in to copy.</p>}
    </div>
  );
}

function History({ id }: { id: string }) {
  const { gh, cfg } = useMatrix();
  const [state, setState] = React.useState<{ loading: boolean; error?: string; items: Commit[] }>({ loading: true, items: [] });
  React.useEffect(() => {
    let live = true;
    gh.commits(`${cfg.dir}/${id}.md`, 25).then((items) => live && setState({ loading: false, items }), (e) => live && setState({ loading: false, items: [], error: explain(e, cfg) }));
    return () => { live = false; };
  }, [gh, cfg, id]);
  if (state.loading) return <div className="grid gap-3" aria-label="Loading history">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (state.error) return <p className="text-sm text-hold">{state.error}</p>;
  if (!state.items.length) return <p className="text-sm text-muted-foreground">No commits yet for this profile.</p>;
  return (
    <ol className="relative grid gap-3 border-l pl-5">
      {state.items.map((c) => {
        const d = c.commit.author?.date ? new Date(c.commit.author.date) : null;
        return (
          <li key={c.sha} className="relative">
            <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-background bg-brand" />
            <a href={c.html_url} target="_blank" rel="noreferrer" className="group grid gap-0.5">
              <span className="text-sm font-medium group-hover:underline">{c.commit.message.split("\n")[0]} <ExternalLink className="inline size-3 text-muted-foreground" /></span>
              <span className="text-xs text-muted-foreground">{c.author?.login ? "@" + c.author.login : c.commit.author?.name} · {d ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : ""} · <span className="font-mono">{c.sha.slice(0, 7)}</span></span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

function ProfileYaml({ id }: { id: string }) {
  const { base, files, pending, cfg } = useMatrix();
  const text = renderProfile(applyChanges(clone(base[id]) || ({ id } as Profile), pending[id] || {}), files[id]?.body || "");
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">The profile as it will be committed to <span className="font-mono text-xs">{cfg.dir}/{id}.md</span>, unsaved changes included. The <code>detected</code> block comes from the repo scan and is left as is.</p>
      <Button variant="outline" size="sm" className="w-fit" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Copied"), () => toast.error("Copy failed"))}><Copy /> Copy</Button>
      <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted p-3 font-mono text-[11.5px] leading-relaxed">{text}</pre>
    </div>
  );
}

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return <div className={`grid gap-2 ${className || ""}`}><Label htmlFor={id}>{label}</Label>{children}</div>;
}
