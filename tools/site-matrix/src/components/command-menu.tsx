import { Download, FileText, Github, Moon, MapPin, RefreshCw, Rows3, Sun } from "lucide-react";
import { useMatrix } from "@/lib/store";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { exportCsv } from "./toolbar";

export function CommandMenu({ open, onOpenChange, onSite, onForm, onSignIn, dark, onTheme, onExpandAll }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSite: (id: string) => void; onForm: (program: string, code: string) => void;
  onSignIn: () => void; dark: boolean; onTheme: () => void; onExpandAll: () => void;
}) {
  const { view, lib, load, user } = useMatrix();
  const run = (fn: () => void) => () => { onOpenChange(false); fn(); };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Find a site, a form or an action…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Sites">
          {view.sites.map((s) => (
            <CommandItem key={s.id} value={`site ${s.name} ${s.country} ${s.status}`} onSelect={run(() => onSite(s.id))}>
              <MapPin /> {s.name} <span className="ml-auto text-xs text-muted-foreground">{s.country} · {s.status}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Forms">
          {view.rows.map((f) => (
            <CommandItem key={f.code + (f.ownerId || "")} value={`form ${f.code} ${f.name} ${f.program}`} onSelect={run(() => onForm(f.program, f.code))}>
              <FileText /> <span className="font-mono text-xs text-muted-foreground">{f.custom ? "new" : f.code}</span> {f.name} <span className="ml-auto text-xs text-muted-foreground">{f.program}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem value="reload refresh github" onSelect={run(() => load(true))}><RefreshCw /> Reload from GitHub</CommandItem>
          <CommandItem value="expand all sections" onSelect={run(onExpandAll)}><Rows3 /> Expand everything</CommandItem>
          <CommandItem value="export csv excel download" onSelect={run(() => exportCsv(view, lib))}><Download /> Export CSV</CommandItem>
          <CommandItem value="theme dark light" onSelect={run(onTheme)}>{dark ? <Sun /> : <Moon />} {dark ? "Light theme" : "Dark theme"}</CommandItem>
          {!user && <CommandItem value="sign in github login" onSelect={run(onSignIn)}><Github /> Sign in to edit</CommandItem>}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
