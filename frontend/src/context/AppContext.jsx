import React, { createContext, useState, useContext, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { initFirebase, getDb } from "../firebase";

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  // --- Initialize state from LocalStorage ---
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('autograder_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [classesList, setClassesList] = useState(() => {
    const saved = localStorage.getItem('autograder_classes');
    return saved ? JSON.parse(saved) : [];
  });

  const [students, setStudents] = useState(() => {
    const saved = localStorage.getItem('autograder_students');
    return saved ? JSON.parse(saved) : [];
  });

  const [mapelKeys, setMapelKeys] = useState(() => {
    const saved = localStorage.getItem('autograder_mapelKeys');
    return saved ? JSON.parse(saved) : {};
  });

  // --- Firebase States ---
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isLoadingDb, setIsLoadingDb] = useState(true);

  // --- Connect to Firebase ---
  useEffect(() => {
    const db = initFirebase();
    if (db) {
      setIsDbConnected(true);
      // Real-time listener
      const unsub = onSnapshot(doc(db, "autograder_db", "main_data"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.classesList) setClassesList(data.classesList);
          if (data.students) setStudents(data.students);
          if (data.mapelKeys) setMapelKeys(data.mapelKeys);
        } else {
          // Jika DB di awan masih kosong (baru pertama kali konek), 
          // dorong (push) data lokal yang ada saat ini ke awan!
          const localClasses = JSON.parse(localStorage.getItem('autograder_classes') || '[]');
          const localStudents = JSON.parse(localStorage.getItem('autograder_students') || '[]');
          const localMapel = JSON.parse(localStorage.getItem('autograder_mapelKeys') || '{}');
          
          setDoc(doc(db, "autograder_db", "main_data"), {
            classesList: localClasses,
            students: localStudents,
            mapelKeys: localMapel
          }).catch(console.error);
        }
        setIsLoadingDb(false);
      }, (err) => {
        console.error("Firestore Error:", err);
        setIsDbConnected(false);
        setIsLoadingDb(false);
      });
      return () => unsub();
    } else {
      setIsDbConnected(false);
      setIsLoadingDb(false);
    }
  }, []);

  // --- Update Handlers ---
  const updateClassesList = (newValOrFn) => {
    setClassesList(prev => {
      const nextVal = typeof newValOrFn === 'function' ? newValOrFn(prev) : newValOrFn;
      if (isDbConnected) {
        setDoc(doc(getDb(), "autograder_db", "main_data"), { classesList: nextVal }, { merge: true }).catch(console.error);
      } else {
        localStorage.setItem('autograder_classes', JSON.stringify(nextVal));
      }
      return nextVal;
    });
  };

  const updateStudents = (newValOrFn) => {
    setStudents(prev => {
      const nextVal = typeof newValOrFn === 'function' ? newValOrFn(prev) : newValOrFn;
      if (isDbConnected) {
        setDoc(doc(getDb(), "autograder_db", "main_data"), { students: nextVal }, { merge: true }).catch(console.error);
      } else {
        localStorage.setItem('autograder_students', JSON.stringify(nextVal));
      }
      return nextVal;
    });
  };

  const updateMapelKeys = (newValOrFn) => {
    setMapelKeys(prev => {
      const nextVal = typeof newValOrFn === 'function' ? newValOrFn(prev) : newValOrFn;
      if (isDbConnected) {
        setDoc(doc(getDb(), "autograder_db", "main_data"), { mapelKeys: nextVal }, { merge: true }).catch(console.error);
      } else {
        localStorage.setItem('autograder_mapelKeys', JSON.stringify(nextVal));
      }
      return nextVal;
    });
  };

  useEffect(() => {
    if (user) {
      localStorage.setItem('autograder_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('autograder_user');
    }
  }, [user]);

  // --- Cross-tab Synchronization (Fallback for LocalStorage) ---
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!isDbConnected) {
        if (e.key === 'autograder_classes' && e.newValue) setClassesList(JSON.parse(e.newValue));
        if (e.key === 'autograder_students' && e.newValue) setStudents(JSON.parse(e.newValue));
        if (e.key === 'autograder_mapelKeys' && e.newValue) setMapelKeys(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isDbConnected]);

  // --- Actions ---
  const login = (email, password) => {
    setUser({ name: "Guru Jombang", email });
  };

  const logout = () => setUser(null);

  return (
    <AppContext.Provider value={{
      user, login, logout,
      classesList, setClassesList: updateClassesList,
      students, setStudents: updateStudents,
      mapelKeys, setMapelKeys: updateMapelKeys,
      isDbConnected, isLoadingDb
    }}>
      {children}
    </AppContext.Provider>
  );
};
