import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { db } from './db.js';
import { indicators, score } from '../shared/scoring.js';

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: {
  directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], formAction: ["'self'"],
    baseUri: ["'none'"], objectSrc: ["'none'"] }
} }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
app.use('/shared', express.static(path.resolve(publicDir, '../shared'), { index: false }));
app.use(express.static(publicDir, { index: false }));

const cookieName = 'crasdex_session';
const hash = token => createHash('sha256').update(token).digest('hex');
const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' };
const expiry = () => new Date(Date.now() + 7 * 86400000);
const dateSQL = date => date.toISOString().slice(0, 23).replace('T', ' ');
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const fail = (res, status, message) => res.status(status).json({ error: message });
const validEmail = v => typeof v === 'string' && v.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
async function configuration() {
  const [categoryRows] = await db.execute('SELECT id,name,active FROM project_categories ORDER BY name');
  const [indicatorRows] = await db.execute('SELECT indicator_key AS `key`,label,weight,options_json AS options,advice FROM assessment_indicators');
  const byKey = new Map(indicatorRows.map(row => [row.key, { ...row, options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options }]));
  const method = indicators.map(i => byKey.get(i.key));
  if (method.some(i => !i) || method.reduce((sum, i) => sum + i.weight, 0) !== 100) throw new Error('Konfigurasi indikator belum lengkap. Jalankan migrasi.');
  return { categories: categoryRows, indicators: method };
}

// Mutations require a same-origin request plus a non-simple custom header.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const host = req.get('host');
  let parsed;
  try { parsed = new URL(origin); } catch { return fail(res, 403, 'Permintaan lintas situs ditolak.'); }
  if (!host || !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.host !== host || req.get('x-cras-dex') !== '1') return fail(res, 403, 'Permintaan lintas situs ditolak.');
  next();
});
app.use('/api', async (req, res, next) => {
  try {
    const token = /(?:^|;\s*)crasdex_session=([a-f0-9]{64})(?:;|$)/.exec(req.get('cookie') || '')?.[1];
    if (token) {
      const [rows] = await db.execute(
        'SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3) AND u.active=1',
        [hash(token)]);
      req.user = rows[0] || null;
      req.sessionToken = token;
    }
    next();
  } catch (error) { next(error); }
});
const auth = (req, res, next) => req.user ? next() : fail(res, 401, 'Silakan masuk terlebih dahulu.');
const roles = (...allowed) => (req, res, next) => allowed.includes(req.user.role) ? next() : fail(res, 403, 'Akses tidak diizinkan.');
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' } });

app.post('/api/login', loginLimit, async (req, res) => {
  const { email, password } = req.body || {};
  if (!validEmail(email) || typeof password !== 'string') return fail(res, 400, 'Email atau kata sandi tidak valid.');
  const [rows] = await db.execute('SELECT * FROM users WHERE email=? AND active=1', [email.trim().toLowerCase()]);
  const user = rows[0];
  const good = user && await bcrypt.compare(password, user.password_hash);
  if (!good) return fail(res, 401, 'Email atau kata sandi salah.');
  if (req.sessionToken) await db.execute('DELETE FROM sessions WHERE token_hash=?', [hash(req.sessionToken)]);
  const token = randomBytes(32).toString('hex');
  await db.execute('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', [hash(token), user.id, dateSQL(expiry())]);
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: 7 * 86400000 });
  res.json({ user: publicUser(user) });
});
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.get('/api/config', auth, async (req, res) => res.json(await configuration()));
app.post('/api/logout', auth, async (req, res) => {
  await db.execute('DELETE FROM sessions WHERE token_hash=?', [hash(req.sessionToken)]);
  res.clearCookie(cookieName, cookieOptions);
  res.json({ ok: true });
});
app.patch('/api/password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128)
    return fail(res, 400, 'Kata sandi baru harus 12–128 karakter.');
  const [rows] = await db.execute('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
  if (!await bcrypt.compare(oldPassword, rows[0].password_hash)) return fail(res, 400, 'Kata sandi lama salah.');
  await db.execute('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(newPassword, 12), req.user.id]);
  await db.execute('DELETE FROM sessions WHERE user_id=? AND token_hash<>?', [req.user.id, hash(req.sessionToken)]);
  res.json({ ok: true });
});

function validateAssessment(body, config) {
  const name = typeof body?.namaProject === 'string' ? body.namaProject.trim() : '';
  const description = typeof body?.deskripsi === 'string' ? body.deskripsi.trim() : '';
  if (typeof name !== 'string' || name.length < 1 || name.length > 100 ||
    typeof description !== 'string' || description.length < 1 || description.length > 500 ||
    !config.categories.some(c => c.name === body.kategoriProject && c.active)) throw new Error('Lengkapi nama (1–100), deskripsi (1–500), dan kategori project aktif.');
  const values = Object.fromEntries(indicators.map(i => [i.key, body[i.key]]));
  const result = score(values, config.indicators);
  const image = body.gambar || '';
  if (typeof image !== 'string' || (image && (image.length >= 650000 ||
    !/^data:image\/jpeg;base64,\/9j\/(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image))))
    throw new Error('Gambar harus berupa JPEG yang diproses aplikasi (maksimal 650.000 karakter).');
  if (body.namaGambar && (typeof body.namaGambar !== 'string' || body.namaGambar.length > 255))
    throw new Error('Nama gambar tidak valid.');
  return { name, description, values, result, image, imageName: body.namaGambar || '' };
}
const mapAssessment = row => {
  const values = { kemampuan: row.ability, pengalaman: row.experience, waktuTersedia: row.available_time, kesiapanTools: row.tools };
  const method = row.method_snapshot ? (typeof row.method_snapshot === 'string' ? JSON.parse(row.method_snapshot) : row.method_snapshot) : indicators;
  return { id: row.id, mahasiswaId: row.student_id, namaMahasiswa: row.student_name,
    namaProject: row.project_name, deskripsi: row.description, kategoriProject: row.project_category,
    gambar: row.image_data || '', namaGambar: row.image_name || '', ...values, ...score(values, method), method,
    tanggalPenilaian: row.created_at.replace(' ', 'T') + 'Z' };
};
const selectAssessment = `SELECT a.*, u.name AS student_name FROM assessments a JOIN users u ON u.id=a.student_id`;
app.get('/api/assessments', auth, async (req, res) => {
  let where = 'WHERE a.student_id=?';
  let params = [req.user.id];
  if (req.user.role === 'admin') { where = ''; params = []; }
  if (req.user.role === 'dosen') { where = 'JOIN lecturer_students ls ON ls.student_id=a.student_id AND ls.lecturer_id=?'; }
  const [rows] = await db.execute(`${selectAssessment} ${where} ORDER BY a.created_at DESC,a.id DESC LIMIT 500`, params);
  res.json({ assessments: rows.map(mapAssessment) });
});
app.post('/api/assessments', auth, roles('mahasiswa'), async (req, res) => {
  let a;
  const config = await configuration();
  try { a = validateAssessment(req.body, config); } catch (error) { return fail(res, 400, error.message); }
  const id = randomUUID();
  await db.execute(`INSERT INTO assessments
    (id,student_id,project_name,description,project_category,image_data,image_name,ability,experience,available_time,tools,score,readiness,method_snapshot)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    id, req.user.id, a.name, a.description, req.body.kategoriProject, a.image || null, a.imageName || null,
    a.values.kemampuan, a.values.pengalaman, a.values.waktuTersedia, a.values.kesiapanTools,
    a.result.skor, a.result.kategoriKesiapan, JSON.stringify(config.indicators)
  ]);
  res.status(201).json({ id });
});
app.delete('/api/assessments/:id', auth, roles('mahasiswa', 'admin'), async (req, res) => {
  const [result] = req.user.role === 'admin'
    ? await db.execute('DELETE FROM assessments WHERE id=?', [req.params.id])
    : await db.execute('DELETE FROM assessments WHERE id=? AND student_id=?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return fail(res, 404, 'Penilaian tidak ditemukan.');
  res.json({ ok: true });
});
app.get('/api/feedback', auth, async (req, res) => {
  const where = req.user.role === 'admin' ? '' :
    req.user.role === 'dosen' ? 'JOIN lecturer_students ls ON ls.student_id=a.student_id AND ls.lecturer_id=?' :
      'WHERE a.student_id=?';
  const [rows] = await db.execute(`SELECT f.assessment_id,f.lecturer_id,u.name AS lecturer_name,f.message,f.updated_at
    FROM lecturer_feedback f JOIN assessments a ON a.id=f.assessment_id
    JOIN users u ON u.id=f.lecturer_id ${where} ORDER BY f.updated_at DESC LIMIT 2000`,
  req.user.role === 'admin' ? [] : [req.user.id]);
  res.json({ feedback: rows });
});
app.put('/api/assessments/:id/feedback', auth, roles('dosen'), async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > 1000) return fail(res, 400, 'Masukan harus 1–1000 karakter.');
  const [assigned] = await db.execute(
    `SELECT a.id FROM assessments a JOIN lecturer_students ls ON ls.student_id=a.student_id
     WHERE a.id=? AND ls.lecturer_id=?`, [req.params.id, req.user.id]);
  if (!assigned.length) return fail(res, 403, 'Mahasiswa ini bukan bimbingan Anda.');
  await db.execute(
    `INSERT INTO lecturer_feedback (assessment_id,lecturer_id,message) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE message=VALUES(message),updated_at=CURRENT_TIMESTAMP(3)`,
    [req.params.id, req.user.id, message]);
  res.json({ ok: true });
});
app.delete('/api/assessments/:id/feedback', auth, roles('dosen'), async (req, res) => {
  const [result] = await db.execute('DELETE FROM lecturer_feedback WHERE assessment_id=? AND lecturer_id=?',
    [req.params.id, req.user.id]);
  if (!result.affectedRows) return fail(res, 404, 'Masukan tidak ditemukan.');
  res.json({ ok: true });
});
app.get('/api/summary', auth, async (req, res) => {
  const [counts] = req.user.role === 'admin'
    ? await db.execute(`SELECT COUNT(*) AS total,COALESCE(ROUND(AVG(score)),0) AS average_score,
      SUM(readiness='Siap') AS ready FROM assessments`)
    : req.user.role === 'dosen'
      ? await db.execute(`SELECT COUNT(*) AS total,COALESCE(ROUND(AVG(a.score)),0) AS average_score,
        SUM(a.readiness='Siap') AS ready FROM assessments a
        JOIN lecturer_students ls ON ls.student_id=a.student_id AND ls.lecturer_id=?`, [req.user.id])
      : await db.execute(`SELECT COUNT(*) AS total,COALESCE(ROUND(AVG(score)),0) AS average_score,
        SUM(readiness='Siap') AS ready FROM assessments WHERE student_id=?`, [req.user.id]);
  const summary = { ...counts[0], ready: Number(counts[0].ready || 0) };
  if (req.user.role === 'admin') {
    const [rows] = await db.execute(`SELECT role,COUNT(*) AS total FROM users WHERE active=1 GROUP BY role`);
    summary.users = Object.fromEntries(rows.map(r => [r.role, r.total]));
  }
  if (req.user.role === 'dosen') {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM lecturer_students WHERE lecturer_id=?', [req.user.id]);
    summary.students = rows[0].total;
  }
  res.json({ summary });
});

app.post('/api/categories', auth, roles('admin'), async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 80) return fail(res, 400, 'Nama kategori harus 1–80 karakter.');
  try {
    await db.execute('INSERT INTO project_categories (name) VALUES (?)', [name]);
    res.status(201).json({ ok: true });
  } catch (error) { if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Kategori sudah tersedia.'); throw error; }
});
app.patch('/api/categories/:id', auth, roles('admin'), async (req, res) => {
  const [rows] = await db.execute('SELECT name,active FROM project_categories WHERE id=?', [req.params.id]);
  if (!rows.length) return fail(res, 404, 'Kategori tidak ditemukan.');
  if (req.body?.active === undefined && req.body?.name === undefined) return fail(res, 400, 'Tidak ada perubahan.');
  const active = req.body.active === undefined ? Boolean(rows[0].active) : req.body.active;
  const name = req.body.name === undefined ? rows[0].name : typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (typeof active !== 'boolean' || !name || name.length > 80) return fail(res, 400, 'Nama atau status kategori tidak valid.');
  if (name !== rows[0].name) {
    const [used] = await db.execute('SELECT id FROM assessments WHERE project_category=? LIMIT 1', [rows[0].name]);
    if (used.length) return fail(res, 409, 'Kategori sudah dipakai. Tambahkan nama baru lalu nonaktifkan kategori lama.');
  }
  try { await db.execute('UPDATE project_categories SET name=?,active=? WHERE id=?', [name, active, req.params.id]); }
  catch (error) { if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Nama kategori sudah dipakai.'); throw error; }
  res.json({ ok: true });
});
app.delete('/api/categories/:id', auth, roles('admin'), async (req, res) => {
  const [rows] = await db.execute('SELECT name FROM project_categories WHERE id=?', [req.params.id]);
  if (!rows.length) return fail(res, 404, 'Kategori tidak ditemukan.');
  const [used] = await db.execute('SELECT id FROM assessments WHERE project_category=? LIMIT 1', [rows[0].name]);
  if (used.length) return fail(res, 409, 'Kategori sudah dipakai. Nonaktifkan agar riwayat tetap utuh.');
  await db.execute('DELETE FROM project_categories WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});
app.put('/api/indicators', auth, roles('admin'), async (req, res) => {
  const method = req.body?.indicators;
  if (!Array.isArray(method) || method.length !== 4 ||
    method.some((i, n) => i?.key !== indicators[n].key ||
      typeof i.label !== 'string' || !i.label.trim() || i.label.trim().length > 100 ||
      !Number.isInteger(i.weight) || i.weight < 0 || i.weight > 100 ||
      !Array.isArray(i.options) || i.options.length !== 6 ||
      i.options.some(o => typeof o !== 'string' || !o.trim() || o.trim().length > 150) ||
      typeof i.advice !== 'string' || !i.advice.trim() || i.advice.trim().length > 500) ||
    method.reduce((sum, i) => sum + i.weight, 0) !== 100)
    return fail(res, 400, 'Empat indikator harus lengkap, skala 0–5, dan total bobot tepat 100.');
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const i of method) await connection.execute(
      'UPDATE assessment_indicators SET label=?,weight=?,options_json=?,advice=? WHERE indicator_key=?',
      [i.label.trim(), i.weight, JSON.stringify(i.options.map(o => o.trim())), i.advice.trim(), i.key]);
    await connection.commit();
    res.json({ ok: true });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
});

app.get('/api/users', auth, roles('admin'), async (req, res) => {
  const [users] = await db.execute('SELECT id,name,email,role,active,created_at FROM users ORDER BY created_at DESC LIMIT 500');
  const [links] = await db.execute('SELECT lecturer_id,student_id FROM lecturer_students');
  res.json({ users, links });
});
app.post('/api/users', auth, roles('admin'), async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || !validEmail(email) ||
    typeof password !== 'string' || password.length < 12 || password.length > 128 ||
    !['admin', 'dosen', 'mahasiswa'].includes(role)) return fail(res, 400, 'Periksa nama, email, peran, dan kata sandi (12–128 karakter).');
  try {
    const [result] = await db.execute('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      [name.trim(), email.trim().toLowerCase(), await bcrypt.hash(password, 12), role]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Email sudah terdaftar.');
    throw error;
  }
});
app.patch('/api/users/:id', auth, roles('admin'), async (req, res) => {
  if (String(req.user.id) === req.params.id) return fail(res, 400, 'Akun sendiri tidak dapat dinonaktifkan atau diubah perannya.');
  if (typeof req.body?.active !== 'boolean') return fail(res, 400, 'Status tidak valid.');
  const [result] = await db.execute('UPDATE users SET active=? WHERE id=?', [req.body.active, req.params.id]);
  if (!result.affectedRows) return fail(res, 404, 'Akun tidak ditemukan.');
  if (!req.body.active) await db.execute('DELETE FROM sessions WHERE user_id=?', [req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/users/:id', auth, roles('admin'), async (req, res) => {
  if (String(req.user.id) === req.params.id) return fail(res, 400, 'Tidak dapat menghapus akun sendiri.');
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute('SELECT active FROM users WHERE id=? FOR UPDATE', [req.params.id]);
    if (!users.length) { await connection.rollback(); return fail(res, 404, 'Akun tidak ditemukan.'); }
    if (users[0].active) { await connection.rollback(); return fail(res, 409, 'Nonaktifkan akun sebelum menghapusnya.'); }
    const [assessments] = await connection.execute('SELECT id FROM assessments WHERE student_id=? LIMIT 1', [req.params.id]);
    const [feedback] = await connection.execute('SELECT assessment_id FROM lecturer_feedback WHERE lecturer_id=? LIMIT 1', [req.params.id]);
    if (assessments.length || feedback.length) {
      await connection.rollback();
      return fail(res, 409, 'Akun memiliki penilaian atau masukan. Biarkan nonaktif agar riwayat tetap utuh.');
    }
    await connection.execute('DELETE FROM users WHERE id=? AND active=0', [req.params.id]);
    await connection.commit();
    res.json({ ok: true });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
});
app.post('/api/assignments', auth, roles('admin'), async (req, res) => {
  const { lecturerId, studentId } = req.body || {};
  if (!/^[1-9]\d*$/.test(String(lecturerId)) || !/^[1-9]\d*$/.test(String(studentId)) || String(lecturerId) === String(studentId))
    return fail(res, 400, 'Pilih dosen dan mahasiswa yang valid.');
  const [rows] = await db.execute('SELECT id,role,active FROM users WHERE id IN (?,?)', [lecturerId, studentId]);
  if (rows.length !== 2 || !rows.some(x => String(x.id) === String(lecturerId) && x.role === 'dosen' && x.active) ||
    !rows.some(x => String(x.id) === String(studentId) && x.role === 'mahasiswa' && x.active))
    return fail(res, 400, 'Pilih dosen dan mahasiswa aktif yang valid.');
  await db.execute('INSERT IGNORE INTO lecturer_students (lecturer_id,student_id) VALUES (?,?)', [lecturerId, studentId]);
  res.status(201).json({ ok: true });
});
app.delete('/api/assignments/:lecturerId/:studentId', auth, roles('admin'), async (req, res) => {
  const [result] = await db.execute('DELETE FROM lecturer_students WHERE lecturer_id=? AND student_id=?',
    [req.params.lecturerId, req.params.studentId]);
  if (!result.affectedRows) return fail(res, 404, 'Penugasan tidak ditemukan.');
  res.json({ ok: true });
});
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.use('/api', (req, res) => fail(res, 404, 'Endpoint tidak ditemukan.'));
app.use((error, req, res, next) => {
  console.error(error);
  if (error.type === 'entity.too.large') return fail(res, 413, 'Permintaan terlalu besar.');
  if (error instanceof SyntaxError && 'body' in error) return fail(res, 400, 'JSON tidak valid.');
  return fail(res, 500, 'Terjadi kesalahan server.');
});
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Cras Dex: http://localhost:${port}`));
