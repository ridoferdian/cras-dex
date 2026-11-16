import { readFile } from 'node:fs/promises';
import { db } from './db.js';
import { categories, indicators } from '../shared/scoring.js';

try {
  const sql = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  // The schema contains no user-supplied SQL; split only on statement delimiters.
  for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) {
    await db.query(statement);
  }
  const [columns] = await db.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='assessments' AND COLUMN_NAME='method_snapshot'`);
  if (!columns.length) await db.query('ALTER TABLE assessments ADD COLUMN method_snapshot JSON NULL');
  const [[categoryCount]] = await db.execute('SELECT COUNT(*) AS total FROM project_categories');
  if (!categoryCount.total) {
    for (const name of categories) await db.execute('INSERT IGNORE INTO project_categories (name) VALUES (?)', [name]);
  }
  for (const i of indicators) await db.execute(
    'INSERT IGNORE INTO assessment_indicators (indicator_key,label,weight,options_json,advice) VALUES (?,?,?,?,?)',
    [i.key, i.label, i.weight, JSON.stringify(i.options), i.advice]);
  console.log('Tabel Cras Dex siap.');
} catch (error) {
  console.error('Migrasi gagal:', error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
