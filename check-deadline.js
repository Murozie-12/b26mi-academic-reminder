'use strict';
// B26MI V5.6 — GitHub Actions background FCM robot.
// Admin SDK bypasses Firestore Rules. Protect FIREBASE_SERVICE_ACCOUNT.
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('GitHub secret FIREBASE_SERVICE_ACCOUNT belum disetel');
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const messaging = getMessaging();
const PHASES = [
  { key: 'h1_urgent', max: 1, title: '🔥 Deadline tinggal 1 jam' },
  { key: 'h6', max: 6, title: '⏰ Deadline tinggal 6 jam' },
  { key: 'd1', max: 24, title: '📚 Deadline dalam 24 jam' },
  { key: 'd3', max: 72, title: '📅 Deadline dalam 3 hari' }
];
const validDate = value => {
  const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

async function run() {
  const now = Date.now();
  // Cache per eksekusi: hindari mengambil semua user/token berulang kali untuk setiap tugas.
  const [usersSnap, tokensSnap, tasksSnap] = await Promise.all([
    db.collection('users').get(), db.collection('fcm_tokens').get(), db.collection('tasks').get()
  ]);
  const approved = new Set(usersSnap.docs.filter(d => d.data().role === 'mahasiswa' && d.data().membershipStatus === 'approved').map(d => d.id));
  const tokensByUid = new Map();
  for (const doc of tokensSnap.docs) {
    const t = doc.data().token;
    if (approved.has(doc.id) && typeof t === 'string' && t.length > 0) tokensByUid.set(doc.id, t);
  }
  let sent = 0, failures = 0, skipped = 0;
  for (const doc of tasksSnap.docs) {
    const task = doc.data();
    const due = validDate(task.dueAt);
    const hours = due ? (due.getTime() - now) / 3600000 : Infinity;
    const phase = PHASES.find(p => hours > 0 && hours <= p.max && !(task.deadlineNotified || {})[p.key]);
    const newTask = task.isNotified === false;
    if (!newTask && !phase) continue;
    const target = (task.target === 'tertentu' || task.target === 'kelompok')
      ? new Set(Array.isArray(task.assignedTo) ? task.assignedTo : []) : approved;
    const recipients = [...target].filter(uid => approved.has(uid) && tokensByUid.has(uid));
    // Note: only members with a saved FCM token can receive background pushes.
    // Check progress for deadline phase; new task notifications still go to all assigned users.
    let completed = new Set();
    if (phase) {
      const snap = await db.collection('task_progress').where('taskId', '==', doc.id).where('status', '==', 'selesai').get();
      completed = new Set(snap.docs.map(d => d.data().userId));
    }
    const send = async (uids, title, body) => {
      let ok = 0, bad = 0;
      for (let i = 0; i < uids.length; i += 500) {
        const batch = uids.slice(i, i + 500);
        const response = await messaging.sendEachForMulticast({
          tokens: batch.map(uid => tokensByUid.get(uid)), notification: { title, body },
          webpush: { fcmOptions: { link: process.env.APP_URL || 'https://b26mi-academic-reminder.web.app/' } }
        });
        response.responses.forEach((r, idx) => {
          if (r.success) ok++;
          else {
            bad++;
            console.warn('Gagal mengirim:', batch[idx], r.error?.code || 'unknown');
            if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code)) {
              // Token kadaluarsa akan diperbarui saat user mengaktifkan ulang notifikasi.
              console.warn('Token tidak valid; pengguna perlu mengaktifkan ulang notifikasi.');
            }
          }
        });
      }
      sent += ok; failures += bad;
      return { ok, bad };
    };
    try {
      if (newTask) {
        if (recipients.length) {
          const r = await send(recipients, `📚 Tugas baru: ${String(task.title || 'Tugas').slice(0, 90)}`, 'Ada tugas baru dari admin. Buka B26MI untuk detail.');
          // Prevent duplicate blasts; partial failures logged for manual follow-up.
          if (r.ok) await doc.ref.update({ isNotified: true });
        } else { skipped++; }
      }
      if (phase) {
        const remaining = recipients.filter(uid => !completed.has(uid));
        if (remaining.length) {
          const r = await send(remaining, phase.title, `${String(task.title || 'Tugas').slice(0, 110)} — segera cek B26MI.`);
          if (r.ok) {
            const phaseIndex = PHASES.findIndex(p => p.key === phase.key);
            const marks = {};
            for (const p of PHASES.slice(phaseIndex)) marks[`deadlineNotified.${p.key}`] = true;
            await doc.ref.update(marks);
          }
        } else if ([...target].filter(uid => approved.has(uid)).every(uid => completed.has(uid))) {
          // Everyone in the target group completed; mark this phase as done.
          const phaseIndex = PHASES.findIndex(p => p.key === phase.key);
          const marks = {};
          for (const p of PHASES.slice(phaseIndex)) marks[`deadlineNotified.${p.key}`] = true;
          await doc.ref.update(marks);
        } else { skipped++; }
      }
    } catch (e) { failures++; console.error('Task', doc.id, e); }
  }
  console.log(JSON.stringify({ tasks: tasksSnap.size, approvedMembers: approved.size, tokens: tokensByUid.size, sent, failures, skipped }));
  if (failures) process.exitCode = 1;
}
run().catch(e => { console.error(e); process.exitCode = 1; });
