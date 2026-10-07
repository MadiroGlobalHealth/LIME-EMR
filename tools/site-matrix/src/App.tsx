import * as React from "react";
import { Toaster } from "sonner";
import { AlertTriangle } from "lucide-react";
import { MatrixProvider, useMatrix } from "@/lib/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/header";
import { Kpis } from "@/components/kpis";
import { Toolbar } from "@/components/toolbar";
import { Matrix } from "@/components/matrix";
import { CellEditor, type EditRequest } from "@/components/cell-editor";
import { SaveBar } from "@/components/save-bar";
import { SiteSheet } from "@/components/site-sheet";
import { ReviewSheet } from "@/components/review-sheet";
import { SignInDialog } from "@/components/sign-in-dialog";
import { CommandMenu } from "@/components/command-menu";
import { useUiState } from "@/components/ui-state";
import { Button } from "@/components/ui/button";

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
  const [edit, setEdit] = React.useState<EditRequest | null>(null);
  const [site, setSite] = React.useState<{ id: string; tab: string } | null>(null);
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

  const allIds = ["sec:time", "sec:reg", "sec:mods", "sec:int", "sec:forms", ...store.view.programs.map((p) => `prog:${p.name}`)];
  const goToForm = (program: string, code: string) => {
    ui.setExpanded((e) => ({ ...e, "sec:forms": true, [`prog:${program}`]: true }));
    ui.setOnlyUsed(false);
    setTimeout(() => {
      const row = [...document.querySelectorAll<HTMLElement>("[data-testid=matrix] tbody tr")].find((tr) => tr.textContent?.includes(code));
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
      row?.querySelector<HTMLElement>("td")?.focus();
    }, 60);
  };

  return (
    <div className="min-h-dvh pb-28">
      <Header onSearch={() => setCmd(true)} onSignIn={() => setSignIn(true)} dark={theme.dark} onTheme={theme.toggle} />
      <main className="mx-auto grid max-w-[1680px] gap-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid max-w-3xl gap-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Site Matrix</h1>
            <p className="text-sm text-muted-foreground">What each LIME EMR site runs today, read from the repo, and what each site needs. Click any value to change it; saving commits the site profile to GitHub under your name.</p>
          </div>
          {store.canEdit && (adding
            ? <AddSite onDone={(id) => { setAdding(false); if (id) setSite({ id, tab: "overview" }); }} />
            : <Button variant="outline" onClick={() => setAdding(true)}>Add site</Button>)}
        </div>
        {store.loadError && (
          <div role="status" className="flex items-start gap-2.5 rounded-lg border border-hold/40 bg-hold-bg px-4 py-3 text-sm text-hold">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /><span className="flex-1">{store.loadError}</span>
            <Button variant="outline" size="xs" onClick={() => store.load(true)}>Try again</Button>
          </div>
        )}
        <Kpis />
        <Toolbar ui={ui} />
        <Legend />
        <Matrix ui={ui} onEdit={setEdit} onOpenSite={(id) => setSite({ id, tab: "overview" })} />
        <p className="text-xs text-muted-foreground">"On" comes from each site's build (pom.xml, configs, OpenFn project). Everything else is a decision stored in <code className="font-mono">{store.cfg.dir}/&lt;site&gt;.md</code>. Reuse = shared library forms ÷ all forms on or needed at the site.</p>
      </main>
      <CellEditor req={edit} onClose={() => setEdit(null)} onSignIn={() => setSignIn(true)} />
      <SiteSheet siteId={site?.id || null} tab={site?.tab || "overview"} onTab={(tab) => setSite((s) => (s ? { ...s, tab } : s))} onClose={() => setSite(null)} />
      <ReviewSheet open={review} onOpenChange={setReview} />
      <SignInDialog open={signIn} onOpenChange={setSignIn} />
      <CommandMenu open={cmd} onOpenChange={setCmd} onSite={(id) => setSite({ id, tab: "overview" })} onForm={goToForm}
        onSignIn={() => setSignIn(true)} dark={theme.dark} onTheme={theme.toggle} onExpandAll={() => ui.expandAll(allIds)} />
      <SaveBar onReview={() => setReview(true)} onSignIn={() => setSignIn(true)} />
      <Toaster position="bottom-center" richColors closeButton offset={96} theme={theme.dark ? "dark" : "light"} />
    </div>
  );
}

function AddSite({ onDone }: { onDone: (id: string | null) => void }) {
  const { addSite } = useMatrix();
  const [name, setName] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [error, setError] = React.useState("");
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); try { onDone(addSite(name.trim(), country.trim())); } catch (err) { setError((err as Error).message); } }}>
      <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Site name" className="h-9 rounded-md border bg-card px-3 text-sm" />
      <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="h-9 w-32 rounded-md border bg-card px-3 text-sm" />
      <Button type="submit">Add as planned</Button>
      <Button type="button" variant="ghost" onClick={() => onDone(null)}>Cancel</Button>
      {error && <span className="w-full text-sm text-crit">{error}</span>}
    </form>
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
      <span className="inline-flex items-center gap-1.5"><span className="rounded border px-1 text-[9.5px] font-bold leading-[14px] text-accent">D2</span>Synced to DHIS2</span>
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
