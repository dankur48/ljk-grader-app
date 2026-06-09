import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

let db = null;

export const initFirebase = (configStr) => {
  if (!configStr) return null;
  
  try {
    const config = typeof configStr === 'string' ? JSON.parse(configStr) : configStr;
    
    // Validasi konfigurasi dasar Firebase
    if (!config.apiKey || !config.projectId) {
      throw new Error("Konfigurasi Firebase tidak valid. Pastikan ada apiKey dan projectId.");
    }

    let app;
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApp(); // Gunakan app yang sudah ada jika React me-render ulang
    }
    
    db = getFirestore(app);
    return db;
  } catch (error) {
    console.error("Gagal menginisialisasi Firebase:", error);
    db = null;
    return null;
  }
};

export const getDb = () => db;
