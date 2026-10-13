import { expect, test, type Page } from '@playwright/test';

// Test cases: docs/testing/exemples/REQ-MH-PHQ9-001.md
// Browser-level checks; the score arithmetic itself is covered in tests/config/forms/phq9-score.spec.ts.
// Needs a fictitious patient with an active visit: set E2E_PATIENT_UUID in .env.
const PATIENT = process.env.E2E_PATIENT_UUID;

const ITEMS = [
  'Little interest or pleasure in doing things?',
  'Feeling down, depressed, or hopeless?',
  'Trouble falling or staying asleep, or sleeping too much?',
  'Feeling tired or having little energy?',
  'Poor appetite or overeating?',
  'Feeling bad about yourself',
  'Trouble concentrating on things',
  'Moving or speaking so slowly',
  'Thoughts that you would be better off dead',
];
const POINTS = ['Not at all (0 point)', 'Several days (1 point)', 'More than half the days (2 points)', 'Nearly every day (3 points)'];

async function openPhq9(page: Page, baseURL?: string) {
  // baseURL ends in /spa without a trailing slash, so build the URL rather than pass a relative path.
  await page.goto(`${baseURL?.replace(/\/$/, '')}/patient/${PATIENT}/chart/Patient%20Summary`);
  await page.getByLabel('Clinical forms').click();
  await page.getByText('F35-MH-PHQ-9').click();
}

async function answer(page: Page, item: number, points: number) {
  await page
    .getByRole('group', { name: new RegExp(ITEMS[item].replace(/[?]/g, '\\?')) })
    .getByRole('radio', { name: POINTS[points] })
    .check({ force: true });
}

const scoreField = (page: Page) => page.getByRole('spinbutton', { name: /PHQ-9 score/ });

test.describe('PHQ-9 form in the patient chart', { tag: '@REQ-MH-PHQ9-001' }, () => {
  test.skip(!PATIENT, 'E2E_PATIENT_UUID is not set');

  test('[TC-MH-PHQ9-003] mixed answers show a score of 14', async ({ page, baseURL }) => {
    await openPhq9(page, baseURL);
    for (const [i, p] of [1, 2, 3, 0, 1, 2, 3, 0, 2].entries()) await answer(page, i, p);
    await expect(scoreField(page)).toHaveValue('14');
  });

  test('[TC-MH-PHQ9-004] the score updates when an answer changes', async ({ page, baseURL }) => {
    await openPhq9(page, baseURL);
    for (const [i, p] of [1, 2, 3, 0, 1, 2, 3, 0, 2].entries()) await answer(page, i, p);
    await expect(scoreField(page)).toHaveValue('14');
    await answer(page, 0, 3);
    await expect(scoreField(page)).toHaveValue('16');
  });

  test('[TC-MH-PHQ9-005] the score cannot be typed over', async ({ page, baseURL }) => {
    await openPhq9(page, baseURL);
    await answer(page, 0, 3);
    const field = scoreField(page);
    await field.fill('99').catch(() => {});
    await expect(field).toHaveValue('3');
  });
});
