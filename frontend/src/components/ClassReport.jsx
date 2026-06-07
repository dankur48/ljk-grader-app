import React, { forwardRef } from 'react';

const ClassReport = forwardRef(({ students, selectedClass, selectedMapel }, ref) => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const getFullUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://localhost:8000')) return url.replace('http://localhost:8000', API_URL);
    if (url.startsWith('/')) return `${API_URL}${url}`;
    return url;
  };

  const classStudents = students
    .filter(s => s.kelas === selectedClass)
    .sort((a, b) => parseInt(a.absen) - parseInt(b.absen));

  if (!selectedClass || !selectedMapel || classStudents.length === 0) {
    return <div ref={ref}></div>;
  }

  return (
    <div ref={ref} className="print-container" style={{ padding: '2cm', background: 'white', color: 'black' }}>
      {/* CSS untuk memisahkan halaman saat dicetak */}
      <style type="text/css" media="print">
        {`
          @page { size: A4; margin: 0; }
          .page-break { page-break-before: always; }
          body { background: white !important; }
        `}
      </style>

      {classStudents.map((student, index) => {
        const nilaiData = student.nilai?.[selectedMapel];
        const score = typeof nilaiData === 'object' && nilaiData !== null ? nilaiData.score : (nilaiData || 0);
        const details = typeof nilaiData === 'object' && nilaiData !== null ? nilaiData.details : [];
        const imageUrl = typeof nilaiData === 'object' && nilaiData !== null ? nilaiData.image_url : null;

        return (
          <div key={student.id} className={index > 0 ? "page-break" : ""} style={{ minHeight: '29.7cm', paddingBottom: '2cm' }}>
            {/* Header Laporan */}
            <div style={{ borderBottom: '2px solid black', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h1 style={{ fontSize: '24px', margin: '0 0 10px 0', color: 'black' }}>Laporan Hasil Pemindaian LJK</h1>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px', fontSize: '14px' }}>
                  <strong>Nama:</strong> <span>{student.nama}</span>
                  <strong>No. Absen:</strong> <span>{student.absen}</span>
                  <strong>Kelas:</strong> <span>{student.kelas}</span>
                  <strong>Mata Pelajaran:</strong> <span>{selectedMapel}</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', border: '2px solid black', padding: '10px 20px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold' }}>NILAI AKHIR</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: score >= 75 ? 'green' : 'red' }}>{score}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem' }}>
              {/* Gambar Scan */}
              <div style={{ flex: 2 }}>
                <h3 style={{ fontSize: '16px', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '15px' }}>Bukti Pindai Kertas</h3>
                {imageUrl ? (
                  <img src={getFullUrl(imageUrl)} alt="Scan LJK" style={{ width: '100%', border: '1px solid #eee', borderRadius: '4px' }} />
                ) : (
                  <div style={{ padding: '2rem', background: '#f5f5f5', textAlign: 'center', color: '#666', border: '1px dashed #ccc' }}>
                    Gambar hasil pindai belum tersedia untuk siswa ini.
                  </div>
                )}
              </div>

              {/* Rincian Jawaban */}
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '15px' }}>Rincian Jawaban</h3>
                {details && details.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f0f0f0' }}>
                        <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>No</th>
                        <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>Siswa</th>
                        <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>Kunci</th>
                        <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>Hasil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.map((item) => (
                        <tr key={item.number}>
                          <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>{item.number}</td>
                          <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>{item.student_answer || '-'}</td>
                          <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center', color: '#666' }}>{item.correct_answer}</td>
                          <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center', fontWeight: 'bold', color: item.is_correct ? 'green' : 'red' }}>
                            {item.is_correct ? '✓' : '✗'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: '#666', fontSize: '12px' }}>Belum ada rincian jawaban.</p>
                )}
              </div>
            </div>
            
            <div style={{ marginTop: '30px', fontSize: '10px', color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '10px' }}>
              Dokumen ini dicetak otomatis dari sistem AutoGrader LJK.
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default ClassReport;
