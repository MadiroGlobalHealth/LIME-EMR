import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";
import { applyChanges, parseProfile, renderProfile } from "../src/lib/profile";
import { buildView, cellState, commitMessage } from "../src/lib/model";
import type { Library, Profile } from "../src/lib/types";

const DIR = path.resolve(__dirname, "../../../docs/site-matrix/profiles");
const files = readdirSync(DIR).filter((f) => f.endsWith(".md"));
const lib = yaml.load(readFileSync(path.resolve(DIR, "../library.yaml"), "utf8")) as Library;
const load = (f: string) => parseProfile(readFileSync(path.join(DIR, f), "utf8"));

describe("profiles written by the app match the Python writer", () => {
  it.each(files)("%s round-trips byte for byte", (f) => {
    const text = readFileSync(path.join(DIR, f), "utf8");
    const { meta, body } = parseProfile(text);
    expect(renderProfile(meta, body)).toBe(text);
  });

  it("a status change touches one line", () => {
    const text = readFileSync(path.join(DIR, "mombasa.md"), "utf8");
    const { meta, body } = parseProfile(text);
    const out = renderProfile(applyChanges(meta, { status: "live" }), body).split("\n");
    const before = text.split("\n");
    expect(out.filter((l) => !before.includes(l))).toEqual(["status: live"]);
    expect(before.filter((l) => !out.includes(l))).toEqual(["status: preparation"]);
  });

  it("never writes the detected block", () => {
    const { meta, body } = load("mosul.md");
    const out = parseProfile(renderProfile(applyChanges(meta, { "detected.forms": ["F99"] }), body)).meta;
    expect(out.detected).toEqual(load("mosul.md").meta.detected);
  });
});

describe("matrix model", () => {
  const base = Object.fromEntries(files.map((f) => { const p = load(f).meta; return [p.id, p as Profile]; }));
  const view = buildView(base, {}, lib);
  const site = (id: string) => view.sites.find((s) => s.id === id)!;

  it("combines repo state and decisions", () => {
    expect(cellState("needed", false, true).st).toBe("todo");
    expect(cellState("not_needed", true, true).st).toBe("remove");
    expect(cellState(null, true, true).st).toBe("on");
    expect(cellState(null, false, false).st).toBe("unk");
  });
  it("reads the real profiles", () => {
    expect(site("matsapha").formCells.F11.st).toBe("on");
    expect(site("mombasa").formCells.F11.st).toBe("todo");
    expect(site("mombasa").formCells.F91.st).toBe("hold");
    expect(site("mosul").integrationCell.st).toBe("on");
    expect(site("bunia").integrationCell.st).toBe("template");
  });
  it("applies unsaved changes", () => {
    const v = buildView(base, { bunia: { "needs.forms.F35": "needed" } }, lib);
    expect(v.sites.find((s) => s.id === "bunia")!.formCells.F35.st).toBe("todo");
  });
  it("writes a readable commit message", () => {
    const msg = commitMessage("bunia", { "needs.forms.F35": "needed" }, base.bunia, lib, "Agreed in the weekly call");
    expect(msg.split("\n")[0]).toBe("site-matrix(bunia): F35 MH PHQ-9: Needed");
    expect(msg).toContain("- F35 MH PHQ-9: not set -> Needed");
    expect(msg).toContain("Agreed in the weekly call");
  });
});
