import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Users, FileText, CheckCircle, Database, AlertCircle, Save } from 'lucide-react';

export default function Dashboard() {
  const { user, students, mapelKeys, isDbConnected, firebaseConfig, saveFirebaseConfig, disconnectFirebase } = useAppContext();
  const [configInput, setConfigInput] = useState('');
  
  const handleConnect = () => {
    try {
      // Validate JSON
      JSON.parse(configInput);
      saveFirebaseConfig(configInput);
      setConfigInput('');
    } catch(e) {
      alert("Konfigurasi tidak valid. Pastikan formatnya JSON yang benar dari Firebase.");
    }
  };

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
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={24} color={isDbConnected ? "var(--success)" : "var(--danger)"} /> 
          Pengaturan Cloud Database (Firebase)
        </h2>
        
        {isDbConnected ? (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: '8px' }}>
            <p style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <CheckCircle size={20} /> Tersambung ke Database Awan!
            </p>
            <p className="text-muted" style={{ marginBottom: '1rem' }}>Semua data kelas, murid, dan kunci jawaban sekarang otomatis tersinkronisasi. Anda bisa login dari HP atau perangkat lain dan data Anda akan langsung muncul!</p>
            <button className="btn-secondary" onClick={disconnectFirebase} style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              Putuskan Koneksi & Kembali ke Penyimpanan Lokal
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px', marginBottom: '1rem' }}>
              <p style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                <AlertCircle size={20} /> Anda Sedang Menggunakan Penyimpanan Offline (Lokal)
              </p>
              <p style={{ color: '#fca5a5', fontSize: '0.9rem' }}>Data Anda hanya tersimpan di komputer ini. Jika pindah perangkat, data tidak akan terbaca.</p>
            </div>
            
            <p className="text-muted" style={{ marginBottom: '0.5rem' }}>Paste <b>Firebase Config (JSON)</b> Anda di bawah ini untuk menghubungkan aplikasi ke Cloud Database Anda sendiri:</p>
            <textarea 
              className="form-control"
              rows="6"
              placeholder='{"apiKey": "AIzaSy...", "authDomain": "...", "projectId": "...", ...}'
              value={configInput}
              onChange={(e) => setConfigInput(e.target.value)}
              style={{ width: '100%', marginBottom: '1rem', fontFamily: 'monospace', fontSize: '0.9rem' }}
            />
            <button className="btn-primary" onClick={handleConnect} disabled={!configInput.trim()} style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <Save size={20} /> Hubungkan ke Firebase
            </button>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ marginTop: '2rem' }}>
        <h2>Aktivitas Terbaru</h2>
        <p className="text-muted" style={{ marginTop: '1rem' }}>Belum ada aktivitas hari ini.</p>
      </div>
    </div>
  );
}
