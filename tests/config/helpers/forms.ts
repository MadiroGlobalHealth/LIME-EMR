import fs from 'fs';
import path from 'path';

export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const DISTRO_INITIALIZER = path.join(REPO_ROOT, 'distro/configs/openmrs/initializer_config');

export type Question = {
  id?: string;
  label?: string;
  type?: string;
  required?: boolean | string;
  questionOptions?: {
    rendering?: string;
    concept?: string;
    answers?: { label: string; concept: string }[];
    calculate?: { calculateExpression: string };
    [key: string]: unknown;
  };
  questions?: Question[];
  [key: string]: unknown;
};

export type Form = {
  name: string;
  uuid: string;
  pages: { label: string; sections: { label: string; questions: Question[] }[] }[];
  [key: string]: unknown;
};

/** Every ampathforms directory: distro first, then each site. */
export function formDirs(): string[] {
  const dirs = [path.join(DISTRO_INITIALIZER, 'ampathforms')];
  const sitesDir = path.join(REPO_ROOT, 'sites');
  for (const site of fs.readdirSync(sitesDir)) {
    const dir = path.join(sitesDir, site, 'configs/openmrs/initializer_config/ampathforms');
    if (fs.existsSync(dir)) dirs.push(dir);
  }
  return dirs;
}

export function allFormFiles(): string[] {
  return formDirs().flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(dir, f)),
  );
}

export function loadForm(file: string): Form {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadDistroForm(fileName: string): Form {
  return loadForm(path.join(DISTRO_INITIALIZER, 'ampathforms', fileName));
}

/** Flattens pages, sections and nested question groups. */
export function allQuestions(form: Form): Question[] {
  const out: Question[] = [];
  const walk = (questions: Question[] = []) => {
    for (const q of questions) {
      out.push(q);
      walk(q.questions);
    }
  };
  for (const page of form.pages ?? []) {
    for (const section of page.sections ?? []) walk(section.questions);
  }
  return out;
}

export function question(form: Form, id: string): Question {
  const q = allQuestions(form).find((x) => x.id === id);
  if (!q) throw new Error(`Question "${id}" not found in form ${form.name}`);
  return q;
}

/** Concept UUID of the answer whose label is `label` (exact match). */
export function answerConcept(q: Question, label: string): string {
  const a = q.questionOptions?.answers?.find((x) => x.label === label);
  if (!a) throw new Error(`Answer "${label}" not found on question ${q.id}`);
  return a.concept;
}

/**
 * Evaluates a calculateExpression the way the form engine does for plain
 * expressions: every question id is a variable holding the selected answer
 * concept (or the typed value). Unanswered questions are undefined.
 * Expressions that call form engine helpers (calcBMI, ...) are not supported.
 */
export function evaluateCalculation(form: Form, questionId: string, values: Record<string, unknown>): unknown {
  const expression = question(form, questionId).questionOptions?.calculate?.calculateExpression;
  if (!expression) throw new Error(`Question "${questionId}" has no calculateExpression`);
  const ids = allQuestions(form)
    .map((q) => q.id)
    .filter((id): id is string => !!id && /^[A-Za-z_$][\w$]*$/.test(id));
  const fn = new Function(...ids, `return (${expression});`);
  return fn(...ids.map((id) => values[id]));
}
