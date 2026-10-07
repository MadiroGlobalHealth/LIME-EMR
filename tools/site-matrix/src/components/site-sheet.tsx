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
import { Input, Label, Textarea } from "./ui/input";
import { StatusBadge } from "./ui/chip";

export function SiteSheet({ siteId, tab, onTab, onClose }: { siteId: string | null; tab: string; onTab: (t: string) => void; onClose: () => void }) {
  const store = useMatrix();
  const s = store.view.sites.find((x) => x.id === siteId);
  return (
    <Sheet open={!!s} onOpenChange={(o) => !o && onClose()}>
      {s && (
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <StatusBadge status={s.status} />
            <SheetTitle className="text-2xl font-semibold tracking-tight">{s.name}</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {[s.country, `${s.stats.forms.on} forms on`, `${s.stats.forms.todo} needed`, s.stats.reuse === null ? "no forms scoped" : `${s.stats.reuse}% from library`].filter(Boolean).join(" · ")}
            </SheetDescription>
          </SheetHeader>
          <Tabs value={tab} onValueChange={onTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="reuse">Reuse</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
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
        <Label>Site name<Input key={`n-${s.name}`} defaultValue={s.name} disabled={!canEdit} onBlur={(e) => set(id, "name", e.target.value.trim() || null)} /></Label>
        <Label>Country<Input key={`c-${s.country}`} defaultValue={s.country || ""} disabled={!canEdit} onBlur={(e) => set(id, "country", e.target.value.trim() || null)} /></Label>
        <Label className="col-span-2">Current phase<Input key={`p-${s.phase}`} defaultValue={s.phase || ""} disabled={!canEdit} onBlur={(e) => set(id, "phase", e.target.value.trim() || null)} /></Label>
      </div>
      <Label>Open items, one per line
        <Textarea key={`o-${(s.open_items || []).join("|")}`} rows={6} defaultValue={(s.open_items || []).join("\n")} disabled={!canEdit}
          onBlur={(e) => set(id, "open_items", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
      </Label>
      <Label>Notes<Textarea key={`t-${s.notes}`} rows={4} defaultValue={s.notes || ""} disabled={!canEdit} onBlur={(e) => set(id, "notes", e.target.value.trim() || null)} /></Label>
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
      <Label>Copy from
        <select value={src} onChange={(e) => setSrc(e.target.value)} className="h-9 rounded-md border bg-card px-2.5 text-sm text-foreground shadow-xs">
          <option value="">Choose a site</option>
          {view.sites.filter((x) => x.id !== id).map((x) => <option key={x.id} value={x.id}>{x.name} ({x.stats.forms.on} forms on)</option>)}
        </select>
      </Label>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={forms} onChange={(e) => setForms(e.target.checked)} className="size-4" /> Forms</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={mods} onChange={(e) => setMods(e.target.checked)} className="size-4" /> Modules</label>
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
  if (state.loading) return <p className="text-sm text-muted-foreground">Loading history…</p>;
  if (state.error) return <p className="text-sm text-hold">{state.error}</p>;
  if (!state.items.length) return <p className="text-sm text-muted-foreground">No commits yet for this profile.</p>;
  return (
    <ol className="relative grid gap-3 border-l pl-5">
      {state.items.map((c) => {
        const d = c.commit.author?.date ? new Date(c.commit.author.date) : null;
        return (
          <li key={c.sha} className="relative">
            <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-card bg-accent" />
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
