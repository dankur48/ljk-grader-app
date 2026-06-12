import React, { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Settings, CheckCircle, AlertCircle, Save } from 'lucide-react';
import Select from 'react-select';

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
  
  const [file, setFile] = useState([]); // Berubah jadi array
  const [preview, setPreview] = useState([]); // Array of urls
  const [isPdf, setIsPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [results, setResults] = useState([]); // Array of results
  const [batchResults, setBatchResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  
  // State for single save
  const [saveSelections, setSaveSelections] = useState({});
  const [essayScores, setEssayScores] = useState({});
  const [saveStatuses, setSaveStatuses] = useState({});
  
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (selectedFiles) => {
    setResults([]);
    setBatchResults(null);
    setSyncStatus('');
    setSaveStatuses({});
    setSaveSelections({});
    setEssayScores({});
    
    // Jika ada PDF, gunakan PDF saja
    const pdfFile = selectedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      setFile([pdfFile]);
      setIsPdf(true);
      setPreview([]);
    } else {
      // Ambil maksimal 10 file gambar
      const imgFiles = selectedFiles.slice(0, 10);
      setFile(imgFiles);
      setIsPdf(false);
      setPreview(imgFiles.map(f => URL.createObjectURL(f)));
    }
  };

  const handleGrade = async () => {
    if (file.length === 0 || !selectedMapel || !selectedClass) {
      alert("Pastikan Anda sudah memilih Kelas, Mata Pelajaran, dan mengunggah file.");
      return;
    }
    
    setLoading(true);
    setProgressText('Mempersiapkan data...');
    setSyncStatus('');
    setSaveStatuses({});
    
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
        splitFormData.append('file', file[0]);
        
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
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout
              
              const gradeRes = await fetch(`${API_URL}/api/grade-path`, {
                method: 'POST',
                body: gradeFormData,
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
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
              if (e.name === 'AbortError') {
                 console.error(`Timeout on page ${i+1}`);
              }
              
              if (e.message && e.message.includes("429")) {
                setProgressText(`Limit Google tercapai. Jeda otomatis 30 detik... (LJK ${i+1}/${pages.length})`);
                await new Promise(r => setTimeout(r, 30000));
                setProgressText(`Melanjutkan koreksi LJK ${i + 1} dari ${pages.length}...`);
              } else if (attempt === 3) {
                 batchResArr.push({ page: i + 1, result: { error: "Gagal memproses setelah 3 percobaan (Koneksi bermasalah/Timeout)." } });
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
        let resArr = [];
        for (let i = 0; i < file.length; i++) {
          setProgressText(file.length > 1 ? `Menganalisis LJK ${i + 1} dari ${file.length}...` : 'Menganalisis LJK...');
          const formData = new FormData();
          formData.append('file', file[i]);
          formData.append('points_per_question', pointsPerQuestion);
          formData.append('answer_key', answerKeyStr);
          
          try {
            const response = await fetch(`${API_URL}/api/grade`, {
              method: 'POST',
              body: formData,
            });
            const data = await response.json();
            resArr.push(data);
          } catch (err) {
            resArr.push({ error: err.message });
          }
          
          // Beri jeda 2 detik antar gambar untuk mencegah rate limit
          if (i < file.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        setResults(resArr);
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
    setStudents(prevStudents => {
      const classStudents = prevStudents
        .filter(s => s.kelas === selectedClass)
        .sort((a, b) => parseInt(a.absen) - parseInt(b.absen));
        
      if (classStudents.length === 0) {
        setSyncStatus(`Gagal tersinkronisasi: Tidak ada murid yang terdaftar di kelas ${selectedClass}. Silakan isi Data Murid terlebih dahulu.`);
        return prevStudents;
      }

      let updatedCount = 0;
      
      const updatedStudents = prevStudents.map((student) => {
        if (student.kelas !== selectedClass) return student;
        const indexInClass = classStudents.findIndex(s => s.id === student.id);
        
        if (indexInClass !== -1 && indexInClass < batchData.length) {
          const pageResult = batchData[indexInClass].result;
          if (pageResult && pageResult.status === 'success') {
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
      
      if (updatedCount === 0) {
        setSyncStatus(`Gagal! Dari ${batchData.length} halaman, tidak ada satu pun yang berhasil masuk ke data murid. Pastikan Nomor Absen sudah urut dan Kelas benar.`);
      } else if (updatedCount < batchData.length) {
        setSyncStatus(`Berhasil menyinkronkan nilai ${updatedCount} murid. Ada halaman yang error atau jumlah murid di web lebih sedikit dari halaman PDF.`);
      } else {
        setSyncStatus(`Sukses! Nilai telah masuk ke data ${updatedCount} murid di kelas ${selectedClass} (Mapel: ${selectedMapel}).`);
      }

      return updatedStudents;
    });
  };

  const handleSaveSingleResult = (index) => {
    const studentId = saveSelections[index];
    const eScore = essayScores[index] || 0;
    const res = results[index];
    if (!studentId || !res) return;
    
    setStudents(prev => prev.map(s => {
      if (s.id.toString() === studentId.toString()) {
        return {
          ...s,
          nilai: {
            ...(s.nilai || {}),
            [selectedMapel]: {
              score_pg: res.score,
              score_essay: parseFloat(eScore),
              score: (parseFloat(res.score) || 0) + parseFloat(eScore),
              details: res.details,
              image_url: res.image_url
            }
          }
        };
      }
      return s;
    }));
    
    setSaveStatuses(prev => ({ ...prev, [index]: 'Tersimpan!' }));
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
        
        {!file || file.length === 0 ? (
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
              accept="image/*, .pdf" 
              multiple
              onChange={handleChange} 
              style={{ display: 'none' }}
              id="file-upload"
            />
          </div>
        ) : (
          <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '2rem', borderRadius: '8px' }}>
            {isPdf ? (
              <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '4rem', margin: 0 }}>📑</h1>
                <h3 style={{ marginTop: '1rem' }}>{file[0].name}</h3>
                <p className="text-muted" style={{ marginTop: '0.5rem' }}>Mode Koreksi Massal (Sesuai Urutan Absen)</p>
              </div>
            ) : (
              <div style={{ position: 'relative', marginTop: '1rem', display: 'flex', gap: '1rem', overflowX: 'auto', padding: '1rem 0' }}>
                {preview.map((p, idx) => (
                  <img key={idx} src={p} alt={`Preview ${idx}`} style={{ height: '250px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'black' }} />
                ))}
              </div>
            )}
            
            <button 
              onClick={() => { setFile([]); setPreview([]); setResults([]); setBatchResults(null); }}
              style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(239, 68, 68, 0.8)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Hapus File
            </button>
          </div>
        )}

        <button 
          className="btn-primary" 
          onClick={handleGrade}
          disabled={file.length === 0 || loading}
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

      {/* Single Image Results */}
      {results && results.length > 0 && results.map((res, index) => {
        if (res.error) {
          return (
            <div key={index} style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px' }}>
              <h3 style={{ color: 'var(--danger)', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={20} />
                Koreksi Gagal (Gambar {index + 1})
              </h3>
              <p style={{ margin: 0, color: 'var(--text-color)', lineHeight: '1.5' }}>{res.error}</p>
            </div>
          );
        }
        
        if (res.status === 'success') {
          return (
            <section key={index} className="glass-card" style={{ marginTop: '2rem' }}>
              <div className="results-header">
                <h2>Hasil Koreksi (Gambar {index + 1})</h2>
                <div className="score-display">{res.score}</div>
              </div>
              
              {/* Form Simpan Nilai Satuan */}
              <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Save size={20} color="var(--primary-color)" />
                  Simpan ke Buku Nilai
                </h3>
                <p className="text-muted" style={{ marginBottom: '1rem' }}>
                  Pilih nama siswa dari kelas <b>{selectedClass}</b> untuk menyimpan nilai <b>{res.score}</b> ini ke mata pelajaran <b>{selectedMapel}</b>.
                </p>
                
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '250px' }}>
                    <Select
                      options={classStudents.map(s => {
                        const hasGrade = s.nilai && s.nilai[selectedMapel] !== undefined;
                        return {
                          value: s.id,
                          label: `${hasGrade ? '✅ ' : ''}Absen ${s.absen} - ${s.nama} ${hasGrade ? `(Telah Dinilai: ${s.nilai[selectedMapel].score})` : ''}`
                        };
                      })}
                      value={saveSelections[index] ? {
                        value: saveSelections[index],
                        label: (() => {
                          const s = classStudents.find(stu => stu.id.toString() === saveSelections[index].toString());
                          if (!s) return '';
                          const hasGrade = s.nilai && s.nilai[selectedMapel] !== undefined;
                          return `${hasGrade ? '✅ ' : ''}Absen ${s.absen} - ${s.nama} ${hasGrade ? `(Telah Dinilai: ${s.nilai[selectedMapel].score})` : ''}`;
                        })()
                      } : null}
                      onChange={(selectedOption) => setSaveSelections(prev => ({ ...prev, [index]: selectedOption ? selectedOption.value : '' }))}
                      placeholder="🔍 Ketik atau Pilih Nama Siswa..."
                      isSearchable={true}
                      isClearable={true}
                      noOptionsMessage={() => "Tidak ada siswa ditemukan"}
                      styles={{
                        control: (baseStyles, state) => ({
                          ...baseStyles,
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderColor: state.isFocused ? 'var(--primary-color)' : 'var(--glass-border)',
                          color: 'var(--text-color)',
                          boxShadow: state.isFocused ? '0 0 0 1px var(--primary-color)' : 'none',
                          '&:hover': {
                            borderColor: 'var(--primary-color)'
                          }
                        }),
                        singleValue: (baseStyles) => ({
                          ...baseStyles,
                          color: 'white',
                        }),
                        input: (baseStyles) => ({
                          ...baseStyles,
                          color: 'white',
                        }),
                        menu: (baseStyles) => ({
                          ...baseStyles,
                          backgroundColor: '#1e1e2d',
                          border: '1px solid var(--glass-border)',
                          zIndex: 100
                        }),
                        option: (baseStyles, state) => ({
                          ...baseStyles,
                          backgroundColor: state.isFocused ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                          color: 'white',
                          '&:active': {
                            backgroundColor: 'rgba(59, 130, 246, 0.4)'
                          }
                        }),
                      }}
                    />
                  </div>
                  
                  <input 
                    type="number" 
                    placeholder="Nilai Essay (Opsional)" 
                    className="form-control"
                    style={{ width: '180px', margin: 0 }}
                    value={essayScores[index] || ''}
                    onChange={(e) => setEssayScores(prev => ({ ...prev, [index]: e.target.value }))}
                  />
                  
                  <button 
                    className="btn-primary" 
                    style={{ margin: 0, width: 'auto' }}
                    onClick={() => handleSaveSingleResult(index)}
                    disabled={!saveSelections[index]}
                  >
                    Simpan Nilai
                  </button>
                  
                  {saveStatuses[index] && (
                    <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle size={16} /> {saveStatuses[index]}
                    </span>
                  )}
                </div>
              </div>

              <div className="results-grid">
                {res.details.map((item) => (
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

              {res.debug_url && (
                <div style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                  <h3>Debug View (Visualisasi Deteksi AI)</h3>
                  <img src={getFullUrl(res.debug_url)} alt="Debug Image" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
                </div>
              )}
            </section>
          );
        }
        return null;
      })}

      {/* Batch PDF Results */}
      {batchResults && (
        <section className="glass-card" style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Log Hasil PDF</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
            {batchResults.map((item, idx) => {
              const isErr = !!item.result.error;
              return (
                <div key={idx} style={{ padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isErr ? 'var(--danger)' : 'var(--success)'}`, background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Hal. {item.page} (Absen {idx + 1})</div>
                  {isErr ? (
                    <div style={{ color: 'var(--danger)', fontSize: '0.75rem', overflowWrap: 'break-word' }}>{item.result.error}</div>
                  ) : (
                    <div style={{ color: 'var(--success)', fontSize: '0.8rem' }}>Skor: {item.result.score}</div>
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
      
      {/* (Removed old single error) */}
    </div>
  );
}
