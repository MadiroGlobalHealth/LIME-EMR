import * as React from "react";
import { cn } from "@/lib/utils";
import type { CellState } from "@/lib/types";
import { Badge } from "./ui/badge";

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
const statusTone: Record<string, string> = {
  live: "border-on/30 bg-on-bg text-on",
  preparation: "border-hold/30 bg-hold-bg text-hold",
  planned: "border-todo/30 bg-todo-bg text-todo",
};
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 capitalize", statusTone[status] || "text-muted-foreground", className)}>
      <span className="size-1.5 rounded-full bg-current" />{status}
    </Badge>
  );
}
