// GitHub REST access. Reads work without signing in (the repository is public);
// saving uses the signed-in person's token, so each commit is authored by them.
import type { RepoConfig } from "./types";

export class GitHubError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface Commit {
  sha: string;
  html_url: string;
  author?: { login?: string } | null;
  commit: { message: string; author?: { name?: string; date?: string } };
}

function b64decode(b64: string) {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function b64encode(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function createGitHub(cfg: RepoConfig, getToken: () => string | null) {
  const api = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}`;
  const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
  const ref = encodeURIComponent(cfg.branch);

  async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers["Content-Type"] = "application/json";
    let res: Response;
    try {
      res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    } catch {
      throw new GitHubError(0, "Could not reach GitHub. Check your connection.");
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new GitHubError(res.status, (data && data.message) || res.statusText);
    return data as T;
  }

  return {
    async read(path: string) {
      const d = await req<{ sha: string; content: string }>("GET", `${api}/contents/${enc(path)}?ref=${ref}`);
      return { sha: d.sha, text: b64decode(d.content || "") };
    },
    async list(dir: string) {
      const d = await req<{ name: string; type: string }[]>("GET", `${api}/contents/${enc(dir)}?ref=${ref}`);
      return Array.isArray(d) ? d : [];
    },
    async write(path: string, content: string, message: string, sha?: string | null) {
      const body: Record<string, string> = { message, content: b64encode(content), branch: cfg.branch };
      if (sha) body.sha = sha;
      const d = await req<{ commit?: { sha?: string; html_url?: string } }>("PUT", `${api}/contents/${enc(path)}`, body);
      return { sha: d.commit?.sha || null, url: d.commit?.html_url || null };
    },
    commits(path: string, n = 20) {
      return req<Commit[]>("GET", `${api}/commits?sha=${ref}&path=${encodeURIComponent(path)}&per_page=${n}`);
    },
    async me() {
      return req<{ login: string; name?: string; avatar_url?: string }>("GET", "https://api.github.com/user");
    },
    async canPush() {
      const d = await req<{ permissions?: { push?: boolean } }>("GET", api);
      return !!d.permissions?.push;
    },
  };
}
export type GitHub = ReturnType<typeof createGitHub>;

export function explain(e: unknown, cfg: RepoConfig): string {
  if (e instanceof GitHubError) {
    if (e.status === 0) return e.message;
    if (e.status === 401) return "GitHub did not accept your sign-in. It may have expired: sign in again.";
    if (e.status === 403) return /rate limit/i.test(e.message)
      ? "GitHub's hourly limit for anonymous visitors was reached. Sign in to continue."
      : `Your GitHub account cannot write to ${cfg.owner}/${cfg.repo}.`;
    if (e.status === 404) return `Not found on GitHub (${cfg.owner}/${cfg.repo} @ ${cfg.branch}).`;
    if (e.status === 409 || e.status === 422) return "Someone saved this profile at the same time. Refresh, then save again.";
    return `GitHub answered ${e.status}: ${e.message}`;
  }
  return e instanceof Error ? e.message : String(e);
}
