import React, { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Settings, CheckCircle, AlertCircle, Save } from 'lucide-react';

export default function Grader() {
  const { mapelKeys, students, setStudents, classesList } = useAppContext();
  
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const getFullUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://localhost:8000')) {
      return url.replace('http://localhost:8000', API_URL);
    }
    if (url.startsWith('/')) {
      return `${API_URL}${url}`;
    }
    return url;
  };
  
  const [selectedClass, setSelectedClass] = useState(classesList[0] || '');
  const [selectedMapel, setSelectedMapel] = useState(Object.keys(mapelKeys)[0] || '');
  const [maxScore, setMaxScore] = useState(100);
  
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isPdf, setIsPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [result, setResult] = useState(null);
  const [batchResults, setBatchResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  
  // State for single save
  const [selectedStudentToSave, setSelectedStudentToSave] = useState('');
  const [singleSaveStatus, setSingleSaveStatus] = useState('');
  
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile) => {
    setFile(selectedFile);
    setResult(null);
    setBatchResults(null);
    setSyncStatus('');
    setSingleSaveStatus('');
    setSelectedStudentToSave('');
    
    if (selectedFile.type === 'application/pdf') {
      setIsPdf(true);
      setPreview(null);
    } else {
      setIsPdf(false);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleGrade = async () => {
    if (!file || !selectedMapel || !selectedClass) {
      alert("Pastikan Anda sudah memilih Kelas, Mata Pelajaran, dan mengunggah file.");
      return;
    }
    
    setLoading(true);
    setProgressText('Mempersiapkan data...');
    setSyncStatus('');
    setSingleSaveStatus('');
    
    const pointsPerQuestion = maxScore / 20.0;
    const currentKey = mapelKeys[selectedMapel];
    const keyDict = currentKey.reduce((acc, curr) => {
      acc[curr.number.toString()] = curr.answer;
      return acc;
    }, {});
    const answerKeyStr = JSON.stringify(keyDict);

    try {
      if (isPdf) {
        setProgressText('Membaca file PDF dan memisahkan halaman...');
        const splitFormData = new FormData();
        splitFormData.append('file', file);
        
        const splitRes = await fetch(`${API_URL}/api/split-pdf`, {
          method: 'POST',
          body: splitFormData,
        });
        const splitData = await splitRes.json();
        
        if (splitData.error) throw new Error(splitData.error);
        
        const pages = splitData.pages;
        let batchResArr = [];
        
        for (let i = 0; i < pages.length; i++) {
          setProgressText(`Mengoreksi LJK ${i + 1} dari ${pages.length}...`);
          
          const gradeFormData = new FormData();
          gradeFormData.append('filename', pages[i]);
          gradeFormData.append('answer_key', answerKeyStr);
          gradeFormData.append('points_per_question', pointsPerQuestion);
          
          let attempt = 0;
          let success = false;
          while (attempt < 3 && !success) {
            try {
              const gradeRes = await fetch(`${API_URL}/api/grade-path`, {
                method: 'POST',
                body: gradeFormData,
              });
              const gradeData = await gradeRes.json();
              
              if (gradeData.error && gradeData.error.includes("429")) {
                 throw new Error("429 Rate Limit");
              }
              
              if (gradeData.error) {
                 console.error(`Error on page ${i+1}:`, gradeData.error);
                 batchResArr.push({ page: i + 1, result: { error: gradeData.error } });
                 success = true;
              } else {
                 batchResArr.push({ page: i + 1, result: gradeData });
                 success = true;
              }
            } catch (e) {
              attempt++;
              if (e.message.includes("429")) {
                setProgressText(`Limit Google tercapai. Jeda otomatis 30 detik... (LJK ${i+1}/${pages.length})`);
                await new Promise(r => setTimeout(r, 30000));
                setProgressText(`Melanjutkan koreksi LJK ${i + 1} dari ${pages.length}...`);
              } else if (attempt === 3) {
                 batchResArr.push({ page: i + 1, result: { error: "Gagal memproses setelah 3 percobaan." } });
              }
            }
          }
          
          if (i < pages.length - 1) {
            await new Promise(r => setTimeout(r, 2500));
          }
        }
        
        setBatchResults(batchResArr);
        syncBatchToStudents(batchResArr);
        
      } else {
        setProgressText('Menganalisis LJK...');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('points_per_question', pointsPerQuestion);
        formData.append('answer_key', answerKeyStr);
        
        const response = await fetch(`${API_URL}/api/grade`, {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        setResult(data);
        if (data.status === 'success') {
          setSelectedStudentToSave('');
        }
      }
    } catch (error) {
      console.error("Error grading:", error);
      alert("Terjadi kesalahan: " + error.message);
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  const syncBatchToStudents = (batchData) => {
    const classStudents = students
      .filter(s => s.kelas === selectedClass)
      .sort((a, b) => parseInt(a.absen) - parseInt(b.absen));
      
    if (classStudents.length === 0) {
      setSyncStatus(`Gagal tersinkronisasi: Tidak ada murid yang terdaftar di kelas ${selectedClass}. Silakan isi Data Murid terlebih dahulu.`);
      return;
    }

    let updatedCount = 0;
    
    const updatedStudents = students.map((student) => {
      if (student.kelas !== selectedClass) return student;
      const indexInClass = classStudents.findIndex(s => s.id === student.id);
      
      if (indexInClass !== -1 && indexInClass < batchData.length) {
        const pageResult = batchData[indexInClass].result;
        if (pageResult.status === 'success') {
          updatedCount++;
          return {
            ...student,
            nilai: {
              ...(student.nilai || {}),
              [selectedMapel]: {
                score: pageResult.score,
                details: pageResult.details,
                image_url: pageResult.image_url
              }
            }
          };
        }
      }
      return student;
    });
    
    setStudents(updatedStudents);
    
    if (updatedCount < batchData.length) {
      setSyncStatus(`Berhasil menyinkronkan nilai ${updatedCount} murid. Ada halaman yang error atau jumlah murid di web lebih sedikit dari halaman PDF.`);
    } else {
      setSyncStatus(`Sukses! Nilai telah masuk ke data ${updatedCount} murid di kelas ${selectedClass} (Mapel: ${selectedMapel}).`);
    }
  };

  const handleSaveSingleResult = () => {
    if (!selectedStudentToSave) {
      alert("Silakan pilih nama siswa terlebih dahulu.");
      return;
    }

    const updatedStudents = students.map(s => {
      if (s.id.toString() === selectedStudentToSave) {
        return {
          ...s,
          nilai: {
            ...(s.nilai || {}),
            [selectedMapel]: {
              score: result.score,
              details: result.details,
              image_url: result.image_url
            }
          }
        };
      }
      return s;
    });

    setStudents(updatedStudents);
    setSingleSaveStatus(`Berhasil disimpan ke mapel ${selectedMapel}!`);
    setTimeout(() => setSingleSaveStatus(''), 3000);
  };

  if (Object.keys(mapelKeys).length === 0) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Belum ada Kunci Jawaban</h2>
        <p>Silakan buat Kunci Jawaban di menu "Kunci Jawaban" terlebih dahulu.</p>
      </div>
    );
  }

  if (classesList.length === 0) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Belum ada Kelas</h2>
        <p>Silakan buat Kelas di menu "Data Murid" terlebih dahulu.</p>
      </div>
    );
  }

  const classStudents = students
    .filter(s => s.kelas === selectedClass)
    .sort((a, b) => parseInt(a.absen) - parseInt(b.absen));

  return (
    <div>
      <div className="page-header">
        <h1>Korektor LJK</h1>
        <p>Pilih Kelas dan Mapel sebelum melakukan pemindaian.</p>
      </div>

      <div className="glass-card" style={{ marginBottom: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Kelas (Target Nilai)</h3>
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
        
        <div style={{ flex: 1, minWidth: '150px' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Mata Pelajaran</h3>
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
        
        <div style={{ flex: 1, minWidth: '150px' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>
            <Settings size={18} style={{ verticalAlign: 'middle', marginRight: '5px' }}/> 
            Nilai Maksimal (Jika Benar Semua)
          </h3>
          <input 
            type="number" 
            step="1"
            min="1"
            className="form-control"
            value={maxScore} 
            onChange={(e) => setMaxScore(parseInt(e.target.value) || 0)}
          />
          <small className="text-muted">Poin per soal akan dihitung otomatis.</small>
        </div>
      </div>

      <section className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginBottom: '1rem' }}>Unggah LJK (Gambar atau PDF)</h2>
        
        {!file ? (
          <div 
            className={`upload-area ${dragActive ? "drag-active" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <div className="upload-icon">📄</div>
            <div className="upload-text">Klik atau Tarik file ke sini</div>
            <div className="upload-subtext">Mendukung Gambar (JPG/PNG) & PDF (Untuk 1 Kelas)</div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*, application/pdf" 
              onChange={handleChange} 
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '2rem', borderRadius: '8px' }}>
            {isPdf ? (
              <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '4rem', margin: 0 }}>📑</h1>
                <h3 style={{ marginTop: '1rem' }}>{file.name}</h3>
                <p className="text-muted" style={{ marginTop: '0.5rem' }}>Mode Koreksi Massal (Sesuai Urutan Absen)</p>
              </div>
            ) : (
              <img 
                src={preview} 
                alt="Preview" 
                style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--glass-border)' }} 
              />
            )}
            
            <button 
              onClick={() => { setFile(null); setPreview(null); setResult(null); setBatchResults(null); }}
              style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(239, 68, 68, 0.8)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Hapus File
            </button>
          </div>
        )}

        <button 
          className="btn-primary" 
          onClick={handleGrade}
          disabled={!file || loading}
        >
          {loading ? (
            <span className="loader" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              {progressText || "Sedang Memproses..."}
            </span>
          ) : isPdf ? `Koreksi Massal untuk Kelas ${selectedClass}` : "Koreksi LJK"}
        </button>
      </section>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {syncStatus.includes('Gagal') ? <AlertCircle size={24} color="#f59e0b" /> : <CheckCircle size={24} color="var(--success)" />}
          <p style={{ color: syncStatus.includes('Gagal') ? '#f59e0b' : 'var(--success)', margin: 0, fontWeight: '500' }}>{syncStatus}</p>
        </div>
      )}

      {/* Single Image Result */}
      {result && result.status === 'success' && (
        <section className="glass-card" style={{ marginTop: '2rem' }}>
          <div className="results-header">
            <h2>Hasil Koreksi</h2>
            <div className="score-display">{result.score}</div>
          </div>
          
          {/* Form Simpan Nilai Satuan */}
          <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Save size={20} color="var(--primary-color)" />
              Simpan ke Buku Nilai
            </h3>
            <p className="text-muted" style={{ marginBottom: '1rem' }}>
              Pilih nama siswa dari kelas <b>{selectedClass}</b> untuk menyimpan nilai <b>{result.score}</b> ini ke mata pelajaran <b>{selectedMapel}</b>.
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select 
                className="form-control"
                style={{ flex: 1, minWidth: '200px' }}
                value={selectedStudentToSave}
                onChange={(e) => setSelectedStudentToSave(e.target.value)}
              >
                <option value="" disabled>-- Pilih Nama Siswa --</option>
                {classStudents.length === 0 ? (
                  <option value="" disabled>Belum ada siswa di kelas ini</option>
                ) : (
                  classStudents.map(s => (
                    <option key={s.id} value={s.id} style={{ color: 'black' }}>
                      Absen {s.absen} - {s.nama}
                    </option>
                  ))
                )}
              </select>
              
              <button 
                className="btn-primary" 
                style={{ margin: 0, width: 'auto' }}
                onClick={handleSaveSingleResult}
                disabled={!selectedStudentToSave}
              >
                Simpan Nilai
              </button>
              
              {singleSaveStatus && (
                <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} /> {singleSaveStatus}
                </span>
              )}
            </div>
          </div>

          <div className="results-grid">
            {result.details.map((item) => (
              <div key={item.number} className={`result-item ${item.is_correct ? 'correct' : 'incorrect'}`}>
                <span className="result-num">{item.number}.</span>
                <span className={`result-ans ${item.is_correct ? 'correct' : 'incorrect'}`}>
                  {item.student_answer || '-'}
                </span>
                {!item.is_correct && (
                   <span style={{ fontSize: '0.8rem', color: 'var(--success)', marginLeft: '10px' }}>
                     (Kunci: {item.correct_answer})
                   </span>
                )}
              </div>
            ))}
          </div>

          {result.debug_url && (
            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
              <h3>Debug View (Visualisasi Deteksi AI)</h3>
              <img src={getFullUrl(result.debug_url)} alt="Debug Image" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
            </div>
          )}
        </section>
      )}

      {/* Batch PDF Results */}
      {batchResults && (
        <section className="glass-card" style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Log Hasil PDF</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
            {batchResults.map((item) => {
              const res = item.result;
              const isError = res.error != null;
              
              return (
                <div key={item.page} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: `1px solid ${isError ? 'var(--danger)' : 'var(--success)'}` }}>
                  <h4 style={{ color: 'var(--text-muted)' }}>Hal. {item.page} (Absen {item.page})</h4>
                  {isError ? (
                    <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Gagal dibaca</p>
                  ) : (
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)', marginTop: '0.5rem' }}>
                      {res.score}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {batchResults[0] && batchResults[0].result && batchResults[0].result.debug_url && (
             <div style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
               <h3>Debug View (Halaman 1)</h3>
               <p className="text-muted">Menampilkan hasil deteksi halaman pertama untuk memverifikasi akurasi posisi LJK.</p>
               <img src={getFullUrl(batchResults[0].result.debug_url)} alt={`Page 1`} style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
             </div>
          )}
        </section>
      )}
      
      {result && result.error && (
        <section className="glass-card" style={{ marginTop: '2rem', borderColor: 'var(--danger)' }}>
          <h2 style={{ color: 'var(--danger)' }}>Error</h2>
          <p>{result.error}</p>
        </section>
      )}
    </div>
  );
}
