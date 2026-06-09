import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDSInJ-WLOgr_7kskROooUAGHmdCtQ19OQ",
  authDomain: "autograder-sekolah.firebaseapp.com",
  projectId: "autograder-sekolah",
  storageBucket: "autograder-sekolah.firebasestorage.app",
  messagingSenderId: "670883689154",
  appId: "1:670883689154:web:8ce86606902486e9a2c15b",
  measurementId: "G-KPLFWNRSVB"
};

let db = null;

export const initFirebase = () => {
  try {
    let app;
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
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
