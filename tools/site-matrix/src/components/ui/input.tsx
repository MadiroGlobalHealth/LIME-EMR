import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("h-9 w-full min-w-0 rounded-md border bg-card px-3 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-60", className)} {...props} />;
}
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn("w-full min-w-0 rounded-md border bg-card px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-60", className)} {...props} />;
}
export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("grid gap-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />;
}
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd className={cn("pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground", className)} {...props} />;
}
