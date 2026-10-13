import { Github, LogOut, Moon, RefreshCw, Search, Sun } from "lucide-react";
import { useMatrix } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Kbd } from "./ui/kbd";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Tip } from "./tip";

export function Header({ onSearch, onSignIn, dark, onTheme }: { onSearch: () => void; onSignIn: () => void; dark: boolean; onTheme: () => void }) {
  const { cfg, source, user, session, load, signOut, snapshot } = useMatrix();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-brand text-[11px] font-bold text-brand-foreground">LM</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">Site Matrix</p>
            <p className="truncate text-[11px] text-muted-foreground">LIME EMR · MSF OCG</p>
          </div>
        </div>
        <Button variant="outline" onClick={onSearch} className="ml-2 hidden w-full max-w-sm justify-start font-normal text-muted-foreground md:flex">
          <Search /> Find a site, form or action <Kbd className="ml-auto">⌘K</Kbd>
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <Tip content={source === "github" ? `Profiles read live from ${cfg.owner}/${cfg.repo} @ ${cfg.branch}` : `Snapshot built ${snapshot.built_at} from ${snapshot.source_commit}`}>
            <Badge variant="outline" asChild className="hidden h-7 gap-1.5 px-2.5 sm:inline-flex">
              <a href={`https://github.com/${cfg.owner}/${cfg.repo}/tree/${cfg.branch}/${cfg.dir}`} target="_blank" rel="noreferrer">
                <span className={cn("size-2 rounded-full", source === "github" ? "bg-on" : source === "loading" ? "animate-pulse bg-hold" : "bg-none")} />
                {source === "github" ? cfg.branch : source === "loading" ? "Loading…" : "Snapshot"}
              </a>
            </Badge>
          </Tip>
          <Tip content="Reload from GitHub"><Button variant="ghost" size="icon-sm" aria-label="Reload from GitHub" onClick={() => load(true)} disabled={source === "loading"}><RefreshCw className={cn(source === "loading" && "animate-spin")} /></Button></Tip>
          <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Search" onClick={onSearch}><Search /></Button>
          <Tip content={dark ? "Light theme" : "Dark theme"}><Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={onTheme}>{dark ? <Sun /> : <Moon />}</Button></Tip>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-1 rounded-full pl-0.5 pr-3" aria-label="Account">
                  {user.avatar_url ? <img src={user.avatar_url} alt="" className="size-7 rounded-full" /> : <Github className="mx-1" />}
                  <span className="hidden sm:inline">@{user.login}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="grid gap-0.5">
                  <span>{user.name || "@" + user.login}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user.canPush ? `Saves commit to ${cfg.branch} as @${user.login}` : `@${user.login} cannot write to ${cfg.repo}`}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut}><LogOut /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" className="ml-1" onClick={onSignIn} disabled={!!session}><Github /> {session ? "Signing in…" : "Sign in"}</Button>
          )}
        </div>
      </div>
    </header>
  );
}
