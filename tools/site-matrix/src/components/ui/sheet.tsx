import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = D.Root;
export const SheetTitle = D.Title;
export const SheetDescription = D.Description;

export function SheetContent({ className, children, side = "right", ...props }: React.ComponentProps<typeof D.Content> & { side?: "right" | "center" }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col border bg-card shadow-2xl outline-none",
          side === "right" ? "inset-y-0 right-0 w-[min(540px,100vw)] border-y-0 border-r-0" : "left-1/2 top-[8vh] max-h-[84vh] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 rounded-xl",
          className,
        )}
        {...props}
      >
        {children}
        <D.Close className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1 border-b px-5 pb-4 pt-5 pr-12", className)} {...props} />;
}
