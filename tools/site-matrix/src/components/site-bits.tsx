import { daysFromToday, fmtDate, nextMilestone, parseDate, regValue, type SiteView } from "@/lib/model";
import { cn } from "@/lib/utils";

/** Forms in the build or still to build, in plain numbers. */
export function formsProgress(s: SiteView) {
  const { on, todo } = s.stats.forms;
  const total = on + todo;
  return { on, todo, total, pct: total ? Math.round((100 * on) / total) : 0 };
}

const DHIS2: Record<string, [string, string]> = {
  on: ["Sending data", "text-on"],
  template: ["Set up, not active", "text-hold"],
  todo: ["To set up", "text-todo"],
  hold: ["Later", "text-hold"],
  remove: ["Active, marked not needed", "text-hold"],
  no: ["Not needed", "text-muted-foreground"],
  unk: ["Not decided", "text-muted-foreground"],
};
export function Dhis2Text({ s, className }: { s: SiteView; className?: string }) {
  const [text, tone] = DHIS2[s.integrationCell.st] || DHIS2.unk;
  return <span className={cn(tone, className)}>{text}</span>;
}

export function relDays(d: number) {
  return d < 0 ? `${-d} day${d === -1 ? "" : "s"} late` : d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`;
}

/** The next dated milestone, or when the site went live. */
export function NextStep({ s }: { s: SiteView }) {
  const n = nextMilestone(s);
  if (n) {
    const d = daysFromToday(n.pd.date);
    const late = n.pd.prec === 3 && d < 0;
    return (
      <span>
        {n.label}: <span className="font-medium text-foreground">{fmtDate(n.pd)}</span>
        {n.pd.prec === 3 && <span className={cn("ml-1", late ? "font-medium text-destructive" : d <= 14 ? "font-medium text-hold" : "")}>({relDays(d)})</span>}
      </span>
    );
  }
  const live = parseDate(s.milestones?.live?.date);
  if (live) return <span>Live since <span className="font-medium text-foreground">{fmtDate(live)}</span></span>;
  return <span>No dates set yet</span>;
}

export function idPrefix(s: SiteView) {
  return (regValue(s, "id_prefix").value as string | undefined) || null;
}
