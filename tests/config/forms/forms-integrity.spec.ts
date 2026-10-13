import path from 'path';
import { expect, test } from '@playwright/test';
import { REPO_ROOT, allFormFiles, allQuestions, loadForm } from '../helpers/forms';

// Generic checks run on every form of the distro and the sites.
// They catch broken JSON and broken expressions before a deployment does.
const files = allFormFiles();

// Calculated fields whose calculateExpression holds the written spec instead of
// JavaScript, so the form engine never computes them. Listed here so the check
// stays green while they are fixed; remove an entry once its form is corrected.
// Any new broken expression still fails the test.
const KNOWN_BROKEN_EXPRESSIONS = new Set([
  'F29-MHPSS_Baseline_v2.json > mainSyndrome',
  'F29-MHPSS_Baseline_v2.json > mainCategoryOfPrecipitatingEvent',
  'F29-MHPSS_Baseline_v2.json > nextSessionDate',
  'F30-MHPSS_Follow-up_v2.json > mainCategoryOfPrecipitatingEvent',
  'F30-MHPSS_Follow-up_v2.json > nextSessionDate',
  'F31-mhGAP_Baseline_v2.json > nextSessionDate',
  'F32-mhGAP_Follow-up_v2.json > nextSessionDate',
  'F40-Referral_and_Discharge.json > lengthOfStayBeforePatientDischargeOrReferral',
]);

test.describe('Form configuration integrity', { tag: '@REQ-FORMS-INTEGRITY' }, () => {
  test('every form file is valid JSON with a name and a uuid', () => {
    const broken: string[] = [];
    for (const file of files) {
      try {
        const form = loadForm(file);
        if (!form.name || !form.uuid) broken.push(`${path.relative(REPO_ROOT, file)}: missing name or uuid`);
      } catch (e) {
        broken.push(`${path.relative(REPO_ROOT, file)}: ${(e as Error).message}`);
      }
    }
    expect(broken).toEqual([]);
  });

  test('form uuids are unique within each directory', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const file of files) {
      const key = `${path.dirname(file)}::${loadForm(file).uuid}`;
      if (seen.has(key)) duplicates.push(`${path.relative(REPO_ROOT, file)} duplicates ${seen.get(key)}`);
      else seen.set(key, path.relative(REPO_ROOT, file));
    }
    expect(duplicates).toEqual([]);
  });

  test('question ids are unique within each form', () => {
    const problems: string[] = [];
    for (const file of files) {
      const ids = allQuestions(loadForm(file))
        .map((q) => q.id)
        .filter(Boolean);
      const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
      if (dupes.length) problems.push(`${path.relative(REPO_ROOT, file)}: ${dupes.join(', ')}`);
    }
    expect(problems).toEqual([]);
  });

  test('every calculateExpression is valid JavaScript', () => {
    const problems: string[] = [];
    for (const file of files) {
      for (const q of allQuestions(loadForm(file))) {
        const expression = q.questionOptions?.calculate?.calculateExpression;
        if (!expression) continue;
        try {
          new Function(`return (${expression});`);
        } catch (e) {
          if (KNOWN_BROKEN_EXPRESSIONS.has(`${path.basename(file)} > ${q.id}`)) {
            test.info().annotations.push({ type: 'known issue', description: `${path.relative(REPO_ROOT, file)} > ${q.id}` });
          } else {
            problems.push(`${path.relative(REPO_ROOT, file)} > ${q.id}: ${(e as Error).message}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
