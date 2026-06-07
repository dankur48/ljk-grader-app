import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Edit2, Trash2, Check, X, School } from 'lucide-react';

export default function Classes() {
  const { classesList, setClassesList, students, setStudents } = useAppContext();
  
  const [newClass, setNewClass] = useState('');
  const [editingClass, setEditingClass] = useState(null);
  const [editClassName, setEditClassName] = useState('');

  const handleAddClass = (e) => {
    e.preventDefault();
    if (!newClass || classesList.includes(newClass)) {
      alert("Nama kelas tidak boleh kosong atau sudah ada.");
      return;
    }
    setClassesList([...classesList, newClass]);
    setNewClass('');
  };

  const handleStartEdit = (cls) => {
    setEditingClass(cls);
    setEditClassName(cls);
  };

  const handleSaveEdit = (oldClass) => {
    if (!editClassName || editClassName === oldClass) {
      setEditingClass(null);
      return;
    }
    
    if (classesList.includes(editClassName)) {
      alert("Nama kelas sudah ada!");
      return;
    }

    // Update classes list
    setClassesList(classesList.map(c => c === oldClass ? editClassName : c));
    
    // Proactively update all students in this class
    setStudents(students.map(s => 
      s.kelas === oldClass ? { ...s, kelas: editClassName } : s
    ));

    setEditingClass(null);
  };

  const handleDelete = (cls) => {
    if (window.confirm(`Yakin ingin menghapus kelas ${cls}? PERINGATAN: Semua data murid dan nilai di kelas ini akan ikut TERHAPUS!`)) {
      setClassesList(classesList.filter(c => c !== cls));
      setStudents(students.filter(s => s.kelas !== cls));
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Manajemen Kelas</h1>
        <p>Kelola daftar kelas (Master Data) untuk pengelompokan siswa.</p>
      </div>

      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Tambah Kelas Baru</h3>
        <form onSubmit={handleAddClass} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '250px', marginBottom: 0 }}>
            <input 
              type="text" 
              required
              value={newClass}
              onChange={(e) => setNewClass(e.target.value)}
              placeholder="Contoh: X TKJ 1" 
            />
          </div>
          <button type="submit" className="btn-primary" style={{ margin: 0, padding: '0.75rem 1.5rem', width: 'auto' }}>
            <Plus size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> 
            Simpan Kelas
          </button>
        </form>
      </div>

      <div className="glass-card table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th width="10%">No.</th>
              <th>Nama Kelas</th>
              <th width="30%">Jumlah Murid</th>
              <th width="20%">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {classesList.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada data kelas.</td>
              </tr>
            ) : (
              classesList.map((cls, index) => {
                const studentCount = students.filter(s => s.kelas === cls).length;
                
                return (
                  <tr key={cls}>
                    <td>{index + 1}</td>
                    {editingClass === cls ? (
                      <td colSpan="2">
                        <input 
                          type="text" 
                          value={editClassName}
                          onChange={(e) => setEditClassName(e.target.value)}
                          style={{ padding: '0.5rem', width: '80%' }}
                          autoFocus
                        />
                      </td>
                    ) : (
                      <>
                        <td style={{ fontWeight: 'bold' }}>
                          <School size={16} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary-color)' }} />
                          {cls}
                        </td>
                        <td className="text-muted">{studentCount} Siswa</td>
                      </>
                    )}
                    
                    <td>
                      {editingClass === cls ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleSaveEdit(cls)} className="btn-secondary" style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', borderColor: 'var(--success)' }} title="Simpan">
                            <Check size={16} color="var(--success)" />
                          </button>
                          <button onClick={() => setEditingClass(null)} className="btn-secondary" style={{ padding: '0.5rem' }} title="Batal">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleStartEdit(cls)} className="btn-secondary" style={{ padding: '0.5rem' }} title="Edit Nama Kelas">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(cls)} className="btn-secondary" style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--danger)' }} title="Hapus Kelas">
                            <Trash2 size={16} color="var(--danger)" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
