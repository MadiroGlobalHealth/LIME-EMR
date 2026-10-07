export type Need = "needed" | "not_needed" | "on_hold";
export type SiteStatus = "live" | "preparation" | "planned" | "closed";
export type CellState = "on" | "todo" | "hold" | "remove" | "no" | "unk" | "template";

export interface Milestone {
  date?: string | null;
  done?: boolean;
  approx?: boolean;
  note?: string;
}

export interface CustomForm {
  code: string;
  name: string;
  program?: string;
  need?: Need;
  note?: string | null;
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
    other_ids?: string[];
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

/** A site profile: YAML frontmatter of docs/site-matrix/profiles/<id>.md. */
export interface Profile {
  id: string;
  name?: string;
  country?: string | null;
  status?: SiteStatus;
  phase?: string | null;
  milestones?: Record<string, Milestone>;
  registration?: {
    id_prefix?: string | null;
    other_ids?: string[] | null;
    extra_fields?: string[] | null;
    address?: string[] | null;
    languages?: string[] | null;
    custom_form?: boolean;
  };
  locations?: string[] | null;
  services?: string[];
  needs?: {
    forms_default?: Need;
    forms?: Record<string, Need>;
    modules?: Record<string, Need>;
  };
  form_notes?: Record<string, string>;
  custom_forms?: CustomForm[];
  integration?: { need?: Need; dhis2_target?: string | null; note?: string };
  open_items?: string[];
  notes?: string;
  detected?: Detected;
  [key: string]: unknown;
}

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
  dir: string;
  library: string;
}

export interface Snapshot {
  built_at: string;
  source_commit: string | null;
  repo: RepoConfig;
  library: Library;
  sites: (Profile & { body?: string })[];
}

/** Unsaved changes for one site: profile path -> new value (null removes it). */
export type SiteChanges = Record<string, unknown> & { __new?: Partial<Profile> };
export type Pending = Record<string, SiteChanges>;
