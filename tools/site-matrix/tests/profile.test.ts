import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyPending, parseDoc, renderDoc } from "../src/lib/profile";
import { buildView, cellState, commitMessage } from "../src/lib/model";

const FILE = path.resolve(__dirname, "../../../docs/site-matrix/sites.yaml");
const text = readFileSync(FILE, "utf8");
const fresh = () => parseDoc(text);
/** Lines that differ, position by position (the edits below keep the line count). */
const diff = (a: string, b: string) => {
  const x = a.split("\n"), y = b.split("\n");
  expect(y.length).toBe(x.length);
  const at = x.map((_, i) => i).filter((i) => x[i] !== y[i]);
  return { added: at.map((i) => y[i]), removed: at.map((i) => x[i]) };
};

describe("sites.yaml written by the app matches the Python writer", () => {
  it("round-trips byte for byte", () => {
    expect(renderDoc(fresh().doc)).toBe(text);
  });

  it("a status change touches one line", () => {
    const { doc } = fresh();
    expect(applyPending(doc, { mombasa: { status: "live" } })).toEqual(["mombasa"]);
    expect(diff(text, renderDoc(doc))).toEqual({ added: ["    status: live"], removed: ["    status: preparation"] });
  });

  it("keeps changes saved meanwhile by someone else", () => {
    // Someone else changed Bunia; my pending change is on Mombasa.
    const theirs = fresh();
    applyPending(theirs.doc, { bunia: { phase: "Hypercare" } });
    const remote = renderDoc(theirs.doc);
    const { doc } = parseDoc(remote);
    applyPending(doc, { mombasa: { status: "live" } });
    const out = parseDoc(renderDoc(doc)).sites;
    expect(out.bunia.phase).toBe("Hypercare");
    expect(out.mombasa.status).toBe("live");
  });

  it("adds a new site at the end of `sites`", () => {
    const { doc } = fresh();
    applyPending(doc, { kabul: { __new: { id: "kabul", name: "Kabul", country: "Afghanistan", status: "planned" } } });
    const out = parseDoc(renderDoc(doc));
    expect(Object.keys(out.sites).at(-1)).toBe("kabul");
    expect(out.sites.kabul.name).toBe("Kabul");
    expect(renderDoc(doc)).not.toContain("id: kabul");
  });

  it("never writes the detected block", () => {
    const { doc } = fresh();
    applyPending(doc, { mosul: { "detected.forms": ["F99"] } });
    expect(parseDoc(renderDoc(doc)).sites.mosul.detected).toEqual(fresh().sites.mosul.detected);
  });
});

describe("matrix model", () => {
  const { sites: base, library: lib } = fresh();
  const view = buildView(base, {}, lib);
  const site = (id: string) => view.sites.find((s) => s.id === id)!;

  it("combines repo state and decisions", () => {
    expect(cellState("needed", false, true).st).toBe("todo");
    expect(cellState("not_needed", true, true).st).toBe("remove");
    expect(cellState(null, true, true).st).toBe("on");
    expect(cellState(null, false, false).st).toBe("unk");
  });
  it("reads the real sites", () => {
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
  it("writes a readable commit message for one site", () => {
    const msg = commitMessage(["bunia"], { bunia: { "needs.forms.F35": "needed" } }, base, lib, "Agreed in the weekly call");
    expect(msg.split("\n")[0]).toBe("site-matrix(bunia): F35 MH PHQ-9: Needed");
    expect(msg).toContain("- F35 MH PHQ-9: not set -> Needed");
    expect(msg).toContain("Agreed in the weekly call");
  });
  it("names every site in a multi-site commit", () => {
    const msg = commitMessage(["bunia", "mombasa"], { bunia: { "needs.forms.F35": "needed" }, mombasa: { status: "live" } }, base, lib, "");
    expect(msg.split("\n")[0]).toBe("site-matrix(bunia,mombasa): 2 changes in Bunia, Mombasa");
    expect(msg).toContain("Mombasa:\n- Status: preparation -> live");
  });
});
