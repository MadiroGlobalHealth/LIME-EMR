import * as React from "react";

export type StatusFilter = "all" | "live" | "preparation" | "planned";
export type Density = "comfortable" | "compact";

function stored<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [v, setV] = React.useState<T>(() => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : initial; } catch { return initial; } });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV];
}

/** View preferences, remembered per browser. */
export function useUiState() {
  const [statusFilter, setStatusFilter] = stored<StatusFilter>("sm-ui-status", "all");
  const [onlyUsed, setOnlyUsed] = stored("sm-ui-only-used", true);
  const [density, setDensity] = stored<Density>("sm-ui-density", "comfortable");
  const [expanded, setExpanded] = stored<Record<string, boolean>>("sm-ui-expanded", {});
  const [q, setQ] = React.useState("");
  const toggle = React.useCallback((id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] })), [setExpanded]);
  const expandAll = React.useCallback((ids: string[] | null) => setExpanded(ids ? Object.fromEntries(ids.map((i) => [i, true])) : {}), [setExpanded]);
  return { statusFilter, setStatusFilter, onlyUsed, setOnlyUsed, density, setDensity, expanded, setExpanded, toggle, expandAll, q, setQ };
}
export type UiState = ReturnType<typeof useUiState>;
