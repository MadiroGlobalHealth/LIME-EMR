import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDoc } from "../src/lib/profile";
import { buildPlan } from "../src/lib/plan";

const read = (f: string) => readFileSync(path.resolve(__dirname, f), "utf8");

describe("work plan", () => {
  // plan-expected.json is what scripts/site-profiles/gaps.py prints for the same fixture and day;
  // the Site matrix workflow checks the Python side against it too.
  it("matches gaps.py task for task", () => {
    const { doc, sites, library, vocab } = parseDoc(read("fixtures/plan-sites.yaml"));
    const expected = JSON.parse(read("fixtures/plan-expected.json"));
    expect(buildPlan(sites, doc, library, vocab, expected.date)).toEqual(expected);
  });

  it("asks the site team before the implementers start a new site", () => {
    const { doc, sites, library, vocab } = parseDoc(read("fixtures/plan-sites.yaml"));
    const mombasa = buildPlan(sites, doc, library, vocab, "2026-10-16").sites.find((s) => s.id === "mombasa")!;
    const folder = mombasa.tasks.find((t) => t.id === "mombasa/site/folder")!;
    expect(folder.depends_on).toEqual(["mombasa/decision/id_prefix"]);
    expect(mombasa.tasks.find((t) => t.id === "mombasa/form/F11")!.depends_on).toEqual(["mombasa/site/folder"]);
  });
});
