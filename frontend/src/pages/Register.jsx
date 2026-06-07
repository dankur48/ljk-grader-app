import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Registrasi berhasil! Silakan login.");
    navigate('/login');
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card">
        <div className="auth-header">
          <h2>Buat Akun</h2>
          <p>Mulai gunakan AutoGrader LJK gratis</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nama Lengkap</label>
            <input type="text" required placeholder="Nama Lengkap" />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" required placeholder="nama@sekolah.edu" />
          </div>
          
          <div className="form-group">
            <label>Kata Sandi</label>
            <div className="password-input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                placeholder="Buat kata sandi" 
              />
              <button 
                type="button" 
                className="eye-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem' }}>
            Daftar
          </button>
        </form>

        <p className="auth-footer">
          Sudah punya akun? <Link to="/login">Masuk di sini</Link>
        </p>
      </div>
    </div>
  );
}
