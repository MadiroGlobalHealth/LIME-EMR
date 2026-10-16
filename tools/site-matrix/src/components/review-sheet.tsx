import { Undo2 } from "lucide-react";
import { useMatrix } from "@/lib/store";
import { pathLabel, show } from "@/lib/model";
import { getPath } from "@/lib/profile";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";

export function ReviewSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pending, base, view, lib, undo, discardSite, saveError } = useMatrix();
  const groups = Object.entries(pending);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b p-5 pr-12">
          <SheetTitle className="text-xl">Unsaved changes</SheetTitle>
          <SheetDescription>Saved together as one change to sites.yaml, under your name. Kept in this browser until then.</SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-5 py-5">
          {saveError && <Alert variant="destructive"><AlertDescription>{saveError}</AlertDescription></Alert>}
          {!groups.length && <p className="text-sm text-muted-foreground">Nothing to save.</p>}
          {groups.map(([id, changes]) => {
            const name = view.sites.find((s) => s.id === id)?.name || id;
            const items = Object.keys(changes).filter((k) => k !== "__new").sort();
            return (
              <section key={id} className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{name}{changes.__new && !base[id] && <span className="ml-2 text-xs font-normal text-muted-foreground">new site</span>}</h3>
                  <Button variant="link" size="sm" onClick={() => discardSite(id)}>Discard</Button>
                </div>
                                <ul className="grid gap-1.5">
                  {items.map((k) => (
                    <li key={k} className="flex items-start justify-between gap-3 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block font-medium">{pathLabel(k, lib)}</span>
                        <span className="block text-muted-foreground">{show(getPath(base[id], k))} → <span className="text-foreground">{show(changes[k])}</span></span>
                      </span>
                      <Button variant="ghost" size="icon-sm" aria-label="Undo" onClick={() => undo(id, k)}><Undo2 /></Button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
