import type { ReactNode } from "react";
import { useMatrix } from "@/lib/store";
import { daysFromToday, fmtDate, nextMilestone } from "@/lib/model";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function Kpis() {
  const { view, lib } = useMatrix();
  const v = view.sites;
  const by = (st: string) => v.filter((s) => s.status === st).length;
  const shared = lib.forms.filter((f) => v.filter((s) => ["on", "todo"].includes(s.formCells[f.code]?.st)).length >= 2).length;
  const prep = v.filter((s) => s.status !== "live" && s.stats.reuse !== null);
  const reuse = prep.length ? Math.round(prep.reduce((a, s) => a + (s.stats.reuse || 0), 0) / prep.length) : null;
  const todo = v.reduce((a, s) => a + s.stats.forms.todo + s.stats.modules.todo, 0);
  let next: { site: string; label: string; date: Date; text: string } | null = null;
  for (const s of v) {
    const n = nextMilestone(s);
    if (n && n.pd.prec === 3 && (!next || n.pd.date < next.date)) next = { site: s.name, label: n.label, date: n.pd.date, text: fmtDate(n.pd) };
  }
  const nd = next ? daysFromToday(next.date) : 0;
  const items: { k: string; v: ReactNode; d: string }[] = [
    { k: "Sites", v: v.length, d: `${by("live")} live · ${by("preparation")} in preparation · ${by("planned")} planned` },
    { k: "Shared forms", v: <>{shared}<small className="ml-1 text-sm font-normal text-muted-foreground">/ {lib.forms.length}</small></>, d: "On or needed at 2+ sites" },
    { k: "Reuse in new sites", v: reuse === null ? "–" : <>{reuse}<small className="text-sm font-normal text-muted-foreground">%</small></>, d: "Forms from the shared library" },
    { k: "Still to build", v: todo, d: "Forms and modules needed, not built" },
    { k: "DHIS2 sync", v: <>{v.filter((s) => s.integrationCell.st === "on").length}<small className="ml-1 text-sm font-normal text-muted-foreground">live</small></>, d: `${v.filter((s) => s.integrationCell.st === "template").length} template only · ${v.filter((s) => s.integrationCell.st === "todo").length} to set up` },
    { k: "Next milestone", v: next ? next.text : "–", d: next ? `${next.site}: ${next.label} (${nd >= 0 ? `in ${nd} d` : `overdue ${-nd} d`})` : "None scheduled" },
  ];
  return (
    <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((i) => (
        <Card key={i.k} className="gap-0 py-4">
          <CardHeader className="gap-1 px-4">
            <CardDescription className="text-xs font-medium">{i.k}</CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">{i.v}</CardTitle>
            <p className="text-xs text-muted-foreground">{i.d}</p>
          </CardHeader>
        </Card>
      ))}
    </section>
  );
}
