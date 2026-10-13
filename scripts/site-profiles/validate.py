#!/usr/bin/env python3
"""Check docs/site-matrix/sites.yaml against sites.schema.json and the catalog.

    python3 scripts/site-profiles/validate.py

Exits 1 and lists the problems if the file is invalid. Requires PyYAML and jsonschema.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from profiles import ROOT, SITES_FILE, load_doc, problems  # noqa: E402


def main():
    errors = problems(load_doc())
    for e in errors:
        print(e)
    print("%s: %s" % (os.path.relpath(SITES_FILE, ROOT), "%d problem(s)" % len(errors) if errors else "valid"))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
