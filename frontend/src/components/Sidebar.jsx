import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, KeyRound, ScanLine, LogOut, School, ChevronLeft } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAppContext();

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`sidebar ${!isOpen ? 'closed' : ''}`}>
      <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', background: 'linear-gradient(to right, var(--primary-color), var(--secondary-color))', WebkitBackgroundClip: 'text', color: 'transparent' }}>AutoGrader</h2>
          <p className="user-email" style={{ margin: 0, marginTop: '4px' }}>{user?.email}</p>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
          title="Sembunyikan Navbar"
          className="hover:bg-slate-800"
        >
          <ChevronLeft size={24} />
        </button>
      </div>
      
      <nav className="sidebar-nav">
        <Link to="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        <Link to="/classes" className={`nav-item ${isActive('/classes') ? 'active' : ''}`}>
          <School size={20} />
          <span>Manajemen Kelas</span>
        </Link>
        <Link to="/students" className={`nav-item ${isActive('/students') ? 'active' : ''}`}>
          <Users size={20} />
          <span>Buku Nilai & Rapot</span>
        </Link>
        <Link to="/keys" className={`nav-item ${isActive('/keys') ? 'active' : ''}`}>
          <KeyRound size={20} />
          <span>Kunci Jawaban</span>
        </Link>
        <Link to="/grade" className={`nav-item ${isActive('/grade') ? 'active' : ''}`}>
          <ScanLine size={20} />
          <span>Korektor LJK</span>
        </Link>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item logout-btn" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );
}
