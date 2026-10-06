import * as React from "react";
import { cn } from "@/lib/utils";
import type { CellState } from "@/lib/types";

export const chipTone: Record<CellState, string> = {
  on: "bg-on-bg text-on",
  todo: "chip-hatched bg-todo-bg text-todo ring-1 ring-inset ring-todo/50",
  hold: "bg-hold-bg text-hold",
  remove: "text-hold ring-1 ring-inset ring-hold",
  no: "text-none font-normal",
  unk: "text-none/60 font-normal",
  template: "bg-hold-bg text-hold",
};

export function Chip({ state, pending, className, ...props }: React.ComponentProps<"span"> & { state: CellState; pending?: boolean }) {
  return (
    <span className={cn("relative inline-flex h-5 min-w-6 items-center justify-center gap-1 whitespace-nowrap rounded px-1.5 text-[11px] font-semibold", chipTone[state], className)} {...props}>
      {props.children}
      {pending && <PendingDot />}
    </span>
  );
}
export function PendingDot({ className }: { className?: string }) {
  return <span aria-label="Not saved yet" className={cn("absolute -right-1 -top-1 size-2 rounded-full bg-new ring-2 ring-card", className)} />;
}
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = status === "live" ? "bg-on-bg text-on" : status === "preparation" ? "bg-hold-bg text-hold" : status === "planned" ? "bg-todo-bg text-todo" : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide", tone, className)}>
      <span className="size-1.5 rounded-full bg-current" />{status}
    </span>
  );
}
