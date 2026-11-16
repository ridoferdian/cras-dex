import bcrypt from 'bcryptjs';
import { db } from './db.js';

const [,, name, email, password] = process.argv;
if (!name?.trim() || !email?.trim() || !password || password.length < 12) {
  console.error('Gunakan: npm run admin:create -- "Nama Admin" admin@example.com "password-minimal-12-karakter"');
  process.exit(1);
}
try {
  const hash = await bcrypt.hash(password, 12);
  await db.execute('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
    [name.trim(), email.trim().toLowerCase(), hash, 'admin']);
  console.log('Akun admin dibuat.');
} catch (error) {
  console.error('Gagal membuat admin:', error.code === 'ER_DUP_ENTRY' ? 'Email sudah digunakan.' : error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
