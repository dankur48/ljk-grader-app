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
  const [firebaseConfig, setFirebaseConfig] = useState(() => localStorage.getItem('autograder_firebase_config') || '');
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isLoadingDb, setIsLoadingDb] = useState(true);

  // --- Connect to Firebase ---
  useEffect(() => {
    if (firebaseConfig) {
      const db = initFirebase(firebaseConfig);
      if (db) {
        setIsDbConnected(true);
        // Real-time listener
        const unsub = onSnapshot(doc(db, "autograder_db", "main_data"), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.classesList) setClassesList(data.classesList);
            if (data.students) setStudents(data.students);
            if (data.mapelKeys) setMapelKeys(data.mapelKeys);
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
    } else {
      setIsDbConnected(false);
      setIsLoadingDb(false);
    }
  }, [firebaseConfig]);

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

  const saveFirebaseConfig = (configStr) => {
    localStorage.setItem('autograder_firebase_config', configStr);
    setFirebaseConfig(configStr);
  };

  const disconnectFirebase = () => {
    localStorage.removeItem('autograder_firebase_config');
    setFirebaseConfig('');
    setIsDbConnected(false);
  };

  useEffect(() => {
    if (user) {
      localStorage.setItem('autograder_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('autograder_user');
    }
  }, [user]);

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
      isDbConnected, isLoadingDb, firebaseConfig, saveFirebaseConfig, disconnectFirebase
    }}>
      {children}
    </AppContext.Provider>
  );
};
