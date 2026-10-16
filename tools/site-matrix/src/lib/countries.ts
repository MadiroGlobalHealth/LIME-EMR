// Country names from ISO 3166-1 alpha-2 codes (stored in sites.yaml), in the viewer's language.
const names = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames([navigator.language || "en", "en"], { type: "region" }) : null;
const NOT_COUNTRIES = new Set(["EU", "EZ", "UN", "ZZ", "QO", "XA", "XB", "AA", "QM", "QN", "QP", "QQ", "QR", "QS", "QT", "QU", "QV", "QW", "QX", "QY", "QZ"]);

export function countryName(code?: string | null) {
  if (!code) return "";
  try { return names?.of(code) || code; } catch { return code; }
}

let list: { code: string; name: string }[] | null = null;
/** Every country the browser knows, sorted by name. */
export function countries() {
  if (list) return list;
  const out: { code: string; name: string }[] = [];
  const A = 65;
  for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) {
    const code = String.fromCharCode(A + i, A + j);
    if (NOT_COUNTRIES.has(code)) continue;
    const name = countryName(code);
    if (name && name !== code) out.push({ code, name });
  }
  return (list = out.sort((a, b) => a.name.localeCompare(b.name)));
}
