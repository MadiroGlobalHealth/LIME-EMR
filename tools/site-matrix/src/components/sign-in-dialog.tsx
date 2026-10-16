import * as React from "react";
import { Github, KeyRound } from "lucide-react";
import { useMatrix } from "@/lib/store";
import { oauthAvailable, startOAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function SignInDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { cfg, signInWithToken } = useMatrix();
  const [oauth, setOauth] = React.useState<boolean | null>(null);
  const [showToken, setShowToken] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [remember, setRemember] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { if (open && oauth === null) oauthAvailable().then(setOauth); }, [open, oauth]);
  React.useEffect(() => { if (oauth === false) setShowToken(true); }, [oauth]);

  const tokenUrl = `https://github.com/settings/personal-access-tokens/new?name=${encodeURIComponent("LIME Site Matrix")}&description=${encodeURIComponent(`Edit site profiles in ${cfg.owner}/${cfg.repo}`)}&target_name=${encodeURIComponent(cfg.owner)}&contents=write`;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { await signInWithToken(token.trim(), remember); setToken(""); onOpenChange(false); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sign in to edit</DialogTitle>
          <DialogDescription>
            Every save is a commit to <b className="font-medium text-foreground">{cfg.owner}/{cfg.repo}</b> by your GitHub account, so the history shows who changed what. You need write access to the repository.
          </DialogDescription>
        </DialogHeader>
        {oauth && <Button size="lg" onClick={startOAuth}><Github /> Sign in with GitHub</Button>}
        {oauth && !showToken && <Button variant="link" size="sm" className="w-fit" onClick={() => setShowToken(true)}><KeyRound /> Use a personal access token instead</Button>}
        {oauth === null && <p className="text-sm text-muted-foreground">Checking sign-in options…</p>}
        {showToken && (
          <form className="grid gap-3 rounded-lg border bg-muted/40 p-4" onSubmit={submit}>
            <ol className="grid list-decimal gap-1 pl-5 text-sm">
              <li><a href={tokenUrl} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">Create a fine-grained token</a> on GitHub.</li>
              <li>Resource owner <b>{cfg.owner}</b>, repository access: only <b>{cfg.repo}</b>.</li>
              <li>Repository permissions: <b>Contents: Read and write</b>. Nothing else.</li>
              <li>Generate it and paste it here. It stays in this browser and is only sent to api.github.com.</li>
            </ol>
            <div className="grid gap-2">
              <Label htmlFor="gh-token">Personal access token</Label>
              <Input id="gh-token" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" className="bg-background font-mono" autoFocus={!oauth} />
            </div>
            <Label className="font-normal"><Checkbox checked={remember} onCheckedChange={(c) => setRemember(c === true)} /> Remember on this device</Label>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button type="submit" className="w-fit" disabled={busy || !token.trim()}>{busy ? "Checking…" : "Sign in with token"}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
