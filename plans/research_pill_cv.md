# Research: Pill Counting với Computer Vision

## 0. Bài toán gốc

**Mục tiêu app:**
- User upload ảnh chứa nhiều viên thuốc
- App: đếm số lượng viên thuốc, vẽ bounding box quanh từng viên, đánh số thứ tự

**KHÔNG cần:**
- Nhận dạng tên thuốc
- OCR
- Classification loại thuốc

---

## 1. Bản chất bài toán

Ban đầu, nếu chưa có constraint nào, bài toán là:

**Object Detection + Counting**

Vì hệ thống cần:
- Tìm object
- Xác định vị trí
- Đếm số lượng

**Tại sao không phải Classification?**
- Classification chỉ trả lời: "ảnh này là gì?" → không biết có bao nhiêu object, nằm ở đâu
- Detection: "có bao nhiêu object và chúng nằm ở đâu?" → bounding boxes + count

**Insight:** Detection thực chất = Localization + Classification

---

## 2. Nếu bài toán hoàn toàn tổng quát (uncontrolled environment)

Ví dụ: background random, ánh sáng random, overlap mạnh, user chụp tùy ý, nhiều loại thuốc khác nhau

→ **Deep Learning sẽ được ưu tiên**

### YOLO (YOLOv8, YOLO11, YOLO26)

**Vì sao phù hợp:**
- Học semantic meaning từ data
- Robust với: lighting, texture, background variation, perspective

**Nhược điểm:**
- Cần dataset
- Cần fine-tune
- Nặng hơn
- Cần GPU nếu realtime

**Lưu ý về naming convention (2025):**
- Ultralytics đã bỏ prefix "v" → YOLO11 (không phải YOLOv11)
- YOLO12 (Feb 2025): attention-centric, nhưng **không ổn định cho production** (training instability, cao memory, chậm CPU 2-3x)
- **YOLO26**: model mới nhất, NMS-free, recommended cho production
- YOLO11 vẫn là lựa chọn ổn định nhất hiện tại

---

## 3. Deep Learning vs OpenCV — khác nhau bản chất

| OpenCV | YOLO |
|--------|------|
| Rule-based | Learned |
| Không cần train | Cần train/fine-tune |
| Nhẹ | Nặng |
| CPU OK | GPU tốt hơn |
| Fragile (controlled env) | Robust (uncontrolled env) |
| Rất mạnh trong controlled environment | Mạnh trong uncontrolled environment |

---

## 4. Khi thêm constraint đầu tiên

**Constraint:** nền đơn giản, viên thuốc không overlap, cùng mặt phẳng, chỉ chạm viền nhau

Bài toán thay đổi từ **general object detection** → **blob / shape separation**

→ Không cần AI semantic understanding mạnh, chỉ cần tách các vùng object riêng biệt

---

## 5. OpenCV bắt đầu trở thành hướng ưu tiên

Vì: background clean, object predictable, lighting có thể kiểm soát

**Classical CV cực mạnh trong:**
- Industrial vision
- Coin counting
- **Pill counting**
- Screw counting

---

## 6. Segmentation là gì?

**Segmentation:** Chia ảnh thành các vùng/object khác nhau.

| Detection | Segmentation |
|-----------|--------------|
| Bounding boxes | Pixel masks |
| Approximate location | Precise object pixels |

**Insight:** Dù output chỉ là bounding box, internally vẫn cần region separation → Detection thường vẫn dùng "segmentation thinking" internally.

---

## 7. Watershed là gì?

**Watershed:** Thuật toán segmentation cổ điển, dùng để tách object đang dính nhau.

**Ý tưởng:** Xem ảnh như bản đồ địa hình → "đổ nước" → tìm boundary giữa các vùng.

### Classical vs Marker-based Watershed

**Classical watershed:**
- Có vấn đề **over-segmentation** do noise
- Tạo quá nhiều vùng nhỏ không mong muốn

**Marker-based watershed** (OpenCV implement):
- Chỉ định trước: foreground, background, unknown
- Algorithm chỉ quyết định vùng unknown
- Kết quả segmentation tốt hơn nhiều

### Pipeline Watershed đầy đủ (quan trọng)

```
1. Threshold → binary image
2. Morphology cleanup (opening để remove noise, closing để fill holes)
3. Distance Transform (tính khoảng cách từ mỗi foreground pixel đến background gần nhất)
4. Threshold distance map → sure foreground
5. Dilate → sure background
6. sure_bg - sure_fg = unknown region
7. Connected Components trên sure_fg → markers
8. markers[unknown == 255] = 0
9. cv2.watershed(img, markers)
10. Boundary pixels được đánh dấu = -1
```

**⚠️ Correction:** Discussion gốc mô tả Watershed quá đơn giản. Distance Transform là **bước critical** — không có nó watershed không hoạt động đúng.

---

## 8. Insight tiếp theo

Mày chỉ cần bounding boxes → **KHÔNG cần full segmentation output**

Bài toán thực chất: **Region Separation + Bounding Box Extraction**

---

## 9. Constraint: viên thuốc mostly tròn/ellipse

Giúp OpenCV dùng: contour geometry, ellipse fitting, circularity, aspect ratio

### Circularity (đã verify)

**Công thức chuẩn:**
```
Circularity = (4π × Area) / Perimeter²
```

- Circle = 1.0
- Giá trị càng nhỏ → càng không tròn

**Trong OpenCV:**
```python
area = cv2.contourArea(cnt)
perimeter = cv2.arcLength(cnt, True)
circularity = (4 * np.pi * area) / (perimeter ** 2)
```

**Hoặc dùng Roundness (compactness):**
```python
roundness = (perimeter ** 2) / (4 * np.pi * area)
# Circle = 1.0, giá trị càng lớn → càng không tròn
```

**Các contour properties khác trong OpenCV:**
- **Aspect Ratio:** `w / h` (boundingRect)
- **Extent:** `contourArea / boundingRectArea`
- **Solidity:** `contourArea / convexHullArea`
- **Equivalent Diameter:** `√(4 × Area / π)`
- **Eccentricity:** từ `fitEllipse()` hoặc moments

---

## 10. Constraint: tất cả viên thuốc cùng một loại

Bài toán shift từ **object recognition** → **repeated shape counting**

**Shape consistency:** size gần giống nhau, contour giống nhau, aspect ratio giống nhau

**Hệ quả:**
- Hardcode heuristics
- Estimate merged pills (nếu blob area ≈ 2× single pill area → 2 pills)
- Reject abnormal contours

---

## 11. Insight cực kỳ quan trọng

Bài toán hiện tại **KHÔNG** còn là "What is this object?" mà là **"How many repeated blobs exist?"**

→ Classical CV cực mạnh cho loại bài toán này.

---

## 12. Vai trò của Image Acquisition

**Setup camera quan trọng hơn model:**

| Yếu tố | Khuyến nghị |
|---------|-------------|
| Background | Matte black hoặc green screen (tương phản mạnh) |
| Lighting | Diffuse light, tránh shadow mạnh |
| Camera | Fixed distance, fixed angle |

**Vì sao?** Threshold dễ hơn, contour clean hơn, segmentation dễ hơn.

### Green Screen Approach (từ research)

Nhiều implementation dùng **green background** + HSV color segmentation:
- Convert sang HSV
- Mask vùng green → background
- Invert → foreground (pills)
- Rồi mới apply contour/watershed

→ Đây là cách đơn giản và robust nhất nếu kiểm soát được background.

---

## 13. Research về thị trường thực tế

### Commercial systems
- Pharmacy automation, medicine dispensing
- Thường dùng: **Classical CV + AI hybrid**
- Trong controlled environment: Classical CV đủ mạnh, nhanh hơn, dễ debug hơn

### Open-source implementations tìm thấy

1. **celankannan/Pill-Detection** (GitHub)
   - Green background + HSV segmentation + Watershed + Connected Components
   - Chỉ hoạt động với flat pills, không handle glossy/reflective

2. **Rishita-Rao/Automatic-pill-counter** (GitHub)
   - Super resolution (EDSR) + Pyramid mean shift filtering
   - Auto-detect background color → chọn threshold method
   - Distance Transform + Watershed

3. **Stack Overflow discussions**
   - CLAHE (Contrast Limited Adaptive Histogram Equalization) cho contrast enhancement
   - Adaptive thresholding cho varying lighting
   - Hough Circle Transform cho round pills

### Pre-trained Models

1. **SARANGx/rtdetr-pill-detector** (Hugging Face)
   - RT-DETR R18 (Real-Time Detection Transformer)
   - 316 training images, 9 classes
   - NMS-free architecture
   - 20M parameters, fast inference on CPU
   - **Limitation:** Chỉ tốt trên ảnh tương tự training data (top-down, clean background)

2. **Roboflow Universe** — nhiều datasets:
   - Pills Detection (696 images)
   - YOLOpills dataset
   - medication-pills (173 images)
   - Hỗ trợ export cho YOLOv5/v8/v9/v11/v12

**⚠️ Domain shift issue:** Pre-trained models accuracy giảm khi lighting, camera, background khác training data.

---

## 14. Edge Cases cần xử lý

| Edge case | Mô tả | Xử lý |
|-----------|-------|-------|
| Translucent/glossy pills | Phản chiếu ánh sáng → contour bị lỗi | Cần controlled lighting, matte surface |
| Different colored pills | Cùng ảnh có nhiều màu | HSV color segmentation hoặc adaptive threshold |
| Touching pills | Viên thuốc chạm nhau | Watershed + Distance Transform |
| Overlapping pills | Viên chồng lên nhau | Khó hơn nhiều, cần perspective/3D hoặc accept limitation |
| Shadow | Bóng đổ dưới viên thuốc | Diffuse lighting, hoặc morphology để remove |
| Camera distance | Khoảng cách khác nhau → size khác nhau | Fixed distance hoặc normalize theo reference object |

---

## 15. Kết luận cuối cùng

### Nếu bài toán hoàn toàn general-purpose
→ YOLO, Deep Learning, fine-tuning

### Khi thêm dần constraint:
- Nền đơn giản
- Không overlap
- Cùng mặt phẳng
- Touching only
- Mostly round/ellipse
- Cùng loại thuốc

→ **Classical Computer Vision** (OpenCV) là phù hợp nhất

---

## 16. Pipeline đề xuất cuối cùng

### Option A: Controlled Background (đơn giản nhất)

```
1. Image acquisition (green/black background, fixed camera)
2. HSV color segmentation → mask pills
3. Morphology cleanup
4. Connected Components
5. Contour filtering (area, circularity, aspect ratio)
6. Bounding boxes
7. Count
```

### Option B: General Background (linh hoạt hơn)

```
1. Image acquisition
2. Grayscale
3. CLAHE (contrast enhancement)
4. Adaptive Threshold hoặc Otsu
5. Morphology cleanup (opening + closing)
6. Distance Transform
7. Threshold distance → sure foreground
8. Dilate → sure background
9. Connected Components → markers
10. Watershed
11. Contour filtering (area, circularity, solidity)
12. Bounding boxes
13. Count
```

### Option C: Hybrid (nếu CV không đủ)

```
1. Pre-trained model (RT-DETR hoặc YOLO fine-tuned)
2. Hoặc: Classical CV + heuristic fallback
```

---

## 17. OpenCV Functions cần dùng

| Function | Purpose |
|----------|---------|
| `cv2.cvtColor()` | BGR → Gray, BGR → HSV |
| `cv2.GaussianBlur()` | Noise reduction |
| `cv2.medianBlur()` | Salt-and-pepper noise |
| `cv2.threshold()` | Global thresholding (Otsu) |
| `cv2.adaptiveThreshold()` | Varying lighting conditions |
| `cv2.createCLAHE()` | Contrast enhancement |
| `cv2.morphologyEx()` | MORPH_OPEN, MORPH_CLOSE |
| `cv2.erode()` | Remove boundary pixels |
| `cv2.dilate()` | Expand object boundary |
| `cv2.distanceTransform()` | Distance to nearest background pixel |
| `cv2.connectedComponents()` | Label connected regions |
| `cv2.watershed()` | Marker-based segmentation |
| `cv2.findContours()` | Extract contours |
| `cv2.contourArea()` | Calculate area |
| `cv2.arcLength()` | Calculate perimeter |
| `cv2.boundingRect()` | Get bounding box |
| `cv2.minEnclosingCircle()` | Get enclosing circle |
| `cv2.fitEllipse()` | Fit ellipse to contour |
| `cv2.convexHull()` | Get convex hull |
| `cv2.drawContours()` | Draw contours/bounding boxes |

---

## 18. Alternative: Hough Circle Transform

Nếu viên thuốc **chắc chắn tròn**, có thể dùng `cv2.HoughCircles()`:
- Detect circles trực tiếp
- Không cần watershed
- Đơn giản hơn
- Nhưng chỉ hoạt động tốt với hình tròn rõ ràng

```python
circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, dp=1, minDist=50,
                           param1=200, param2=100, minRadius=20, maxRadius=100)
count = len(circles[0]) if circles is not None else 0
```

---

## 19. Tóm tắt: Khi nào dùng gì?

| Scenario | Approach |
|----------|----------|
| Controlled background + round pills | Hough Circles hoặc Contour Analysis |
| Controlled background + mixed shapes | Watershed + Contour filtering |
| Varying lighting | Adaptive Threshold + CLAHE |
| Green/black background | HSV color segmentation |
| Uncontrolled environment | YOLO/Deep Learning + fine-tune |
| Touching pills | Distance Transform + Watershed |
| Overlapping pills | Deep Learning (classical CV khó handle) |

---

## 20. References

- OpenCV Watershed Tutorial: https://docs.opencv.org/4.x/d3/db4/tutorial_py_watershed.html
- OpenCV Distance Transform: https://docs.opencv.org/4.x/d2/dbd/tutorial_distance_transform.html
- OpenCV Contour Properties: https://docs.opencv.org/4.x/d1/d32/tutorial_py_contour_properties.html
- Pill Detection (GitHub): https://github.com/celankannan/Pill-Detection
- Auto Pill Counter (GitHub): https://github.com/Rishita-Rao/Automatic-pill-counter
- RT-DETR Pill Detector: https://huggingface.co/SARANGx/rtdetr-pill-detector
- Roboflow Pills Dataset: https://universe.roboflow.com/yolopills-vmabw/pills-4xqlr
- Circularity Formula (ScienceDirect): https://www.sciencedirect.com/science/article/abs/pii/S0031320309002660
- YOLO11 Docs: https://github.com/ultralytics/ultralytics/tree/main/docs/en/models/yolo11.md
- YOLO12 Docs: https://docs.ultralytics.com/models/yolo12
