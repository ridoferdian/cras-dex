# SPEC — Cras Dex

Simulator kesiapan mahasiswa dalam mengerjakan project. MVP web untuk dikerjakan dalam 1 hari (8 jam). Bahasa antarmuka: Indonesia.

## 1. Tujuan

Membantu mahasiswa merefleksikan kesiapan sebelum memulai project melalui penilaian kemampuan, pengalaman, waktu tersedia, dan kesiapan tools. Aplikasi menghitung skor transparan, menampilkan rekomendasi, serta menyimpan riwayat lokal. Hasil merupakan panduan refleksi, bukan penentu mutlak kemampuan mahasiswa atau jaminan keberhasilan project.

Deliverable pertama: `cras-dex.html`, prototype mandiri berisi HTML, CSS, dan JavaScript tanpa dependensi eksternal. Bisa dibuka langsung; jika browser membatasi localStorage pada file lokal, jalankan melalui server lokal. Implementasi lanjutan menggunakan Vite + JavaScript vanilla. Prototype tidak memerlukan proses build Vite.

## 2. Acuan arsip dan keputusan adaptasi

Arsip terbaru yang diperiksa (`uas(2).rar`, dilampirkan sebagai acuan uas.rar) berisi:

| File | Perilaku yang ditemukan |
| --- | --- |
| `PenilaianKesiapan.py` | CLI, nama project, 4 kategori bidang, self-assessment skill skala 0–5, pengalaman berupa jumlah project dan bulan coding. |
| `ReadinessCalculator.py` | Skor skill = jumlah nilai / (jumlah skill × 5) × 100; bonus pengalaman = min(20, jumlah project × 5 + bulan coding × 0,5); total dibatasi 100. |
| `Recommendation.py` | Empat kategori: Siap ≥80, Cukup Siap ≥60, Kurang Siap ≥40, Belum Siap <40. |
| `SkillGapAnalyzer.py` | Gap terhadap requirement skill, prioritas HIGH/MEDIUM/LOW, estimasi belajar, pengurutan gap, dan penjumlahan waktu belajar rekursif. |

Terdapat pula cache bytecode `__pycache__`. Tidak ditemukan README, soal, atau dokumen instruksi tugas terpisah. Sumber dibaca sebagai referensi; kode Python tidak dijalankan.

Instruksi terbaru pengguna menjadi acuan lingkup. Self-assessment 0–5 dan ambang 60/80 dipertahankan. Rumus bonus pengalaman asli diganti rumus berbobot agar waktu dan tools ikut dihitung. Kategori di bawah 60 digabung menjadi Belum siap. Pengalaman disederhanakan ke indikator ordinal 0–5; waktu diukur berdasarkan kecukupan terhadap kebutuhan project, bukan bulan coding. Gap per skill dan roadmap mingguan diganti rekomendasi empat indikator. Ini adaptasi yang disengaja, bukan port identik Python. Tidak ada katalog, contoh project, dashboard pengelola, atau login.

## 3. Pengguna dan alur utama

Satu mahasiswa pada satu perangkat/browser. Tidak ada identitas akun, pemisahan pengguna, atau peran admin.

1. Masukkan nama, kategori dan deskripsi singkat project milik sendiri. Gambar project opsional.
2. Pilih kondisi pada keempat indikator. Semua pilihan awal kosong; nilai 0 adalah jawaban sah.
3. Setelah empat indikator terisi, preview otomatis menampilkan skor, kategori, kontribusi poin, dan rekomendasi. Metadata belum lengkap tidak menghalangi eksplorasi preview, tetapi menghalangi simpan dan bagikan.
4. Simpan penilaian untuk membuat snapshot bertanggal pada riwayat.
5. Buka detail riwayat, bagikan hasil melalui WhatsApp, atau hapus satu penilaian setelah konfirmasi.

## 4. Fitur MVP

| Fitur | Perilaku |
| --- | --- |
| Form project | Nama 1–100 karakter setelah trim; deskripsi 1–500 karakter setelah trim. Keduanya wajib dan menolak teks hanya spasi. |
| Kategori project | Wajib: Web Development, Data Science, Machine Learning, Mobile Development, UI/UX Design, Game Development, Internet of Things (IoT), Cybersecurity, Lainnya. Metadata ini tidak mengubah rumus skor. |
| Upload gambar | Satu gambar opsional, PNG/JPG/WebP ≤5 MB dan ≤20 megapiksel. Dekode lokal, resize sisi terpanjang maksimal 1280 px, konversi JPEG terkompresi data URL <650.000 karakter. Preview, hapus, snapshot riwayat/detail. Transparansi memakai latar abu-abu. Tidak ada upload server. Simpan ditahan saat pemrosesan; file invalid tidak mengganti gambar sebelumnya. |
| Empat indikator | Pilihan tunggal nilai integer 0–5 dengan label kondisi yang jelas. |
| Preview langsung | Perubahan input memperbarui progress terisi dan hasil tanpa tombol hitung. Skor tetap “—” sampai empat indikator lengkap. |
| Skor dan kategori | Rumus tetap, rincian kontribusi, dan dialog penjelasan metode. Tidak ada random atau AI scoring. |
| Rekomendasi | Saran deterministik berdasarkan indikator lemah, bukan analisis otomatis isi deskripsi. |
| Simpan hasil | Snapshot baru dengan id unik dan timestamp ISO. Menyimpan hasil sama berulang kali tanpa perubahan pada sesi form yang sama dicegah. |
| Riwayat | Kosong pada penggunaan pertama. Urut terbaru dahulu, menampilkan nama, tanggal lokal perangkat, skor, kategori, dan detail semua jawaban/rekomendasi. |
| Hapus riwayat | Hapus satu record dengan konfirmasi. Batal tidak mengubah data. Tidak ada hapus massal. |
| Bagikan WhatsApp | Aktif setelah metadata dan indikator lengkap; dari detail riwayat memakai snapshot. Membuka dialog nomor tujuan setiap kali berbagi, dari preview maupun detail. Input 08 dinormalisasi ke 628; +kode negara dan separator spasi/tanda hubung/kurung diterima. Setelah normalisasi harus 8–15 digit dengan awal bukan nol. Nomor tidak disimpan. Membuka wa.me/nomor dengan teks ter-encode; pengguna mengirim sendiri. Kategori project disertakan; gambar tidak dilampirkan lewat URL WhatsApp. |
| Penyimpanan lokal | Hanya riwayat beserta kategori/gambar disimpan; nomor WhatsApp tidak disimpan. Draft form tidak dipersistenkan. Riwayat tetap ada setelah reload pada origin/browser yang sama. |
| Mulai ulang | Mengosongkan form setelah konfirmasi, tidak menghapus riwayat. Penilaian baru dari riwayat kembali ke form yang sedang ada; tombol Mulai ulang dipakai untuk mengosongkannya. |

## 5. Indikator dan aturan perhitungan

### Skala pilihan

| Nilai | Kemampuan | Pengalaman project serupa | Waktu tersedia / kebutuhan project | Kesiapan tools |
| --- | --- | --- | --- | --- |
| 0 | Belum mengenal kemampuan yang dibutuhkan | Belum pernah mencoba | 0% | Belum tersedia |
| 1 | Pernah mendengar/membaca | Mengikuti tutorial | >0% dan <25% | Baru mengidentifikasi tools |
| 2 | Memahami konsep dasar | 1 project dengan panduan | ≥25% dan <50% | Sebagian tools tersedia |
| 3 | Mengerjakan dengan panduan | 1 project mandiri | ≥50% dan <75% | Semua tersedia, belum dikonfigurasi |
| 4 | Mengerjakan mandiri | 2–3 project mandiri | ≥75% dan <100% | Semua dikonfigurasi, belum diuji |
| 5 | Sangat menguasai, bisa mengajarkan | >3 project mandiri | ≥100% | Semua siap, diuji berjalan |

Kemampuan dinilai terhadap kebutuhan utama project yang ditulis. Tools mencakup perangkat, editor, runtime, dan alat relevan lain; tidak dibatasi merek. Waktu memakai perkiraan pengguna untuk keseluruhan project: tersedia 6 jam dari kebutuhan 8 jam = 75%, pilih 4. Tidak ada field hitung jam otomatis. “Latihan 1 hari” adalah batas pengerjaan aplikasi MVP, bukan batas durasi setiap project mahasiswa.

### Rumus versi 1

| Komponen | Bobot/poin maksimal |
| --- | --- |
| Kemampuan (K) | 50 |
| Pengalaman (P) | 20 |
| Waktu tersedia (W) | 20 |
| Kesiapan tools (T) | 10 |

```text
kontribusi = nilai / 5 × bobot
skor = Math.round(K / 5 × 50 + P / 5 × 20 + W / 5 × 20 + T / 5 × 10)
```

Domain keempat nilai adalah integer 0–5; skor berada pada 0–100. Dengan bobot ini kontribusinya selalu integer. Kategori ditetapkan dari skor yang sama dengan yang ditampilkan: 0–59 Belum siap, 60–79 Cukup siap, 80–100 Siap. Tidak ada bonus tambahan atau gerbang kategori tersembunyi. Skor agregat bisa tinggi walaupun satu indikator rendah; jawaban, saran, dan batasan metode tetap ditampilkan.

Contoh: K=4, P=3, W=5, T=4 menghasilkan 40+12+20+8=80 → Siap.

### Rekomendasi perbaikan

Setiap indikator bernilai <4 mendapat satu saran:

| Indikator | Saran |
| --- | --- |
| Kemampuan | Perkuat kemampuan inti melalui latihan kecil terkait fitur project. |
| Pengalaman | Selesaikan satu mini project serupa dan catat kendala serta solusinya. |
| Waktu | Kurangi lingkup fitur atau tambah alokasi waktu. |
| Tools | Lengkapi, konfigurasi, dan uji satu alur kerja sederhana. |

Urutkan berdasarkan kehilangan poin `(5 − nilai) / 5 × bobot`, terbesar dahulu. Jika sama, urutan tetap kemampuan, pengalaman, waktu, tools. Semua saran yang relevan ditampilkan. Jika seluruh nilai ≥4, sarankan memulai fitur inti, milestone kecil, dan evaluasi berkala. Nama, deskripsi, kategori project, dan gambar tidak mengubah skor ataupun rekomendasi.

## 6. Data model

### Record penilaian

| Field | Tipe dan validasi |
| --- | --- |
| id | string unik; crypto.randomUUID jika tersedia, fallback timestamp + random |
| namaProject | string trim, panjang 1–100 |
| deskripsi | string trim, panjang 1–500 |
| kategoriProject | enum kategori project; wajib pada penilaian baru. Riwayat lama tanpa field dibaca sebagai `Belum ditentukan`. |
| gambar | string data URL JPEG tervalidasi <650.000 karakter, atau string kosong. Data PNG/JPG/WebP dari upload dikonversi sebelum simpan. |
| namaGambar | string nama file untuk informasi UI, atau kosong. |
| kemampuan | integer 0–5 |
| pengalaman | integer 0–5 |
| waktuTersedia | integer 0–5 |
| kesiapanTools | integer 0–5 |
| skor | integer 0–100, diturunkan dari empat indikator |
| kategoriKesiapan | enum `Belum siap`, `Cukup siap`, `Siap`, diturunkan dari skor |
| rekomendasi | string[], diturunkan dari indikator |
| tanggalPenilaian | string tanggal ISO 8601 saat disimpan, ditampilkan mengikuti zona waktu perangkat |

Penyimpanan: key `crasDex.penilaian.v1`, value JSON array record. Input/label metode adalah konfigurasi kode, bukan data yang dapat diedit pengguna. Tidak ada data awal contoh. Data tersimpan adalah snapshot terpisah dari draft.

Saat load: tangkap error JSON/akses, pastikan array, validasi field sumber serta tanggal, saring record invalid dan id duplikat, hitung ulang skor/kategori/rekomendasi dengan rumus v1. Jangan menimpa data lama otomatis ketika pembacaan gagal. Tampilkan pemberitahuan; penggantian data bermasalah saat aksi simpan/hapus memerlukan konfirmasi. Jika write gagal, pertahankan riwayat sebelumnya dan tampilkan pesan, tanpa klaim berhasil. Perubahan rumus masa depan memerlukan key versi/migrasi baru.

## 7. Nonfunctional requirements

- Arsitektur client-only; implementasi akhir Vite + JavaScript vanilla, tanpa backend, API key, layanan AI, atau login palsu.
- Prototype satu file: CSS/JS dan ilustrasi SVG buatan sendiri inline; tidak ada font, library, atau aset eksternal.
- Tema abu-abu gelap (graphite): latar #18191b, panel #242629, teks terang dan aksen netral.
- UI responsif, target lebar 360–1440 px; kolom bertumpuk di ponsel, tabel detail bisa membungkus teks; tidak ada konten penting yang bergantung pada hover.
- Label input eksplisit, navigasi keyboard, focus indicator, tombol dengan nama aksesibel, dialog native dengan Escape, status simpan melalui live region. Warna kategori didampingi teks.
- Perhitungan segera tanpa request jaringan; tidak ada simulasi loading palsu. Hormati prefers-reduced-motion.
- Gunakan textContent/DOM APIs untuk teks pengguna dan encodeURIComponent untuk pesan WhatsApp. Tidak ada eval atau penyisipan HTML dari input.
- Tidak menyimpan data pribadi yang diminta sistem. Nama project/deskripsi sebaiknya tidak mengandung rahasia atau data sensitif. localStorage tidak terenkripsi.
- Operasi inti berjalan offline setelah file dimuat; WhatsApp memerlukan internet/aplikasi yang sesuai. Membuka WhatsApp hanya melalui klik pengguna.
- Uji manual pada browser modern berbasis Chromium; dukungan Firefox/Safari perlu verifikasi sebelum produksi. Perilaku file:// bergantung browser; origin server lokal lebih konsisten.

## 8. Risiko dan mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Penilaian diri bias dan bobot belum tervalidasi | Jelaskan rumus, tampilkan jawaban serta disclaimer refleksi, hindari klaim ilmiah/kelulusan. |
| Salah estimasi waktu | Jelaskan rasio jam tersedia terhadap kebutuhan dan contoh 6/8 jam. |
| Data hilang saat storage dibersihkan atau perangkat berganti | Label penyimpanan lokal, hindari klaim sinkronisasi/cadangan. |
| Storage rusak, penuh, atau diblokir | Tangkap kegagalan, beri pesan jelas, jangan ubah state seolah berhasil; preview/share tetap berfungsi. |
| Perubahan rumus mengubah arti riwayat | Tetapkan metode v1 dan gunakan migrasi/key baru bila rumus berubah. |
| Teks berbahaya dari nama/deskripsi | Render sebagai teks; jangan menjalankan atau menginterpretasikan HTML pengguna. |
| Satu perangkat dipakai beberapa orang | Jelaskan riwayat terlihat pada semua pemakai browser/origin yang sama; sediakan hapus per record. |
| Dua tab menulis bersamaan | MVP mengasumsikan satu tab aktif; penulisan terakhir dapat menimpa perubahan tab lain. Sinkronisasi lintas tab ditunda. |
| WhatsApp diblokir browser/tidak tersedia | Gunakan aksi klik langsung dan tab baru; keberhasilan pengiriman tidak diklaim aplikasi. |

## 9. Out of scope

Katalog/daftar project contoh, pengelola/admin, CRUD master project, autentikasi, database server, multiuser, sinkronisasi cloud, AI/analisis deskripsi, sertifikasi kompetensi, penilaian dosen, bonus lama coding versi CLI, penilaian skill khusus per bidang, roadmap belajar mingguan, grafik perkembangan, ekspor/impor, fitur edit riwayat, hapus massal, pengiriman WhatsApp otomatis, serta deployment publik.

## 10. Acceptance criteria manual

Jalankan pengujian dengan penyimpanan origin kosong agar tidak menghapus data pengguna. Tidak perlu mengirim pesan WhatsApp sungguhan.

| ID | Langkah uji | Hasil yang diharapkan |
| --- | --- | --- |
| AC01 | Buka aplikasi pertama kali | Form kosong; riwayat 0; tidak ada katalog/project contoh/login. |
| AC02 | Klik Simpan tanpa nama/deskripsi atau dengan teks hanya spasi | Ditolak; tidak menambah riwayat; fokus/pesan validasi tersedia. |
| AC03 | Isi nama/deskripsi, pilih 3 indikator | Progress 3/4, skor “—”, kategori Belum dinilai; simpan/share belum menghasilkan record/pesan. |
| AC04 | Isi keempat indikator dengan nilai 0 | Skor 0, Belum siap; empat rekomendasi; nilai 0 tidak dianggap input kosong. |
| AC05 | Set K=3, P=3, W=3, T=2 | Skor 58 (30+12+12+4), Belum siap. |
| AC06 | Ubah T pada AC05 menjadi 3 | Skor otomatis 60, Cukup siap, tanpa reload/klik hitung. |
| AC07 | Set K=4, P=3, W=5, T=3 | Skor 78, Cukup siap. |
| AC08 | Ubah T pada AC07 menjadi 4 | Skor 80, Siap; kontribusi 40/50, 12/20, 20/20, 8/10. |
| AC09 | Semua indikator 5 | Skor 100, Siap; satu saran milestone/evaluasi. |
| AC10 | Buka “Bagaimana skor dihitung?” | Bobot 50/20/20/10, formula, batas kategori, contoh 60, dan definisi waktu sesuai spesifikasi. Tutup dengan tombol atau Escape. |
| AC11 | K=0, P=0, W=0, T=0 | Saran kemampuan pertama, pengalaman kedua, waktu ketiga, tools keempat; prioritas kehilangan poin dengan tie stabil. |
| AC12 | Isi data sah dan simpan | Tepat satu record ber-id/tanggal muncul; pesan berhasil dan jumlah riwayat bertambah. Klik simpan ulang tanpa perubahan pada sesi sama tidak menduplikasi. |
| AC13 | Buka detail, lalu ubah form tanpa simpan | Detail record lama tetap memakai jawaban/skor saat disimpan. |
| AC14 | Reload, buka riwayat | Riwayat dan rincian tetap ada; draft form kembali kosong. |
| AC15 | Simpan dua penilaian berbeda | Keduanya tampil, terbaru di atas; masing-masing detail tepat. |
| AC16 | Hapus record, pilih Batal; ulangi pilih konfirmasi | Batal mempertahankan record; konfirmasi menghapus hanya target; reload tetap terhapus. |
| AC17 | Hapus record terakhir | Empty state riwayat dengan tombol kembali menilai. |
| AC18 | Klik Bagikan dari preview lengkap atau detail; isi nomor sah lalu Buka WhatsApp | Dialog nomor muncul; tab WhatsApp ditujukan ke nomor ternormalisasi dengan teks nama, kategori project, deskripsi, empat nilai, skor, kategori kesiapan, rekomendasi, disclaimer. Karakter khusus ter-encode. Gambar tidak dilampirkan; tidak otomatis mengirim. |
| AC19 | Klik Mulai ulang, batalkan lalu konfirmasi | Batal mempertahankan draft; konfirmasi mengosongkan form dan preview, riwayat tetap. |
| AC20 | Uji lebar 360 dan 1440 px serta Tab/Shift+Tab | Form, preview, riwayat, dialog dapat digunakan tanpa konten terpotong atau overflow horizontal. |
| AC21 | Simpan nama berisi `<img src=x onerror=alert(1)>` | Tampil sebagai teks di riwayat/detail; tidak ada kode dijalankan. |
| AC22 | Pada origin uji, ubah value storage menjadi JSON invalid lalu reload | Peringatan tampil; aplikasi tetap berfungsi, data lama tidak ditimpa otomatis; konfirmasi sebelum write berikutnya. |
| AC23 | Blokir storage/penuhi kuota di lingkungan uji, lalu simpan | Peringatan gagal; tidak muncul klaim berhasil; riwayat lama tidak berubah; preview masih dapat digunakan. |
| AC24 | Putus koneksi setelah aplikasi termuat | Form, perhitungan, simpan dan riwayat lokal tetap berfungsi; share tetap memerlukan koneksi WhatsApp. |

| AC25 | Buka form dan pilih kategori Data Science / Web Development / Machine Learning | Daftar bidang tampil, simpan ditolak jika kategori kosong. Kategori terpilih tercantum pada preview, riwayat, detail dan teks WhatsApp. |
| AC26 | Pilih gambar PNG/JPG/WebP sah, isi penilaian, simpan dan reload | Preview muncul; gambar terkompresi tersimpan dan terlihat pada thumbnail serta detail riwayat. |
| AC27 | Pilih file >5 MB, bukan gambar, atau gambar rusak | Pesan penolakan tampil; gambar valid sebelumnya tetap dipakai; Simpan kembali bisa digunakan. |
| AC28 | Klik Hapus gambar / Mulai ulang | Gambar draft hilang; snapshot riwayat lama tetap utuh. |
| AC29 | Buka berbagi, isi `081234567890`, `+62 812-3456-7890`, lalu input huruf/kosong | Dua input sah dinormalisasi ke `6281234567890`; input huruf/kosong ditolak. Nomor tidak ditulis ke localStorage. |
| AC30 | Buka versi baru pada origin berisi riwayat versi sebelumnya | Record lama tetap terbaca dengan kategori Belum ditentukan dan tanpa gambar; skor tetap. |
| AC31 | Periksa halaman form, riwayat, detail, pilihan kategori dan dialog WhatsApp | Semua memakai tema abu-abu gelap dengan teks dan fokus tetap terbaca. |

Skor integer ganjil tidak terjangkau dengan bobot dan skala v1 (semua kontribusi kelipatan 2); oleh karena itu pengujian UI memakai 58/60 dan 78/80 untuk dua sisi batas. Fungsi kategori tetap didefinisikan pada rentang penuh 0–100.

## 11. Implementation plan per iterasi (8 jam)

| Iterasi | Durasi | Pekerjaan | Exit criteria |
| --- | --- | --- | --- |
| 1 — Fondasi dan form | 1,5 jam | Tinjau sumber Python, tetapkan adaptasi, siapkan Vite vanilla, struktur UI responsif, metadata dan pilihan indikator. | AC01–AC03 lulus; label dan domain input jelas. |
| 2 — Mesin penilaian | 2 jam | Fungsi murni skor/kategori/rekomendasi, preview, breakdown, dialog metode. | AC04–AC11 lulus, satu sumber formula dipakai semua tampilan. |
| 3 — Riwayat lokal | 2 jam | Snapshot, validasi data, persist, detail, hapus, empty state, penanganan error. | AC12–AC17, AC21–AC23 lulus. |
| 4 — Bagikan dan verifikasi | 2,5 jam | WhatsApp, reset, QA responsif/keyboard/offline, penyempurnaan visual, dokumentasi. | AC18–AC20 dan AC24 lulus, batasan yang belum diuji dicatat. |

Struktur Vite lanjutan yang disarankan: `index.html`, `src/main.js` (event/orchestration), `src/penilaian.js` (konfigurasi + rumus), `src/storage.js`, `src/ui.js`, `src/style.css`. Prototype single HTML adalah baseline perilaku yang dipisah ke modul, bukan tambahan fitur.

## 12. Catatan verifikasi prototype

- Sintaks JavaScript diperiksa dengan `node --check`.
- Seluruh 1.296 kombinasi empat indikator 0–5 diperiksa terhadap rumus dan kategori; lulus. Rekomendasi tersedia pada setiap kombinasi.
- Uji browser Chromium: kondisi awal kosong, skor 0/58/60/78/80/100 beserta kategorinya, simpan, pencegahan duplikasi pada form sama, detail snapshot, persistensi setelah reload, dan pembatalan hapus terverifikasi.
- Tampilan desktop diperiksa secara visual. Pengujian penuh ponsel, penghapusan terkonfirmasi, error/kuota storage, offline, keyboard menyeluruh, dan alur WhatsApp eksternal belum diverifikasi di browser. Kriteria manual di atas tetap menjadi checklist sebelum penggunaan lebih luas.

## 13. Revisi tema dan metadata project

Tema diganti ke abu-abu gelap; kategori bidang, gambar project opsional, dan nomor WhatsApp tujuan yang dapat diisi setiap kali berbagi ditambahkan. Rumus v1 tidak berubah; key riwayat tetap untuk mempertahankan data lama. Normalisasi field baru dilakukan saat membaca tanpa menulis otomatis. Nomor tujuan bersifat sementara dan tidak masuk record penilaian.

Gambar memperbesar kebutuhan localStorage sehingga riwayat bergambar lebih cepat mencapai kuota browser; kompresi mengurangi ukuran dan kegagalan tulis tetap dilaporkan tanpa menambah record palsu. Menghapus gambar draft tidak menghapus gambar snapshot lama. Perlu implementasi penyimpanan lain jika kelak menampung banyak gambar.

Verifikasi revisi: sintaks JavaScript dan seluruh 1.296 kombinasi skor/kategori lulus; normalisasi nomor 08/+62, penolakan input nomor invalid, penerimaan record lama, penolakan data gambar SVG, serta penyertaan kategori pada teks share diperiksa. Di Chromium, tema gelap, upload PNG valid, kategori Data Science, simpan snapshot bergambar dan detail setelah reload, riwayat lama, serta penolakan nomor WhatsApp kosong terverifikasi. Pengiriman pesan tidak dilakukan; pengujian file terlalu besar/rusak dan kuota storage masih mengikuti checklist manual.
