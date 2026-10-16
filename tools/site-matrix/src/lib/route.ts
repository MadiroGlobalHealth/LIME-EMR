import * as React from "react";

/** In-app pages, kept in the URL hash so links to a site can be shared. */
export type Route =
  | { page: "home" }
  | { page: "compare" }
  | { page: "site"; id: string; tab: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "compare") return { page: "compare" };
  if (parts[0] === "site" && parts[1]) return { page: "site", id: parts[1], tab: parts[2] || "overview" };
  return { page: "home" };
}

export function routeHash(r: Route): string {
  if (r.page === "compare") return "#/compare";
  if (r.page === "site") return `#/site/${encodeURIComponent(r.id)}${r.tab && r.tab !== "overview" ? "/" + r.tab : ""}`;
  return "#/";
}

export function useRoute() {
  const [route, setRoute] = React.useState<Route>(() => parseRoute(location.hash));
  React.useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = React.useCallback((r: Route) => {
    const h = routeHash(r);
    if (location.hash !== h) location.hash = h;
    else setRoute(r);
  }, []);
  return { route, go };
}
