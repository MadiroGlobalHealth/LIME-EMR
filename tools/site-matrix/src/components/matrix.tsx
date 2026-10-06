import * as React from "react";
import { flexRender, getCoreRowModel, getExpandedRowModel, useReactTable, type ColumnDef, type ExpandedState, type Row } from "@tanstack/react-table";
import { ChevronRight, Info } from "lucide-react";
import { useMatrix } from "@/lib/store";
import { daysFromToday, fmtDate, LABEL, MILESTONES, nextMilestone, parseDate, programCell, REG_ROWS, regValue, type FormRow, type Program, type SiteView } from "@/lib/model";
import { expandCodes, same } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Chip, PendingDot, StatusBadge } from "./ui/chip";
import { Tip } from "./ui/tooltip";
import type { EditRequest } from "./cell-editor";
import type { UiState } from "./ui-state";

type RowData =
  | { id: string; kind: "section"; title: string; hint: string; section: string; subRows: RowData[] }
  | { id: string; kind: "milestone"; key: string; label: string; hint: string }
  | { id: string; kind: "phase" | "openitems" }
  | { id: string; kind: "reg"; key: string; label: string; hint: string; editor: "text" | "list"; path: string }
  | { id: string; kind: "module"; moduleId: string; label: string }
  | { id: string; kind: "int"; key: string; label: string; hint: string }
  | { id: string; kind: "program"; program: Program; shown: FormRow[]; subRows: RowData[] }
  | { id: string; kind: "form"; form: FormRow };

const INT_ROWS: [string, string, string][] = [
  ["target", "DHIS2 target", "Tracker program"],
  ["version", "OpenFn config", "Project version"],
  ["workflows", "Workflows", "Schedule (UTC) and state"],
  ["forms", "Forms synced", "Production / staging"],
];

export function Matrix({ ui, onEdit, onOpenSite }: { ui: UiState; onEdit: (r: EditRequest) => void; onOpenSite: (id: string) => void }) {
  const { view, lib, pending, canEdit } = useMatrix();
  const sites = React.useMemo(() => view.sites.filter((s) => ui.statusFilter === "all" || s.status === ui.statusFilter), [view.sites, ui.statusFilter]);
  const q = ui.q.trim().toLowerCase();

  const data = React.useMemo<RowData[]>(() => {
    const used = (f: FormRow) => sites.some((s) => ["on", "todo", "hold", "remove"].includes(s.formCells[f.code]?.st));
    const programs = view.programs
      .map((p) => {
        const shown = p.forms.filter((f) => (!q || `${f.code} ${f.name} ${p.name}`.toLowerCase().includes(q)) && (q || !ui.onlyUsed || used(f)));
        return { id: `prog:${p.name}`, kind: "program" as const, program: p, shown, subRows: shown.map((f) => ({ id: `form:${f.code}`, kind: "form" as const, form: f })) };
      })
      .filter((p) => p.shown.length || (!ui.onlyUsed && !q));
    return [
      { id: "sec:time", kind: "section", section: "time", title: "Status & milestones", hint: "Next date per site",
        subRows: [...MILESTONES.map(([key, label, hint]) => ({ id: `ms:${key}`, kind: "milestone" as const, key, label, hint })), { id: "phase", kind: "phase" as const }, { id: "openitems", kind: "openitems" as const }] },
      { id: "sec:reg", kind: "section", section: "reg", title: "Registration & patient ID", hint: "MSF ID prefix and languages",
        subRows: REG_ROWS.map(([key, label, hint, editor, path]) => ({ id: `reg:${key}`, kind: "reg" as const, key, label, hint, editor, path })) },
      { id: "sec:mods", kind: "section", section: "mods", title: "Modules", hint: `${lib.modules.length} key modules`,
        subRows: lib.modules.map((m) => ({ id: `mod:${m.id}`, kind: "module" as const, moduleId: m.id, label: m.name })) },
      { id: "sec:int", kind: "section", section: "int", title: "DHIS2 integration", hint: "OpenFn sync status",
        subRows: INT_ROWS.map(([key, label, hint]) => ({ id: `int:${key}`, kind: "int" as const, key, label, hint })) },
      { id: "sec:forms", kind: "section", section: "forms", title: "Programs & forms", hint: `${view.rows.length} forms in ${view.programs.length} programs`, subRows: programs },
    ];
  }, [view, lib, sites, q, ui.onlyUsed]);

  // Searching opens the forms section and every matching program.
  const expanded = React.useMemo<ExpandedState>(() => {
    const e: Record<string, boolean> = { ...ui.expanded };
    if (q) { e["sec:forms"] = true; for (const p of view.programs) e[`prog:${p.name}`] = true; }
    return e;
  }, [ui.expanded, q, view.programs]);

  const isPending = React.useCallback((site: string, path: string | null, prefix = false) => {
    const p = pending[site];
    if (!p || !path) return false;
    return path in p || (prefix && Object.keys(p).some((k) => k.startsWith(path + ".")));
  }, [pending]);

  const columns = React.useMemo<ColumnDef<RowData>[]>(() => [
    {
      id: "label",
      header: () => <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Configuration</span>,
      cell: ({ row }) => <RowLabel row={row} onToggle={() => ui.toggle(row.original.id)} />,
    },
    ...sites.map<ColumnDef<RowData>>((s) => ({
      id: s.id,
      header: () => <SiteHeader s={s} pending={!!pending[s.id]} statusPending={isPending(s.id, "status")} onOpen={() => onOpenSite(s.id)}
        onStatus={(el) => onEdit(canEdit ? { site: s.id, kind: "status", path: "status", title: "Status", anchor: el } : { site: s.id, kind: "denied", path: null, title: "", anchor: el })} />,
      cell: ({ row }) => <SiteCell r={row.original} s={s} isPending={isPending} />,
    })),
  ], [sites, pending, isPending, onOpenSite, onEdit, canEdit, ui]);

  const table = useReactTable({
    data, columns,
    state: { expanded },
    getRowId: (r) => r.id,
    getSubRows: (r) => ("subRows" in r ? r.subRows : undefined),
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });
  const rows = table.getRowModel().rows;

  // What a click or Enter on a cell edits.
  const editFor = (r: RowData, s: SiteView): Omit<EditRequest, "anchor"> | null => {
    switch (r.kind) {
      case "milestone": return { site: s.id, kind: "milestone", path: `milestones.${r.key}`, title: r.label };
      case "phase": return { site: s.id, kind: "text", path: "phase", title: "Phase" };
      case "reg": return { site: s.id, kind: r.editor, path: r.path, title: r.label };
      case "module": return { site: s.id, kind: "need", path: `needs.modules.${r.moduleId}`, title: r.label };
      case "int": return r.key === "target" ? { site: s.id, kind: "text", path: "integration.dhis2_target", title: "DHIS2 target" } : null;
      case "program": return { site: s.id, kind: "need", path: null, title: `${r.program.name} (all forms)`, program: r.program };
      case "form":
        if (r.form.custom) return r.form.ownerId === s.id ? { site: s.id, kind: "need", path: "custom_forms", title: r.form.name, form: r.form } : null;
        return { site: s.id, kind: "need", path: `needs.forms.${r.form.code}`, title: `${r.form.code} ${r.form.name}`, form: r.form };
      case "section":
        if (r.section === "reg") return { site: s.id, kind: "text", path: "registration.id_prefix", title: "MSF ID prefix" };
        if (r.section === "int") return { site: s.id, kind: "need", path: "integration.need", title: "DHIS2 integration" };
        return null;
      default: return null;
    }
  };

  // Keyboard: arrows move between cells, Enter edits, Enter on a row label expands it.
  const [active, setActive] = React.useState<[number, number]>([0, 0]);
  const gridRef = React.useRef<HTMLTableElement>(null);
  const focusCell = (r: number, c: number) => {
    const rr = Math.max(0, Math.min(rows.length - 1, r)), cc = Math.max(0, Math.min(sites.length, c));
    setActive([rr, cc]);
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${rr}:${cc}"]`)?.focus();
  };
  const activate = (rowIndex: number, colIndex: number, el: HTMLElement) => {
    const r = rows[rowIndex].original;
    if (colIndex === 0) { if (r.kind === "section" || r.kind === "program") ui.toggle(r.id); else if (r.kind === "form" || r.kind === "module") return; return; }
    const s = sites[colIndex - 1];
    if (r.kind === "openitems") return onOpenSite(s.id);
    const req = editFor(r, s);
    if (req) onEdit({ ...req, anchor: el });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const [r, c] = active;
    const moves: Record<string, [number, number]> = { ArrowDown: [r + 1, c], ArrowUp: [r - 1, c], ArrowRight: [r, c + 1], ArrowLeft: [r, c - 1], Home: [r, 0], End: [r, sites.length] };
    if (moves[e.key]) { e.preventDefault(); focusCell(...moves[e.key]); }
    else if (e.key === "Enter" || e.key === " ") {
      const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${r}:${c}"]`);
      if (el && document.activeElement === el) { e.preventDefault(); activate(r, c, el); }
    }
  };

  const pad = ui.density === "compact" ? "py-1" : "py-2";

  return (
    <div className="max-h-[calc(100dvh-7rem)] min-h-[360px] overflow-auto rounded-xl border bg-card shadow-xs" data-testid="matrix">
      <table ref={gridRef} role="grid" aria-label="Site matrix" onKeyDown={onKeyDown} className="border-separate border-spacing-0 text-sm tabular-nums">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h, i) => (
                <th key={h.id} scope="col"
                  className={cn("sticky top-0 border-b border-r bg-card px-3 py-2.5 text-left align-bottom font-normal",
                    i === 0 ? "left-0 z-30 w-[268px] min-w-[220px] max-w-[268px]" : "z-20 w-[164px] min-w-[164px]")}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const r = row.original;
            const isSection = r.kind === "section";
            return (
              <tr key={row.id} className={cn("group/row", isSection ? "bg-muted/60" : "hover:bg-muted/40")}>
                {row.getVisibleCells().map((cell, ci) => {
                  const site = ci > 0 ? sites[ci - 1] : null;
                  const editable = ci > 0 && canEdit && site ? (r.kind === "openitems" || !!editFor(r, site)) : ci === 0 && (r.kind === "section" || r.kind === "program");
                  return (
                    <td key={cell.id} data-cell={`${ri}:${ci}`} tabIndex={active[0] === ri && active[1] === ci ? 0 : -1}
                      role="gridcell"
                      onFocus={() => setActive([ri, ci])}
                      onClick={(e) => { if (ci === 0 || canEdit || r.kind === "openitems") activate(ri, ci, e.currentTarget); else onEdit({ site: site!.id, kind: "denied", path: null, title: "", anchor: e.currentTarget }); }}
                      className={cn("border-b border-r px-3 align-top outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", pad,
                        ci === 0 ? "sticky left-0 z-10 bg-card group-hover/row:bg-muted" : "",
                        ci === 0 && isSection && "bg-muted",
                        editable && ci > 0 && "cursor-pointer hover:bg-new-bg/40",
                        ci === 0 && (r.kind === "section" || r.kind === "program") && "cursor-pointer")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowLabel({ row, onToggle }: { row: Row<RowData>; onToggle: () => void }) {
  const r = row.original;
  const chevron = <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", row.getIsExpanded() && "rotate-90")} />;
  switch (r.kind) {
    case "section":
      return (
        <div className="flex items-start gap-2" aria-expanded={row.getIsExpanded()} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          <span className="mt-1">{chevron}</span>
          <span className="grid"><span className="font-semibold">{r.title}</span><span className="text-xs text-muted-foreground">{r.hint}</span></span>
        </div>
      );
    case "program":
      return (
        <div className="flex items-center gap-2 pl-4 font-medium" aria-expanded={row.getIsExpanded()} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {chevron}<span>{r.program.name}</span><span className="text-xs font-normal text-muted-foreground">{r.program.forms.length}</span>
        </div>
      );
    case "form":
      return (
        <div className="pl-12 text-[13px]">
          {!r.form.custom && <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">{r.form.code}</span>}
          {r.form.name}
          {r.form.custom && <span className="ml-1.5 rounded bg-new-bg px-1.5 py-px text-[10px] font-semibold uppercase text-new" title={`Site-specific form for ${r.form.owner}`}>New</span>}
          {!r.form.custom && r.form.in_library === false && <span className="ml-1 text-xs text-muted-foreground" title="Not yet in the distro form library">◌</span>}
        </div>
      );
    case "module": return <div className="pl-6 text-[13px]">{r.label}</div>;
    case "phase": return <Detail label="Phase" hint="Current step" />;
    case "openitems": return <Detail label="Open items" hint="From the weekly follow-up" />;
    default: return <Detail label={r.label} hint={r.hint} />;
  }
}
const Detail = ({ label, hint }: { label: string; hint?: string }) => (
  <div className="grid pl-6"><span className="text-[13px] font-medium">{label}</span>{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</div>
);

function SiteHeader({ s, pending, statusPending, onOpen, onStatus }: { s: SiteView; pending: boolean; statusPending: boolean; onOpen: () => void; onStatus: (el: HTMLElement) => void }) {
  return (
    <div className="relative grid gap-1">
      <button className="relative w-fit rounded-full hover:ring-2 hover:ring-new/40" aria-label={`Status of ${s.name}: ${s.status}. Change`} onClick={(e) => onStatus(e.currentTarget)}>
        <StatusBadge status={s.status} />{statusPending && <PendingDot />}
      </button>
      <button className="group grid gap-0.5 text-left" onClick={onOpen}>
        <span className="text-[15px] font-semibold leading-tight group-hover:underline">{s.name}</span>
        <span className="text-xs text-muted-foreground">{s.country || "–"}</span>
      </button>
      {pending && <PendingDot className="right-0 top-0" />}
    </div>
  );
}

const muted = <span className="text-none/60">·</span>;
const tbd = (t = "To define") => <span className="text-xs italic text-none">{t}</span>;

function Counts({ c }: { c: SiteView["stats"]["forms"] }) {
  if (!c.on && !c.todo && !c.hold && !c.remove) return muted;
  return (
    <span className="flex flex-wrap gap-x-2 text-[13px]">
      {c.on > 0 && <span><b className="font-semibold">{c.on}</b> on</span>}
      {c.todo > 0 && <span className="text-todo"><b className="font-semibold">{c.todo}</b> needed</span>}
      {c.hold > 0 && <span className="text-hold"><b className="font-semibold">{c.hold}</b> hold</span>}
      {c.remove > 0 && <span className="text-hold"><b className="font-semibold">{c.remove}</b> to remove</span>}
    </span>
  );
}

function SiteCell({ r, s, isPending }: { r: RowData; s: SiteView; isPending: (site: string, path: string | null, prefix?: boolean) => boolean }) {
  switch (r.kind) {
    case "section": return <SectionSummary section={r.section} s={s} isPending={isPending} />;
    case "milestone": return <Pend on={isPending(s.id, `milestones.${r.key}`, true)}><MilestoneValue s={s} k={r.key} /></Pend>;
    case "phase": return <Pend on={isPending(s.id, "phase")}><span className="text-[13px]">{s.phase || muted}</span></Pend>;
    case "openitems": return <span className="text-[13px] text-muted-foreground">{s.open_items?.length ? `${s.open_items.length} open` : "·"}</span>;
    case "reg": return <Pend on={isPending(s.id, r.path)}><RegValue s={s} k={r.key} /></Pend>;
    case "module": {
      const c = s.moduleCells[r.moduleId];
      return <Center><Tip content={c.title}><Chip state={c.st} pending={isPending(s.id, `needs.modules.${r.moduleId}`)}>{LABEL[c.st]}</Chip></Tip></Center>;
    }
    case "int": return <IntValue s={s} k={r.key} pending={isPending(s.id, "integration.dhis2_target")} />;
    case "program": {
      const c = programCell(s, r.program);
      return <Center><Chip state={c.st} title={c.title}>{c.label}</Chip></Center>;
    }
    case "form": {
      const c = s.formCells[r.form.code];
      if (!c) return null;
      const path = r.form.custom ? "custom_forms" : `needs.forms.${r.form.code}`;
      return (
        <Center>
          <Tip content={c.title}><Chip state={c.st} pending={isPending(s.id, path)}>{LABEL[c.st]}</Chip></Tip>
          {c.sync && <Tip content={c.sync === "live" ? "Synced to DHIS2 by the production OpenFn workflow" : "Mapped in the staging OpenFn project only"}><span className={cn("rounded border px-1 text-[9.5px] font-bold leading-[14px] text-accent", c.sync === "staging" && "border-dashed text-muted-foreground")}>D2</span></Tip>}
          {c.note && <Tip content={c.note}><Info className="size-3.5 text-muted-foreground" /></Tip>}
        </Center>
      );
    }
  }
}
const Center = ({ children }: { children: React.ReactNode }) => <div className="flex items-center justify-center gap-1">{children}</div>;
const Pend = ({ on, children }: { on: boolean; children: React.ReactNode }) => <div className="relative pr-2">{children}{on && <PendingDot className="right-0 top-0" />}</div>;

function SectionSummary({ section, s, isPending }: { section: string; s: SiteView; isPending: (site: string, path: string | null, prefix?: boolean) => boolean }) {
  if (section === "time") {
    const n = nextMilestone(s);
    if (n) {
      const d = daysFromToday(n.pd.date);
      const rel = n.pd.prec < 3 ? "target" : d < 0 ? <span className="font-medium text-crit">overdue {-d} d</span> : d <= 14 ? <span className="font-medium text-hold">in {d} d</span> : `in ${d} d`;
      return <div className="grid text-[13px]"><span className="font-medium">{n.label}</span><span className="text-xs text-muted-foreground">{fmtDate(n.pd)} · {rel}</span></div>;
    }
    const live = parseDate(s.milestones?.live?.date);
    if (live) return <div className="grid text-[13px]"><span className="font-medium">Live</span><span className="text-xs text-muted-foreground">since {fmtDate(live)}</span></div>;
    return <div className="grid text-[13px]"><span>{s.phase}</span><span className="text-xs text-muted-foreground">No dates set</span></div>;
  }
  if (section === "reg") {
    const p = regValue(s, "id_prefix").value as string | undefined;
    const l = regValue(s, "languages").value as string[] | undefined;
    if (!p && !l && !s.registration?.custom_form) return muted;
    return (
      <Pend on={isPending(s.id, "registration.id_prefix")}>
        <div className="grid">
          <span className="flex items-center gap-1.5">{p ? <span className="font-mono text-[13px] font-semibold">{p}</span> : tbd("Prefix TBD")}
            {s.registration?.custom_form && <span className="rounded bg-new-bg px-1 text-[10px] font-semibold uppercase text-new">New</span>}</span>
          <span className="text-xs text-muted-foreground">{Array.isArray(l) ? l.join(", ") : "Languages TBD"}</span>
        </div>
      </Pend>
    );
  }
  if (section === "mods") return <Counts c={s.stats.modules} />;
  if (section === "int") {
    const c = s.integrationCell;
    return <div className="grid gap-1"><Tip content={c.title}><Chip state={c.st} pending={isPending(s.id, "integration.need")} className="w-fit">{c.label}</Chip></Tip><span className="text-xs text-muted-foreground">{c.sub}</span></div>;
  }
  return <div className="grid gap-0.5"><Counts c={s.stats.forms} /><span className="text-xs text-muted-foreground">{s.stats.reuse === null ? "No forms scoped" : `${s.stats.reuse}% from shared library`}</span></div>;
}

function MilestoneValue({ s, k }: { s: SiteView; k: string }) {
  const m = s.milestones?.[k];
  if (!m) return muted;
  const pd = parseDate(m.date);
  if (!pd) return <span title={m.note}>{tbd(m.done ? "Done, date TBC" : "Date TBC")}</span>;
  let rel: React.ReactNode;
  if (m.done) rel = <span className="text-on">Done</span>;
  else if (pd.prec === 3) { const d = daysFromToday(pd.date); rel = <span className={d < 0 ? "font-medium text-crit" : d <= 14 ? "font-medium text-hold" : "text-muted-foreground"}>{d < 0 ? `Overdue ${-d} d` : d === 0 ? "Today" : `In ${d} d`}</span>; }
  else rel = <span className="text-muted-foreground">Target</span>;
  return (
    <div className="grid text-[13px]" title={m.note}>
      <span className="font-medium">{m.approx ? "≈ " : ""}{fmtDate(pd)}{m.note && <Info className="ml-1 inline size-3 text-muted-foreground" />}</span>
      <span className="text-xs">{rel}</span>
    </div>
  );
}

function RegValue({ s, k }: { s: SiteView; k: string }) {
  const v = regValue(s, k);
  if (v.value == null || (Array.isArray(v.value) && !v.value.length)) return s.detected || s.registration ? tbd() : muted;
  const text = Array.isArray(v.value) ? v.value.join(k === "address" ? " › " : ", ") : String(v.value);
  const differs = v.plan != null && v.det != null && !same(v.plan, v.det) && !(Array.isArray(v.plan) && !v.plan.length);
  return (
    <div className="grid text-[12.5px]">
      {k === "id_prefix" ? <span className="font-mono font-semibold">{text}</span> : <span>{text}</span>}
      {k === "id_prefix" && v.value === s.detected?.registration?.id_prefix && s.detected?.registration?.id_example && <span className="text-xs text-muted-foreground">e.g. {s.detected.registration.id_example}</span>}
      {differs && <span className="text-[11px] text-hold" title="The site build has a different value: the repo config still needs this change">Repo: {Array.isArray(v.det) ? (v.det as string[]).join(", ") : String(v.det)}</span>}
    </div>
  );
}

function IntValue({ s, k, pending }: { s: SiteView; k: string; pending: boolean }) {
  const i = s.detected?.integration;
  if (k === "target") return <Pend on={pending}>{s.integration?.dhis2_target ? <span className="text-[12.5px]">{s.integration.dhis2_target}</span> : i || s.integration?.need ? tbd() : muted}</Pend>;
  if (!i) return muted;
  if (k === "version") return <div className="grid"><span className="font-mono text-[12.5px] font-semibold">{i.version || "?"}</span>{i.version_date && <span className="text-xs text-muted-foreground">{fmtDate(parseDate(i.version_date)!)}</span>}</div>;
  if (k === "workflows") return (
    <div className="grid gap-0.5 text-[12px]">
      {(i.workflows || []).map((w, n) => <span key={n}><b className={w.enabled ? "text-on" : "text-none"}>{w.enabled ? "On" : "Off"}</b> {(w.name || "").replace(/^wf(\d)-/, "WF$1 ")} <span className="text-muted-foreground">{w.cron}</span></span>)}
    </div>
  );
  if (k === "forms") return (
    <div className="grid text-[12.5px]">
      <span><b>{expandCodes(i.synced_forms).length}</b> live · <b>{expandCodes(i.staging_forms).length}</b> staging</span>
      {i.mapped_forms && !i.synced_forms?.length && <span className="text-xs text-muted-foreground">Mapped but off: {i.mapped_forms.join(", ")}</span>}
    </div>
  );
  return null;
}
