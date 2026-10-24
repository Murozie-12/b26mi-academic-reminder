const admin = require("firebase-admin");

// Inisialisasi Firebase menggunakan kredensial rahasia GitHub Secrets
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const messaging = admin.messaging();

async function checkTaskDeadlines() {
  console.log("🤖 [Robot FCM Reminder] Memeriksa deadline tugas akademik...");
  const now = new Date();

  try {
    const tasksSnapshot = await db.collection("tasks").get();
    
    if (tasksSnapshot.empty) {
      console.log("Belum ada tugas yang tersimpan di database.");
      return;
    }

    // Ambil token perangkat mahasiswa yang tersimpan di Firestore (misal di koleksi 'fcm_tokens')
    const tokensSnapshot = await db.collection("fcm_tokens").get();
    const registrationTokens = [];
    tokensSnapshot.forEach(doc => {
      if (doc.data().token) {
        registrationTokens.push(doc.data().token);
      }
    });

    tasksSnapshot.forEach(async (docSnap) => {
      const task = docSnap.data();
      if (!task.dueAt) return;

      const dueDate = task.dueAt.toDate ? task.dueAt.toDate() : new Date(task.dueAt);
      const diffMs = dueDate - now;
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffHours / 24;

      console.log(`📌 Tugas: "${task.title}" | Sisa waktu: ${diffDays >= 1 ? diffDays.toFixed(1) + ' hari' : diffHours.toFixed(1) + ' jam'}`);

      let notificationTitle = "";
      let notificationBody = "";

      // Logika deteksi rentang waktu mendekati deadline (dengan toleransi kisaran 1 jam eksekusi cron)
      if (diffDays >= 2.9 && diffDays <= 3.1) {
        notificationTitle = "⚠️ Peringatan H-3 Deadline Tugas!";
        notificationBody = `Tugas "${task.title}" (${task.subject || 'Kuliah'}) akan deadline dalam 3 hari. Yuk mulai dicicil!`;
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

      // Jika ada pesan yang harus dikirim dan ada token mahasiswa terdaftar
      if (notificationTitle && registrationTokens.length > 0) {
        const message = {
          notification: {
            title: notificationTitle,
            body: notificationBody
          },
          tokens: registrationTokens
        };

        try {
          const response = await messaging.sendEachForMulticast(message);
          console.log(`✅ Notifikasi terkirim untuk tugas: "${task.title}" (${response.successCount} berhasil terkirim)`);
        } catch (err) {
          console.error("❌ Gagal mengirim FCM ke perangkat:", err);
        }
      }
    });

    console.log("✅ Pemeriksaan deadline selesai.");
  } catch (error) {
    console.error("❌ Terjadi kesalahan pada sistem pengecek:", error);
  }
}

checkTaskDeadlines();
