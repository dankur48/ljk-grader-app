import React, { createContext, useState, useContext, useEffect } from 'react';

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
    if (saved) return JSON.parse(saved);
    return []; // Kosong secara bawaan
  });

  const [students, setStudents] = useState(() => {
    const saved = localStorage.getItem('autograder_students');
    if (saved) return JSON.parse(saved);
    return []; // Kosong secara bawaan
  });

  const [mapelKeys, setMapelKeys] = useState(() => {
    const saved = localStorage.getItem('autograder_mapelKeys');
    if (saved) return JSON.parse(saved);
    return {}; // Kosong secara bawaan
  });

  // --- Save to LocalStorage whenever state changes ---
  useEffect(() => {
    if (user) {
      localStorage.setItem('autograder_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('autograder_user');
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('autograder_classes', JSON.stringify(classesList));
  }, [classesList]);

  useEffect(() => {
    localStorage.setItem('autograder_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('autograder_mapelKeys', JSON.stringify(mapelKeys));
  }, [mapelKeys]);

  // --- Actions ---
  const login = (email, password) => {
    setUser({ name: "Guru Jombang", email });
  };

  const logout = () => setUser(null);

  return (
    <AppContext.Provider value={{
      user, login, logout,
      classesList, setClassesList,
      students, setStudents,
      mapelKeys, setMapelKeys
    }}>
      {children}
    </AppContext.Provider>
  );
};
