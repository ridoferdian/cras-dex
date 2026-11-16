import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../server/db.js';

test('alur MySQL: peran, konfigurasi, penilaian, dan masukan', {
  skip: process.env.CRAS_DEX_INTEGRATION !== '1',
  timeout: 30000
}, async () => {
  const port = 39983, origin = `http://127.0.0.1:${port}`, suffix = randomUUID().slice(0, 8);
  const emails = ['admin', 'dosen', 'mahasiswa'].map(role => `test-${role}-${suffix}@example.invalid`);
  const password = `test-password-${suffix}`;
  const ids = [], cookies = {};
  let processServer, categoryId;
  async function request(route, method = 'GET', body, role) {
    const response = await fetch(origin + '/api' + route, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { Origin: origin, 'X-Cras-Dex': '1' } : {}),
        ...(role ? { Cookie: cookies[role] } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  }
  try {
    const hash = await bcrypt.hash(password, 4);
    for (const [n, role] of ['admin', 'dosen', 'mahasiswa'].entries()) {
      const [result] = await db.execute('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
        [`Pengujian ${role}`, emails[n], hash, role]);
      ids.push(result.insertId);
    }
    processServer = spawn(process.execPath, ['server/index.js'], {
      cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
    });
    await new Promise((resolve, reject) => {
      processServer.stdout.once('data', resolve);
      processServer.once('error', reject);
      processServer.once('exit', code => reject(new Error(`Server keluar: ${code}`)));
    });
    for (const [n, role] of ['admin', 'dosen', 'mahasiswa'].entries()) {
      const login = await request('/login', 'POST', { email: emails[n], password });
      assert.equal(login.status, 200);
      cookies[role] = login.cookie.split(';')[0];
    }
    const config = (await request('/config', 'GET', null, 'admin')).data;
    assert.equal(config.indicators.length, 4);
    assert.equal((await request('/indicators', 'PUT', { indicators: config.indicators }, 'mahasiswa')).status, 403);
    assert.equal((await request('/indicators', 'PUT', {
      indicators: config.indicators.map((i, n) => n ? i : { ...i, weight: i.weight - 1 })
    }, 'admin')).status, 400);
    assert.equal((await request('/indicators', 'PUT', { indicators: config.indicators }, 'admin')).status, 200);
    const added = await request('/categories', 'POST', { name: `Uji ${suffix}` }, 'admin');
    assert.equal(added.status, 201);
    categoryId = (await request('/config', 'GET', null, 'admin')).data.categories.find(c => c.name === `Uji ${suffix}`).id;
    assert.equal((await request(`/categories/${categoryId}`, 'DELETE', null, 'admin')).status, 200);
    categoryId = null;
    assert.equal((await request('/assignments', 'POST',
      { lecturerId: ids[1], studentId: ids[2] }, 'admin')).status, 201);
    const created = await request('/assessments', 'POST', {
      namaProject: 'Tes integrasi', deskripsi: 'Project uji otomatis', kategoriProject: 'Web Development',
      kemampuan: 4, pengalaman: 3, waktuTersedia: 5, kesiapanTools: 4
    }, 'mahasiswa');
    assert.equal(created.status, 201);
    const assessmentId = created.data.id;
    const usedCategory = config.categories.find(c => c.name === 'Web Development');
    assert.equal((await request(`/categories/${usedCategory.id}`, 'PATCH',
      { name: `Ganti ${suffix}` }, 'admin')).status, 409);
    assert.equal((await request('/assessments', 'GET', null, 'dosen')).data.assessments[0].skor, 80);
    assert.equal((await request(`/assessments/${assessmentId}`, 'DELETE', null, 'dosen')).status, 403);
    assert.equal((await request(`/assessments/${assessmentId}/feedback`, 'PUT',
      { message: 'Perkuat dokumentasi project.' }, 'dosen')).status, 200);
    assert.equal((await request('/feedback', 'GET', null, 'mahasiswa')).data.feedback[0].message,
      'Perkuat dokumentasi project.');
    assert.equal((await request('/summary', 'GET', null, 'admin')).status, 200);
    assert.equal((await request(`/users/${ids[2]}`, 'DELETE', null, 'admin')).status, 409);
    assert.equal((await request(`/assessments/${assessmentId}`, 'DELETE', null, 'admin')).status, 200);
    assert.equal((await request(`/users/${ids[2]}`, 'PATCH', { active: false }, 'admin')).status, 200);
    assert.equal((await request(`/users/${ids[2]}`, 'DELETE', null, 'admin')).status, 200);
  } finally {
    processServer?.kill();
    if (categoryId) await db.execute('DELETE FROM project_categories WHERE id=?', [categoryId]);
    if (ids.length) await db.query('DELETE FROM users WHERE id IN (?)', [ids]);
    await db.end();
  }
});
