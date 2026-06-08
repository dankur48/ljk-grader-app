import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAppContext } from '../context/AppContext';
import { Menu } from 'lucide-react';

export default function Layout() {
  const { user } = useAppContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="layout-container">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <main className={`main-content ${!isSidebarOpen ? 'expanded' : ''}`}>
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            style={{ 
              position: 'fixed', top: '1rem', left: '1rem', zIndex: 50, 
              background: 'var(--primary-color)', color: 'white', 
              border: 'none', padding: '0.6rem', borderRadius: '8px', 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
            title="Tampilkan Navbar"
          >
            <Menu size={24} />
          </button>
        )}
        <Outlet />
      </main>
    </div>
  );
}
