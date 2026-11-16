import test from 'node:test';
import assert from 'node:assert/strict';
import { indicators, score } from '../shared/scoring.js';

test('batas kategori dan rincian bobot', () => {
  assert.equal(score({ kemampuan: 0, pengalaman: 0, waktuTersedia: 0, kesiapanTools: 0 }).skor, 0);
  const values = { kemampuan: 3, pengalaman: 3, waktuTersedia: 3, kesiapanTools: 2 };
  assert.deepEqual([score(values).skor, score(values).kategoriKesiapan], [58, 'Belum siap']);
  values.kesiapanTools = 3;
  assert.deepEqual([score(values).skor, score(values).kategoriKesiapan], [60, 'Cukup siap']);
  Object.assign(values, { kemampuan: 4, waktuTersedia: 5 });
  assert.equal(score(values).skor, 78);
  values.kesiapanTools = 4;
  assert.deepEqual(score(values).contributions, [40, 12, 20, 8]);
  assert.equal(score(values).kategoriKesiapan, 'Siap');
});
test('semua kombinasi bernilai valid, saran tersedia', () => {
  for (let k = 0; k <= 5; k++) for (let p = 0; p <= 5; p++)
    for (let w = 0; w <= 5; w++) for (let t = 0; t <= 5; t++) {
      const result = score({ kemampuan: k, pengalaman: p, waktuTersedia: w, kesiapanTools: t });
      assert.equal(result.skor, k * 10 + p * 4 + w * 4 + t * 2);
      assert.ok(result.rekomendasi.length > 0);
    }
  assert.throws(() => score({ kemampuan: 6, pengalaman: 1, waktuTersedia: 1, kesiapanTools: 1 }));
});
test('snapshot metode mempertahankan hasil lama saat bobot berubah', () => {
  const values = { kemampuan: 4, pengalaman: 3, waktuTersedia: 5, kesiapanTools: 4 };
  const oldMethod = structuredClone(indicators);
  const newMethod = structuredClone(indicators);
  newMethod[0].weight = 40;
  newMethod[1].weight = 30;
  assert.equal(score(values, oldMethod).skor, 80);
  assert.equal(score(values, newMethod).skor, 78);
  assert.equal(score(values, oldMethod).skor, 80);
});
