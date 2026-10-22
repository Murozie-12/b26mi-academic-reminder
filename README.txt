B26MI — Academic Reminder (starter)

ISI PAKET
- index.html: starter UI dan integrasi Firebase Web SDK.
- firestore.rules: aturan keamanan awal (perlu ditinjau dan diuji sebelum digunakan kelas).

PENTING
1. File ini belum siap dipublikasikan ke kelas sebelum konfigurasi Firebase di index.html diisi.
2. Ganti GANTI_DENGAN_API_KEY, GANTI_DENGAN_STORAGE_BUCKET, dan GANTI_DENGAN_APP_ID dengan nilai dari:
   Firebase Console > Project settings (ikon gear) > General > Your apps > aplikasi web B26MI.
3. Di Firebase Authentication > Settings > Authorized domains, pastikan domain hosting nanti ditambahkan.
4. Aturan Firestore harus dipublikasikan dari tab Rules. Jangan gunakan aturan publik seperti allow read, write: if true.
5. Untuk akun pertama admin: login sebagai mahasiswa, lalu admin perlu membuat/mengubah dokumen users/{UID} dari Firebase Console menjadi role=admin. Jangan berikan kemampuan mengubah role kepada pengguna lewat UI.
6. Ketua kelompok dan tampilan progres kelompok belum diaktifkan di starter ini. Tambahkan aturan keanggotaan kelompok yang teruji sebelum mengaktifkannya.
7. Integrasi pengingat email/Telegram dan Google Calendar belum diimplementasikan; memerlukan konfigurasi layanan tambahan dan izin pengguna.
8. Web config Firebase bukan password server, tetapi tetap jangan membagikan akses console, token OAuth, service account key, atau kode verifikasi.
9. Biaya: paket gratis memiliki batas kuota dan beberapa layanan/integrasi mungkin memerlukan billing. Jangan upgrade paket tanpa memeriksa biaya.

CARA UJI AWAL
- Host file melalui hosting statis (misalnya GitHub Pages) atau server lokal.
- Isi konfigurasi Firebase.
- Terapkan firestore.rules.
- Pastikan Authentication > Google aktif.
- Login, lalu uji hanya dengan data non-sensitif.
