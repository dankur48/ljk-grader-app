import React, { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, BookOpen, ChevronDown, ChevronRight, Upload, Download, Trash2, Edit2, Check, X, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AnswerKeys() {
  const { mapelKeys, setMapelKeys, setStudents } = useAppContext();
  const [newMapel, setNewMapel] = useState('');
  const [expandedMapel, setExpandedMapel] = useState(null);
  const [editingMapel, setEditingMapel] = useState(null);
  const [editMapelName, setEditMapelName] = useState('');
  const [saveStatus, setSaveStatus] = useState({});

  const excelInputRef = useRef(null);
  const [uploadTargetMapel, setUploadTargetMapel] = useState(null);

  const handleAddMapel = (e) => {
    e.preventDefault();
    if (!newMapel || mapelKeys[newMapel]) return;
    
    setMapelKeys({
      ...mapelKeys,
      [newMapel]: Array.from({ length: 20 }, (_, i) => ({ number: i + 1, answer: 'A' }))
    });
    setNewMapel('');
    setExpandedMapel(newMapel);
  };

  const handleDeleteMapel = (mapel, e) => {
    e.stopPropagation();
    if (window.confirm(`Apakah Anda yakin ingin menghapus kunci jawaban mata pelajaran ${mapel}?`)) {
      const updatedKeys = { ...mapelKeys };
      delete updatedKeys[mapel];
      setMapelKeys(updatedKeys);
      if (expandedMapel === mapel) setExpandedMapel(null);
    }
  };

  const handleStartEditMapel = (mapel, e) => {
    e.stopPropagation();
    setEditingMapel(mapel);
    setEditMapelName(mapel);
  };

  const handleSaveEditMapel = (oldMapel, e) => {
    e.stopPropagation();
    if (!editMapelName || editMapelName === oldMapel) {
      setEditingMapel(null);
      return;
    }
    
    if (mapelKeys[editMapelName]) {
      alert("Nama mata pelajaran sudah ada!");
      return;
    }

    const updatedKeys = { ...mapelKeys };
    updatedKeys[editMapelName] = updatedKeys[oldMapel];
    delete updatedKeys[oldMapel];
    setMapelKeys(updatedKeys);
    
    setStudents(prevStudents => prevStudents.map(student => {
      if (student.nilai && student.nilai[oldMapel] !== undefined) {
        const newNilai = { ...student.nilai };
        newNilai[editMapelName] = newNilai[oldMapel];
        delete newNilai[oldMapel];
        return { ...student, nilai: newNilai };
      }
      return student;
    }));

    setEditingMapel(null);
    if (expandedMapel === oldMapel) setExpandedMapel(editMapelName);
  };

  const handleCancelEditMapel = (e) => {
    e.stopPropagation();
    setEditingMapel(null);
  };

  const handleKeyChange = (mapel, index, value) => {
    const updatedKeys = { ...mapelKeys };
    updatedKeys[mapel][index].answer = value;
    setMapelKeys(updatedKeys);
  };

  const toggleMapel = (mapel) => {
    if (editingMapel === mapel) return;
    if (expandedMapel === mapel) {
      setExpandedMapel(null);
    } else {
      setExpandedMapel(mapel);
    }
  };

  const downloadExcelTemplate = (mapel, e) => {
    e.stopPropagation();
    const data = mapelKeys[mapel].map(item => ({
      'Nomor Soal': item.number,
      'Kunci Jawaban': item.answer
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Kunci_${mapel}`);
    XLSX.writeFile(wb, `Kunci_Jawaban_${mapel.replace(/\s+/g, '_')}.xlsx`);
  };

  const triggerUpload = (mapel, e) => {
    e.stopPropagation();
    setUploadTargetMapel(mapel);
    excelInputRef.current.click();
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !uploadTargetMapel) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length > 0) {
          const newKey = Array.from({ length: 20 }, (_, i) => ({ number: i + 1, answer: 'A' }));
          
          data.forEach(row => {
            const no = parseInt(row['Nomor Soal']);
            let ans = row['Kunci Jawaban'];
            
            if (!isNaN(no) && no >= 1 && no <= 20 && ans) {
              ans = ans.toString().toUpperCase().trim();
              if (['A', 'B', 'C', 'D', 'E'].includes(ans)) {
                newKey[no - 1].answer = ans;
              }
            }
          });
          
          const updatedKeys = { ...mapelKeys };
          updatedKeys[uploadTargetMapel] = newKey;
          setMapelKeys(updatedKeys);
          alert(`Berhasil memperbarui kunci jawaban untuk ${uploadTargetMapel} dari file Excel.`);
          
          setSaveStatus({ ...saveStatus, [uploadTargetMapel]: 'Kunci Diperbarui!' });
          setTimeout(() => setSaveStatus(prev => ({ ...prev, [uploadTargetMapel]: null })), 3000);
        }
      } catch (err) {
        console.error(err);
        alert("Gagal membaca file Excel. Pastikan formatnya sesuai template.");
      }
      setUploadTargetMapel(null);
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const handleManualSave = (mapel) => {
    setSaveStatus({ ...saveStatus, [mapel]: 'Tersimpan!' });
    setTimeout(() => setSaveStatus(prev => ({ ...prev, [mapel]: null })), 3000);
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Kunci Jawaban</h1>
          <p>Kelola bank kunci jawaban berdasarkan Mata Pelajaran</p>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Tambah Mata Pelajaran Baru</h3>
        <form onSubmit={handleAddMapel} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '250px', marginBottom: 0 }}>
            <input 
              type="text" 
              required
              value={newMapel}
              onChange={(e) => setNewMapel(e.target.value)}
              placeholder="Nama Mata Pelajaran (Contoh: B. Indonesia)" 
            />
          </div>
          <button type="submit" className="btn-primary" style={{ margin: 0, padding: '0.75rem 1.5rem', width: 'auto' }}>
            <Plus size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> 
            Buat Bank Soal
          </button>
        </form>
      </div>

      <input 
        type="file" 
        accept=".xlsx, .xls" 
        style={{ display: 'none' }} 
        ref={excelInputRef}
        onChange={handleExcelUpload}
      />

      <div className="mapel-list">
        {Object.keys(mapelKeys).length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>Belum ada kunci jawaban.</div>
        ) : (
          Object.keys(mapelKeys).map(mapel => (
            <div key={mapel} className="glass-card" style={{ marginBottom: '1rem', padding: '1rem 1.5rem', transition: 'all 0.3s' }}>
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: editingMapel === mapel ? 'default' : 'pointer' }}
                onClick={() => toggleMapel(mapel)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                  {editingMapel === mapel ? (
                    <>
                      <BookOpen size={20} color="var(--primary-color)" />
                      <input 
                        type="text" 
                        value={editMapelName}
                        onChange={(e) => setEditMapelName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ padding: '0.5rem', margin: 0, width: '200px' }}
                        autoFocus
                      />
                      <button onClick={(e) => handleSaveEditMapel(mapel, e)} className="btn-secondary" style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', borderColor: 'var(--success)' }}>
                        <Check size={16} color="var(--success)" />
                      </button>
                      <button onClick={handleCancelEditMapel} className="btn-secondary" style={{ padding: '0.5rem' }}>
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <BookOpen size={20} color="var(--primary-color)" />
                      <h3 style={{ margin: 0 }}>{mapel}</h3>
                    </>
                  )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {editingMapel !== mapel && (
                    <>
                      <button onClick={(e) => downloadExcelTemplate(mapel, e)} className="btn-secondary" style={{ padding: '0.5rem' }} title="Download Excel">
                        <Download size={16} />
                      </button>
                      <button onClick={(e) => triggerUpload(mapel, e)} className="btn-secondary" style={{ padding: '0.5rem' }} title="Upload Excel">
                        <Upload size={16} />
                      </button>
                      <button onClick={(e) => handleStartEditMapel(mapel, e)} className="btn-secondary" style={{ padding: '0.5rem' }} title="Edit Nama Mapel">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={(e) => handleDeleteMapel(mapel, e)} className="btn-secondary" style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--danger)' }} title="Hapus Mapel">
                        <Trash2 size={16} color="var(--danger)" />
                      </button>
                      <div style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center' }}>
                        {expandedMapel === mapel ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {expandedMapel === mapel && editingMapel !== mapel && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', animation: 'fadeInDown 0.3s' }}>
                  <div className="key-grid">
                    {mapelKeys[mapel].map((item, index) => (
                      <div key={item.number} className="key-item">
                        <label>No. {item.number}</label>
                        <select 
                          value={item.answer} 
                          onChange={(e) => handleKeyChange(mapel, index, e.target.value)}
                        >
                          {['A', 'B', 'C', 'D', 'E'].map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  
                  {/* Tombol Simpan Manual untuk Psikologis Pengguna */}
                  <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                    <button className="btn-primary" onClick={() => handleManualSave(mapel)} style={{ margin: 0, width: 'auto' }}>
                      <CheckCircle size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                      Simpan Kunci Jawaban
                    </button>
                    
                    {saveStatus[mapel] && (
                      <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle size={16} /> {saveStatus[mapel]}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
