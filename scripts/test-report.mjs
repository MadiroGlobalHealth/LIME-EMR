#!/usr/bin/env node
// Builds a Markdown traceability report (requirement > test case > result)
// from the Playwright JSON report.
//
// Usage: node scripts/test-report.mjs [results.json] [report.md]
// Defaults: test-results/results.json -> test-results/report.md
// When GITHUB_STEP_SUMMARY is set, the report is also appended to the job summary.
//
// Conventions read from the tests:
//   - requirement: a tag such as @REQ-MH-PHQ9-001 (on the test or its describe)
//   - test case:   an id in brackets at the start of the title, e.g. [TC-MH-PHQ9-001]
//   - known issue: an annotation of type "known issue"

import fs from 'fs';

const input = process.argv[2] || 'test-results/results.json';
const output = process.argv[3] || 'test-results/report.md';

if (!fs.existsSync(input)) {
  console.error(`No Playwright JSON report at ${input}. Run the tests first (yarn test:config or yarn test:e2e).`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(input, 'utf8'));
const ICON = { passed: '✅', failed: '❌', timedOut: '❌', interrupted: '⚠️', skipped: '⏭️', flaky: '⚠️' };

const rows = [];
function walk(suite, titles = []) {
  const path = suite.title ? [...titles, suite.title] : titles;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const results = t.results ?? [];
      const last = results[results.length - 1] ?? {};
      let status = last.status ?? 'skipped';
      if (t.status === 'flaky') status = 'flaky';
      const tags = [...(spec.tags ?? []), ...(t.tags ?? [])].map((x) => x.replace(/^@/, ''));
      const tc = spec.title.match(/^\[([^\]]+)\]/)?.[1] ?? '';
      rows.push({
        req: tags.find((x) => x.startsWith('REQ-')) ?? '(no requirement)',
        tc,
        title: spec.title.replace(/^\[[^\]]+\]\s*/, ''),
        project: t.projectName,
        file: spec.file,
        status,
        duration: results.reduce((sum, r) => sum + (r.duration ?? 0), 0),
        error: (last.error?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0],
        knownIssues: (t.annotations ?? []).filter((a) => a.type === 'known issue').map((a) => a.description),
      });
    }
  }
  for (const child of suite.suites ?? []) walk(child, path);
}
for (const suite of report.suites ?? []) walk(suite);

const count = (s) => rows.filter((r) => r.status === s).length;
const failed = rows.filter((r) => ['failed', 'timedOut', 'interrupted'].includes(r.status));
const byReq = Map.groupBy ? Map.groupBy(rows, (r) => r.req) : rows.reduce((m, r) => m.set(r.req, [...(m.get(r.req) ?? []), r]), new Map());

const lines = [];
lines.push('# LIME EMR test report', '');
lines.push(`Run: ${report.stats?.startTime ?? new Date().toISOString()}${process.env.OPENMRS_BASE_URL ? `, target: ${process.env.OPENMRS_BASE_URL}` : ''}`, '');
lines.push(
  `**${rows.length} tests**: ${count('passed')} passed, ${failed.length} failed, ${count('flaky')} flaky, ${count('skipped')} skipped.`,
  '',
);

lines.push('## Requirements', '', '| Requirement | Tests | Result |', '|---|---|---|');
for (const [req, list] of [...byReq].sort()) {
  const bad = list.filter((r) => !['passed', 'skipped'].includes(r.status)).length;
  const verdict = bad ? `❌ ${bad} failing` : list.every((r) => r.status === 'skipped') ? '⏭️ not run' : '✅ covered';
  lines.push(`| ${req} | ${list.length} | ${verdict} |`);
}
lines.push('');

if (failed.length) {
  lines.push('## Failures', '');
  for (const r of failed) lines.push(`- ${ICON[r.status]} **${r.tc || r.title}** (${r.req}, ${r.file}): ${r.error || r.status}`);
  lines.push('');
}

const known = rows.flatMap((r) => r.knownIssues.map((k) => `- ${k} (${r.req})`));
if (known.length) lines.push('## Known issues (tracked, not failing)', '', ...known, '');

lines.push('## Detail', '');
for (const [req, list] of [...byReq].sort()) {
  lines.push(`### ${req}`, '', '| Test case | Check | Project | Result | Time |', '|---|---|---|---|---|');
  for (const r of list) {
    lines.push(`| ${r.tc || '-'} | ${r.title} | ${r.project} | ${ICON[r.status] ?? r.status} ${r.status} | ${r.duration} ms |`);
  }
  lines.push('');
}

const md = lines.join('\n');
fs.mkdirSync(output.replace(/[^/]+$/, '') || '.', { recursive: true });
fs.writeFileSync(output, md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
console.log(md);
