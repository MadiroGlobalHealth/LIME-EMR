import { Github, LogOut, Moon, RefreshCw, Search, Sun } from "lucide-react";
import { useMatrix } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Kbd } from "./ui/kbd";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Tip } from "./tip";

export function Header({ page, onHome, onCompare, onSearch, onSignIn, dark, onTheme }: {
  page: "home" | "compare" | "site"; onHome: () => void; onCompare: () => void; onSearch: () => void; onSignIn: () => void; dark: boolean; onTheme: () => void;
}) {
  const { cfg, user, session, load, signOut } = useMatrix();
  const nav = (active: boolean) => cn("text-muted-foreground", active && "bg-accent text-foreground");
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button onClick={onHome} className="flex min-w-0 items-center gap-2.5 rounded-md text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none" aria-label="LIME EMR sites, home">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand text-[11px] font-bold text-brand-foreground">LM</span>
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block truncate text-sm font-semibold">LIME EMR sites</span>
            <span className="block truncate text-[11px] text-muted-foreground">MSF OCG</span>
          </span>
        </button>
        <nav className="ml-1 flex items-center gap-1 sm:ml-3" aria-label="Pages">
          <Button variant="ghost" size="sm" className={nav(page !== "compare")} onClick={onHome}>Sites</Button>
          <Button variant="ghost" size="sm" className={nav(page === "compare")} onClick={onCompare}>Compare</Button>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onSearch} className="hidden w-56 justify-start font-normal text-muted-foreground lg:flex">
            <Search /> Search <Kbd className="ml-auto">⌘K</Kbd>
          </Button>
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Search" onClick={onSearch}><Search /></Button>
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
                <DropdownMenuItem onSelect={() => load(true)}><RefreshCw /> Reload from GitHub</DropdownMenuItem>
                <DropdownMenuItem asChild><a href={`https://github.com/${cfg.owner}/${cfg.repo}/blob/${cfg.branch}/${cfg.file}`} target="_blank" rel="noreferrer"><Github /> Open sites.yaml on GitHub</a></DropdownMenuItem>
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
