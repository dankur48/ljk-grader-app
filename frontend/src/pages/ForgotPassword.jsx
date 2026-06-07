import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card">
        <div className="auth-header">
          <h2>Lupa Kata Sandi?</h2>
          <p>Masukkan email Anda untuk menerima tautan pemulihan</p>
        </div>
        
        {!sent ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@sekolah.edu" 
              />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem' }}>
              Kirim Tautan Reset
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ color: 'var(--success)', marginBottom: '1rem' }}>
              ✅ Tautan pemulihan telah dikirim ke <strong>{email}</strong>
            </p>
            <p className="auth-subtext">Silakan cek kotak masuk atau folder spam Anda.</p>
          </div>
        )}

        <p className="auth-footer" style={{ marginTop: '2rem' }}>
          Ingat kata sandi? <Link to="/login">Kembali ke Login</Link>
        </p>
      </div>
    </div>
  );
}
