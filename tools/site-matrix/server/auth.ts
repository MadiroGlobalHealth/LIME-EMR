// "Sign in with GitHub" for the site matrix, written against the Web Request/Response API so the
// same code runs as a Vercel Edge Function (api/auth/*) and a Cloudflare Pages Function (functions/api/auth/*).
//
// Settings (environment variables on the host):
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET  from a GitHub App (recommended: Contents read/write,
//                                           installed on the LIME-EMR repository only) or an OAuth App
//   GITHUB_SCOPE                            OAuth App only, e.g. "public_repo"; leave empty for a GitHub App
export interface AuthEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_SCOPE?: string;
}

const STATE_COOKIE = "sm_oauth_state";

function configured(env: AuthEnv) {
  return !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

function safeReturn(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function cookie(req: Request, name: string) {
  const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export function config(_req: Request, env: AuthEnv): Response {
  return Response.json({ oauth: configured(env) }, { headers: { "Cache-Control": "no-store" } });
}

export function login(req: Request, env: AuthEnv): Response {
  if (!configured(env)) return Response.json({ error: "Sign in with GitHub is not configured on this host." }, { status: 501 });
  const url = new URL(req.url);
  const nonce = crypto.randomUUID();
  const state = nonce + "." + encodeURIComponent(safeReturn(url.searchParams.get("return")));
  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID!);
  gh.searchParams.set("redirect_uri", url.origin + "/api/auth/callback");
  gh.searchParams.set("state", state);
  if (env.GITHUB_SCOPE) gh.searchParams.set("scope", env.GITHUB_SCOPE);
  return new Response(null, {
    status: 302,
    headers: {
      Location: gh.toString(),
      "Set-Cookie": `${STATE_COOKIE}=${nonce}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}

export async function callback(req: Request, env: AuthEnv): Promise<Response> {
  const url = new URL(req.url);
  const [nonce, ret] = (url.searchParams.get("state") || "").split(".");
  const back = (fragment: Record<string, string>) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: url.origin + safeReturn(decodeURIComponent(ret || "/")) + "#" + new URLSearchParams(fragment).toString(),
        "Set-Cookie": `${STATE_COOKIE}=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
        "Cache-Control": "no-store",
      },
    });

  if (!configured(env)) return back({ gh_error: "Sign in with GitHub is not configured on this host." });
  if (url.searchParams.get("error")) return back({ gh_error: url.searchParams.get("error_description") || "GitHub sign-in was cancelled." });
  if (!nonce || nonce !== cookie(req, STATE_COOKIE)) return back({ gh_error: "The sign-in link expired. Try again." });

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: url.searchParams.get("code"),
      redirect_uri: url.origin + "/api/auth/callback",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!data.access_token) return back({ gh_error: data.error_description || "GitHub did not return a token." });
  const fragment: Record<string, string> = { gh_token: data.access_token };
  if (data.expires_in) fragment.gh_expires_in = String(data.expires_in);
  return back(fragment);
}
