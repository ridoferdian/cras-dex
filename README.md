# Cras Dex

Aplikasi web refleksi kesiapan project berdasarkan `SPEC.md`. Versi ini mengembangkan prototipe `cras-dex.html` menjadi aplikasi multi-pengguna dengan Node.js, Express, JavaScript vanilla, dan MySQL 8+. Prototipe lama tetap tersedia sebagai referensi, **bukan** halaman aplikasi baru.

## Peran

| Peran | Akses |
| --- | --- |
| Admin | Melihat ringkasan penggunaan, menambah/mengubah status/menghapus kategori yang belum digunakan, mengubah empat indikator (label, pilihan 0–5, rekomendasi), mengatur bobot total 100, membuat/mengaktifkan/menonaktifkan akun (menghapus akun nonaktif tanpa riwayat/masukan), mengelola penugasan, melihat dan menghapus penilaian yang tidak diperlukan. |
| Dosen | Melihat ringkasan bimbingan, memfilter dan memantau riwayat mahasiswa yang ditugaskan, memeriksa detail indikator/skor, menambah/mengubah/menghapus masukan sendiri pada hasil mahasiswa. Tidak dapat mengubah skor. |
| Mahasiswa | Mengisi metadata dan empat indikator, melihat skor serta rekomendasi, mengunggah gambar, menyimpan/menghapus riwayat sendiri, membaca masukan dosen, berbagi via WhatsApp. |

Bobot awal: kemampuan 50, pengalaman 20, waktu 20, tools 10; setiap indikator 0–5. Admin boleh mengubah bobot dengan total wajib 100. Batas kategori tetap: `<60` Belum siap, `60–79` Cukup siap, `≥80` Siap. Server menghitung ulang skor saat menyimpan; input skor dari browser tidak dipercaya. Metode tiap penilaian baru disimpan sebagai snapshot sehingga perubahan bobot/label/saran tidak mengubah riwayat lama.

## Menyiapkan MySQL (Windows + Laragon)

1. Jalankan **Laragon**, klik **Start All** agar MySQL berjalan. MySQL command line Laragon pada mesin ini ada di `C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysql.exe`. Jika instalasi lain, gunakan `mysql` dari PATH.
2. Buka terminal dan masuk ke MySQL:

   ```powershell
   & "C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysql.exe" -u root -p
   ```

   Jika root Laragon belum diberi password, saat diminta tekan Enter. **Atur password root sebelum membuka database ke jaringan.**
3. Jalankan SQL berikut dalam prompt `mysql>` (ganti password contoh dengan password unik):

   ```sql
   CREATE DATABASE cras_dex CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'crasdex'@'localhost' IDENTIFIED BY 'password_kuat_unik';
   CREATE USER 'crasdex'@'127.0.0.1' IDENTIFIED BY 'password_kuat_unik';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES, ALTER
     ON cras_dex.* TO 'crasdex'@'localhost';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES, ALTER
     ON cras_dex.* TO 'crasdex'@'127.0.0.1';
   EXIT;
   ```

   Untuk deployment, sebaiknya gunakan **akun migrasi** terpisah dengan hak `CREATE/ALTER` dan akun aplikasi hanya `SELECT/INSERT/UPDATE/DELETE`.
4. Salin `.env.example` menjadi `.env`; isi `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`. `.env` tidak boleh dibagikan atau di-commit.
5. Jalankan perintah dari folder project:

   ```powershell
   npm.cmd install
   npm.cmd run db:migrate
   npm.cmd run admin:create -- "Admin Utama" admin@example.com "kata-sandi-panjang-unik"
   npm.cmd start
   ```

   Di PowerShell yang mengizinkan `npm`, `npm` dapat dipakai menggantikan `npm.cmd`. Buka **http://localhost:3000**. Login menggunakan admin tadi, buat akun dosen dan mahasiswa lewat dashboard admin, lalu atur penugasan.

   **Jika Anda sudah pernah menjalankan versi sebelumnya:** cukup jalankan `npm.cmd run db:migrate` sekali lagi lalu **restart server** (`Ctrl+C`, kemudian `npm.cmd start`). Jangan membuat admin baru lagi. Migrasi menambah tabel kategori, indikator, masukan dosen, dan kolom snapshot tanpa menghapus penilaian lama.

Untuk memeriksa data langsung di MySQL:

```sql
USE cras_dex;
SHOW TABLES;
SELECT id, name, email, role, active FROM users;
SELECT id, student_id, project_name, score, readiness, created_at FROM assessments ORDER BY created_at DESC LIMIT 20;
```

Perubahan data sebaiknya dilakukan lewat aplikasi agar validasi tetap berlaku. Cadangkan database dengan `mysqldump` dan pulihkan menggunakan `mysql` sebelum upgrade/deployment.

## Penggunaan

- Mahasiswa memilih kategori, mengisi nama/deskripsi dan 4 indikator. Gambar opsional dikompresi di browser sebelum disimpan. Skor dan rekomendasi muncul langsung. Klik **Simpan penilaian** untuk membuat snapshot baru. Halaman awal menampilkan jumlah, rata-rata, dan jumlah hasil kategori Siap.
- Dosen masuk dengan akun dari admin, memilih filter mahasiswa bimbingan, membuka detail indikator, lalu mengirim masukan. Masukan bisa diperbarui/dihapus oleh dosen penulis dan terbaca mahasiswa pemilik.
- Admin melihat ringkasan pemakaian dan jumlah akun aktif, mengatur kategori/metode penilaian, membuat akun/penugasan, dan bisa menghapus penilaian setelah konfirmasi. Kategori yang sudah dipakai tidak dapat dihapus/diubah namanya; cukup nonaktifkan untuk form baru agar riwayat lama tetap benar. Akun yang dinonaktifkan kehilangan akses/sesi; data penilaian tetap ada.
- Semua pengguna dapat mengganti kata sandinya. Kata sandi minimal 12 karakter. Nomor WhatsApp hanya digunakan saat berbagi, tidak disimpan.
- Tidak ada pendaftaran publik. Penilaian prototipe lama di `localStorage` **tidak dipindahkan otomatis** ke database; jika perlu migrasi, lakukan setelah menentukan pemilik tiap record dengan benar.

## Operasional dan batasan

- Pakai Node.js 20+ dan MySQL 8+. `npm.cmd test` menjalankan uji rumus. Untuk uji alur tiga peran menggunakan database aktif, jalankan `$env:CRAS_DEX_INTEGRATION='1'; npm.cmd test` (PowerShell); pengujian ini membuat lalu membersihkan akun dan data uji sementara. Saat pengembangan, gunakan `npm.cmd run dev`.
- Produksi harus berada di balik **HTTPS** dengan `NODE_ENV=production`, reverse proxy yang mengirim host asli, MySQL tidak diekspos publik, backup terjadwal, pemantauan log, dan kebijakan retensi data institusi. Cookie sesi akan memakai flag Secure dalam mode produksi.
- Sesi disimpan di tabel `sessions` selama 7 hari; jadwalkan pembersihan berkala: `DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP(3);`.
- Daftar API dibatasi 500 penilaian/pengguna per permintaan dan 500 akun admin; pagination, audit log administratif, reset kata sandi, verifikasi email, dan pemulihan data belum tersedia. Jangan anggap sistem ini siap untuk institusi besar tanpa pekerjaan tambahan tersebut.
- Gambar tersimpan sebagai JPEG base64 di MySQL. Pastikan backup dan kuota penyimpanan memadai. Unggah dibatasi 5 MB, 20 megapiksel, dan hasil kompresi <650.000 karakter.
- Perhitungan adalah refleksi diri, bukan penilaian akademik otomatis. Dosen tidak dapat mengubah skor mahasiswa.
