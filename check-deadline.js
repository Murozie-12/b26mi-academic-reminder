const admin = require("firebase-admin");

// Inisialisasi Firebase menggunakan kredensial rahasia GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkTaskDeadlines() {
  console.log("Memeriksa deadline tugas...");
  const now = new Date();

  try {
    const tasksSnapshot = await db.collection("tasks").get();
    
    tasksSnapshot.forEach(async (docSnap) => {
      const task = docSnap.data();
      if (!task.dueAt) return;

      const dueDate = task.dueAt.toDate ? task.dueAt.toDate() : new Date(task.dueAt);
      const diffMs = dueDate - now;
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffHours / 24;

      // Logika pengecekan H-3 (sekitar 72 jam), H-1 (24 jam), 6 jam, dan 1 jam
      // Kita beri rentang waktu toleransi (misal selisih 1 jam dari waktu eksekusi cron)
      console.log(`Tugas: ${task.title}, Sisa waktu: ${diffHours.toFixed(1)} jam`);

      // Contoh pemicu notifikasi FCM bisa ditambahkan di sini
      if (diffDays >= 2.9 && diffDays <= 3.1) {
        console.log(`-> Memicu pengingat H-3 untuk tugas: ${task.title}`);
        // Kirim notifikasi FCM H-3
      } else if (diffDays >= 0.9 && diffDays <= 1.1) {
        console.log(`-> Memicu pengingat H-1 untuk tugas: ${task.title}`);
        // Kirim notifikasi FCM H-1
      } else if (diffHours >= 5.8 && diffHours <= 6.2) {
        console.log(`-> Memicu pengingat 6 jam untuk tugas: ${task.title}`);
        // Kirim notifikasi FCM 6 jam
      } else if (diffHours >= 0.9 && diffHours <= 1.1) {
        console.log(`-> Memicu pengingat 1 jam untuk tugas: ${task.title}`);
        // Kirim notifikasi FCM 1 jam
      }
    });

    console.log("Pemeriksaan deadline selesai.");
  } catch (error) {
    console.error("Gagal memeriksa deadline:", error);
  }
}

checkTaskDeadlines();
