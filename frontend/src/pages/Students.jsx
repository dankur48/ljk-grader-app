import React, { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Edit2, Trash2, Check, X, Download, Upload, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useReactToPrint } from 'react-to-print';
import ClassReport from '../components/ClassReport';

export default function Students() {
  const { classesList, students, setStudents, mapelKeys, globalClass, setGlobalClass, globalMapel, setGlobalMapel } = useAppContext();
  
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const getFullUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://localhost:8000')) return url.replace('http://localhost:8000', API_URL);
    if (url.startsWith('/')) return `${API_URL}${url}`;
    return url;
  };

  const [selectedClassLocal, setSelectedClassLocal] = useState('');
  const [selectedMapelLocal, setSelectedMapelLocal] = useState('');

  // Sync with global state
  useEffect(() => {
    if (!globalClass && classesList.length > 0) setGlobalClass(classesList[0]);
    if (!globalMapel && Object.keys(mapelKeys).length > 0) setGlobalMapel(Object.keys(mapelKeys)[0]);
  }, [classesList, mapelKeys]);

  const currentClass = selectedClassLocal || globalClass || (classesList[0] || '');
  const currentMapel = selectedMapelLocal || globalMapel || (Object.keys(mapelKeys)[0] || '');

  const setSelectedClass = (val) => {
    setSelectedClassLocal(val);
    setGlobalClass(val);
  };
  const setSelectedMapel = (val) => {
    setSelectedMapelLocal(val);
    setGlobalMapel(val);
  };

  // Form States
  const [absen, setAbsen] = useState('');
  const [nama, setNama] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // State untuk Modal Laporan Rinci
  const [reportModalStudent, setReportModalStudent] = useState(null);
  
  const excelInputRef = useRef(null);
  const printRef = useRef();
  const singlePrintRef = useRef();

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Laporan_LJK_Kelas_${currentClass}_${currentMapel}`,
  });

  const handlePrintSingle = useReactToPrint({
    contentRef: singlePrintRef,
    documentTitle: reportModalStudent ? `Laporan_LJK_${reportModalStudent.nama}_${currentMapel}` : 'Laporan_LJK',
  });

  // Filtered Students
  const displayedStudents = students
    .filter(s => s.kelas === currentClass)
    .sort((a, b) => parseInt(a.absen) - parseInt(b.absen));

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!absen || !nama || !currentClass) return;
    
    const exists = students.some(s => s.kelas === currentClass && (s.absen === absen || s.nama.toLowerCase() === nama.toLowerCase()));
    if (exists) {
      alert("Siswa dengan nomor absen atau nama ini sudah ada di kelas ini!");
      return;
    }
    
    const newStudent = { 
      id: Date.now(), 
      absen, 
      nama, 
      kelas: currentClass, 
      nilai: {} 
    };
    setStudents([...students, newStudent]);
    setAbsen('');
    setNama('');
    setIsAddingStudent(false);
  };

  const handleEdit = (student) => {
    setEditingId(student.id);
    setAbsen(student.absen);
    setNama(student.nama);
  };

  const handleSaveEdit = () => {
    setStudents(students.map(s => 
      s.id === editingId ? { ...s, absen, nama } : s
    ));
    setEditingId(null);
    setAbsen('');
    setNama('');
  };

  const handleDelete = (id) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data murid ini?")) {
      setStudents(students.filter(s => s.id !== id));
    }
  };

  const handleDeleteAll = () => {
    if (confirm("Yakin ingin menghapus seluruh murid dari kelas ini? Semua data nilai akan hilang!")) {
      setStudents(prev => prev.filter(s => s.kelas !== currentClass));
    }
  };

  const handleResetNilai = () => {
    if (!currentMapel) return;
    if (confirm(`Yakin ingin mereset/menghapus seluruh nilai mapel ${currentMapel} di kelas ${currentClass}?`)) {
      const updated = students.map(s => {
        if (s.kelas === currentClass && s.nilai && s.nilai[currentMapel]) {
          const newNilai = { ...s.nilai };
          delete newNilai[currentMapel];
          return { ...s, nilai: newNilai };
        }
        return s;
      });
      setStudents(updated);
    }
  };

  const updateScore = (studentId, field, value) => {
    if (!currentMapel) return;
    const numValue = value === '' ? 0 : parseFloat(value) || 0;
    setStudents(students.map(s => {
      if (s.id === studentId) {
        let currentNilai = s.nilai?.[currentMapel] || { score_pg: 0, score_essay: 0, score_uh: 0, score_pts: 0 };
        
        const newNilai = { 
          ...(typeof currentNilai === 'object' ? currentNilai : { score_pg: parseFloat(currentNilai) || 0, score_essay: 0 }),
          [field]: numValue 
        };
        newNilai.score_pg = newNilai.score_pg ?? newNilai.score ?? 0;
        newNilai.score = (parseFloat(newNilai.score_pg) || 0) + (parseFloat(newNilai.score_essay) || 0);
        
        return { ...s, nilai: { ...s.nilai, [currentMapel]: newNilai } };
      }
      return s;
    }));
  };

  const downloadExcelTemplate = () => {
    if (!currentClass) {
      alert("Pilih kelas terlebih dahulu!");
      return;
    }
    
    let data;
    if (displayedStudents.length === 0) {
      data = [
        { 'Kelas': currentClass, 'Mata Pelajaran': currentMapel, 'Nomor Absen': '01', 'Nama Siswa': 'Ahmad Budi', 'Nilai PAS': '', 'Nilai UH': '', 'Nilai PTS': '', 'Nilai Akhir Rapor': '' },
        { 'Kelas': currentClass, 'Mata Pelajaran': currentMapel, 'Nomor Absen': '02', 'Nama Siswa': 'Citra Kirana', 'Nilai PAS': '', 'Nilai UH': '', 'Nilai PTS': '', 'Nilai Akhir Rapor': '' }
      ];
    } else {
      data = displayedStudents.map(s => {
        const nilaiObj = s.nilai && currentMapel && s.nilai[currentMapel];
        const scorePG = typeof nilaiObj === 'object' ? (nilaiObj.score_pg ?? nilaiObj.score ?? '') : '';
        const scoreEssay = typeof nilaiObj === 'object' ? (nilaiObj.score_essay ?? 0) : '';
        const scoreUH = typeof nilaiObj === 'object' ? (nilaiObj.score_uh ?? '') : '';
        const scorePTS = typeof nilaiObj === 'object' ? (nilaiObj.score_pts ?? '') : '';
        const totalScore = typeof nilaiObj === 'object' ? nilaiObj.score : (nilaiObj || '');
        return {
          'Kelas': currentClass,
          'Mata Pelajaran': currentMapel,
          'Nomor Absen': s.absen,
          'Nama Siswa': s.nama,
          'Nilai PAS': totalScore,
          'Nilai UH': scoreUH,
          'Nilai PTS': scorePTS,
          'Nilai Akhir Rapor': (((parseFloat(totalScore)||0) + (parseFloat(scoreUH)||0) + (parseFloat(scorePTS)||0)) / 3).toFixed(1)
        };
      });
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Murid");
    XLSX.writeFile(wb, `Template_Nilai_${currentClass}_${currentMapel}.xlsx`);
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !currentClass) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length > 0) {
          const expectedClass = data[0]['Kelas'] ? data[0]['Kelas'].toString().trim() : currentClass;
          const expectedMapel = data[0]['Mata Pelajaran'] ? data[0]['Mata Pelajaran'].toString().trim() : currentMapel;
          
          if (expectedClass !== currentClass || expectedMapel !== currentMapel) {
            alert(`File Excel ini untuk kelas ${expectedClass} mapel ${expectedMapel}. Harap pilih menu yang sesuai terlebih dahulu.`);
            return;
          }

          const overwrite = window.confirm("Apakah Anda ingin menimpa (menghapus) data murid lama di kelas ini dengan data dari Excel?");
          let updatedStudents = overwrite ? students.filter(s => s.kelas !== currentClass) : [...students];
          let addedCount = 0;

          data.forEach((row, index) => {
            const rowAbsen = row['Nomor Absen'] ? row['Nomor Absen'].toString() : '';
            const rowNama = row['Nama Siswa'] ? row['Nama Siswa'].toString() : '';
            const totalScore = row['Nilai PAS'];

            if (rowAbsen && rowNama) {
              const existingIdx = updatedStudents.findIndex(s => s.kelas === currentClass && s.absen === rowAbsen);
              
              if (existingIdx >= 0) {
                updatedStudents[existingIdx].nama = rowNama;
                if (totalScore !== undefined && currentMapel) {
                  updatedStudents[existingIdx].nilai[currentMapel] = { 
                    ...(typeof updatedStudents[existingIdx].nilai[currentMapel] === 'object' ? updatedStudents[existingIdx].nilai[currentMapel] : {}),
                    score: totalScore,
                    score_pg: totalScore
                  };
                }
              } else {
                addedCount++;
                const newStudent = {
                  id: Date.now() + index,
                  absen: rowAbsen,
                  nama: rowNama,
                  kelas: currentClass,
                  nilai: totalScore !== undefined ? { [currentMapel]: { score: totalScore, score_pg: totalScore } } : {}
                };
                updatedStudents.push(newStudent);
              }
            }
          });
          
          setStudents(updatedStudents);
          alert(`Berhasil memproses Excel. ${addedCount} murid baru ditambahkan.`);
        }
      } catch (err) {
        console.error(err);
        alert("Gagal membaca file Excel.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  return (
    <div>
      <div className="page-header">
        <h1>Buku Nilai & Rapotan</h1>
        <p>Kelola data murid, Nilai PAS (LJK), Nilai UH, dan Nilai PTS dalam satu layar.</p>
      </div>

      <div className="glass-card" style={{ marginBottom: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Pilih Kelas</label>
          <select 
            className="form-control"
            value={currentClass} 
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            {classesList.map(cls => (
              <option key={cls} value={cls} style={{ color: 'black' }}>{cls}</option>
            ))}
          </select>
        </div>
        
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Pilih Mata Pelajaran (Nilai)</label>
          <select 
            className="form-control"
            value={currentMapel} 
            onChange={(e) => setSelectedMapel(e.target.value)}
          >
            {Object.keys(mapelKeys).map(mapel => (
              <option key={mapel} value={mapel} style={{ color: 'black' }}>{mapel}</option>
            ))}
          </select>
        </div>
      </div>

      {currentClass && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem' }}>Siswa: {currentClass}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={downloadExcelTemplate} title="Download format tabel/rekap nilai">
              <Download size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Export
            </button>
            <button className="btn-secondary" onClick={() => excelInputRef.current.click()} title="Upload data murid dari Excel">
              <Upload size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Import
            </button>
            <button className="btn-secondary" onClick={() => handlePrint()} style={{ borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }} title="Cetak laporan rinci beserta gambar scan ke PDF">
              <Printer size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Cetak Laporan (PDF)
            </button>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              style={{ display: 'none' }} 
              ref={excelInputRef}
              onChange={handleExcelUpload}
            />
            <button className="btn-primary" onClick={() => { setIsAddingStudent(!isAddingStudent); setEditingId(null); setAbsen(''); setNama(''); }} style={{ margin: 0, width: 'auto' }}>
              <Plus size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> 
              Tambah Manual
            </button>
            <button className="btn-secondary" onClick={handleDeleteAll} style={{ margin: 0, width: 'auto', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--danger)', color: 'var(--danger)' }} title="Hapus seluruh murid di kelas ini">
              <Trash2 size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> 
              Hapus Semua
            </button>
            <button className="btn-secondary" onClick={handleResetNilai} style={{ margin: 0, width: 'auto', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'var(--warning)', color: 'var(--warning)' }} title="Reset nilai mapel ini">
              <X size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> 
              Reset Nilai
            </button>
          </div>
        </div>
      )}

      {isAddingStudent && !editingId && (
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Tambah Murid Baru di {currentClass}</h3>
          <form onSubmit={handleAddStudent} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
              <label>Nomor Absen</label>
              <input type="text" required value={absen} onChange={(e) => setAbsen(e.target.value)} placeholder="Misal: 04" />
            </div>
            <div className="form-group" style={{ flex: 2, minWidth: '200px', marginBottom: 0 }}>
              <label>Nama Siswa</label>
              <input type="text" required value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama Lengkap" />
            </div>
            <button type="submit" className="btn-primary" style={{ margin: 0, padding: '0.75rem 1.5rem', width: 'auto' }}>Simpan</button>
          </form>
        </div>
      )}

      {currentClass ? (
        <div className="glass-card table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th width="8%">No. Absen</th>
                <th width="20%">Nama Siswa</th>
                <th width="12%" style={{textAlign: 'center'}}>Nilai PG</th>
                <th width="12%" style={{textAlign: 'center'}}>Nilai Essay</th>
                <th width="12%" style={{textAlign: 'center'}}>Nilai PAS (Total)</th>
                <th width="12%" style={{textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)'}}>Nilai UH</th>
                <th width="12%" style={{textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)'}}>Nilai PTS</th>
                <th width="12%" style={{textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)'}}>Nilai Rapor</th>
                <th width="10%" style={{textAlign: 'center'}}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada murid di kelas {currentClass}.</td>
                </tr>
              ) : (
                displayedStudents.map((student) => {
                  const nilaiData = currentMapel ? (student.nilai?.[currentMapel]) : null;
                  const isObject = typeof nilaiData === 'object' && nilaiData !== null;
                  
                  const score_pg = isObject ? (nilaiData.score_pg ?? nilaiData.score ?? 0) : (parseFloat(nilaiData) || 0);
                  const score_essay = isObject ? (nilaiData.score_essay ?? 0) : 0;
                  const score_uh = isObject ? (nilaiData.score_uh ?? '') : '';
                  const score_pts = isObject ? (nilaiData.score_pts ?? '') : '';
                  const total_score = isObject && nilaiData.score !== undefined ? nilaiData.score : score_pg + score_essay;
                  
                  const val_uh = parseFloat(score_uh) || 0;
                  const val_pts = parseFloat(score_pts) || 0;
                  const val_pas = parseFloat(total_score) || 0;
                  const nilai_rapor = ((val_pas + val_uh + val_pts) / 3).toFixed(1);
                  
                  const hasData = nilaiData !== undefined && nilaiData !== null && nilaiData !== '';
                  
                  return (
                    <tr key={student.id}>
                      {editingId === student.id ? (
                        <>
                          <td><input type="text" value={absen} onChange={(e) => setAbsen(e.target.value)} style={{ padding: '0.5rem', width: '100%' }} /></td>
                          <td><input type="text" value={nama} onChange={(e) => setNama(e.target.value)} style={{ padding: '0.5rem', width: '100%' }} /></td>
                          <td colSpan="3" className="text-muted" style={{ textAlign: 'center' }}>Sedang mengedit identitas...</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button onClick={handleSaveEdit} className="btn-secondary" style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', borderColor: 'var(--success)' }}><Check size={16} color="var(--success)" /></button>
                              <button onClick={() => setEditingId(null)} className="btn-secondary" style={{ padding: '0.5rem' }}><X size={16} /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{student.absen}</td>
                          <td onClick={() => { if (hasData) setReportModalStudent(student); }} style={{ cursor: hasData ? 'pointer' : 'default', textDecoration: hasData ? 'underline' : 'none' }} title="Klik untuk lihat rincian scan">
                            {student.nama}
                          </td>
                          
                          <td>
                            <input 
                              type="number" 
                              value={hasData ? score_pg : ''} 
                              onChange={(e) => updateScore(student.id, 'score_pg', e.target.value)}
                              placeholder="-"
                              className="form-control"
                              style={{ width: '80px', padding: '0.25rem', margin: 0, textAlign: 'center', background: 'transparent', border: '1px solid var(--glass-border)', color: 'white' }}
                            />
                          </td>
                          
                          <td>
                            <input 
                              type="number" 
                              value={hasData ? score_essay : ''} 
                              onChange={(e) => updateScore(student.id, 'score_essay', e.target.value)}
                              placeholder="-"
                              className="form-control"
                              style={{ width: '80px', padding: '0.25rem', margin: 0, textAlign: 'center', background: 'transparent', border: '1px solid var(--glass-border)', color: 'white' }}
                            />
                          </td>
                          
                          <td style={{textAlign: 'center'}}>
                            {hasData ? (
                              <span style={{ fontWeight: 'bold', color: total_score >= 75 ? 'var(--success)' : 'var(--danger)', fontSize: '1.2rem' }}>{total_score}</span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          
                          <td style={{textAlign: 'center'}}>
                            <input 
                              type="number" 
                              value={hasData ? score_uh : ''} 
                              onChange={(e) => updateScore(student.id, 'score_uh', e.target.value)}
                              placeholder="0"
                              className="form-control"
                              style={{ width: '60px', padding: '0.25rem', margin: 0, textAlign: 'center', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--primary-color)', color: 'white' }}
                            />
                          </td>

                          <td style={{textAlign: 'center'}}>
                            <input 
                              type="number" 
                              value={hasData ? score_pts : ''} 
                              onChange={(e) => updateScore(student.id, 'score_pts', e.target.value)}
                              placeholder="0"
                              className="form-control"
                              style={{ width: '60px', padding: '0.25rem', margin: 0, textAlign: 'center', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--primary-color)', color: 'white' }}
                            />
                          </td>

                          <td style={{textAlign: 'center'}}>
                            {hasData ? (
                              <span style={{ fontWeight: 'bold', color: nilai_rapor >= 75 ? 'var(--success)' : 'var(--warning)', fontSize: '1.2rem' }}>{nilai_rapor}</span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          
                          <td style={{textAlign: 'center'}}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button onClick={() => handleEdit(student)} className="btn-secondary" style={{ padding: '0.5rem' }} title="Edit Identitas"><Edit2 size={16} /></button>
                              <button onClick={() => handleDelete(student.id)} className="btn-secondary" style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--danger)' }} title="Hapus Siswa"><Trash2 size={16} color="var(--danger)" /></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>Silakan tambah atau pilih kelas terlebih dahulu.</div>
      )}

      {/* Komponen Laporan Tersembunyi untuk Dicetak (Satu Kelas) */}
      <div style={{ display: 'none' }}>
        <ClassReport ref={printRef} students={students} selectedClass={selectedClass} selectedMapel={selectedMapel} />
      </div>

      {reportModalStudent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
          
          {/* Komponen Laporan Tersembunyi untuk Dicetak (Satu Siswa) dipindah ke dalam modal agar ref-nya akurat */}
          <div style={{ display: 'none' }}>
            <ClassReport ref={singlePrintRef} students={[reportModalStudent]} selectedClass={selectedClass} selectedMapel={selectedMapel} />
          </div>

          <div className="glass-card" style={{ background: '#1e1e2d', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => handlePrintSingle()} 
                className="btn-primary" 
                style={{ margin: 0, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                title="Cetak Laporan Anak Ini"
              >
                <Printer size={16} /> Cetak PDF
              </button>
              <button onClick={() => setReportModalStudent(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '0.5rem' }}><X size={24} /></button>
            </div>
            
            <h2 style={{ marginBottom: '0.5rem', paddingRight: '150px' }}>Laporan Hasil Pemindaian LJK</h2>
            <p className="text-muted" style={{ marginBottom: '2rem' }}>Siswa: {reportModalStudent.nama} (Absen: {reportModalStudent.absen}) | Mapel: {selectedMapel}</p>
            {(() => {
              const nd = selectedMapel ? reportModalStudent.nilai?.[selectedMapel] : null;
              if (!nd || typeof nd !== 'object') return <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--glass-border)', borderRadius: '8px' }}>Siswa ini belum memiliki laporan rincian gambar untuk mapel ini.</div>;
              return (
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '300px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Nilai Pilihan Ganda:</span><strong>{nd.score_pg ?? nd.score ?? 0}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Nilai Essay:</span><strong>{nd.score_essay ?? 0}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}><span>Total Nilai Akhir:</span><span style={{ color: nd.score >= 75 ? 'var(--success)' : 'var(--danger)', fontSize: '1.5rem', fontWeight: 'bold' }}>{nd.score}</span></div>
                    </div>
                    <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '1rem' }}>
                      <table className="data-table">
                        <thead><tr><th>No</th><th>Jwb</th><th>Kunci</th><th>Hasil</th></tr></thead>
                        <tbody>{nd.details.map(item => (<tr key={item.number}><td>{item.number}</td><td style={{ fontWeight: 'bold' }}>{item.student_answer || '-'}</td><td className="text-muted">{item.correct_answer}</td><td style={{ color: item.is_correct ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>{item.is_correct ? 'Benar' : 'Salah'}</td></tr>))}</tbody>
                      </table>
                    </div>
                  </div>
                  <div style={{ flex: 2, minWidth: '400px' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Bukti Pindai LJK</h3>
                    {nd.image_url ? <img src={getFullUrl(nd.image_url)} alt="Scan Result" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--glass-border)' }} /> : <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--glass-border)' }}>Gambar tidak tersedia.</div>}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
