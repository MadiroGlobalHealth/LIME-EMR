import * as React from "react";
import { toast } from "sonner";
import snapshotJson from "@/snapshot.json";
import { createGitHub, explain, GitHubError } from "./github";
import { clearSession, loadSession, saveSession, takeSessionFromUrl, type Session } from "./auth";
import { applyPending, clone, getPath, parseDoc, renderDoc, same, slugify, type SitesDoc } from "./profile";
import { buildView, commitMessage, type MatrixView } from "./model";
import type { Library, Pending, Profile, RepoConfig, SiteChanges, Snapshot } from "./types";

const MAX_TRIES = 3;

const snapshot = snapshotJson as unknown as Snapshot;
const initial = parseDoc(snapshot.text);

function repoConfig(): RepoConfig {
  const q = new URLSearchParams(location.search);
  const env = import.meta.env;
  return {
    ...snapshot.repo,
    owner: env.VITE_REPO_OWNER || snapshot.repo.owner,
    repo: env.VITE_REPO_NAME || snapshot.repo.repo,
    branch: q.get("branch") || env.VITE_REPO_BRANCH || snapshot.repo.branch,
  };
}

type Source = "snapshot" | "loading" | "github";
export interface User { login: string; name?: string; avatar_url?: string; canPush: boolean }

function useStored<T>(key: string, initial: T) {
  const [v, setV] = React.useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  React.useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV] as const;
}

function useMatrixState() {
  const cfg = React.useMemo(repoConfig, []);
  const [lib, setLib] = React.useState<Library>(initial.library);
  const [base, setBase] = React.useState<Record<string, Profile>>(initial.sites);
  const [fileText, setFileText] = React.useState(snapshot.text);
  const [pending, setPending] = useStored<Pending>(`sm-draft:${cfg.owner}/${cfg.repo}@${cfg.branch}`, {});
  const [source, setSource] = React.useState<Source>("loading");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [commitNote, setCommitNote] = React.useState("");

  const tokenRef = React.useRef<string | null>(null);
  tokenRef.current = session?.token || null;
  const gh = React.useMemo(() => createGitHub(cfg, () => tokenRef.current), [cfg]);
  const view: MatrixView = React.useMemo(() => buildView(base, pending, lib), [base, pending, lib]);
  const canEdit = !!user?.canPush && source === "github";

  const adopt = React.useCallback((text: string) => {
    const p = parseDoc(text);
    setBase(p.sites);
    if (p.library.forms.length) setLib(p.library);
    setFileText(text);
  }, []);

  const load = React.useCallback(async (announce = false) => {
    setSource("loading");
    try {
      adopt((await gh.read(cfg.file)).text);
      setSource("github");
      setLoadError(null);
      if (announce) toast.success("Loaded the latest version from GitHub");
    } catch (e) {
      setSource("snapshot");
      setLoadError(`${explain(e, cfg)} Showing the saved copy from ${snapshot.source_commit || "the last build"}.`);
    }
  }, [gh, cfg, adopt]);

  const identify = React.useCallback(async (s: Session) => {
    tokenRef.current = s.token;
    const me = await gh.me();
    const canPush = await gh.canPush().catch(() => false);
    setUser({ login: me.login, name: me.name, avatar_url: me.avatar_url, canPush });
    return canPush;
  }, [gh]);

  // Start: pick up an OAuth redirect or a stored session, then load.
  React.useEffect(() => {
    let s: Session | null = null;
    try { s = takeSessionFromUrl() || loadSession(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "GitHub sign-in failed"); }
    if (s) {
      setSession(s);
      identify(s).catch((e) => {
        if (e instanceof GitHubError && e.status === 401) { clearSession(); setSession(null); toast.error("Your GitHub sign-in expired. Sign in again to edit."); }
      });
    }
    load();
  }, [identify, load]);

  const signInWithToken = React.useCallback(async (token: string, remember: boolean) => {
    const s: Session = { token, method: "token" };
    const prev = session;
    setSession(s);
    try {
      const canPush = await identify(s);
      if (!canPush) {
        setSession(prev); tokenRef.current = prev?.token || null; setUser(null);
        throw new Error(`This account or token cannot write to ${cfg.owner}/${cfg.repo}. Give it Contents: Read and write on that repository.`);
      }
      saveSession(s, remember);
      if (source !== "github") load();
    } catch (e) {
      setSession(prev); tokenRef.current = prev?.token || null;
      throw e instanceof GitHubError ? new Error(explain(e, cfg)) : e;
    }
  }, [identify, session, source, load, cfg]);

  const signOut = React.useCallback(() => {
    clearSession(); setSession(null); setUser(null); tokenRef.current = null;
    toast("Signed out. Unsaved changes stay in this browser.");
  }, []);

  // ---- editing
  const setMany = React.useCallback((site: string, changes: Record<string, unknown>) => {
    setPending((all) => {
      const next: SiteChanges = { ...(all[site] || {}) };
      for (const [path, value] of Object.entries(changes)) {
        if (base[site] && same(getPath(base[site], path), value)) delete next[path];
        else next[path] = value == null ? null : clone(value);
      }
      const out = { ...all };
      if (Object.keys(next).length) out[site] = next; else delete out[site];
      return out;
    });
  }, [base, setPending]);
  const set = React.useCallback((site: string, path: string, value: unknown) => setMany(site, { [path]: value }), [setMany]);
  const undo = React.useCallback((site: string, path: string) => setPending((all) => {
    const next = { ...(all[site] || {}) }; delete next[path];
    const out = { ...all }; if (Object.keys(next).length) out[site] = next; else delete out[site];
    return out;
  }), [setPending]);
  const discardSite = React.useCallback((site: string) => setPending((all) => { const o = { ...all }; delete o[site]; return o; }), [setPending]);
  const discardAll = React.useCallback(() => { setPending({}); setSaveError(null); }, [setPending]);

  const addSite = React.useCallback((name: string, country: string) => {
    const id = slugify(name);
    if (!id || base[id] || pending[id]) throw new Error("A site with that name already exists.");
    setPending((all) => ({ ...all, [id]: { __new: { id, name, country: country || null, status: "planned", phase: "Feasibility & budgeting" } } }));
    return id;
  }, [base, pending, setPending]);

  // ---- saving: one commit with every site's changes, authored by the signed-in person.
  // The file is read again right before writing and the changes are applied to that version, so
  // edits saved meanwhile by someone else (other sites or other fields) are kept. If someone saves
  // in between, GitHub refuses the write and it is retried on the newer version.
  const saveAll = React.useCallback(async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    setSaveError(null);
    const names = (ids: string[]) => ids.map((id) => view.sites.find((s) => s.id === id)?.name || id);
    try {
      for (let attempt = 1; ; attempt++) {
        const remote = await gh.read(cfg.file);
        const { doc, sites: before } = parseDoc(remote.text);
        const changed = applyPending(doc as SitesDoc, pending);
        const { problems } = await import("./validate"); // loaded on first save only
        const invalid = problems(doc as SitesDoc);
        if (invalid.length) throw new Error(`These changes would make sites.yaml invalid, so nothing was saved: ${invalid.slice(0, 3).join("; ")}${invalid.length > 3 ? ` and ${invalid.length - 3} more` : ""}.`);
        const text = renderDoc(doc as SitesDoc);
        if (!changed.length || text === remote.text) {
          adopt(remote.text);
          setPending({});
          toast("Nothing to save: GitHub already has these values.");
          break;
        }
        try {
          const res = await gh.write(cfg.file, text, commitMessage(changed, pending, before, lib, commitNote), remote.sha);
          adopt(text);
          setPending({});
          setCommitNote("");
          toast.success(`Saved to ${cfg.branch}`, { description: `${names(changed).join(", ")}${res.sha ? " · " + res.sha.slice(0, 7) : ""}` });
          break;
        } catch (e) {
          if (e instanceof GitHubError && (e.status === 409 || e.status === 422) && attempt < MAX_TRIES) continue;
          throw e;
        }
      }
    } catch (e) {
      const msg = explain(e, cfg);
      setSaveError(msg);
      toast.error("Your changes were not saved", { description: msg });
    } finally {
      setSaving(false);
    }
  }, [canEdit, saving, pending, gh, cfg, lib, commitNote, view.sites, adopt, setPending]);

  return {
    cfg, snapshot, lib, base, fileText, pending, view, source, loadError, session, user, canEdit, saving, saveError, commitNote,
    setCommitNote, load, signInWithToken, signOut, set, setMany, undo, discardSite, discardAll, addSite, saveAll, gh,
  };
}

export type MatrixStore = ReturnType<typeof useMatrixState>;
const Ctx = React.createContext<MatrixStore | null>(null);
export function MatrixProvider({ children }: { children: React.ReactNode }) {
  const store = useMatrixState();
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
export function useMatrix() {
  const s = React.useContext(Ctx);
  if (!s) throw new Error("useMatrix outside MatrixProvider");
  return s;
}
