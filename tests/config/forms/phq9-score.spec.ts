import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import { DISTRO_INITIALIZER, answerConcept, evaluateCalculation, loadDistroForm, question } from '../helpers/forms';

// Test cases: docs/testing/exemples/REQ-MH-PHQ9-001.md
const REQ = '@REQ-MH-PHQ9-001';
const form = loadDistroForm('F35-MH-PHQ-9_v2.json');

const ITEMS = [
  'littleInterestOrPleasureInDoingThings',
  'feelingDownDepressedOrHopeless',
  'troubleFallingOrStayingAsleepOrSleepingTooMuch',
  'feelingTiredOrHavingLittleEnergy',
  'poorAppetiteOrOverEating',
  'feelingBadAboutYourself',
  'troubleConcentratingOnThings',
  'movingOrSpeakingSoSlowly',
  'thoughtsThatYouWouldBeBetterOffDead',
];
const POINTS = ['Not at all (0 point)', 'Several days (1 point)', 'More than half the days (2 points)', 'Nearly every day (3 points)'];

/** Builds form values from a list of points (0-3) per item; null leaves the item unanswered. */
function answers(points: (number | null)[]): Record<string, string> {
  const values: Record<string, string> = {};
  points.forEach((p, i) => {
    if (p !== null) values[ITEMS[i]] = answerConcept(question(form, ITEMS[i]), POINTS[p]);
  });
  return values;
}

const score = (points: (number | null)[]) => evaluateCalculation(form, 'phq9Score', answers(points));

test.describe('PHQ-9 score calculation (F35 v2)', { tag: REQ }, () => {
  test('[TC-MH-PHQ9-001] all "Not at all" gives 0', () => {
    expect(score(Array(9).fill(0))).toBe(0);
  });

  test('[TC-MH-PHQ9-002] all "Nearly every day" gives 27', () => {
    expect(score(Array(9).fill(3))).toBe(27);
  });

  test('[TC-MH-PHQ9-003] mixed answers give 14', () => {
    expect(score([1, 2, 3, 0, 1, 2, 3, 0, 2])).toBe(14);
  });

  test('[TC-MH-PHQ9-006] unanswered items count as 0', () => {
    expect(score([3, 3, null, null, null, null, null, null, null])).toBe(6);
  });

  test('[TC-MH-PHQ9-002] score field accepts the full 0-27 range', () => {
    const opts = question(form, 'phq9Score').questionOptions!;
    expect(opts.min).toBe(0);
    expect(opts.max).toBe(27);
  });

  test('[TC-MH-PHQ9-007] every label has a French translation', () => {
    const file = path.join(DISTRO_INITIALIZER, 'ampathformstranslations/F35-MH-PHQ-9_v2_translations_fr.json');
    const translations: Record<string, string> = JSON.parse(fs.readFileSync(file, 'utf8')).translations;
    const labels = [
      'PHQ-9 score',
      ...ITEMS.map((id) => question(form, id).label!),
      ...POINTS,
    ];
    const missing = labels.filter((l) => !translations[l]?.trim());
    expect(missing, 'labels without a French translation').toEqual([]);
  });
});
