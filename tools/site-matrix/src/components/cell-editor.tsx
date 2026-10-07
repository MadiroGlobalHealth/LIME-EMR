import * as React from "react";
import { useMatrix } from "@/lib/store";
import { getPath, clone, same } from "@/lib/profile";
import { REG_ROWS, regValue, type FormRow, type Program } from "@/lib/model";
import type { Need, SiteStatus } from "@/lib/types";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";
import { Button } from "./ui/button";
import { Input, Label } from "./ui/input";
import { Chip, StatusBadge } from "./ui/chip";

export interface EditRequest {
  site: string;
  kind: "need" | "status" | "text" | "list" | "milestone" | "denied";
  path: string | null;
  title: string;
  anchor: HTMLElement;
  program?: Program;
  form?: FormRow;
}

const NEEDS: [Need | null, string, "todo" | "no" | "hold" | "unk", string][] = [
  ["needed", "Needed", "todo", "Needed"],
  ["not_needed", "Not needed", "no", "–"],
  ["on_hold", "On hold", "hold", "Hold"],
  [null, "No decision (use the repo state)", "unk", "·"],
];

export function CellEditor({ req, onClose, onSignIn }: { req: EditRequest | null; onClose: () => void; onSignIn: () => void }) {
  const store = useMatrix();
  const anchorRef = React.useRef<HTMLElement | null>(null);
  anchorRef.current = req?.anchor || null;
  const site = req ? store.view.sites.find((s) => s.id === req.site) : null;
  const restoreFocus = () => req?.anchor.focus();

  return (
    <Popover open={!!req} onOpenChange={(o) => { if (!o) { onClose(); restoreFocus(); } }}>
      <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
      {req && site && (
        <PopoverContent className="grid gap-3" onCloseAutoFocus={(e) => e.preventDefault()}>
          <div>
            <p className="text-sm font-semibold">{req.kind === "denied" ? "Sign in to edit" : req.title}</p>
            <p className="text-xs text-muted-foreground">{site.name}</p>
          </div>
          {req.kind === "denied" && <Denied onSignIn={() => { onClose(); onSignIn(); }} />}
          {req.kind === "need" && (
            <div className="grid gap-0.5">
              {NEEDS.map(([need, label, st, short]) => (
                <button key={label} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() => { applyNeed(store, req, need); onClose(); restoreFocus(); }}>
                  <Chip state={st}>{short}</Chip>{label}
                </button>
              ))}
            </div>
          )}
          {req.kind === "status" && (
            <div className="grid gap-0.5">
              {(["live", "preparation", "planned", "closed"] as SiteStatus[]).map((st) => (
                <button key={st} className="rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" onClick={() => { store.set(req.site, "status", st); onClose(); restoreFocus(); }}>
                  <StatusBadge status={st} />
                </button>
              ))}
            </div>
          )}
          {(req.kind === "text" || req.kind === "list") && <TextEditor req={req} onDone={() => { onClose(); restoreFocus(); }} />}
          {req.kind === "milestone" && <MilestoneEditor req={req} onDone={() => { onClose(); restoreFocus(); }} />}
        </PopoverContent>
      )}
    </Popover>
  );
}

function Denied({ onSignIn }: { onSignIn: () => void }) {
  const { source, cfg } = useMatrix();
  return (
    <div className="grid gap-2 text-sm">
      <p className="text-muted-foreground">
        {source === "github" ? `Changes are saved as commits to ${cfg.owner}/${cfg.repo}, under your GitHub account.` : "GitHub could not be reached, so the page shows its snapshot and editing is off."}
      </p>
      {source === "github" && <Button size="sm" onClick={onSignIn}>Sign in with GitHub</Button>}
    </div>
  );
}

function applyNeed(store: ReturnType<typeof useMatrix>, req: EditRequest, need: Need | null) {
  if (req.program) {
    const changes: Record<string, unknown> = {};
    for (const f of req.program.forms) if (!f.custom) changes[`needs.forms.${f.code}`] = need;
    store.setMany(req.site, changes);
  } else if (req.path === "custom_forms") {
    const site = store.view.sites.find((s) => s.id === req.site)!;
    const list = clone(site.custom_forms || []).map((c) => (c.code === req.form?.code ? { ...c, need: need || "needed" } : c));
    store.set(req.site, "custom_forms", list);
  } else if (req.path) store.set(req.site, req.path, need);
}

function TextEditor({ req, onDone }: { req: EditRequest; onDone: () => void }) {
  const store = useMatrix();
  const site = store.view.sites.find((s) => s.id === req.site)!;
  const isAddress = req.path!.endsWith("address");
  const sep = isAddress ? " › " : ", ";
  const reg = REG_ROWS.find((r) => r[4] === req.path);
  const current = getPath(site, req.path!);
  const det = reg ? regValue(site, reg[0]).det : null;
  const toText = (v: unknown) => (Array.isArray(v) ? v.join(sep) : v == null ? "" : String(v));
  const [value, setValue] = React.useState(toText(current));
  const repo = det != null && !same(det, current) ? toText(det) : "";
  const apply = (text: string) => {
    const t = text.trim();
    const v = !t ? null : req.kind === "list" ? t.split(isAddress ? /\s*[›>]\s*/ : /\s*,\s*/).filter(Boolean) : t;
    store.set(req.site, req.path!, v);
    onDone();
  };
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); apply(value); }}>
      <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={repo || "Not set"} aria-label={req.title} />
      {req.kind === "list" && <p className="text-xs text-muted-foreground">{isAddress ? "Levels separated by ›" : "Separate values with commas"}</p>}
      {repo && <p className="text-xs text-muted-foreground">In the site build: {repo}</p>}
      <div className="flex gap-2"><Button size="sm" type="submit">Apply</Button><Button size="sm" variant="outline" type="button" onClick={() => apply("")}>Clear</Button></div>
    </form>
  );
}

function MilestoneEditor({ req, onDone }: { req: EditRequest; onDone: () => void }) {
  const store = useMatrix();
  const site = store.view.sites.find((s) => s.id === req.site)!;
  const m = (getPath(site, req.path!) || {}) as { date?: string; done?: boolean; note?: string; approx?: boolean };
  const [date, setDate] = React.useState(m.date || "");
  const [done, setDone] = React.useState(!!m.done);
  const [note, setNote] = React.useState(m.note || "");
  const [error, setError] = React.useState("");
  const apply = (clear = false) => {
    const d = clear ? "" : date.trim();
    if (d && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(d)) { setError("Use YYYY-MM-DD, YYYY-MM or YYYY."); return; }
    let next: Record<string, unknown> | null = { ...m, date: d || null };
    if (!clear && done) next.done = true; else delete next.done;
    if (!clear && note.trim()) next.note = note.trim(); else delete next.note;
    if (clear) delete next.approx;
    if (!next.date && !next.done && !next.note) next = null;
    store.set(req.site, req.path!, next);
    onDone();
  };
  return (
    <form className="grid gap-2.5" onSubmit={(e) => { e.preventDefault(); apply(); }}>
      <Label>Date <Input autoFocus value={date} onChange={(e) => setDate(e.target.value)} placeholder="2026-11-30" className="font-mono" /></Label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} className="size-4 accent-[var(--primary)]" /> Done</label>
      <Label>Note <Input value={note} onChange={(e) => setNote(e.target.value)} /></Label>
      {error && <p className="text-xs text-crit">{error}</p>}
      <div className="flex gap-2"><Button size="sm" type="submit">Apply</Button><Button size="sm" variant="outline" type="button" onClick={() => apply(true)}>Clear</Button></div>
    </form>
  );
}
