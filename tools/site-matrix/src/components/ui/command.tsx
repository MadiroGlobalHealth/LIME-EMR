import * as React from "react";
import { Command as C } from "cmdk";
import { Dialog as D } from "radix-ui";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function CommandDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-2xl outline-none">
          <D.Title className="sr-only">Search the site matrix</D.Title>
          <D.Description className="sr-only">Jump to a site, a form or an action</D.Description>
          <C className="flex max-h-[min(70vh,520px)] flex-col" loop>{children}</C>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
export function CommandInput(props: React.ComponentProps<typeof C.Input>) {
  return (
    <div className="flex items-center gap-2 border-b px-3">
      <Search className="size-4 text-muted-foreground" />
      <C.Input className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" {...props} />
    </div>
  );
}
export const CommandList = ({ className, ...p }: React.ComponentProps<typeof C.List>) => <C.List className={cn("overflow-y-auto p-1.5", className)} {...p} />;
export const CommandEmpty = (p: React.ComponentProps<typeof C.Empty>) => <C.Empty className="py-8 text-center text-sm text-muted-foreground" {...p} />;
export const CommandGroup = ({ className, ...p }: React.ComponentProps<typeof C.Group>) => (
  <C.Group className={cn("[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground", className)} {...p} />
);
export const CommandItem = ({ className, ...p }: React.ComponentProps<typeof C.Item>) => (
  <C.Item className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground", className)} {...p} />
);
