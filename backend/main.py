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

def process_ljk(image_bytes, answer_key, points_per_question=5, save_debug=True, save_permanent=True):
    # Load image
    nparr = np.frombuffer(image_bytes, np.uint8)
    original_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if original_img is None:
        return {"error": "Could not decode image"}

    # Resize to standard width (1200px)
    ratio = 1200.0 / original_img.shape[1]
    img = cv2.resize(original_img, (1200, int(original_img.shape[0] * ratio)))
    debug_img = img.copy()

    # --- 1. Color Separation ---
    red_channel = img[:, :, 2]
    red_channel = cv2.GaussianBlur(red_channel, (5, 5), 0)
    _, pen_marks = cv2.threshold(red_channel, 130, 255, cv2.THRESH_BINARY_INV)

    green_channel = img[:, :, 1]
    green_channel = cv2.GaussianBlur(green_channel, (5, 5), 0)
    _, form_mask = cv2.threshold(green_channel, 160, 255, cv2.THRESH_BINARY_INV)

    # --- 2. Find the "PILIHAN GANDA" grid ---
    contours, _ = cv2.findContours(form_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    best_box = None
    candidate_boxes = []
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area > 40000: # large contour
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / h
            if 1.5 < aspect_ratio < 6.0:
                candidate_boxes.append((x, y, w, h))
                
    if candidate_boxes:
        # Sort by Y coordinate (top to bottom)
        candidate_boxes.sort(key=lambda b: b[1])
        best_box = candidate_boxes[0]

    if best_box is None:
        return {"error": "Tidak dapat menemukan kotak PILIHAN GANDA."}

    x, y, w, h = best_box
    
    cv2.rectangle(debug_img, (x, y), (x+w, y+h), (255, 0, 0), 3)

    # --- 3. Geometric Slicing ---
    header_offset = int(h * 0.12)
    grid_y = y + header_offset
    grid_h = h - header_offset
    
    cv2.line(debug_img, (x, grid_y), (x+w, grid_y), (255, 255, 0), 2)

    col_w = w // 4
    row_h = grid_h // 5
    
    results = []
    score = 0
    options_letters = ['A', 'B', 'C', 'D', 'E']
    
    for col in range(4):
        cv2.line(debug_img, (x + col*col_w, y), (x + col*col_w, y+h), (255, 255, 0), 2)
        
        for row in range(5):
            q_num = col * 5 + row + 1
            if q_num > 20:
                continue
                
            cell_x = x + (col * col_w)
            cell_y = grid_y + (row * row_h)
            
            opt_start_x = cell_x + int(col_w * 0.25)
            opt_area_w = int(col_w * 0.70)
            opt_w = opt_area_w // 5
            
            pixel_counts = []
            for opt_idx in range(5):
                opt_x = opt_start_x + (opt_idx * opt_w)
                margin = 5
                roi_x1 = opt_x + margin
                roi_y1 = cell_y + margin
                roi_x2 = opt_x + opt_w - margin
                roi_y2 = cell_y + row_h - margin
                
                roi_x2 = min(roi_x2, img.shape[1])
                roi_y2 = min(roi_y2, img.shape[0])
                
                cv2.rectangle(debug_img, (roi_x1, roi_y1), (roi_x2, roi_y2), (0, 255, 0), 1)
                
                opt_roi = pen_marks[roi_y1:roi_y2, roi_x1:roi_x2]
                pixels = cv2.countNonZero(opt_roi)
                pixel_counts.append(pixels)
            
            max_pixels = max(pixel_counts)
            student_ans = None
            
            if max_pixels > 30:
                best_opt_idx = pixel_counts.index(max_pixels)
                student_ans = options_letters[best_opt_idx]
                
                chosen_x = opt_start_x + (best_opt_idx * opt_w) + margin
                # Kotak merah tua untuk jawaban siswa
                cv2.rectangle(debug_img, (chosen_x, cell_y + margin), (chosen_x + opt_w - margin*2, cell_y + row_h - margin), (0, 0, 255), 3)

            correct_ans = answer_key.get(str(q_num), 'A')
            is_correct = (student_ans == correct_ans)
            
            # Jika jawaban salah atau kosong, gambar kotak HIJAU di posisi jawaban yang benar
            if not is_correct:
                if correct_ans in options_letters:
                    correct_opt_idx = options_letters.index(correct_ans)
                    correct_x = opt_start_x + (correct_opt_idx * opt_w) + margin
                    # Kotak hijau tebal untuk kunci jawaban
                    cv2.rectangle(debug_img, (correct_x, cell_y + margin), (correct_x + opt_w - margin*2, cell_y + row_h - margin), (0, 255, 0), 3)
            
            if is_correct:
                score += float(points_per_question)
                
            results.append({
                "number": q_num,
                "student_answer": student_ans,
                "correct_answer": correct_ans,
                "is_correct": is_correct
            })

    if save_debug:
        cv2.imwrite("debug.jpg", debug_img)
        
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
        "debug_url": f"{os.environ.get('HOST_URL', 'http://localhost:8000')}/api/debug-image" if save_debug else None,
        "image_url": final_image_url
    }

@app.post("/api/grade")
async def grade_ljk(
    file: UploadFile = File(...), 
    answer_key: str = Form(...),
    points_per_question: float = Form(5.0)
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
                res = process_ljk(img_bytes, key_dict, points_per_question, save_debug=save_debug, save_permanent=True)
                batch_results.append({
                    "page": page_num + 1,
                    "result": res
                })
                
            return JSONResponse(content={"status": "success", "type": "batch", "batch_results": batch_results})
            
        else:
            # Single Image
            result = process_ljk(contents, key_dict, points_per_question, save_debug=True, save_permanent=True)
            result["type"] = "single"
            return JSONResponse(content=result)
            
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
