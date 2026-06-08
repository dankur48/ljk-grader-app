from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import cv2
import numpy as np
import os
import fitz  # PyMuPDF
import uuid
import cloudinary
import cloudinary.uploader
import cloudinary.api
import google.generativeai as genai
from PIL import Image
import json

# Konfigurasi Cloudinary otomatis via environment variable CLOUDINARY_URL
# Jika tidak ada, fungsi upload ke cloudinary akan dilewati
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("scans", exist_ok=True)

@app.get("/api/scans/{filename}")
async def get_scan_image(filename: str):
    filepath = os.path.join("scans", filename)
    if os.path.exists(filepath):
        return FileResponse(filepath)
    return JSONResponse(content={"error": "Image not found"}, status_code=404)

@app.get("/api/debug-image")
async def get_debug_image():
    if os.path.exists("debug.jpg"):
        return FileResponse("debug.jpg")
    return JSONResponse(content={"error": "Debug image not found"}, status_code=404)

def process_ljk(image_bytes, answer_key, points_per_question=5, save_debug=True, save_permanent=True, gemini_api_key=None):
    # Load image
    nparr = np.frombuffer(image_bytes, np.uint8)
    original_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if original_img is None:
        return {"error": "Could not decode image"}

    # Resize to standard width (1200px)
    ratio = 1200.0 / original_img.shape[1]
    img = cv2.resize(original_img, (1200, int(original_img.shape[0] * ratio)))
    debug_img = img.copy()

    # Ekstrak channel merah untuk memisahkan tinta dari kertas dan cetakan merah
    red_channel = img[:, :, 2]
    # Threshold 150: sangat sensitif terhadap tinta pulpen tipis/biru muda
    _, pen_marks = cv2.threshold(red_channel, 150, 255, cv2.THRESH_BINARY_INV)
    
    # Dilate pen marks to make thin 'X' lines thicker and easier to count
    pen_marks = cv2.dilate(pen_marks, np.ones((3,3), np.uint8), iterations=1)

    green_channel = img[:, :, 1]
    green_channel = cv2.GaussianBlur(green_channel, (5, 5), 0)
    _, form_mask = cv2.threshold(green_channel, 160, 255, cv2.THRESH_BINARY_INV)
    
    # Hubungkan garis merah yang terputus karena kualitas foto/cahaya
    kernel = np.ones((7, 7), np.uint8)
    form_mask = cv2.morphologyEx(form_mask, cv2.MORPH_CLOSE, kernel)

    # --- 2. Find the "PILIHAN GANDA" grid ---
    contours, _ = cv2.findContours(form_mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    pilihan_ganda_box = None
    max_bbox_area = 0
    img_h, img_w = img.shape[:2]
    
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        bbox_area = w * h
        # Kotak Pilihan Ganda berada di tengah halaman (25% - 65% dari atas)
        if bbox_area > 30000 and img_h * 0.25 < y < img_h * 0.65:
            aspect_ratio = w / float(h)
            if 2.0 < aspect_ratio < 6.0 and w > img_w * 0.7:
                if bbox_area > max_bbox_area:
                    max_bbox_area = bbox_area
                    pilihan_ganda_box = (x, y, w, h)

    if pilihan_ganda_box is None:
        return {"error": "Tidak dapat menemukan kotak PILIHAN GANDA."}

    x, y, w, h = pilihan_ganda_box
    
    cv2.rectangle(debug_img, (x, y), (x+w, y+h), (255, 0, 0), 3)

    # --- 3. Potong gambar untuk Gemini ---
    margin = 10
    crop_y1 = max(0, y - margin)
    crop_y2 = min(img.shape[0], y + h + margin)
    crop_x1 = max(0, x - margin)
    crop_x2 = min(img.shape[1], x + w + margin)
    
    cropped_img = img[crop_y1:crop_y2, crop_x1:crop_x2]
    
    raw_api_key = os.environ.get("GEMINI_API_KEY")
    api_key = raw_api_key.strip() if raw_api_key else None
    
    results = []
    score = 0
    
    if not api_key:
        return {"error": "API Key Gemini tidak ditemukan. Silakan masukkan API Key Anda di menu aplikasi atau pengaturan server."}
        
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Kirim FULL IMAGE ke Gemini
        pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        
        prompt = """
Anda adalah sistem koreksi ujian otomatis (Grader) berteknologi tinggi.
Saya memberikan gambar PENUH dari sebuah LJK (Lembar Jawaban Komputer). 
Fokuslah pada kotak bagian PILIHAN GANDA (nomor 1 sampai 20) yang letaknya kira-kira di tengah halaman.
Ikuti instruksi berikut dengan sangat teliti:
1. Pindai seluruh area LJK. Abaikan jika sudut pengambilan gambar atau posisi kertas sedikit miring, cari struktur baris nomor soal dan kolom pilihan jawaban (A, B, C, D, atau E).
2. Kenali tanda pilihan siswa baik yang berbentuk silang (X), bulatan penuh, maupun garis miring (/) yang tegas sebagai jawaban yang dipilih.
3. Penanganan Jawaban Ganda: Jika dalam satu nomor terdapat dua tanda pilihan tanpa ada tanda pembatalan yang jelas, langsung kategorikan nomor tersebut sebagai "GANDA".
4. Penanganan Bekas Tipe-x / Coretan: Lakukan analisis visual secara mendalam. Jika ada tanda yang terlihat samar karena dihapus dengan tipe-x atau dicoret-coret sebagai bentuk pembatalan, abaikan tanda tersebut. Ambil pilihan tanda yang paling bersih, tegas, dan merupakan keputusan final siswa.
5. Format Output: Berikan hasil pemeriksaan HANYA dalam format JSON murni yang bersih tanpa teks pengantar, penutup, atau markdown (jangan gunakan ```json). Kunci harus berupa nomor soal (string "1" sampai "20") dan nilai berupa huruf kapital ("A", "B", "C", "D", "E"), "GANDA", atau null jika kosong/ragu.
Contoh output:
{"1": "A", "2": "C", "3": "GANDA", "4": "B", "5": "E", "6": "A", "7": "D", "8": "E", "9": null, "10": "A", "11": "B", "12": "C", "13": "D", "14": "E", "15": "A", "16": "B", "17": "C", "18": "D", "19": "E", "20": "A"}
"""
        response = model.generate_content([prompt, pil_img])
        text_response = response.text.strip()
        
        if text_response.startswith('```json'):
            text_response = text_response[7:-3]
        elif text_response.startswith('```'):
            text_response = text_response[3:-3]
            
        gemini_answers = json.loads(text_response.strip())
        
        # Variabel untuk menghitung posisi huruf di dalam kotak pilihan ganda
        pg_x, pg_y, pg_w, pg_h = pilihan_ganda_box
        cols = 4
        rows_per_col = 5
        col_w = pg_w / cols
        row_h = pg_h / rows_per_col

        for q_num in range(1, 21):
            student_ans = gemini_answers.get(str(q_num))
            correct_ans = answer_key.get(str(q_num), 'A')
            is_correct = (student_ans == correct_ans)
            
            if is_correct and student_ans is not None:
                score += float(points_per_question)
                
            results.append({
                "number": q_num,
                "student_answer": student_ans,
                "correct_answer": correct_ans,
                "is_correct": is_correct
            })

            # Kalkulasi posisi untuk menggambar bukti koreksi di debug_img
            q_idx = q_num - 1
            col = q_idx // rows_per_col
            row = q_idx % rows_per_col
            
            # Header LJK (tulisan PILIHAN GANDA) memakan sekitar 16% dari atas kotak
            header_offset_y = int(pg_h * 0.16)
            effective_h = pg_h - header_offset_y
            row_h_eff = effective_h / rows_per_col
            
            q_x = pg_x + int(col * col_w)
            q_y = pg_y + header_offset_y + int(row * row_h_eff)
            q_w_int = int(col_w)
            q_h_int = int(row_h_eff)
            
            # Pilihan A-E dimulai dari 28% lebar kolom dan memakan 50% lebar
            opt_start_x = q_x + int(q_w_int * 0.28)
            opt_total_w = q_w_int * 0.50
            opt_step_x = opt_total_w / 4.0
            
            # Fungsi kecil untuk menggambar KOTAK berdasarkan huruf (A=0, B=1, dsb)
            def draw_mark(ans_char, color, thickness=2):
                if ans_char in ['A', 'B', 'C', 'D', 'E']:
                    opt_idx = ord(ans_char) - ord('A')
                    center_x = int(opt_start_x + (opt_idx * opt_step_x))
                    center_y = int(q_y + (q_h_int * 0.5))
                    
                    # Hitung batas sudut kiri atas dan kanan bawah untuk kotak
                    half_w = int(opt_step_x * 0.40)
                    half_h = int(q_h_int * 0.35)
                    pt1 = (center_x - half_w, center_y - half_h)
                    pt2 = (center_x + half_w, center_y + half_h)
                    
                    cv2.rectangle(debug_img, pt1, pt2, color, thickness)
                    
            # Selalu gambar lingkaran hijau untuk kunci jawaban
            draw_mark(correct_ans, (0, 255, 0), 3) # Hijau
            
            # Jika jawaban siswa salah dan ada isinya, gambar lingkaran merah
            if not is_correct and student_ans and student_ans in ['A', 'B', 'C', 'D', 'E']:
                draw_mark(student_ans, (0, 0, 255), 2) # Merah

    except Exception as e:
        error_msg = f"Error memproses dengan Gemini: {str(e)}"
        try:
            available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            error_msg += f"\n\n[DIAGNOSTIK] Model yang tersedia untuk Kunci API Anda: {', '.join(available_models)}"
        except Exception as list_e:
            error_msg += f"\n\n[DIAGNOSTIK] Gagal mengambil daftar model: {str(list_e)}"
        return {"error": error_msg}
    debug_base64 = None
    if save_debug:
        # Tampilkan FULL IMAGE yang sudah digambar bukti koreksi
        _, buffer = cv2.imencode('.jpg', debug_img)
        import base64
        b64_str = base64.b64encode(buffer).decode('utf-8')
        debug_base64 = f"data:image/jpeg;base64,{b64_str}"
        
    final_image_url = None
    if save_permanent:
        unique_filename = f"{uuid.uuid4().hex}.jpg"
        local_filepath = os.path.join("scans", unique_filename)
        cv2.imwrite(local_filepath, debug_img)
        
        # Cek apakah terhubung ke Cloudinary (Server Online)
        if os.environ.get("CLOUDINARY_URL"):
            try:
                upload_result = cloudinary.uploader.upload(local_filepath, folder="ljk_scans")
                final_image_url = upload_result.get("secure_url")
                # Hapus file lokal untuk menghemat ruang disk jika sudah di awan
                os.remove(local_filepath)
            except Exception as e:
                print("Cloudinary Upload Error:", e)
                # Fallback ke URL lokal jika gagal
                host_url = os.environ.get("HOST_URL", "http://localhost:8000")
                final_image_url = f"{host_url}/api/scans/{unique_filename}"
        else:
            # Server Lokal
            host_url = os.environ.get("HOST_URL", "http://localhost:8000")
            final_image_url = f"{host_url}/api/scans/{unique_filename}"
        
    results.sort(key=lambda x: x["number"])

    return {
        "status": "success",
        "score": score,
        "details": results,
        "debug_url": debug_base64,
        "image_url": final_image_url
    }

@app.post("/api/grade")
async def grade_ljk(
    file: UploadFile = File(...), 
    answer_key: str = Form(...),
    points_per_question: float = Form(5.0),
    gemini_api_key: str = Form(None)
):
    try:
        import json
        key_dict = json.loads(answer_key)
        
        contents = await file.read()
        
        # Check if it's a PDF
        if file.filename.lower().endswith('.pdf'):
            pdf_document = fitz.open(stream=contents, filetype="pdf")
            batch_results = []
            
            for page_num in range(pdf_document.page_count):
                page = pdf_document.load_page(page_num)
                # Convert PDF page to high-res image (300 DPI)
                pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))
                img_bytes = pix.tobytes("png")
                
                # Only save debug.jpg for the very first page to save IO, but save permanent for ALL pages
                save_debug = (page_num == 0)
                res = process_ljk(img_bytes, key_dict, points_per_question, save_debug=save_debug, save_permanent=True, gemini_api_key=gemini_api_key)
                batch_results.append({
                    "page": page_num + 1,
                    "result": res
                })
                
            return JSONResponse(content={"status": "success", "type": "batch", "batch_results": batch_results})
            
        else:
            # Single Image
            result = process_ljk(contents, key_dict, points_per_question, save_debug=True, save_permanent=True, gemini_api_key=gemini_api_key)
            result["type"] = "single"
            return JSONResponse(content=result)
            
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
