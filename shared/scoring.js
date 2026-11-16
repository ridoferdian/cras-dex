export const categories = ['Web Development', 'Data Science', 'Machine Learning', 'Mobile Development', 'UI/UX Design', 'Game Development', 'Internet of Things (IoT)', 'Cybersecurity', 'Lainnya'];
export const indicators = [
  { key: 'kemampuan', label: 'Kemampuan teknis', weight: 50, options: ['Belum mengenal kemampuan yang dibutuhkan', 'Pernah mendengar/membaca', 'Memahami konsep dasar', 'Mengerjakan dengan panduan', 'Mengerjakan mandiri', 'Sangat menguasai, bisa mengajarkan'], advice: 'Perkuat kemampuan inti melalui latihan kecil terkait fitur project.' },
  { key: 'pengalaman', label: 'Pengalaman project serupa', weight: 20, options: ['Belum pernah mencoba', 'Mengikuti tutorial', '1 project dengan panduan', '1 project mandiri', '2–3 project mandiri', '>3 project mandiri'], advice: 'Selesaikan satu mini project serupa dan catat kendala serta solusinya.' },
  { key: 'waktuTersedia', label: 'Waktu tersedia / kebutuhan project', weight: 20, options: ['0%', '>0% dan <25%', '≥25% dan <50%', '≥50% dan <75%', '≥75% dan <100%', '≥100%'], advice: 'Kurangi lingkup fitur atau tambah alokasi waktu.' },
  { key: 'kesiapanTools', label: 'Kesiapan tools', weight: 10, options: ['Belum tersedia', 'Baru mengidentifikasi tools', 'Sebagian tools tersedia', 'Semua tersedia, belum dikonfigurasi', 'Semua dikonfigurasi, belum diuji', 'Semua siap, diuji berjalan'], advice: 'Lengkapi, konfigurasi, dan uji satu alur kerja sederhana.' }
];

export function score(values, method = indicators) {
  if (!method.every(({ key }) => Number.isInteger(values[key]) && values[key] >= 0 && values[key] <= 5)) throw new Error('Indikator harus bilangan bulat 0–5.');
  const contributions = method.map(i => values[i.key] / 5 * i.weight);
  const skor = Math.round(contributions.reduce((a, b) => a + b, 0));
  const kategoriKesiapan = skor >= 80 ? 'Siap' : skor >= 60 ? 'Cukup siap' : 'Belum siap';
  const rekomendasi = method.filter(i => values[i.key] < 4)
    .sort((a, b) => (5 - values[b.key]) / 5 * b.weight - (5 - values[a.key]) / 5 * a.weight)
    .map(i => i.advice);
  if (!rekomendasi.length) rekomendasi.push('Mulai dari fitur inti, buat milestone kecil, dan evaluasi berkala.');
  return { skor, kategoriKesiapan, rekomendasi, contributions };
}
