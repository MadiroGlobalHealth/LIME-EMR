import * as React from "react";
import { toast } from "sonner";
import yaml from "js-yaml";
import snapshotJson from "@/snapshot.json";
import { createGitHub, explain, GitHubError } from "./github";
import { clearSession, loadSession, saveSession, takeSessionFromUrl, type Session } from "./auth";
import { applyChanges, clone, getPath, parseProfile, renderProfile, same, slugify } from "./profile";
import { buildView, commitMessage, type MatrixView } from "./model";
import type { Library, Pending, Profile, RepoConfig, SiteChanges, Snapshot } from "./types";

const snapshot = snapshotJson as unknown as Snapshot;

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

type FileInfo = { sha?: string | null; body: string; text?: string };
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
  const [lib, setLib] = React.useState<Library>(snapshot.library);
  const [base, setBase] = React.useState<Record<string, Profile>>(() => Object.fromEntries(snapshot.sites.map(({ body: _b, ...p }) => [p.id, p as Profile])));
  const [files, setFiles] = React.useState<Record<string, FileInfo>>(() => Object.fromEntries(snapshot.sites.map((s) => [s.id, { body: s.body || "" }])));
  const [pending, setPending] = useStored<Pending>(`sm-draft:${cfg.owner}/${cfg.repo}@${cfg.branch}`, {});
  const [source, setSource] = React.useState<Source>("loading");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveErrors, setSaveErrors] = React.useState<Record<string, string>>({});
  const [commitNote, setCommitNote] = React.useState("");

  const tokenRef = React.useRef<string | null>(null);
  tokenRef.current = session?.token || null;
  const gh = React.useMemo(() => createGitHub(cfg, () => tokenRef.current), [cfg]);
  const view: MatrixView = React.useMemo(() => buildView(base, pending, lib), [base, pending, lib]);
  const canEdit = !!user?.canPush && source === "github";

  const load = React.useCallback(async (announce = false) => {
    setSource("loading");
    try {
      const entries = await gh.list(cfg.dir);
      const ids = entries.filter((e) => e.type === "file" && e.name.endsWith(".md")).map((e) => e.name.replace(/\.md$/, ""));
      try {
        const l = yaml.load((await gh.read(cfg.library)).text) as Library;
        if (l?.forms && l?.modules) setLib(l);
      } catch { /* keep the snapshot library */ }
      const results = await Promise.all(ids.map((id) => gh.read(`${cfg.dir}/${id}.md`).then((f) => [id, f] as const, () => [id, null] as const)));
      const nextBase: Record<string, Profile> = {}, nextFiles: Record<string, FileInfo> = {};
      let failed = 0;
      for (const [id, f] of results) {
        if (!f) { failed++; continue; }
        const { meta, body } = parseProfile(f.text);
        nextBase[id] = { ...meta, id: meta.id || id };
        nextFiles[id] = { sha: f.sha, body, text: f.text };
      }
      setBase((prev) => { for (let i = 0; i < results.length; i++) if (!results[i][1] && prev[results[i][0]]) nextBase[results[i][0]] = prev[results[i][0]]; return nextBase; });
      setFiles((prev) => ({ ...prev, ...nextFiles }));
      setSource("github");
      setLoadError(failed ? `${failed} profile(s) could not be read from GitHub; showing the snapshot for those.` : null);
      if (announce) toast.success("Loaded the latest profiles from GitHub");
    } catch (e) {
      setSource("snapshot");
      setLoadError(`${explain(e, cfg)} Showing the snapshot from ${snapshot.source_commit || "the last build"}.`);
    }
  }, [gh, cfg]);

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
  const discardAll = React.useCallback(() => { setPending({}); setSaveErrors({}); }, [setPending]);

  const addSite = React.useCallback((name: string, country: string) => {
    const id = slugify(name);
    if (!id || base[id] || pending[id]) throw new Error("A site with that name already exists.");
    setPending((all) => ({ ...all, [id]: { __new: { id, name, country: country || null, status: "planned", phase: "Feasibility & budgeting" } } }));
    return id;
  }, [base, pending, setPending]);

  // ---- saving: one commit per site profile, authored by the signed-in person
  const saveSite = React.useCallback(async (id: string, changes: SiteChanges) => {
    const path = `${cfg.dir}/${id}.md`;
    const isNew = !base[id];
    const remote = isNew ? null : await gh.read(path);
    let meta: Profile, body: string;
    if (remote) ({ meta, body } = parseProfile(remote.text)); else { meta = { id }; body = ""; }
    applyChanges(meta, changes);
    const text = renderProfile(meta, body);
    if (remote && text === remote.text) return { meta, body, sha: remote.sha, text, commit: null as string | null };
    const res = await gh.write(path, text, commitMessage(id, changes, base[id], lib, commitNote), remote?.sha);
    const fresh = await gh.read(path).catch(() => null);
    return { meta, body, sha: fresh?.sha || null, text, commit: res.sha };
  }, [cfg, base, gh, lib, commitNote]);

  const saveAll = React.useCallback(async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    const ok: string[] = [], errors: Record<string, string> = {};
    for (const [id, changes] of Object.entries(pending)) {
      try {
        const r = await saveSite(id, changes);
        setBase((b) => ({ ...b, [id]: r.meta }));
        setFiles((f) => ({ ...f, [id]: { sha: r.sha, body: r.body, text: r.text } }));
        setPending((all) => { const o = { ...all }; delete o[id]; return o; });
        ok.push(`${view.sites.find((s) => s.id === id)?.name || id}${r.commit ? " " + r.commit.slice(0, 7) : ""}`);
      } catch (e) {
        errors[id] = explain(e, cfg);
      }
    }
    setSaveErrors(errors);
    setSaving(false);
    if (ok.length) toast.success(`Committed to ${cfg.branch}`, { description: ok.join(", ") });
    if (Object.keys(errors).length) toast.error("Some changes were not saved", { description: Object.values(errors)[0] });
    else setCommitNote("");
  }, [canEdit, saving, pending, saveSite, view.sites, cfg, setPending]);

  return {
    cfg, snapshot, lib, base, files, pending, view, source, loadError, session, user, canEdit, saving, saveErrors, commitNote,
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
