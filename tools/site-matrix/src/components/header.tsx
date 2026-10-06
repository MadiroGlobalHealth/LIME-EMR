import { Github, LogOut, Moon, RefreshCw, Search, Sun } from "lucide-react";
import { DropdownMenu as M } from "radix-ui";
import { useMatrix } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Kbd } from "./ui/input";
import { Tip } from "./ui/tooltip";

export function Header({ onSearch, onSignIn, dark, onTheme }: { onSearch: () => void; onSignIn: () => void; dark: boolean; onTheme: () => void }) {
  const { cfg, source, user, session, load, signOut, snapshot } = useMatrix();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-accent text-[11px] font-bold text-white">LM</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">Site Matrix</p>
            <p className="truncate text-[11px] text-muted-foreground">LIME EMR · MSF OCG</p>
          </div>
        </div>
        <button onClick={onSearch} className="ml-2 hidden h-9 w-full max-w-sm items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground shadow-xs hover:bg-muted md:flex">
          <Search className="size-4" /> Find a site, form or action <Kbd className="ml-auto">⌘K</Kbd>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <Tip content={source === "github" ? `Profiles read live from ${cfg.owner}/${cfg.repo} @ ${cfg.branch}` : `Snapshot built ${snapshot.built_at} from ${snapshot.source_commit}`}>
            <a href={`https://github.com/${cfg.owner}/${cfg.repo}/tree/${cfg.branch}/${cfg.dir}`} target="_blank" rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs hover:bg-muted sm:inline-flex">
              <span className={cn("size-2 rounded-full", source === "github" ? "bg-on" : source === "loading" ? "animate-pulse bg-hold" : "bg-none")} />
              {source === "github" ? cfg.branch : source === "loading" ? "Loading…" : "Snapshot"}
            </a>
          </Tip>
          <Tip content="Reload from GitHub"><Button variant="ghost" size="icon-sm" aria-label="Reload from GitHub" onClick={() => load(true)} disabled={source === "loading"}><RefreshCw className={cn(source === "loading" && "animate-spin")} /></Button></Tip>
          <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Search" onClick={onSearch}><Search /></Button>
          <Tip content={dark ? "Light theme" : "Dark theme"}><Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={onTheme}>{dark ? <Sun /> : <Moon />}</Button></Tip>
          {user ? (
            <M.Root>
              <M.Trigger asChild>
                <button className="ml-1 flex items-center gap-2 rounded-full border bg-card py-0.5 pl-0.5 pr-2.5 text-sm hover:bg-muted" aria-label="Account">
                  {user.avatar_url ? <img src={user.avatar_url} alt="" className="size-7 rounded-full" /> : <Github className="m-1 size-5" />}
                  <span className="hidden sm:inline">@{user.login}</span>
                </button>
              </M.Trigger>
              <M.Portal>
                <M.Content align="end" sideOffset={6} className="z-50 w-64 rounded-lg border bg-popover p-1.5 text-sm shadow-lg">
                  <div className="px-2 py-1.5">
                    <p className="font-medium">{user.name || "@" + user.login}</p>
                    <p className="text-xs text-muted-foreground">{user.canPush ? `Saves commit to ${cfg.branch} as @${user.login}` : `@${user.login} cannot write to ${cfg.repo}`}</p>
                  </div>
                  <M.Separator className="my-1 h-px bg-border" />
                  <M.Item onSelect={signOut} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none data-[highlighted]:bg-muted"><LogOut className="size-4" /> Sign out</M.Item>
                </M.Content>
              </M.Portal>
            </M.Root>
          ) : (
            <Button size="sm" className="ml-1" onClick={onSignIn} disabled={!!session}><Github /> {session ? "Signing in…" : "Sign in"}</Button>
          )}
        </div>
      </div>
    </header>
  );
}
