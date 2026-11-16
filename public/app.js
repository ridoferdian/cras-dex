import { score } from '/shared/scoring.js';
const $ = id => document.getElementById(id);
const node = (tag, text) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el; };
let user = null, assessments = [], users = [], links = [], feedback = [], categories = [], indicators = [];
let categoryRows = [];
let image = '', imageName = '', imageBusy = false, imageSequence = 0, lastSaved = '';
const form = $('assessment-form');
function notify(message) { $('notice').textContent = message; if (message) $('notice').scrollIntoView({ block: 'nearest' }); }
async function api(url, options = {}) {
  let response;
  try {
    response = await fetch('/api' + url, {
      credentials: 'same-origin', ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.method ? { 'X-Cras-Dex': '1' } : {}), ...options.headers }
    });
  } catch { throw new Error('Jaringan tidak tersedia. Coba lagi saat terhubung.'); }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Permintaan gagal.');
  return body;
}
async function run(task) { try { await task(); } catch (error) { notify(error.message); } }
const date = iso => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const metadata = () => ({
  namaProject: form.elements.namaProject.value.trim(), deskripsi: form.elements.deskripsi.value.trim(),
  kategoriProject: form.elements.kategoriProject.value, gambar: image, namaGambar: imageName
});
const values = () => Object.fromEntries(indicators.map(i => [i.key, form.elements[i.key].value === '' ? null : Number(form.elements[i.key].value)]));
const draft = () => ({ ...metadata(), ...values() });
function preview() {
  const v = values(), filled = Object.values(v).filter(x => x !== null).length, ready = filled === 4;
  const result = ready && indicators.length === 4 ? score(v, indicators) : null;
  $('progress').textContent = `${filled} dari 4 indikator terisi`;
  $('preview-score').replaceChildren(document.createTextNode(result ? String(result.skor) + ' ' : '— '), node('small', '/100'));
  $('preview-category').textContent = result?.kategoriKesiapan || 'Belum dinilai';
  $('preview-category').dataset.level = result?.kategoriKesiapan || '';
  $('breakdown').textContent = result ? indicators.map((i, n) => `${i.label}: ${result.contributions[n]}/${i.weight}`).join(' · ') : 'Pilih empat indikator untuk melihat skor.';
  $('advice').replaceChildren(...(result?.rekomendasi || ['Isi penilaian dengan jujur.']).map(text => node('li', text)));
  $('share-preview').disabled = !result || !metadata().namaProject || !metadata().deskripsi || !metadata().kategoriProject || imageBusy;
}
function showDialog(title, content) {
  $('dialog-title').textContent = title;
  $('dialog-content').replaceChildren(content);
  $('dialog').showModal();
}
function shareText(a) {
  return ['Hasil refleksi Cras Dex', `Project: ${a.namaProject}`, `Kategori project: ${a.kategoriProject}`, a.deskripsi, '',
    ...(a.method || indicators).map(i => `${i.label}: ${a[i.key]}/5`), `Skor kesiapan: ${a.skor}/100`, `Kategori kesiapan: ${a.kategoriKesiapan}`,
    '', 'Rekomendasi:', ...a.rekomendasi.map(t => '• ' + t), '', 'Panduan refleksi, bukan penentu mutlak kemampuan mahasiswa.'].join('\n');
}
function phone(raw) {
  if (!/^[+\d\s()-]+$/.test(raw.trim())) return null;
  let number = raw.trim().replace(/[\s()-]/g, '').replace(/^\+/, '');
  if (number.startsWith('0')) number = '62' + number.slice(1);
  return /^[1-9]\d{7,14}$/.test(number) ? number : null;
}
function share(a) {
  const box = node('div'), label = node('label', 'Nomor WhatsApp tujuan');
  const input = node('input'); input.type = 'tel'; input.placeholder = '08… atau +62…'; input.autocomplete = 'off';
  const error = node('p'); error.setAttribute('role', 'alert');
  const button = node('button', 'Buka WhatsApp');
  button.onclick = () => {
    const number = phone(input.value);
    if (!number) { error.textContent = 'Nomor harus 8–15 digit setelah normalisasi.'; input.focus(); return; }
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(shareText(a))}`, '_blank', 'noopener,noreferrer');
  };
  label.append(input);
  box.append(node('p', 'Nomor tidak disimpan. Hanya teks hasil yang dibagikan; gambar tidak dilampirkan.'), label, error, button);
  showDialog('Bagikan hasil', box); input.focus();
}
function detail(a) {
  const box = node('div');
  box.append(node('p', `${a.namaMahasiswa} · ${date(a.tanggalPenilaian)}`),
    node('p', `Kategori project: ${a.kategoriProject}`), node('p', a.deskripsi),
    node('h3', `${a.skor}/100 · ${a.kategoriKesiapan}`));
  if (a.gambar) { const img = node('img'); img.className = 'detail-image'; img.alt = 'Gambar ' + a.namaProject; img.src = a.gambar; box.append(img); }
  const table = node('table');
  (a.method || indicators).forEach((i, index) => {
    const tr = node('tr'); tr.append(node('td', i.label), node('td', `${a[i.key]}/5 · ${i.options[a[i.key]]}`), node('td', `${a.contributions[index]}/${i.weight}`)); table.append(tr);
  });
  box.append(table, node('h3', 'Rekomendasi')); const list = node('ul');
  a.rekomendasi.forEach(t => list.append(node('li', t))); box.append(list);
  box.append(node('p', 'Hasil ini panduan refleksi, bukan penentu mutlak kemampuan.'));
  const comments = feedback.filter(f => f.assessment_id === a.id);
  box.append(node('h3', 'Masukan dosen'));
  if (!comments.length) box.append(node('p', 'Belum ada masukan.'));
  comments.forEach(f => {
    const item = node('div'); item.className = 'feedback';
    item.append(node('strong', f.lecturer_name), node('small', ' · ' + date(f.updated_at.replace(' ', 'T') + 'Z')), node('p', f.message));
    box.append(item);
  });
  if (user.role === 'dosen') {
    const own = comments.find(f => String(f.lecturer_id) === String(user.id));
    const label = node('label', 'Masukan atau rekomendasi Anda');
    const input = node('textarea'); input.maxLength = 1000; input.value = own?.message || '';
    label.append(input); box.append(label);
    const save = node('button', own ? 'Perbarui masukan' : 'Kirim masukan');
    save.onclick = () => run(async () => {
      await api(`/assessments/${a.id}/feedback`, { method: 'PUT', body: JSON.stringify({ message: input.value }) });
      await loadAssessments(); $('dialog').close(); detail(a); notify('Masukan dosen tersimpan.');
    }); box.append(save);
    if (own) {
      const remove = node('button', 'Hapus masukan'); remove.className = 'danger';
      remove.onclick = () => { if (confirm('Hapus masukan Anda?')) run(async () => {
        await api(`/assessments/${a.id}/feedback`, { method: 'DELETE' });
        await loadAssessments(); $('dialog').close(); detail(a); notify('Masukan dihapus.');
      }); }; box.append(' ', remove);
    }
  }
  if (user.role === 'mahasiswa') {
    const button = node('button', 'Bagikan via WhatsApp'); button.onclick = () => { $('dialog').close(); share(a); }; box.append(button);
  }
  showDialog(a.namaProject, box);
}
function assessmentCard(a, canDelete) {
  const card = node('article'); card.className = 'card';
  const info = node('div'); info.append(node('h3', a.namaProject),
    node('p', `${a.namaMahasiswa} · ${a.kategoriProject} · ${date(a.tanggalPenilaian)}`),
    node('p', `${a.skor}/100 · ${a.kategoriKesiapan}`));
  const controls = node('div'); controls.className = 'controls';
  const view = node('button', 'Lihat detail'); view.className = 'secondary'; view.onclick = () => detail(a); controls.append(view);
  if (canDelete) {
    const del = node('button', 'Hapus'); del.className = 'danger';
    del.setAttribute('aria-label', 'Hapus penilaian ' + a.namaProject);
    del.onclick = () => { if (confirm(`Hapus penilaian "${a.namaProject}"?`)) run(async () => {
      await api('/assessments/' + encodeURIComponent(a.id), { method: 'DELETE' }); lastSaved = ''; await loadAssessments(); await loadSummary(); notify('Penilaian dihapus.');
    }); };
    controls.append(del);
  }
  card.append(info, controls); return card;
}
function renderAssessments() {
  const target = user.role === 'mahasiswa' ? $('history-list') : user.role === 'dosen' ? $('lecturer-list') : $('admin-assessments');
  const selection = user.role === 'dosen' ? $('lecturer-filter').value : '';
  const visible = selection ? assessments.filter(a => String(a.mahasiswaId) === selection) : assessments;
  target.replaceChildren(...visible.map(a => assessmentCard(a, user.role === 'mahasiswa' || user.role === 'admin')));
  if (!visible.length) target.append(node('p', 'Belum ada penilaian yang dapat ditampilkan.'));
}
async function loadAssessments() {
  const [results, remarks] = await Promise.all([api('/assessments'), api('/feedback')]);
  assessments = results.assessments; feedback = remarks.feedback;
  if (user.role === 'dosen') {
    const filter = $('lecturer-filter'), selected = filter.value;
    filter.replaceChildren(node('option', 'Semua mahasiswa')); filter.firstChild.value = '';
    const students = new Map(assessments.map(a => [String(a.mahasiswaId), a.namaMahasiswa]));
    for (const [id, name] of students) { const option = node('option', name); option.value = id; filter.append(option); }
    filter.value = students.has(selected) ? selected : '';
  }
  renderAssessments();
}
function renderSummary(id, items) {
  $(id).replaceChildren(...items.map(([label, value]) => {
    const card = node('div'); card.className = 'panel';
    card.append(node('strong', String(value)), node('span', label)); return card;
  }));
}
async function loadSummary() {
  const { summary: s } = await api('/summary');
  const base = [['Total penilaian', s.total], ['Rata-rata skor', `${s.average_score}/100`], ['Hasil kategori Siap', s.ready]];
  if (user.role === 'admin') renderSummary('admin-summary', [
    ...base, ['Admin aktif', s.users.admin || 0], ['Dosen aktif', s.users.dosen || 0], ['Mahasiswa aktif', s.users.mahasiswa || 0]
  ]);
  else if (user.role === 'dosen') renderSummary('lecturer-summary', [['Mahasiswa ditugaskan', s.students], ...base]);
  else renderSummary('student-summary', base);
}
function renderAdmin() {
  const lists = [['lecturer-select', 'dosen'], ['student-select', 'mahasiswa']];
  lists.forEach(([id, role]) => {
    const select = $(id); select.replaceChildren(node('option', `Pilih ${role}`)); select.firstChild.value = '';
    users.filter(u => u.role === role && u.active).forEach(u => {
      const option = node('option', `${u.name} (${u.email})`); option.value = u.id; select.append(option);
    });
  });
  $('users-list').replaceChildren(...users.map(u => {
    const card = node('div'); card.className = 'card';
    const label = node('div'); label.append(node('h3', u.name), node('p', `${u.email} · ${u.role} · ${u.active ? 'Aktif' : 'Nonaktif'}`));
    card.append(label);
    if (String(u.id) !== String(user.id)) {
      const button = node('button', u.active ? 'Nonaktifkan' : 'Aktifkan');
      button.className = u.active ? 'danger' : 'secondary';
      button.onclick = () => {
        if (!confirm(`${u.active ? 'Nonaktifkan' : 'Aktifkan'} akun ${u.name}?`)) return;
        run(async () => { await api('/users/' + u.id, { method: 'PATCH', body: JSON.stringify({ active: !u.active }) }); await loadAdmin(); notify('Status pengguna diperbarui.'); });
      }; card.append(button);
      if (!u.active) {
        const remove = node('button', 'Hapus akun'); remove.className = 'danger';
        remove.onclick = () => {
          if (!confirm(`Hapus akun nonaktif ${u.name} secara permanen? Akun yang punya riwayat/masukan tidak bisa dihapus.`)) return;
          run(async () => { await api('/users/' + u.id, { method: 'DELETE' }); await loadAdmin(); await loadSummary(); notify('Akun dihapus.'); });
        }; card.append(remove);
      }
    } return card;
  }));
  $('assignments-list').replaceChildren(...links.map(link => {
    const dosen = users.find(u => u.id === link.lecturer_id), student = users.find(u => u.id === link.student_id);
    const card = node('div'); card.className = 'card';
    card.append(node('span', `${dosen?.name || link.lecturer_id} → ${student?.name || link.student_id}`));
    const button = node('button', 'Lepas'); button.className = 'danger';
    button.onclick = () => { if (confirm('Lepas penugasan ini?')) run(async () => {
      await api(`/assignments/${link.lecturer_id}/${link.student_id}`, { method: 'DELETE' }); await loadAdmin(); notify('Penugasan dilepas.');
    }); }; card.append(button); return card;
  }));
  if (!links.length) $('assignments-list').append(node('p', 'Belum ada penugasan.'));
}
async function loadAdmin() { ({ users, links } = await api('/users')); renderAdmin(); }
function renderConfig() {
  const current = form.elements.kategoriProject.value;
  $('category').replaceChildren(node('option', 'Pilih bidang project'));
  $('category').firstChild.value = '';
  categoryRows.filter(c => c.active).forEach(c => {
    const option = node('option', c.name); $('category').append(option);
  });
  $('category').value = categories.includes(current) ? current : '';
  $('categories-list').replaceChildren(...categoryRows.map(c => {
    const row = node('div'); row.className = 'card';
    row.append(node('span', c.name + (c.active ? ' · Aktif' : ' · Nonaktif')));
    const controls = node('div'); controls.className = 'controls';
    const rename = node('button', 'Ubah nama'); rename.className = 'secondary';
    rename.onclick = () => {
      const name = prompt('Nama baru kategori (kategori yang sudah dipakai tidak dapat diubah):', c.name);
      if (name === null || name.trim() === c.name) return;
      run(async () => {
        await api(`/categories/${c.id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) });
        await loadConfig(); notify('Nama kategori diperbarui.');
      });
    }; controls.append(rename);
    const toggle = node('button', c.active ? 'Nonaktifkan' : 'Aktifkan');
    toggle.className = 'secondary';
    toggle.onclick = () => run(async () => {
      await api(`/categories/${c.id}`, { method: 'PATCH', body: JSON.stringify({ active: !c.active }) });
      await loadConfig(); notify('Status kategori diperbarui.');
    }); controls.append(toggle);
    const remove = node('button', 'Hapus'); remove.className = 'danger';
    remove.onclick = () => { if (confirm(`Hapus kategori "${c.name}"? Kategori yang sudah dipakai harus dinonaktifkan.`)) run(async () => {
      await api(`/categories/${c.id}`, { method: 'DELETE' }); await loadConfig(); notify('Kategori dihapus.');
    }); };
    controls.append(remove); row.append(controls); return row;
  }));
  $('indicator-settings').replaceChildren(...indicators.map(i => {
    const field = node('fieldset'); field.dataset.key = i.key; field.append(node('legend', i.key));
    const label = (title, name, value, max, type = 'text') => {
      const element = node('label', title), input = node('input');
      input.name = name; input.type = type; input.value = value; input.required = true; if (max) input.maxLength = max;
      if (type === 'number') { input.min = 0; input.max = 100; input.step = 1; }
      element.append(input); field.append(element);
    };
    label('Nama indikator', 'label', i.label, 100);
    label('Bobot (poin dari 100)', 'weight', i.weight, 0, 'number');
    i.options.forEach((value, n) => label(`Pilihan nilai ${n}`, `option-${n}`, value, 150));
    const adviceLabel = node('label', 'Saran saat nilai di bawah 4');
    const advice = node('textarea'); advice.name = 'advice'; advice.maxLength = 500; advice.required = true; advice.value = i.advice;
    adviceLabel.append(advice); field.append(adviceLabel); return field;
  }));
  preview();
}
async function loadConfig() {
  const config = await api('/config');
  categoryRows = config.categories;
  categories = categoryRows.filter(c => c.active).map(c => c.name);
  indicators = config.indicators;
  renderIndicatorFields();
  renderConfig();
}
function renderIndicatorFields() {
  const previous = Object.fromEntries(indicators.map(i => [i.key, form.elements[i.key]?.value ?? '']));
  $('indicator-fields').replaceChildren(...indicators.map(i => {
    const wrap = node('div'); wrap.className = 'indicator';
    const label = node('label', `${i.label} · bobot ${i.weight}%`);
    const select = node('select'); select.name = i.key; select.required = true;
    const empty = node('option', 'Pilih kondisi kamu'); empty.value = ''; select.append(empty);
    i.options.forEach((text, n) => { const option = node('option', `${n} — ${text}`); option.value = n; select.append(option); });
    select.value = previous[i.key] || '';
    label.append(select); wrap.append(label);
    if (i.key === 'waktuTersedia') wrap.append(node('p', 'Bandingkan jam tersedia dengan kebutuhan project; 6/8 jam = 75% (nilai 4).'));
    return wrap;
  }));
  preview();
}
function navigate(section) {
  ['student', 'history', 'lecturer', 'admin'].forEach(name => { $(name + '-view').hidden = name !== section; });
  [...$('nav').children].forEach(button => { button.classList.toggle('active', button.dataset.view === section); if (button.dataset.view === section) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  run(async () => {
    if (section === 'history' || section === 'lecturer' || section === 'admin') await loadAssessments();
    if (section === 'admin') await loadAdmin();
    await loadSummary();
  });
  window.scrollTo(0, 0);
}
async function enter(account) {
  user = account; $('login-view').hidden = true; $('app-view').hidden = false; $('identity').hidden = false;
  $('user-label').textContent = `${user.name} · ${user.role}`;
  await loadConfig();
  const sections = user.role === 'mahasiswa' ? [['student', 'Penilaian'], ['history', 'Riwayat']] :
    user.role === 'dosen' ? [['lecturer', 'Pantau bimbingan']] : [['admin', 'Kelola aplikasi']];
  $('nav').replaceChildren(...sections.map(([view, title]) => {
    const button = node('button', title); button.dataset.view = view; button.className = 'secondary'; button.onclick = () => navigate(view); return button;
  }));
  navigate(sections[0][0]);
}
function exit() {
  user = null; assessments = []; users = []; links = []; feedback = []; lastSaved = '';
  $('app-view').hidden = true; $('identity').hidden = true; $('login-view').hidden = false;
  $('login-form').reset(); form.reset(); clearImage(); notify('');
}
function clearImage() {
  imageSequence++; imageBusy = false; image = ''; imageName = ''; $('image-input').value = '';
  $('image-box').hidden = true; $('image-preview').removeAttribute('src'); $('save').disabled = false;
  $('image-message').textContent = 'PNG/JPG/WebP maksimal 5 MB dan 20 megapiksel.'; preview();
}
async function processImage() {
  const file = $('image-input').files[0]; if (!file) return;
  const sequence = ++imageSequence;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    $('image-message').textContent = 'Gambar ditolak: gunakan PNG/JPG/WebP maksimal 5 MB. Gambar lama tetap dipakai.';
    $('image-input').value = ''; return;
  }
  imageBusy = true; $('save').disabled = true; preview();
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 20000000) throw new Error('Gambar melebihi 20 megapiksel.');
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = node('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); context.fillStyle = '#292b2f'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let data = '';
    for (const quality of [.82, .65, .45, .25]) { data = canvas.toDataURL('image/jpeg', quality); if (data.length < 650000) break; }
    if (data.length >= 650000) throw new Error('Gambar terkompresi masih terlalu besar.');
    if (sequence !== imageSequence) return;
    image = data; imageName = file.name.slice(0, 255);
    $('image-preview').src = image; $('image-box').hidden = false; $('image-message').textContent = `${imageName} · siap disimpan`;
  } catch (error) { if (sequence === imageSequence) { $('image-input').value = ''; $('image-message').textContent = `${error.message} Gambar sebelumnya tetap dipakai.`; } }
  finally { bitmap?.close(); if (sequence === imageSequence) { imageBusy = false; $('save').disabled = false; preview(); } }
}
$('lecturer-filter').onchange = renderAssessments;
form.addEventListener('input', preview); form.addEventListener('change', preview);
form.addEventListener('submit', event => {
  event.preventDefault(); run(async () => {
    const a = draft();
    if (!a.namaProject || !a.deskripsi) throw new Error('Nama dan deskripsi tidak boleh hanya spasi.');
    if (imageBusy) throw new Error('Tunggu gambar selesai diproses.');
    const signature = JSON.stringify(a);
    if (signature === lastSaved) throw new Error('Hasil yang sama sudah disimpan pada sesi form ini.');
    await api('/assessments', { method: 'POST', body: JSON.stringify(a) });
    lastSaved = signature; await loadAssessments(); await loadSummary(); notify('Penilaian berhasil disimpan. Buka Riwayat untuk melihatnya.');
  });
});
$('reset').onclick = () => { if (confirm('Kosongkan form? Riwayat tetap tersedia.')) { form.reset(); clearImage(); lastSaved = ''; preview(); } };
$('image-input').onchange = processImage; $('remove-image').onclick = clearImage;
$('share-preview').onclick = () => { const a = draft(); share({ ...a, ...score(a, indicators), method: indicators }); };
$('method').onclick = () => {
  const box = node('div');
  box.append(node('p', 'Kontribusi = nilai / 5 × bobot. Skor = jumlah kontribusi dibulatkan. Nilai 0–5 tiap indikator.'));
  indicators.forEach(i => box.append(node('p', `${i.label}: ${i.weight} poin maksimal.`)));
  box.append(node('p', '0–59: Belum siap · 60–79: Cukup siap · 80–100: Siap. Contoh: semua bernilai 3 → 30+12+12+6 = 60.'));
  box.append(node('p', 'Waktu = rasio jam tersedia terhadap kebutuhan project. 6 dari 8 jam = 75% → nilai 4. Indikator di bawah 4 mendapat saran menurut kehilangan poin terbesar.'));
  showDialog('Bagaimana skor dihitung?', box);
};
$('close-dialog').onclick = () => $('dialog').close();
$('login-form').onsubmit = event => { event.preventDefault(); run(async () => {
  const data = Object.fromEntries(new FormData(event.target));
  const { user: account } = await api('/login', { method: 'POST', body: JSON.stringify(data) });
  event.target.reset(); notify(''); await enter(account);
}); };
$('logout').onclick = () => run(async () => { await api('/logout', { method: 'POST' }); exit(); });
$('password-form').onsubmit = event => { event.preventDefault(); run(async () => {
  await api('/password', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
  event.target.reset(); notify('Kata sandi diperbarui. Sesi lain sudah keluar.');
}); };
$('user-form').onsubmit = event => { event.preventDefault(); run(async () => {
  await api('/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
  event.target.reset(); await loadAdmin(); notify('Akun dibuat.');
}); };
$('assignment-form').onsubmit = event => { event.preventDefault(); run(async () => {
  await api('/assignments', { method: 'POST', body: JSON.stringify({ lecturerId: $('lecturer-select').value, studentId: $('student-select').value }) });
  await loadAdmin(); notify('Mahasiswa ditugaskan ke dosen.');
}); };
$('category-form').onsubmit = event => { event.preventDefault(); run(async () => {
  const data = Object.fromEntries(new FormData(event.target));
  await api('/categories', { method: 'POST', body: JSON.stringify(data) });
  event.target.reset(); await loadConfig(); notify('Kategori ditambahkan.');
}); };
$('indicators-form').onsubmit = event => { event.preventDefault(); run(async () => {
  const method = [...$('indicator-settings').children].map(field => {
    const input = field.querySelector.bind(field);
    return { key: field.dataset.key, label: input('[name=label]').value.trim(),
      weight: Number(input('[name=weight]').value),
      options: Array.from({ length: 6 }, (_, n) => input(`[name=option-${n}]`).value.trim()),
      advice: input('[name=advice]').value.trim() };
  });
  await api('/indicators', { method: 'PUT', body: JSON.stringify({ indicators: method }) });
  await loadConfig(); notify('Metode penilaian diperbarui. Riwayat lama tetap memakai bobot sebelumnya.');
}); };
run(async () => { try { const { user: account } = await api('/me'); await enter(account); } catch (error) { if (!error.message.includes('Silakan masuk')) notify(error.message); } });
