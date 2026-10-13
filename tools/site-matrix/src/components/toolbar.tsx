import { ChevronsDownUp, ChevronsUpDown, Download, Rows3, Rows4, Search } from "lucide-react";
import { useMatrix } from "@/lib/store";
import { countryName } from "@/lib/countries";
import { LABEL, MILESTONES, regText, regValue } from "@/lib/model";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Tip } from "./tip";
import type { StatusFilter, UiState } from "./ui-state";

export function Toolbar({ ui }: { ui: UiState }) {
  const { view, lib } = useMatrix();
  const allIds = ["sec:time", "sec:reg", "sec:mods", "sec:int", "sec:forms", ...view.programs.map((p) => `prog:${p.name}`)];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup type="single" variant="outline" aria-label="Filter sites by status" value={ui.statusFilter}
        onValueChange={(v) => v && ui.setStatusFilter(v as StatusFilter)}>
        {([["all", "All sites"], ["live", "Live"], ["preparation", "Preparation"], ["planned", "Planned"]] as const).map(([v, text]) => (
          <ToggleGroupItem key={v} value={v} className="px-3">{text}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="relative min-w-0 flex-[1_1_220px] sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={ui.q} onChange={(e) => ui.setQ(e.target.value)} placeholder="Filter forms and programs" className="pl-8" aria-label="Filter forms and programs" />
      </div>
      <Label className="cursor-pointer px-1 font-normal text-muted-foreground">
        <Checkbox checked={ui.onlyUsed} onCheckedChange={(c) => ui.setOnlyUsed(c === true)} />
        Only forms in use or needed
      </Label>
      <div className="ml-auto flex items-center gap-1.5">
        <Tip content="Expand all"><Button variant="outline" size="icon" aria-label="Expand all" onClick={() => ui.expandAll(allIds)}><ChevronsUpDown /></Button></Tip>
        <Tip content="Collapse all"><Button variant="outline" size="icon" aria-label="Collapse all" onClick={() => ui.expandAll(null)}><ChevronsDownUp /></Button></Tip>
        <Tip content={ui.density === "compact" ? "Comfortable rows" : "Compact rows"}>
          <Button variant="outline" size="icon" aria-label="Toggle row density" onClick={() => ui.setDensity(ui.density === "compact" ? "comfortable" : "compact")}>{ui.density === "compact" ? <Rows3 /> : <Rows4 />}</Button>
        </Tip>
        <Button variant="outline" onClick={() => exportCsv(view, lib)}><Download /> Export CSV</Button>
      </div>
    </div>
  );
}

export function exportCsv(view: ReturnType<typeof useMatrix>["view"], lib: ReturnType<typeof useMatrix>["lib"]) {
  const sites = view.sites;
  const rows: string[][] = [["Section", "Item", ...sites.map((s) => s.name)]];
  rows.push(["Site", "Status", ...sites.map((s) => s.status)]);
  rows.push(["Site", "Country", ...sites.map((s) => countryName(s.country))]);
  rows.push(["Site", "Organisation", ...sites.map((s) => s.org || "")]);
  rows.push(["Site", "Phase", ...sites.map((s) => s.phase || "")]);
  for (const [k, label] of MILESTONES) rows.push(["Milestone", label, ...sites.map((s) => s.milestones?.[k]?.date || "")]);
  for (const k of ["id_prefix", "identifiers", "languages", "address"]) rows.push(["Registration", k, ...sites.map((s) => regText(k, regValue(s, k).value))]);
  for (const m of lib.modules) rows.push(["Module", m.name, ...sites.map((s) => LABEL[s.moduleCells[m.id].st])]);
  rows.push(["DHIS2", "Integration", ...sites.map((s) => s.integrationCell.label)]);
  for (const f of view.rows) rows.push([`Form: ${f.program}`, `${f.custom ? "" : f.code + " "}${f.name}`, ...sites.map((s) => LABEL[s.formCells[f.code]?.st || "unk"])]);
  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `lime-site-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
