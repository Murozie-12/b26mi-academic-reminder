const admin = require("firebase-admin");

// Inisialisasi Firebase menggunakan kredensial rahasia GitHub Secrets
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkTaskDeadlines() {
  console.log("🤖 [Robot Reminder] Memeriksa deadline tugas akademik...");
  const now = new Date();

  try {
    const tasksSnapshot = await db.collection("tasks").get();
    
    if (tasksSnapshot.empty) {
      console.log("Belum ada tugas yang tersimpan di database.");
      return;
    }

    tasksSnapshot.forEach((docSnap) => {
      const task = docSnap.data();
      if (!task.dueAt) return;

      const dueDate = task.dueAt.toDate ? task.dueAt.toDate() : new Date(task.dueAt);
      const diffMs = dueDate - now;
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffHours / 24;

      console.log(`📌 Tugas: "${task.title}" | Sisa waktu: ${diffDays >= 1 ? diffDays.toFixed(1) + ' hari' : diffHours.toFixed(1) + ' jam'}`);

      // Logika deteksi rentang waktu mendekati deadline (dengan toleransi kisaran 1 jam eksekusi cron)
      if (diffDays >= 2.9 && diffDays <= 3.1) {
        console.log(`🚨 [PERINGATAN H-3]: Tugas "${task.title}" akan deadline dalam 3 hari!`);
        // Di sini Anda bisa menghubungkan fungsi pengiriman notifikasi FCM/OneSignal jika token perangkat tersimpan
      } 
      else if (diffDays >= 0.9 && diffDays <= 1.1) {
        console.log(`🚨 [PERINGATAN H-1]: Tugas "${task.title}" akan deadline besok!`);
      } 
      else if (diffHours >= 5.8 && diffHours <= 6.2) {
        console.log(`🚨 [PERINGATAN 6 JAM]: Tugas "${task.title}" tinggal 6 jam lagi!`);
      } 
      else if (diffHours >= 0.9 && diffHours <= 1.1) {
        console.log(`🚨 [PERINGATAN 1 JAM]: Tugas "${task.title}" tinggal 1 jam lagi! Segera kumpulkan!`);
      }
    });

    console.log("✅ Pemeriksaan deadline selesai.");
  } catch (error) {
    console.error("❌ Gagal memeriksa deadline:", error);
  }
}

checkTaskDeadlines();
