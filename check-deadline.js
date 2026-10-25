const admin = require('firebase-admin');

// Cek apakah Secret GitHub tersedia
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ ERROR FATAL: Variabel rahasia 'FIREBASE_SERVICE_ACCOUNT' tidak ditemukan di GitHub Secrets!");
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error("❌ Gagal memparsing JSON dari FIREBASE_SERVICE_ACCOUNT:", error.message);
  process.exit(1);
}

const db = admin.firestore();
const messaging = admin.messaging();

async function runRobot() {
  console.log("🤖 Mulai patroli: Mengecek tugas baru & deadline...");
  const now = new Date();

  try {
    // 1. Ambil semua tugas dari database
    const tasksSnapshot = await db.collection('tasks').get();
    
    for (const doc of tasksSnapshot.docs) {
      const task = doc.data();
      const taskId = doc.id;
      
      // ==========================================
      // MISI 1: CEK TUGAS BARU (YANG BELUM DIUMUMKAN)
      // ==========================================
      if (task.isNotified === false) {
        console.log(`Ada tugas baru: [${task.title}]. Mengirim notifikasi...`);
        await sendNewTaskNotification(task);
        // Tandai bahwa tugas ini sudah diumumkan agar tidak dikirim ganda
        await db.collection('tasks').doc(taskId).update({ isNotified: true });
      }

      // ==========================================
// MISI 2: CEK DEADLINE (H-3, H-1, 6 Jam, 1 Jam)
// ==========================================
if (task.dueAt) {
  const dueDate = task.dueAt.toDate ? task.dueAt.toDate() : new Date(task.dueAt);
  const diffMs = dueDate - now;
  const diffHours = diffMs / (1000 * 60 * 60);

  // Abaikan jika sudah lewat deadline
  if (diffHours > 0) {
    // Ambil rekam jejak notifikasi sebelumnya (jika belum ada, buat objek kosong)
    const notified = task.deadlineNotified || {};
    let updatedNotified = { ...notified };
    
    let notificationTitle = "";
    let notificationBody = "";
    let shouldNotify = false;

    // Cek dari yang paling darurat ke yang paling longgar
    if (diffHours <= 1 && !notified.h1_urgent) {
      notificationTitle = "🔥 DARURAT: 1 Jam Lagi Deadline!";
      notificationBody = `Waktu hampir habis untuk tugas "${task.title}"! Segera submit sekarang!`;
      updatedNotified.h1_urgent = true;
      updatedNotified.h6 = true; updatedNotified.d1 = true; updatedNotified.d3 = true; // Kunci fase sebelumnya agar tidak mundur
      shouldNotify = true;
    } 
    else if (diffHours <= 6 && diffHours > 1 && !notified.h6) {
      notificationTitle = "⏰ Kurang 6 Jam Menuju Deadline!";
      notificationBody = `Tugas "${task.title}" tinggal 6 jam lagi. Segera selesaikan dan kumpulkan!`;
      updatedNotified.h6 = true;
      updatedNotified.d1 = true; updatedNotified.d3 = true;
      shouldNotify = true;
    } 
    else if (diffHours <= 24 && diffHours > 6 && !notified.d1) {
      notificationTitle = "🚨 Peringatan H-1 Deadline Tugas!";
      notificationBody = `Besok adalah batas pengumpulan tugas "${task.title}"! Jangan sampai terlewat.`;
      updatedNotified.d1 = true;
      updatedNotified.d3 = true;
      shouldNotify = true;
    } 
    else if (diffHours <= 72 && diffHours > 24 && !notified.d3) {
      notificationTitle = "⚠️ Peringatan H-3 Deadline Tugas!";
      notificationBody = `Tugas "${task.title}" akan deadline dalam 3 hari. Yuk mulai dicicil!`;
      updatedNotified.d3 = true;
      shouldNotify = true;
    }

    if (shouldNotify) {
      console.log(`Memicu notifikasi deadline [${task.title}]: ${notificationTitle}`);
      await sendDeadlineNotification(taskId, task, notificationTitle, notificationBody);
      
      // Simpan status bahwa notifikasi fase ini sudah dikirim ke database
      await db.collection('tasks').doc(taskId).update({ deadlineNotified: updatedNotified });
    }
  }
}
      
    console.log("✅ Pengecekan selesai.");
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    process.exit(1);
  }
}

// FUNGSI A: Kirim Notifikasi Tugas Baru
async function sendNewTaskNotification(task) {
  try {
    const targetUsers = await getTargetUsers(task);
    if (targetUsers.length === 0) return;

    const tokens = await getTokensForUsers(targetUsers);
    if (tokens.length > 0) {
      const payload = {
        notification: {
          title: `📚 Tugas Baru: ${task.title}`,
          body: `Ada tugas baru yang ditambahkan oleh admin. Segera cek website untuk melihat detailnya!`,
        },
        tokens: tokens
      };
      const response = await messaging.sendEachForMulticast(payload);
      console.log(`Berhasil mengirim ${response.successCount} notifikasi TUGAS BARU.`);
    }
  } catch (error) {
    console.error("Gagal mengirim notif tugas baru:", error);
  }
}

// FUNGSI B: Kirim Notifikasi Peringatan Deadline (Abaikan yang sudah selesai & filter target)
async function sendDeadlineNotification(taskId, task, title, body) {
  try {
    const targetUsers = await getTargetUsers(task);
    if (targetUsers.length === 0) return;
    
    // Cari siapa saja yang SUDAH SELESAI
    const progressSnapshot = await db.collection('task_progress')
      .where('taskId', '==', taskId)
      .where('status', '==', 'selesai')
      .get();
    
    const completedUserIds = new Set();
    progressSnapshot.forEach(doc => completedUserIds.add(doc.data().userId));

    // FILTER: Hapus mahasiswa yang sudah selesai dari daftar penerima
    const usersToNotify = targetUsers.filter(uid => !completedUserIds.has(uid));

    if (usersToNotify.length === 0) {
      console.log(`Semua target mahasiswa sudah selesai mengerjakan [${task.title}]. Aman!`);
      return;
    }

    const tokens = await getTokensForUsers(usersToNotify);
    if (tokens.length > 0) {
      const payload = {
        notification: {
          title: title,
          body: body,
        },
        tokens: tokens
      };
      const response = await messaging.sendEachForMulticast(payload);
      console.log(`Berhasil mengirim ${response.successCount} notifikasi DEADLINE.`);
    }
  } catch (error) {
    console.error(`Gagal memproses notif deadline [${taskId}]:`, error);
  }
}

// --- FUNGSI BANTUAN (HELPER) ---

async function getTargetUsers(task) {
  let targetUsers = [];
  if (task.target === 'tertentu' || task.target === 'kelompok') {
    targetUsers = task.assignedTo || [];
  } else {
    const usersSnapshot = await db.collection('users').where('role', '==', 'mahasiswa').get();
    targetUsers = usersSnapshot.docs.map(doc => doc.id);
  }
  return targetUsers;
}

async function getTokensForUsers(userIdsArray) {
  const tokens = [];
  const tokensSnapshot = await db.collection('fcm_tokens').get();
  tokensSnapshot.forEach(doc => {
    const data = doc.data();
    if (userIdsArray.includes(data.uid) && data.token) {
      tokens.push(data.token);
    }
  });
  return tokens;
}

runRobot();
