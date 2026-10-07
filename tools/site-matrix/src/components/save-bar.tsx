import { GitCommitHorizontal } from "lucide-react";
import { useMatrix } from "@/lib/store";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function SaveBar({ onReview, onSignIn }: { onReview: () => void; onSignIn: () => void }) {
  const { pending, view, saving, saveAll, discardAll, commitNote, setCommitNote, user, canEdit, cfg } = useMatrix();
  const count = Object.values(pending).reduce((n, p) => n + Object.keys(p).length, 0);
  if (!count && !saving) return null;
  const names = Object.keys(pending).map((id) => view.sites.find((s) => s.id === id)?.name || id).join(", ");
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 shadow-[0_-8px_30px_rgb(0_0_0/0.08)] backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <form className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6" onSubmit={(e) => { e.preventDefault(); saveAll(); }}>
        <span className="flex items-center gap-2 text-sm">
          <span className="grid size-6 place-items-center rounded-full bg-new text-[11px] font-semibold text-white dark:text-background">{count}</span>
          unsaved change{count === 1 ? "" : "s"} <span className="hidden text-muted-foreground sm:inline">· {names}</span>
        </span>
        <Button type="button" variant="link" size="sm" onClick={onReview}>Review</Button>
        <Input value={commitNote} onChange={(e) => setCommitNote(e.target.value)} placeholder="Why? Added to the commit message (optional)" className="h-9 flex-[1_1_260px]" aria-label="Commit note" />
        {user && <span className="text-xs text-muted-foreground">Commits to <b className="font-medium">{cfg.branch}</b> as @{user.login}</span>}
        <Button type="button" variant="outline" onClick={discardAll} disabled={saving}>Discard</Button>
        {canEdit
          ? <Button type="submit" variant="accent" disabled={saving}><GitCommitHorizontal /> {saving ? "Saving…" : "Save to GitHub"}</Button>
          : <Button type="button" onClick={onSignIn}>Sign in to save</Button>}
      </form>
    </div>
  );
}
