import React, { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Edit2, Trash2, Check, X, Download, Upload, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useReactToPrint } from 'react-to-print';
import ClassReport from '../components/ClassReport';

export default function Students() {
  const { students, setStudents, classesList, setClassesList, mapelKeys } = useAppContext();
  
  // Filters
  const [selectedClass, setSelectedClass] = useState(classesList[0] || '');
  const [selectedMapel, setSelectedMapel] = useState(Object.keys(mapelKeys)[0] || '');

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
    documentTitle: `Laporan_LJK_Kelas_${selectedClass}_${selectedMapel}`,
  });

  const handlePrintSingle = useReactToPrint({
    contentRef: singlePrintRef,
    documentTitle: reportModalStudent ? `Laporan_LJK_${reportModalStudent.nama}_${selectedMapel}` : 'Laporan_LJK',
  });

  // Filtered Students
  const displayedStudents = students
    .filter(s => s.kelas === selectedClass)
    .sort((a, b) => parseInt(a.absen) - parseInt(b.absen));

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!absen || !nama || !selectedClass) return;
    
    const newStudent = { 
      id: Date.now(), 
      absen, 
      nama, 
      kelas: selectedClass, 
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

  const downloadExcelTemplate = () => {
    if (!selectedClass) {
      alert("Pilih kelas terlebih dahulu!");
      return;
    }
    
    let data;
    if (displayedStudents.length === 0) {
      data = [
        { 'Nomor Absen': '01', 'Nama Siswa': 'Ahmad Budi', 'Nilai': '', 'Mapel Terakhir': '' },
        { 'Nomor Absen': '02', 'Nama Siswa': 'Citra Kirana', 'Nilai': '', 'Mapel Terakhir': '' }
      ];
    } else {
      data = displayedStudents.map(s => {
        const nilaiObj = s.nilai && selectedMapel && s.nilai[selectedMapel];
        const finalScore = typeof nilaiObj === 'object' ? nilaiObj.score : (nilaiObj || '');
        return {
          'Nomor Absen': s.absen,
          'Nama Siswa': s.nama,
          'Nilai': finalScore,
          'Mapel Terakhir': selectedMapel
        };
      });
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Murid");
    XLSX.writeFile(wb, `Data_Murid_${selectedClass}_${selectedMapel}.xlsx`);
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedClass) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length > 0) {
          let updatedStudents = [...students];
          let addedCount = 0;

          data.forEach((row, index) => {
            const rowAbsen = row['Nomor Absen'] ? row['Nomor Absen'].toString() : '';
            const rowNama = row['Nama Siswa'] ? row['Nama Siswa'].toString() : '';
            const rowNilai = row['Nilai'];

            if (rowAbsen && rowNama) {
              const existingIdx = updatedStudents.findIndex(s => s.kelas === selectedClass && s.absen === rowAbsen);
              
              if (existingIdx >= 0) {
                updatedStudents[existingIdx].nama = rowNama;
                if (rowNilai !== undefined && selectedMapel) {
                  updatedStudents[existingIdx].nilai[selectedMapel] = rowNilai;
                }
              } else {
                addedCount++;
                const newStudent = {
                  id: Date.now() + index,
                  absen: rowAbsen,
                  nama: rowNama,
                  kelas: selectedClass,
                  nilai: {}
                };
                if (rowNilai !== undefined && selectedMapel) {
                  newStudent.nilai[selectedMapel] = rowNilai;
                }
                updatedStudents.push(newStudent);
              }
            }
          });
          
          setStudents(updatedStudents);
          alert(`Berhasil memproses Excel. ${addedCount} murid baru ditambahkan ke kelas ${selectedClass}.`);
        }
      } catch (err) {
        console.error(err);
        alert("Gagal membaca file Excel. Pastikan kolom 'Nomor Absen' dan 'Nama Siswa' ada.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  return (
    <div>
      <div className="page-header">
        <h1>Buku Nilai & Data Murid</h1>
        <p>Pilih Kelas dan Mata Pelajaran untuk melihat nilai.</p>
      </div>

      <div className="glass-card" style={{ marginBottom: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Pilih Kelas</label>
          <select 
            className="form-control"
            value={selectedClass} 
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
            value={selectedMapel} 
            onChange={(e) => setSelectedMapel(e.target.value)}
          >
            {Object.keys(mapelKeys).map(mapel => (
              <option key={mapel} value={mapel} style={{ color: 'black' }}>{mapel}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedClass && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem' }}>Siswa: {selectedClass}</h2>
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
          </div>
        </div>
      )}

      {isAddingStudent && !editingId && (
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Tambah Murid Baru di {selectedClass}</h3>
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

      {selectedClass ? (
        <div className="glass-card table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th width="15%">No. Absen</th>
                <th>Nama Siswa</th>
                <th width="20%">Nilai {selectedMapel && `(${selectedMapel})`}</th>
                <th width="15%">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada murid di kelas {selectedClass}.</td>
                </tr>
              ) : (
                displayedStudents.map((student) => {
                  const nilaiData = selectedMapel ? (student.nilai?.[selectedMapel]) : null;
                  const score = typeof nilaiData === 'object' && nilaiData !== null ? nilaiData.score : nilaiData;
                  
                  return (
                    <tr key={student.id}>
                      {editingId === student.id ? (
                        <>
                          <td><input type="text" value={absen} onChange={(e) => setAbsen(e.target.value)} style={{ padding: '0.5rem', width: '100%' }} /></td>
                          <td><input type="text" value={nama} onChange={(e) => setNama(e.target.value)} style={{ padding: '0.5rem', width: '100%' }} /></td>
                          <td className="text-muted">Sedang mengedit...</td>
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
                          <td>{student.nama}</td>
                          <td onClick={() => { if (nilaiData) setReportModalStudent(student); }} style={{ cursor: nilaiData ? 'pointer' : 'default' }}>
                            {score !== undefined && score !== null ? (
                              <span style={{ fontWeight: 'bold', color: score >= 75 ? 'var(--success)' : 'var(--danger)', fontSize: '1.1rem' }}>{score}</span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button onClick={() => handleEdit(student)} className="btn-secondary" style={{ padding: '0.5rem' }} title="Edit"><Edit2 size={16} /></button>
                              <button onClick={() => handleDelete(student.id)} className="btn-secondary" style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--danger)' }} title="Hapus"><Trash2 size={16} color="var(--danger)" /></button>
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
                    <h3 style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}><span>Nilai Akhir:</span><span style={{ color: nd.score >= 75 ? 'var(--success)' : 'var(--danger)', fontSize: '1.5rem' }}>{nd.score}</span></h3>
                    <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '1rem' }}>
                      <table className="data-table">
                        <thead><tr><th>No</th><th>Jwb</th><th>Kunci</th><th>Hasil</th></tr></thead>
                        <tbody>{nd.details.map(item => (<tr key={item.number}><td>{item.number}</td><td style={{ fontWeight: 'bold' }}>{item.student_answer || '-'}</td><td className="text-muted">{item.correct_answer}</td><td style={{ color: item.is_correct ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>{item.is_correct ? 'Benar' : 'Salah'}</td></tr>))}</tbody>
                      </table>
                    </div>
                  </div>
                  <div style={{ flex: 2, minWidth: '400px' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Bukti Pindai LJK</h3>
                    {nd.image_url ? <img src={nd.image_url} alt="Scan Result" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--glass-border)' }} /> : <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--glass-border)' }}>Gambar tidak tersedia.</div>}
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
