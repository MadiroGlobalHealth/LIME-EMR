// End-to-end check of the built app against a simulated GitHub API.
//   npm run build && npx vite preview --port 4173 &
//   node tests/e2e.mjs            (PLAYWRIGHT=/path/to/playwright if not installed locally)
// Covers: anonymous live load, token sign-in (bad then good), editing a status, an ID prefix,
// a milestone and a form need, saving (one commit per site), commit history, ⌘K and CSV export.
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../..");
const URL_ = process.env.APP_URL || "http://localhost:4173/";
const SHOTS = process.env.SHOTS || "";

const store = {};
for (const f of readdirSync(`${ROOT}/docs/site-matrix/profiles`)) store[`docs/site-matrix/profiles/${f}`] = readFileSync(`${ROOT}/docs/site-matrix/profiles/${f}`, "utf8");
store["docs/site-matrix/library.yaml"] = readFileSync(`${ROOT}/docs/site-matrix/library.yaml`, "utf8");
const original = { ...store };
const sha = (t) => createHash("sha1").update(t).digest("hex");
const commits = [];
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failures++; };

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
await ctx.route(/\/api\/auth\/config/, (r) => r.fulfill({ json: { oauth: false } }));
await ctx.route(/api\.github\.com/, async (r) => {
  const req = r.request(), u = new URL(req.url()), auth = req.headers()["authorization"] || "";
  const json = (o, status = 200) => r.fulfill({ status, json: o, headers: { "access-control-allow-origin": "*" } });
  if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  if (u.pathname === "/user") return auth === "Bearer good" ? json({ login: "pius-n", name: "Pius N." }) : json({ message: "Bad credentials" }, 401);
  if (/^\/repos\/[^/]+\/[^/]+$/.test(u.pathname)) return json({ permissions: { push: auth === "Bearer good" } });
  if (u.pathname.endsWith("/commits")) return json(commits.filter((c) => c.path === u.searchParams.get("path")).map((c) => ({ sha: c.sha, html_url: `https://github.com/x/commit/${c.sha}`, author: { login: "pius-n" }, commit: { message: c.message, author: { name: "Pius", date: "2026-10-06T15:00:00Z" } } })));
  const m = u.pathname.match(/\/contents\/(.+)$/), p = m && decodeURIComponent(m[1]);
  if (req.method() === "GET") {
    if (store[p] !== undefined) return json({ sha: sha(store[p]), content: Buffer.from(store[p]).toString("base64"), encoding: "base64" });
    const kids = Object.keys(store).filter((k) => k.startsWith(p + "/")).map((k) => ({ name: k.split("/").pop(), path: k, type: "file" }));
    return kids.length ? json(kids) : json({ message: "Not Found" }, 404);
  }
  if (req.method() === "PUT") {
    if (auth !== "Bearer good") return json({ message: "Bad credentials" }, 401);
    const body = JSON.parse(req.postData());
    if (store[p] !== undefined && body.sha !== sha(store[p])) return json({ message: "sha mismatch" }, 409);
    store[p] = Buffer.from(body.content, "base64").toString("utf8");
    const c = { sha: sha(store[p] + commits.length), path: p, message: body.message, branch: body.branch };
    commits.unshift(c);
    return json({ commit: { sha: c.sha, html_url: `https://github.com/x/commit/${c.sha}` } });
  }
  return json({ message: "unexpected" }, 400);
});

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(URL_);
await page.getByText(/claude\/|main/).first().waitFor({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(800);
if (SHOTS) await page.screenshot({ path: `${SHOTS}/e1.png` });
check(await page.locator("thead th").count() === 10, "9 site columns loaded live");

// Clicking a cell while signed out offers sign-in.
const regRow = page.locator("tbody tr", { hasText: "Registration & patient ID" });
await regRow.locator("td").nth(5).click();
check(await page.getByText("Sign in to edit").first().isVisible(), "signed-out click offers sign-in");
await page.keyboard.press("Escape");

await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.getByPlaceholder("github_pat_…").fill("bad");
await page.getByRole("button", { name: "Sign in with token" }).click();
await page.waitForTimeout(400);
check(await page.getByText("did not accept your sign-in").isVisible(), "bad token is rejected with a clear message");
await page.getByPlaceholder("github_pat_…").fill("good");
await page.getByRole("button", { name: "Sign in with token" }).click();
await page.getByText("@pius-n").first().waitFor({ timeout: 5000 });
check(true, "signed in as @pius-n");

// Mombasa is the 5th site column (td index 5).
await regRow.locator("td").nth(5).click();
await page.getByRole("textbox", { name: "MSF ID prefix" }).fill("KE-MBA-");
await page.getByRole("button", { name: "Apply" }).click();

await page.getByLabel(/Status of Mombasa/).click();
await page.getByRole("button", { name: "live", exact: true }).click();

await page.locator("tbody tr", { hasText: "Status & milestones" }).locator("td").first().click();
await page.locator("tbody tr", { hasText: "Production target" }).locator("td").nth(5).click();
await page.getByPlaceholder("2026-11-30").fill("2026-12-01");
await page.getByRole("button", { name: "Apply" }).click();

await page.locator("tbody tr", { hasText: "Programs & forms" }).locator("td").first().click();
await page.locator("tbody tr", { hasText: "Mental Health" }).first().locator("td").first().click();
const f35 = page.locator("tbody tr", { hasText: "F35" });
await f35.locator("td").nth(1).click();
await page.getByRole("button", { name: /^Needed\s*Needed$/ }).click();
check(await page.getByText("4 unsaved changes").isVisible().catch(() => false) || (await page.locator("form").filter({ hasText: "unsaved change" }).innerText()).includes("4"), "4 unsaved changes in the save bar");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2.png` });

// Keyboard: arrow from the F35 Bunia cell to Matsapha and open the editor with Enter.
await f35.locator("td").nth(1).focus();
await page.keyboard.press("ArrowRight");
await page.keyboard.press("Enter");
check(await page.getByText("No decision (use the repo state)").isVisible(), "arrow keys and Enter open the next cell's editor");
await page.keyboard.press("Escape");

await page.getByLabel("Commit note").fill("Agreed in the weekly LIME call");
await page.getByRole("button", { name: "Save to GitHub" }).click();
await page.getByText(/Committed to/).waitFor({ timeout: 8000 });
check(commits.length === 2, `2 commits (one per site): ${commits.map((c) => c.message.split("\n")[0]).join(" | ")}`);
const diff = (p) => { const a = original[p].split("\n"), b = store[p].split("\n"); return { add: b.filter((l) => !a.includes(l)), del: a.filter((l) => !b.includes(l)) }; };
const m = diff("docs/site-matrix/profiles/mombasa.md");
check(JSON.stringify(m.del) === JSON.stringify(["status: preparation", "  id_prefix: null"]), `mombasa diff only touches changed lines: +${JSON.stringify(m.add)} -${JSON.stringify(m.del)}`);
check(commits.every((c) => c.message.includes("Agreed in the weekly LIME call")), "commit note is in each commit message");

// History tab
await page.getByRole("button", { name: /^Bunia/ }).click();
await page.getByRole("tab", { name: "History" }).click();
await page.getByText("site-matrix(bunia): F35 MH PHQ-9: Needed").waitFor({ timeout: 5000 });
check(true, "history tab lists the new commit by @pius-n");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/e3.png` });
await page.keyboard.press("Escape");

// Command menu
await page.keyboard.press("Control+k");
await page.getByPlaceholder("Find a site, a form or an action…").fill("homs");
await page.keyboard.press("Enter");
check(await page.getByRole("dialog").getByText("Homs").first().isVisible(), "⌘K opens a site");
await page.keyboard.press("Escape");

const dl = page.waitForEvent("download");
await page.getByRole("button", { name: "Export CSV" }).click();
const file = await dl;
check(/lime-site-matrix-.*\.csv/.test(file.suggestedFilename()), `CSV export: ${file.suggestedFilename()}`);

await page.emulateMedia({ colorScheme: "dark" });
await page.setViewportSize({ width: 400, height: 860 });
await page.waitForTimeout(300);
check(await page.evaluate(() => document.documentElement.scrollWidth) <= 400, "no horizontal page scroll at phone width");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/e4.png` });

check(errors.length === 0, `no page errors ${errors.join("; ")}`);
await browser.close();
process.exit(failures ? 1 : 0);
