# Site matrix

Side-by-side view of every LIME EMR site: status and milestones, patient ID and registration,
modules, forms per program, and DHIS2 sync through OpenFn.

- `profiles/<site>.md`: one profile per site. YAML frontmatter; `detected` is generated from the repo,
  the rest records decisions (what the site needs, dates, notes).
- `library.yaml`: catalog of shared forms (with their program) and key modules.
- `index.html`: generated page (`python3 scripts/site-profiles/build.py`). Read-only on GitHub Pages.

Shared page (editable, for the implementation team): https://claude.ai/artifact/Dtud3AZyLb6J6GNGFqEm7x
Click any value to change it; "Save to GitHub" commits each changed profile under your own GitHub
account (needs the GitHub connector in claude.ai and write access to this repository).

Workflow and scripts: see the `site-profiles` skill in `.claude/skills/site-profiles/SKILL.md`.
