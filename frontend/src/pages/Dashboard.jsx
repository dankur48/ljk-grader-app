import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Users, FileText, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  const { user, students, mapelKeys } = useAppContext();

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Selamat datang kembali, {user?.name}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-icon" style={{ color: '#ec4899' }}><Users size={28} /></div>
          <div>
            <h3>Total Murid</h3>
            <p className="stat-value">{students.length}</p>
          </div>
        </div>
        
        <div className="stat-card glass-card">
          <div className="stat-icon" style={{ color: '#10b981' }}><FileText size={28} /></div>
          <div>
            <h3>Mapel Tersimpan</h3>
            <p className="stat-value">{Object.keys(mapelKeys).length}</p>
          </div>
        </div>
        
        <div className="stat-card glass-card">
          <div className="stat-icon" style={{ color: '#3b82f6' }}><CheckCircle size={28} /></div>
          <div>
            <h3>LJK Dikoreksi</h3>
            <p className="stat-value">0</p>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: '2rem' }}>
        <h2>Aktivitas Terbaru</h2>
        <p className="text-muted" style={{ marginTop: '1rem' }}>Belum ada aktivitas hari ini.</p>
      </div>
    </div>
  );
}
