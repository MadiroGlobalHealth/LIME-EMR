// Sign-in. "Sign in with GitHub" goes through /api/auth/* (Vercel or Cloudflare Pages
// function) when the host has it configured; a personal access token always works as well.
const KEY = "sm-github-session";

export interface Session { token: string; expiresAt?: number | null; method: "oauth" | "token" }

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (s.expiresAt && Date.now() > s.expiresAt) { clearSession(); return null; }
    return s;
  } catch { return null; }
}
export function saveSession(s: Session, remember: boolean) {
  try {
    clearSession();
    (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s));
  } catch { /* storage blocked: the session lasts until reload */ }
}
export function clearSession() {
  try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Picks up the token the OAuth callback puts in the URL fragment, then removes it from the address bar. */
export function takeSessionFromUrl(): Session | null {
  const h = new URLSearchParams(location.hash.slice(1));
  const token = h.get("gh_token");
  const error = h.get("gh_error");
  if (!token && !error) return null;
  history.replaceState(null, "", location.pathname + location.search);
  if (error) throw new Error(error);
  const ttl = Number(h.get("gh_expires_in") || 0);
  const s: Session = { token: token!, method: "oauth", expiresAt: ttl ? Date.now() + ttl * 1000 : null };
  saveSession(s, true);
  return s;
}

export async function oauthAvailable(): Promise<boolean> {
  try {
    const r = await fetch("/api/auth/config", { cache: "no-store" });
    if (!r.ok) return false;
    const d = await r.json();
    return !!d.oauth;
  } catch { return false; }
}

export function startOAuth() {
  location.href = "/api/auth/login?return=" + encodeURIComponent(location.pathname + location.search);
}
