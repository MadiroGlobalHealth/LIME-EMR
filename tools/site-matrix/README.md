# LIME Site Matrix app

Web app for the implementation team: what each LIME EMR site runs (read from the repo) and what
each site needs. Any value can be edited in place; saving commits the site profile
(`docs/site-matrix/profiles/<site>.md`) to GitHub under the editor's own account, so the history
shows who changed what.

Stack: React 19, TypeScript, Vite, Tailwind CSS 4 with shadcn/ui-style components on Radix,
TanStack Table, cmdk (⌘K search), sonner (notifications). It is a static site plus a small
"Sign in with GitHub" function, deployable to Vercel or Cloudflare Pages.

## How it works

- On load it reads every profile live from GitHub (`api.github.com`). The repository is public, so
  reading needs no sign-in. If GitHub cannot be reached, it shows `src/snapshot.json`, written by
  `scripts/site-profiles/build.py`.
- To edit, people sign in with GitHub. Saving writes one commit per changed profile, with a message
  that lists each change and the optional "why" note. The page checks that the account can push.
- Unsaved changes stay in the browser until saved or discarded.
- Repo facts (`detected` in each profile) are never written by the app; the `site-profiles` skill
  refreshes them from the repo.

## Develop

```bash
cd tools/site-matrix
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests: profile round-trip against the real profiles, model, commit messages
npm run build        # type check + production build in dist/
python3 ../../scripts/site-profiles/build.py   # refresh src/snapshot.json from the profiles
```

End-to-end test against a simulated GitHub API: `npm run build && npx vite preview --port 4173 &`
then `node tests/e2e.mjs` (needs Playwright).

`rollup` is pinned to 4.44.1 in `package.json` (overrides): Rollup 4.64.0 loops forever while
tree-shaking this app.

## Configuration

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_REPO_BRANCH` | build | Branch the app reads and commits to (default: the branch `build.py` ran on). `?branch=` in the URL overrides it. |
| `VITE_REPO_OWNER`, `VITE_REPO_NAME` | build | Repository (default `MadiroGlobalHealth/LIME-EMR`) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | runtime (secret) | Enables "Sign in with GitHub". Without them, people sign in with a personal access token. |
| `GITHUB_SCOPE` | runtime | Only for an OAuth App, e.g. `public_repo`. Leave empty for a GitHub App. |

### Sign in with GitHub (recommended: a GitHub App)

1. GitHub → Settings (of the MadiroGlobalHealth organization) → Developer settings → GitHub Apps → New.
2. Callback URL: `https://<your-domain>/api/auth/callback`. Tick "Request user authorization (OAuth) during installation" off; leave webhooks off.
3. Repository permissions: **Contents: Read and write**. Nothing else.
4. Install the app on the **LIME-EMR** repository only.
5. Generate a client secret. Put the client ID and secret in the host's environment variables.

Commits are then authored by the person who signed in, and the app can only ever write to the
repository it is installed on. An OAuth App also works (set `GITHUB_SCOPE=public_repo`) but its
token can write to every public repository the person can access.

## Deploy

### Cloudflare Pages

- Create a Pages project connected to the repository.
- Root directory: `tools/site-matrix`. Build command: `npm run build`. Output directory: `dist`.
- Environment variables: `VITE_REPO_BRANCH` (build), `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (encrypted).
- `functions/api/auth/*` becomes the sign-in endpoints automatically.

### Vercel

- Import the repository, root directory `tools/site-matrix` (framework: Vite, settings in `vercel.json`).
- Environment variables as above.
- `api/auth/*` runs as Edge Functions.

Both use the same code in `server/auth.ts`.
