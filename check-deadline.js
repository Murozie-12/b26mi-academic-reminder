const admin = require('firebase-admin');

// Inisialisasi Firebase Admin dengan rahasia dari GitHub Secrets
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const messaging = admin.messaging();

async function runRobot() {
  console.log("🤖 Mulai patroli: Mengecek tugas baru & deadline...");
  const now = new Date();

  try {
    // Ambil semua tugas dari database
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
        const diffDays = diffHours / 24;

        let notificationTitle = "";
        let notificationBody = "";

        if (diffDays >= 2.9 && diffDays <= 3.1) {
          notificationTitle = "⚠️ Peringatan H-3 Deadline Tugas!";
          notificationBody = `Tugas "${task.title}" akan deadline dalam 3 hari. Yuk mulai dicicil!`;
        } 
        else if (diffDays >= 0.9 && diffDays <= 1.1) {
          notificationTitle = "🚨 Peringatan H-1 Deadline Tugas!";
          notificationBody = `Besok adalah batas pengumpulan tugas "${task.title}"! Jangan sampai terlewat.`;
        } 
        else if (diffHours >= 5.8 && diffHours <= 6.2) {
          notificationTitle = "⏰ Kurang 6 Jam Menuju Deadline!";
          notificationBody = `Tugas "${task.title}" tinggal 6 jam lagi. Segera selesaikan dan kumpulkan!`;
        } 
        else if (diffHours >= 0.9 && diffHours <= 1.1) {
          notificationTitle = "🔥 DARURAT: 1 Jam Lagi Deadline!";
          notificationBody = `Waktu hampir habis untuk tugas "${task.title}"! Segera submit sekarang!`;
        }

        if (notificationTitle) {
          console.log(`Deadline [${task.title}] memenuhi kriteria. Memproses peringatan...`);
          await sendDeadlineNotification(taskId, task, notificationTitle, notificationBody);
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

// Mencari tahu siapa saja UID mahasiswa yang berhak mendapat tugas ini
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

// Mengambil token HP (alamat FCM) dari daftar UID mahasiswa
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

// Jalankan fungsi utama
runRobot();
