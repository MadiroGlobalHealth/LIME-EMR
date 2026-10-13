import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { MatrixProvider, useMatrix } from "@/lib/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/header";
import { Toolbar } from "@/components/toolbar";
import { Matrix } from "@/components/matrix";
import { CellEditor, type EditRequest } from "@/components/cell-editor";
import { SaveBar } from "@/components/save-bar";
import { SitesHome } from "@/components/sites-home";
import { SitePage } from "@/components/site-page";
import { useRoute } from "@/lib/route";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReviewSheet } from "@/components/review-sheet";
import { SignInDialog } from "@/components/sign-in-dialog";
import { CommandMenu } from "@/components/command-menu";
import { useUiState } from "@/components/ui-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Toaster } from "@/components/ui/sonner";

function useTheme() {
  const [dark, setDark] = React.useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => setDark((d) => {
    const next = !d;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("sm-theme", next ? "dark" : "light"); } catch { /* ignore */ }
    return next;
  });
  // Follow the system theme until the viewer picks one.
  React.useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let stored: string | null = null;
      try { stored = localStorage.getItem("sm-theme"); } catch { /* ignore */ }
      if (stored) return;
      document.documentElement.classList.toggle("dark", mq.matches);
      setDark(mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return { dark, toggle };
}

function Shell() {
  const store = useMatrix();
  const ui = useUiState();
  const theme = useTheme();
  const { route, go } = useRoute();
  const [edit, setEdit] = React.useState<EditRequest | null>(null);
  const [review, setReview] = React.useState(false);
  const [signIn, setSignIn] = React.useState(false);
  const [cmd, setCmd] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((o) => !o); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (Object.keys(store.pending).length) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [store.pending]);
  const pageKey = route.page === "site" ? `site:${route.id}` : route.page;
  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [pageKey]);

  const openSite = (id: string, tab = "overview") => go({ page: "site", id, tab });
  const allIds = ["sec:time", "sec:reg", "sec:mods", "sec:int", "sec:forms", ...store.view.programs.map((p) => `prog:${p.name}`)];
  const goToForm = (program: string, code: string) => {
    go({ page: "compare" });
    ui.setExpanded((e) => ({ ...e, "sec:forms": true, [`prog:${program}`]: true }));
    ui.setOnlyUsed(false);
    setTimeout(() => {
      const row = [...document.querySelectorAll<HTMLElement>("[data-testid=matrix] tbody tr")].find((tr) => tr.textContent?.includes(code));
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
      row?.querySelector<HTMLElement>("td")?.focus();
    }, 120);
  };

  return (
    <div className="min-h-dvh pb-28">
      <Header page={route.page} onHome={() => go({ page: "home" })} onCompare={() => go({ page: "compare" })}
        onSearch={() => setCmd(true)} onSignIn={() => setSignIn(true)} dark={theme.dark} onTheme={theme.toggle} />
      <main className={cn("mx-auto grid gap-5 px-4 py-6 sm:px-6", route.page === "compare" ? "max-w-[1680px]" : "max-w-6xl")}>
        {store.loadError && (
          <Alert role="status" className="border-hold/40 bg-hold-bg text-hold">
            <AlertTriangle />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-hold">
              {store.loadError}
              <Button variant="outline" size="xs" onClick={() => store.load(true)}>Try again</Button>
            </AlertDescription>
          </Alert>
        )}
        {route.page === "home" && <SitesHome onOpen={(id) => openSite(id)} onCompare={() => go({ page: "compare" })} onAdd={() => setAdding(true)} />}
        {route.page === "site" && (
          <SitePage id={route.id} tab={route.tab} onTab={(tab) => go({ page: "site", id: route.id, tab })} onBack={() => go({ page: "home" })} onSignIn={() => setSignIn(true)} />
        )}
        {route.page === "compare" && (
          <>
            <div className="grid max-w-3xl gap-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Compare sites</h1>
              <p className="text-muted-foreground">All sites side by side. Open a row to see details; click a value to change it, or click a site name to open its page.</p>
            </div>
            <Toolbar ui={ui} />
            <Legend />
            <Matrix ui={ui} onEdit={setEdit} onOpenSite={(id) => openSite(id)} />
            <p className="text-xs text-muted-foreground">"On" comes from each site's setup in the repository (pom.xml, configs, OpenFn project). Everything else is a decision stored in <code className="font-mono">{store.cfg.file}</code>.</p>
          </>
        )}
        <DataSource />
      </main>
      <CellEditor req={edit} onClose={() => setEdit(null)} onSignIn={() => setSignIn(true)} />
      <AddSiteDialog open={adding} onOpenChange={setAdding} onAdded={(id) => openSite(id)} />
      <ReviewSheet open={review} onOpenChange={setReview} />
      <SignInDialog open={signIn} onOpenChange={setSignIn} />
      <CommandMenu open={cmd} onOpenChange={setCmd} onSite={(id) => openSite(id)} onForm={goToForm}
        onSignIn={() => setSignIn(true)} dark={theme.dark} onTheme={theme.toggle} onExpandAll={() => { go({ page: "compare" }); ui.expandAll(allIds); }} />
      <SaveBar onReview={() => setReview(true)} onSignIn={() => setSignIn(true)} />
      <Toaster position="bottom-center" closeButton offset={96} theme={theme.dark ? "dark" : "light"} />
    </div>
  );
}

function DataSource() {
  const { source, cfg, snapshot } = useMatrix();
  return (
    <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("size-2 rounded-full", source === "github" ? "bg-on" : source === "loading" ? "animate-pulse bg-hold" : "bg-none")} />
      {source === "github" ? <>Up to date with GitHub ({cfg.owner}/{cfg.repo}, branch {cfg.branch}).</> : source === "loading" ? "Loading from GitHub…" : <>Saved copy from {snapshot.built_at.slice(0, 10)}; GitHub could not be reached.</>}
    </p>
  );
}

function AddSiteDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: (id: string) => void }) {
  const { addSite } = useMatrix();
  const [name, setName] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [error, setError] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setName(""); setCountry(""); setError(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a site</DialogTitle>
          <DialogDescription>It starts as Planned. Fill in its details on the next page, then save.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); try { const id = addSite(name.trim(), country.trim()); onOpenChange(false); setName(""); setCountry(""); onAdded(id); } catch (err) { setError((err as Error).message); } }}>
          <div className="grid gap-1.5"><Label htmlFor="new-name">Site name</Label><Input id="new-name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mombasa" /></div>
          <div className="grid gap-1.5"><Label htmlFor="new-country">Country</Label><Input id="new-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Kenya" /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-fit">Add site</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Legend() {
  const item = (cls: string, label: string, text: string) => (
    <span className="inline-flex items-center gap-1.5"><span className={`inline-flex h-5 min-w-6 items-center justify-center rounded px-1.5 text-[11px] font-semibold ${cls}`}>{label}</span>{text}</span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Legend">
      {item("bg-on-bg text-on", "On", "In the site build")}
      {item("bg-todo-bg text-todo ring-1 ring-inset ring-todo/50", "Needed", "Needed, not built yet")}
      {item("bg-hold-bg text-hold", "Hold", "On hold")}
      {item("text-hold ring-1 ring-inset ring-hold", "Remove?", "Built, marked not needed")}
      {item("text-none font-normal", "–", "Not needed")}
      {item("text-none/60 font-normal", "·", "No decision")}
      <span className="inline-flex items-center gap-1.5"><span className="rounded border px-1 text-[9.5px] font-bold leading-[14px] text-brand">D2</span>Synced to DHIS2</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-new" />Not saved yet</span>
      <span className="ml-auto hidden lg:inline">Arrow keys move, Enter edits, ⌘K searches</span>
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <MatrixProvider><Shell /></MatrixProvider>
    </TooltipProvider>
  );
}
