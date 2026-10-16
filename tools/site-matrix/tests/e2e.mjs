// End-to-end check of the built app against a simulated GitHub API.
//   npm run build && npx vite preview --port 4173 &
//   node tests/e2e.mjs            (PLAYWRIGHT=/path/to/playwright if not installed locally)
// Covers: home cards, site page editing, anonymous live load, token sign-in (bad then good), editing a status, an ID prefix,
// a milestone and a form need, saving (one commit per site), commit history, ⌘K and CSV export.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
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
const FILE = "docs/site-matrix/sites.yaml";
store[FILE] = readFileSync(`${ROOT}/${FILE}`, "utf8");
const original = { ...store };
// Simulates someone else saving between the app's read and its write, once.
let race = true;
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
    if (race) { race = false; store[p] = store[p].replace("    name: Homs\n", "    name: Homs (raced)\n"); }
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
check(await page.locator("[data-testid=site-cards] > *").count() === 9, "home shows 9 site cards");
await page.getByRole("navigation", { name: "Pages" }).getByRole("button", { name: "Compare" }).click();
await page.locator("thead th").first().waitFor();
check(await page.locator("thead th").count() === 10, "compare view: 9 site columns loaded live");

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
await page.getByRole("button", { name: "Live", exact: true }).click();

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
await page.getByRole("button", { name: "Save changes" }).click();
await page.getByText(/Saved to /).first().waitFor({ timeout: 8000 });
check(commits.length === 1 && /^site-matrix\((bunia,mombasa|mombasa,bunia)\): /.test(commits[0].message), `1 commit naming both sites, after a refused write: ${commits.map((c) => c.message.split("\n")[0]).join(" | ")}`);
check(store[FILE].includes("name: Homs (raced)"), "a change saved meanwhile by someone else is kept");
// Lines added and removed, counting duplicates.
const diff = (p) => {
  const count = (lines) => lines.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
  const a = count(original[p].split("\n")), b = count(store[p].split("\n"));
  const more = (x, y) => [...x].flatMap(([l, n]) => Array(Math.max(0, n - (y.get(l) || 0))).fill(l));
  return { add: more(b, a).filter((l) => !l.includes("Homs")), del: more(a, b).filter((l) => !l.includes("Homs")) };
};
const m = diff(FILE);
check(JSON.stringify(m.del) === JSON.stringify(["    status: preparation", "      id_prefix: null"]) && ["    status: live", "      id_prefix: KE-MBA-", "        date: '2026-12-01'", "      F35: needed"].every((l) => m.add.includes(l)) && m.add.length <= 7,
  `sites.yaml diff only touches changed lines: +${JSON.stringify(m.add)} -${JSON.stringify(m.del)}`);
check(commits.every((c) => c.message.includes("Agreed in the weekly LIME call")), "commit note is in each commit message");

// History tab
await page.getByRole("button", { name: /^Bunia/ }).click();
await page.getByRole("tab", { name: "History" }).click();
await page.getByText("F35 MH PHQ-9: Needed").waitFor({ timeout: 5000 });
check(await page.getByText("@pius-n").first().isVisible(), "site page history lists the new commit by @pius-n");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/e3.png` });
await page.keyboard.press("Escape");

// Command menu
await page.keyboard.press("Control+k");
await page.getByPlaceholder("Find a site, a form or an action…").fill("homs");
await page.keyboard.press("Enter");
check(await page.getByRole("heading", { name: "Homs", level: 1 }).waitFor({ timeout: 5000 }).then(() => true, () => false), "⌘K opens a site page");

// Site page: edit the patient ID prefix and a form need in plain controls.
await page.getByRole("button", { name: "LIME EMR sites, home" }).click();
await page.getByRole("button", { name: "Mombasa", exact: true }).click();
await page.getByRole("heading", { name: "Mombasa", level: 1 }).waitFor();
await page.getByLabel("MSF ID prefix").fill("KE-MSA-");
await page.getByLabel("MSF ID prefix").press("Enter");
await page.getByRole("tab", { name: "Forms" }).click();
await page.getByRole("radio", { name: "All forms" }).click();
await page.getByRole("button", { name: /^Antenatal Care/ }).click().catch(() => {});
const toggle = page.getByRole("radio", { name: /: Needed$/ }).and(page.locator("[data-state=off]")).first();
await toggle.click();
check(await page.getByText("2 unsaved changes").first().isVisible(), "site page: prefix and form need become 2 unsaved changes");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/e5.png`, fullPage: false });
await page.getByRole("button", { name: "Discard" }).click();
await page.getByRole("navigation", { name: "Pages" }).getByRole("button", { name: "Compare" }).click();

const dl = page.waitForEvent("download");
await page.getByRole("button", { name: "Export CSV" }).click();
const file = await dl;
check(/lime-site-matrix-.*\.csv/.test(file.suggestedFilename()), `CSV export: ${file.suggestedFilename()}`);

await page.getByRole("navigation", { name: "Pages" }).getByRole("button", { name: "Sites" }).click();
await page.emulateMedia({ colorScheme: "dark" });
await page.setViewportSize({ width: 400, height: 860 });
await page.waitForTimeout(300);
check(await page.evaluate(() => document.documentElement.scrollWidth) <= 400, "no horizontal page scroll at phone width");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/e4.png` });

check(errors.length === 0, `no page errors ${errors.join("; ")}`);
await browser.close();
process.exit(failures ? 1 : 0);
