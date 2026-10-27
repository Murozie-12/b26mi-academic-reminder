'use strict';
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('FIREBASE_SERVICE_ACCOUNT belum diatur pada GitHub Secrets.');
  process.exit(1);
}
try {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
} catch (error) {
  console.error('Firebase Admin gagal diinisialisasi:', error.message);
  process.exit(1);
}
const db = getFirestore();
const messaging = getMessaging();

function deadlinePhase(hours, notified) {
  if (hours <= 0 || !Number.isFinite(hours)) return null;
  if (hours <= 1 && !notified.h1_urgent) return { key: 'h1_urgent', title: '🔥 DARURAT: 1 Jam Lagi Deadline!', body: 'Waktu hampir habis', mark: ['h1_urgent', 'h6', 'd1', 'd3'] };
  if (hours <= 6 && hours > 1 && !notified.h6) return { key: 'h6', title: '⏰ Kurang 6 Jam Menuju Deadline!', body: 'Tinggal 6 jam', mark: ['h6', 'd1', 'd3'] };
  if (hours <= 24 && hours > 6 && !notified.d1) return { key: 'd1', title: '🚨 Peringatan H-1 Deadline Tugas!', body: 'Besok batas pengumpulan', mark: ['d1', 'd3'] };
  if (hours <= 72 && hours > 24 && !notified.d3) return { key: 'd3', title: '⚠️ Peringatan H-3 Deadline Tugas!', body: 'Deadline dalam 3 hari', mark: ['d3'] };
  return null;
}

async function getTargetUsers(task) {
  if (task.target === 'tertentu' || task.target === 'kelompok') {
    return [...new Set(Array.isArray(task.assignedTo) ? task.assignedTo.filter(x => typeof x === 'string') : [])];
  }
  const users = await db.collection('users').where('role', '==', 'mahasiswa').get();
  return users.docs.map(doc => doc.id);
}

async function getTokensForUsers(userIds) {
  const ids = new Set(userIds);
  if (!ids.size) return [];
  const snapshot = await db.collection('fcm_tokens').get();
  const tokens = new Set();
  snapshot.forEach(doc => {
    const data = doc.data();
    // Mendukung field uid lama maupun UID sebagai ID dokumen.
    if (ids.has(data.uid || doc.id) && typeof data.token === 'string' && data.token) tokens.add(data.token);
  });
  return [...tokens];
}

async function sendToUsers(userIds, title, body) {
  if (!userIds.length) return { success: 0, failure: 0, reason: 'no-target' };
  const tokens = await getTokensForUsers(userIds);
  if (!tokens.length) return { success: 0, failure: 0, reason: 'no-token' };
  let success = 0;
  let failure = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const response = await messaging.sendEachForMulticast({
      notification: { title, body },
      tokens: tokens.slice(i, i + 500)
    });
    success += response.successCount;
    failure += response.failureCount;
    response.responses.forEach((r, j) => {
      if (!r.success) console.warn('FCM gagal untuk token index', i + j, r.error?.code || 'unknown');
    });
  }
  console.log(`FCM: ${success} berhasil, ${failure} gagal`);
  return { success, failure, reason: 'sent' };
}

async function runRobot() {
  const now = Date.now();
  let errors = 0;
  console.log('Memulai pemeriksaan tugas dan deadline');
  // Query dibatasi untuk tugas yang belum kedaluwarsa atau belum ditandai.
  // Tetap mengambil semua tugas demi kompatibilitas skema lama; lihat README untuk optimasi lanjutan.
  const tasks = await db.collection('tasks').get();
  for (const doc of tasks.docs) {
    try {
      const task = doc.data();
      const title = String(task.title || 'Tugas akademik');
      let targetUsers;
      const targets = async () => (targetUsers ??= await getTargetUsers(task));

      if (task.isNotified === false) {
        const result = await sendToUsers(await targets(), `📚 Tugas Baru: ${title}`, 'Ada tugas baru yang ditambahkan oleh admin. Segera cek website untuk melihat detailnya!');
        // Hindari status terkirim palsu ketika seluruh pengiriman gagal.
        if (result.success > 0 || result.reason === 'no-target') {
          await doc.ref.update({ isNotified: true });
          if (result.failure) console.warn(`Tugas ${doc.id}: sebagian token gagal; tidak diulang agar penerima lain tidak menerima duplikat.`);
        } else console.warn(`Tugas ${doc.id}: belum ditandai karena ${result.reason}.`);
      }

      if (!task.dueAt) continue;
      const date = typeof task.dueAt.toDate === 'function' ? task.dueAt.toDate() : new Date(task.dueAt);
      const hours = (date.getTime() - now) / 3600000;
      const notified = task.deadlineNotified || {};
      const phase = deadlinePhase(hours, notified);
      if (!phase) continue;
      const completed = await db.collection('task_progress')
        .where('taskId', '==', doc.id).where('status', '==', 'selesai').get();
      const completedIds = new Set(completed.docs.map(d => d.data().userId));
      const remaining = (await targets()).filter(uid => !completedIds.has(uid));
      let result;
      if (remaining.length === 0) {
        result = { success: 0, failure: 0, reason: 'no-target' };
      } else {
        const bodies = {
          h1_urgent: `Waktu hampir habis untuk tugas "${title}"! Segera submit sekarang!`,
          h6: `Tugas "${title}" tinggal 6 jam lagi. Segera selesaikan dan kumpulkan!`,
          d1: `Besok adalah batas pengumpulan tugas "${title}"! Jangan sampai terlewat.`,
          d3: `Tugas "${title}" akan deadline dalam 3 hari. Yuk mulai dicicil!`
        };
        result = await sendToUsers(remaining, phase.title, bodies[phase.key]);
      }
      if (result.success > 0 || result.reason === 'no-target') {
        const next = { ...notified };
        for (const key of phase.mark) next[key] = true;
        await doc.ref.update({ deadlineNotified: next });
        if (result.failure) console.warn(`Deadline ${doc.id}: beberapa token gagal; fase ditandai agar tidak spam.`);
      } else console.warn(`Deadline ${doc.id}: belum ditandai karena ${result.reason}.`);
    } catch (error) {
      errors++;
      console.error(`Gagal memproses tugas ${doc.id}:`, error);
    }
  }
  console.log(`Selesai: ${tasks.size} tugas diperiksa, ${errors} kesalahan.`);
  if (errors) process.exitCode = 1;
}
runRobot().catch(error => { console.error('Robot gagal:', error); process.exitCode = 1; });
