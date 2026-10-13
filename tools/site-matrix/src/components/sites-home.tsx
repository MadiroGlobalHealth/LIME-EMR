import * as React from "react";
import { ArrowRight, Plus, Search, Table2 } from "lucide-react";
import { useMatrix } from "@/lib/store";
import { daysFromToday, fmtDate, nextMilestone, type SiteView } from "@/lib/model";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { StatusBadge } from "./chip";
import { Dhis2Text, formsProgress, idPrefix, NextStep, relDays } from "./site-bits";

type Filter = "all" | "live" | "preparation" | "planned";

export function SitesHome({ onOpen, onCompare, onAdd }: { onOpen: (id: string) => void; onCompare: () => void; onAdd: () => void }) {
  const { view, canEdit } = useMatrix();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  const sites = view.sites.filter((s) => (filter === "all" || s.status === filter) && `${s.name} ${s.country || ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const count = (st: string) => view.sites.filter((s) => s.status === st).length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">LIME EMR sites</h1>
          <p className="max-w-2xl text-muted-foreground">Open a site to see its setup and plans, and to update them.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCompare}><Table2 /> Compare sites</Button>
          {canEdit && <Button onClick={onAdd}><Plus /> Add a site</Button>}
        </div>
      </div>

      <Summary />

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" aria-label="Show sites" value={filter} onValueChange={(v) => v && setFilter(v as Filter)}>
          <ToggleGroupItem value="all" className="px-3">All {view.sites.length}</ToggleGroupItem>
          <ToggleGroupItem value="live" className="px-3">Live {count("live")}</ToggleGroupItem>
          <ToggleGroupItem value="preparation" className="px-3">Preparing {count("preparation")}</ToggleGroupItem>
          <ToggleGroupItem value="planned" className="px-3">Planned {count("planned")}</ToggleGroupItem>
        </ToggleGroup>
        <div className="relative min-w-0 flex-[1_1_200px] sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a site or country" className="pl-8" aria-label="Find a site or country" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="site-cards">
        {sites.map((s) => <SiteCard key={s.id} s={s} onOpen={() => onOpen(s.id)} />)}
        {!sites.length && <p className="text-muted-foreground">No site matches.</p>}
      </div>
    </div>
  );
}

function Summary() {
  const { view } = useMatrix();
  let next: { s: SiteView; label: string; text: string; d: number } | null = null;
  for (const s of view.sites) {
    const n = nextMilestone(s);
    if (n && n.pd.prec === 3 && (!next || daysFromToday(n.pd.date) < next.d)) next = { s, label: n.label, text: fmtDate(n.pd), d: daysFromToday(n.pd.date) };
  }
  const toBuild = view.sites.reduce((a, s) => a + s.stats.forms.todo, 0);
  const sending = view.sites.filter((s) => s.integrationCell.st === "on").length;
  const items = [
    { k: "Coming up", v: next ? `${next.s.name}: ${next.label}` : "Nothing scheduled", d: next ? `${next.text}, ${relDays(next.d)}` : "Add dates on a site page" },
    { k: "Forms still to build", v: String(toBuild), d: "Needed by a site, not in its build yet" },
    { k: "Reporting to DHIS2", v: `${sending} of ${view.sites.length} sites`, d: "Data sent automatically every day" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.k} className="grid gap-0.5 rounded-lg border bg-muted/40 px-4 py-3">
          <span className="text-xs text-muted-foreground">{i.k}</span>
          <span className="truncate font-semibold">{i.v}</span>
          <span className="text-xs text-muted-foreground">{i.d}</span>
        </div>
      ))}
    </div>
  );
}

function SiteCard({ s, onOpen }: { s: SiteView; onOpen: () => void }) {
  const p = formsProgress(s);
  const prefix = idPrefix(s);
  const { pending } = useMatrix();
  const unsaved = !!pending[s.id];
  return (
    <Card className="group relative gap-4 py-5 transition-shadow hover:shadow-md">
      <CardHeader className="gap-1.5 px-5">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={s.status} />
          {unsaved && <span className="text-xs font-medium text-new">Unsaved changes</span>}
        </div>
        <CardTitle className="text-lg">
          <button className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 focus-visible:outline-none" onClick={onOpen}>{s.name}</button>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{[s.country, s.phase].filter(Boolean).join(" · ") || "No details yet"}</p>
      </CardHeader>
      <CardContent className="grid gap-4 px-5">
        <p className="text-sm text-muted-foreground"><NextStep s={s} /></p>
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Forms</span>
            <span>{p.total ? <><b className="font-semibold">{p.on}</b> of {p.total} ready</> : <span className="text-muted-foreground">None chosen yet</span>}</span>
          </div>
          <Progress value={p.pct} className={cn("h-1.5", !p.total && "opacity-40")} aria-label={`${p.on} of ${p.total} forms ready`} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Patient ID</dt><dd className="text-right font-mono">{prefix || <span className="font-sans text-muted-foreground">Not set</span>}</dd>
          <dt className="text-muted-foreground">DHIS2</dt><dd className="text-right"><Dhis2Text s={s} /></dd>
        </dl>
        <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground group-hover:text-foreground">Open site <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
      </CardContent>
    </Card>
  );
}
