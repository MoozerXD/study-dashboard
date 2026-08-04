// Merges *-ext*.json extension files into the main exam banks and validates the result.
// Usage: node scripts/merge-exam-extensions.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const examsDir = path.join(root, 'public/data/exams');

function validate(exam) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const sectionIds = new Set(exam.sections.map((s) => s.id));
  const passageIds = new Set((exam.passages || []).map((p) => p.id));
  for (const q of exam.questions) {
    if (ids.has(q.id)) errors.push(`duplicate id ${q.id}`);
    ids.add(q.id);
    if (!sectionIds.has(q.sectionId)) errors.push(`${q.id}: unknown sectionId ${q.sectionId}`);
    if (q.passageId && !passageIds.has(q.passageId)) errors.push(`${q.id}: unknown passageId ${q.passageId}`);
    if (q.type === 'input') {
      if (!Array.isArray(q.answers) || !q.answers.length) errors.push(`${q.id}: input without answers`);
    } else if (q.type === 'multi') {
      if (!Array.isArray(q.choices) || q.choices.length < 4) errors.push(`${q.id}: multi needs >=4 choices`);
      else if (!Array.isArray(q.correctIndices) || !q.correctIndices.length
        || q.correctIndices.some((i) => i < 0 || i >= q.choices.length)
        || new Set(q.correctIndices).size !== q.correctIndices.length) errors.push(`${q.id}: bad correctIndices`);
    } else {
      if (!Array.isArray(q.choices) || q.choices.length < 2) errors.push(`${q.id}: bad choices`);
      else if (q.correctIndex == null || q.correctIndex < 0 || q.correctIndex >= q.choices.length) errors.push(`${q.id}: bad correctIndex`);
    }
    // Some questions imported from the original SAT PDFs have no rationale — usable, just less helpful
    if (!q.explanation) warnings.push(q.id);
  }
  return { errors, warnings };
}

for (const examId of ['ent', 'ege', 'ielts', 'sat']) {
  const mainPath = path.join(examsDir, `${examId}.json`);
  const extFiles = fs.readdirSync(examsDir).filter((f) => f.startsWith(`${examId}-ext`) && f.endsWith('.json'));
  if (!extFiles.length) continue;
  const exam = JSON.parse(fs.readFileSync(mainPath, 'utf8'));
  const existingIds = new Set(exam.questions.map((q) => q.id));
  const existingPassages = new Set((exam.passages || []).map((p) => p.id));
  let added = 0, addedPassages = 0, addedSections = 0, addedTasks = 0, skipped = 0;
  for (const file of extFiles) {
    const ext = JSON.parse(fs.readFileSync(path.join(examsDir, file), 'utf8'));
    for (const s of ext.sections || []) {
      if (exam.sections.some((x) => x.id === s.id)) { skipped++; continue; }
      exam.sections.push(s);
      addedSections++;
    }
    for (const key of ['writingTasks', 'speakingTasks']) {
      for (const w of ext[key] || []) {
        if ((exam[key] || []).some((x) => x.id === w.id)) { skipped++; continue; }
        (exam[key] ||= []).push(w);
        addedTasks++;
      }
    }
    for (const p of ext.passages || []) {
      if (existingPassages.has(p.id)) { skipped++; continue; }
      (exam.passages ||= []).push(p);
      existingPassages.add(p.id);
      addedPassages++;
    }
    for (const q of ext.questions || []) {
      if (existingIds.has(q.id)) { skipped++; continue; }
      exam.questions.push(q);
      existingIds.add(q.id);
      added++;
    }
  }
  const { errors, warnings } = validate(exam);
  if (errors.length) {
    console.error(`${examId}: VALIDATION FAILED, not writing:`);
    for (const e of errors.slice(0, 20)) console.error('  -', e);
    process.exitCode = 1;
    continue;
  }
  if (warnings.length) console.warn(`${examId}: ${warnings.length} question(s) without an explanation (imported from source PDFs)`);
  fs.writeFileSync(mainPath, JSON.stringify(exam));
  for (const file of extFiles) fs.unlinkSync(path.join(examsDir, file));
  console.log(`${examId}: +${added} questions, +${addedPassages} passages, +${addedSections} sections, +${addedTasks} writing tasks (skipped ${skipped}); total ${exam.questions.length}. Merged: ${extFiles.join(', ')}`);
}
console.log('done');
