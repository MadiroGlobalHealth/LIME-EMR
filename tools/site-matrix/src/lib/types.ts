export type Need = "needed" | "not_needed" | "on_hold";
export type SiteStatus = "live" | "preparation" | "planned" | "closed";
export type CellState = "on" | "todo" | "hold" | "remove" | "no" | "unk" | "template";

export interface Milestone {
  date?: string | null;
  done?: boolean;
  approx?: boolean;
  note?: string;
}

/** One form decision (in memory always the long form; `F11: needed` in the file). */
export interface FormDecision {
  need?: Need | null;
  note?: string | null;
  /** A form made for this site, not in the library yet; its key is a site-specific code. */
  custom?: boolean;
  name?: string;
  program?: string;
}

export interface Identifier {
  name: string;
  required?: boolean;
  format?: string;
}

export interface Integration {
  need?: Need | null;
  target?: string | null;
  note?: string;
}

export interface Detected {
  generated_at?: string;
  source_commit?: string;
  site_folder?: string;
  forms?: string[];
  modules?: string[];
  registration?: {
    id_prefix?: string;
    id_example?: string;
    identifiers?: Identifier[];
    extra_fields?: string[];
    address?: string[];
    languages?: string[];
    default_language?: string;
  };
  locations?: string[];
  integration?: {
    status?: "live" | "template";
    config?: string;
    version?: string;
    version_date?: string;
    workflows?: { name?: string; cron?: string; enabled?: boolean }[];
    mapped_forms?: string[];
    synced_forms?: string[];
    staging_forms?: string[];
    identical_to?: string[];
    metadata?: string;
  } | null;
}

/** One site under `sites` in docs/site-matrix/sites.yaml (`id` is its key there). */
export interface Profile {
  id: string;
  name?: string;
  org?: string;
  /** ISO 3166-1 alpha-2, e.g. KE */
  country?: string | null;
  status?: SiteStatus;
  phase?: string | null;
  focal_point?: string | null;
  reviewed?: string | null;
  environments?: { uat?: string | null; prod?: string | null };
  milestones?: Record<string, Milestone>;
  registration?: {
    id_prefix?: string | null;
    identifiers?: Identifier[] | null;
    extra_fields?: string[] | null;
    address?: string[] | null;
    languages?: string[] | null;
    custom_form?: boolean;
  };
  locations?: string[] | null;
  services?: string[];
  forms_default?: Need;
  forms?: Record<string, FormDecision>;
  modules?: Record<string, Need>;
  integrations?: Record<string, Integration>;
  open_items?: string[];
  notes?: string;
  detected?: Detected;
  [key: string]: unknown;
}

export interface VocabItem { id: string; label: string; hint?: string }
export interface Vocab { milestones: VocabItem[]; integrations: VocabItem[] }
export type Orgs = Record<string, { name: string; notes?: string | null }>;

export interface LibraryForm {
  code: string;
  name: string;
  program: string;
  in_library?: boolean;
}
export interface LibraryModule {
  id: string;
  name: string;
  apps?: string[];
}
export interface Library {
  forms: LibraryForm[];
  modules: LibraryModule[];
}

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
  /** docs/site-matrix/sites.yaml */
  file: string;
}

/** Fallback copy of sites.yaml, written by scripts/site-profiles/build.py. */
export interface Snapshot {
  built_at: string;
  source_commit: string | null;
  repo: RepoConfig;
  text: string;
}

/** Unsaved changes for one site: profile path -> new value (null removes it). */
export type SiteChanges = Record<string, unknown> & { __new?: Partial<Profile> };
export type Pending = Record<string, SiteChanges>;
