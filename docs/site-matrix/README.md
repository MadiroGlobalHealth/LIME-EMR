# Site matrix

Side-by-side view of every LIME EMR site: status and milestones, patient ID and registration,
modules, forms per program, and DHIS2 sync through OpenFn.

- `profiles/<site>.md`: one profile per site. YAML frontmatter; `detected` is generated from the repo,
  the rest records decisions (what the site needs, dates, notes).
- `library.yaml`: catalog of shared forms (with their program) and key modules.
- `index.html`: the same app, standalone (GitHub Pages, or open the file locally). It reads the
  profiles live from GitHub; "Sign in to GitHub" with a fine-grained personal access token
  (repository LIME-EMR only, Contents: Read and write) to edit and commit from it.

Shared page (editable, for the implementation team): https://claude.ai/artifact/Dtud3AZyLb6J6GNGFqEm7x
Click any value to change it; "Save to GitHub" commits each changed profile under your own GitHub
account. Inside Claude it uses your GitHub connector (claude.ai Settings, Connectors); the standalone
page uses your personal access token instead. Either way you need write access to this repository.

Workflow and scripts: see the `site-profiles` skill in `.claude/skills/site-profiles/SKILL.md`.
