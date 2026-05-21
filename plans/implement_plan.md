# Implementation Plan: Pill Counter — OpenCV Pipeline

## Mục tiêu

Thay thế AI vision model (OpenRouter) bằng OpenCV server-side processing. Giữ nguyên Next.js app, chỉ đổi logic đếm ở `app/api/count/route.ts`.

**Constraint quan trọng:** 90%+ viên thuốc sẽ chạm nhau → pipeline mặc định PHẢI xử lý touching pills.

---

## 1. Tech Choice: `@techstark/opencv-js`

**Lý do chọn:**
- Pure WASM, `pnpm add` xong chạy được ngay — không cần cmake, node-gyp, native deps
- OpenCV 4.12.0, 100K+ weekly downloads, actively maintained
- Chạy được trong Node.js (Next.js API route)

**Install:**
```bash
pnpm add @techstark/opencv-js jimp
```

**Hạn chế & workaround:**

| Thiếu | Workaround |
|-------|-----------|
| `morphologyEx` | Compose từ `erode` + `dilate` (MORPH_OPEN = erode→dilate, MORPH_CLOSE = dilate→erode) |
| `watershed` | **Không cần cho counting.** Dùng distance transform + connectedComponentsWithStats. Watershed chỉ cần cho visual boundary refinement — có thể implement sau hoặc skip |

---

## 2. Pipeline — DEFAULT (Touching Pills)

Đây là pipeline chính. Viên thuốc chạm nhau → connectedComponents thường đếm thiếu → cần distance transform để tách.

### Bước chi tiết (tham khảo thuật toán celankannan/Pill-Detection, C++ no-license, chỉ tham khảo concept):

```
Input: base64 image
  ↓
1. Decode (jimp) → RGBA Mat
  ↓
2. Resize nếu ảnh quá lớn (giữ max 1024px chiều dài)
  ↓
3. Binarization — CHỌN 1 trong 2 mode:

   Mode A — Otsu (auto, nhanh):
     cvtColor → Grayscale
     GaussianBlur(5×5)
     threshold(otsu, THRESH_BINARY_INV)

   Mode B — Adaptive (ánh sáng không đều):
     cvtColor → Grayscale
     GaussianBlur(5×5)
     adaptiveThreshold(ADAPTIVE_THRESH_GAUSSIAN_C, THRESH_BINARY_INV, blockSize=11, C=2)
  ↓
4. Morphology cleanup:
     erode ×1-2 → remove noise nhỏ
     dilate ×1-2 → fill holes nhỏ
  ↓
5. Distance Transform (BẮT BUỘC cho touching pills):
     distanceTransform(binary, dist, DIST_L2, maskSize=5)
     normalize(dist, dist, 0, 1.0, NORM_MINMAX)
  ↓
6. Threshold distance map → sure foreground:
     threshold(dist, sureFg, 0.4-0.6, 255, THRESH_BINARY)
     convertTo(sureFg, CV_8U)
  ↓
7. Connected Components trên sure foreground:
     connectedComponentsWithStats(sureFg, labels, stats, centroids)
     pillCount = numLabels - 1  (trừ background)
  ↓
8. Filter components:
     Loại label 0 (background)
     Lọc theo area: minArea < area < maxArea
     Lọc theo extent (area / boundingRectArea) nếu cần
  ↓
9. Extract centroids → normalized coordinates (0-1)
  ↓
10. Output: { count, points[] }
```

### Tại sao distance transform tách được viên chạm nhau?

```
Viên A chạm viên B:

  Binary mask:        Distance map:         Threshold (0.5):
  ████████████        000123432100          000001100000
  ██  ██  ██          0123456543210         000111110000
  ██  ██  ██    →     1234567654321    →    001111111000
  ██  ██  ██          0123456543210         000111110000
  ████████████        000123432100          000001100000

  → Mỗi viên có 1 peak riêng → tách ra thành 2 component riêng biệt
```

### Tham số cần tune

```ts
interface CVConfig {
  // Binarization
  thresholdMode: 'otsu' | 'adaptive';  // default: 'otsu'
  adaptiveBlockSize: number;            // default: 11 (phải là số lẻ)
  adaptiveC: number;                    // default: 2

  // Morphology
  erodeIterations: number;              // default: 1
  dilateIterations: number;             // default: 2

  // Distance Transform
  distThreshold: number;                // default: 0.5 (0.4-0.6, tune theo ảnh thực)
  distMaskSize: number;                 // default: 5 (3 hoặc 5)

  // Component filtering
  minArea: number;                      // default: 200 px (loại noise)
  maxArea: number;                      // default: 100000 px (loại vùng quá lớn)
  minExtent: number;                    // default: 0.3 (area/boundingRect)
}
```

---

## 3. Pipeline — HSV Segmentation (Controlled Background)

Nếu user đặt viên thuốc trên nền có màu rõ ràng (đen, xanh lá, trắng), HSV segmentation cho kết quả sạch hơn Otsu rất nhiều. Dùng như **alternative entry point** — bước 3 thay bằng HSV, còn lại giữ nguyên.

```
Thay bước 3 bằng:
  ↓
3'. HSV Color Segmentation:
      cvtColor → HSV
      inRange(lower_hsv, upper_hsv) → mask foreground
      bitwise_not → binary (foreground=white, background=black)
  ↓
4'. Morphology cleanup (giống bước 4)
  ↓
... tiếp tục từ bước 5 (distance transform) trở đi
```

**HSV ranges:**

| Background | H min | H max | S min | S max | V min | V max |
|-----------|-------|-------|-------|-------|-------|-------|
| Nền đen | 0 | 180 | 0 | 255 | 0 | 50 |
| Nền xanh lá | 35 | 85 | 40 | 255 | 40 | 255 |
| Nền trắng | 0 | 180 | 0 | 30 | 200 | 255 |

**Auto-detect background:** Lấy mẫu 4 góc ảnh → nếu > 50% pixel góc cùng màu → dùng HSV mode.否则 fallback Otsu.

---

## 4. Pipeline — HSV Segmentation (No Background Constraint)

Khi không biết background màu gì, dùng heuristic:
1. Lấy mẫu 4 góc ảnh
2. Tính median HSV của 4 góc
3. Nếu saturation thấp (< 30) → background trắng/xám → dùng V channel threshold
4. Nếu saturation cao → có màu cụ thể → dùng HSV inRange
5. Fallback → Otsu grayscale

---

## 5. Addressing `watershed` Thiếu trong opencv-js

**Thực tế:** `watershed` chỉ cần cho VISUAL (vẽ đường biên giữa viên chạm nhau). Cho counting, `connectedComponentsWithStats` trên distance-transformed image đã đủ.

**Nếu cần watershed visual refinement:**

Option A — Implement marker-based watershed thủ công:
```
1. sureFg = threshold(distanceMap, 0.5)
2. sureBg = dilate(binary, iterations=3)
3. unknown = sureBg - sureFg
4. markers = connectedComponents(sureFg) + 1
5. markers[unknown == 255] = 0
6. watershed(src, markers)  ← implement nếu cần
```

Option B — Skip watershed, chỉ dùng connectedComponents centroids:
- Vẽ dot + số thứ tự tại centroid mỗi component
- Không vẽ đường biên giữa viên chạm nhau
- Đơn giản hơn, đủ cho use case "đếm + đánh số"

**Quyết định:** Implement Option B trước. Nếu cần visual refinement → implement Option A sau.

---

## 6. File Changes

```
pill-counter/
├── app/api/count/route.ts        # REWRITE: OpenCV pipeline thay OpenRouter
├── lib/
│   ├── opencv-init.ts             # NEW: singleton OpenCV WASM init + lazy loader
│   ├── pill-cv.ts                 # NEW: core pipeline (binarize, distanceTransform, count)
│   ├── pill-cv-config.ts          # NEW: tham số tune, threshold mode selection
│   └── pill-common.ts             # MODIFY: giữ types, bỏ OpenRouter prompt
├── lib/openrouter.ts              # KEEP (fallback, không xóa)
└── package.json                   # UPDATE: thêm @techstark/opencv-js, jimp
```

---

## 7. OpenCV Init Pattern (Node.js)

```ts
// lib/opencv-init.ts
import cv from "@techstark/opencv-js";

let cvReady: typeof cv | null = null;

export async function getCV(): Promise<typeof cv> {
  if (cvReady) return cvReady;

  if (cv instanceof Promise) {
    cvReady = await cv;
  } else if ((cv as any).Mat) {
    cvReady = cv;
  } else {
    await new Promise<void>((resolve) => {
      (cv as any).onRuntimeInitialized = () => resolve();
    });
    cvReady = cv;
  }
  return cvReady!;
}
```

---

## 8. Memory Management Rules

Mọi `new cv.Mat()` **phải** có `.delete()` khi xong. Dùng try/finally:

```ts
const gray = new cv.Mat();
try {
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  // ... use gray
} finally {
  gray.delete();
}
```

---

## 9. Output Format (giữ nguyên)

```ts
interface PillCountResult {
  count: number;
  points: Array<{ x: number; y: number }>; // normalized 0-1
}
```

Giống hệt output hiện tại từ AI model → `annotated-image.tsx` và `result-display.tsx` không cần đổi.

---

## 10. Error Handling (Vietnamese)

| Tình huống | Message |
|-----------|---------|
| Ảnh decode fail | "Không thể đọc ảnh, vui lòng chọn ảnh khác" |
| Không tìm thấy pill nào | "Không tìm thấy viên thuốc nào trong ảnh" |
| OpenCV WASM load fail | "Không thể khởi tạo bộ xử lý ảnh" |
| Ảnh quá lớn | Giữ nguyên logic compress hiện tại |

---

## 11. Implementation Order

```
Step 1: pnpm add @techstark/opencv-js jimp
Step 2: Tạo lib/opencv-init.ts (singleton loader)
Step 3: Tạo lib/pill-cv.ts — DEFAULT pipeline (grayscale → otsu → morphology → distanceTransform → connectedComponents)
Step 4: Rewrite app/api/count/route.ts (gọi pill-cv thay openrouter)
Step 5: Test với ảnh viên thuốc chạm nhau → tune distThreshold, minArea
Step 6: Thêm adaptive threshold mode (ánh sáng không đều)
Step 7: Thêm HSV segmentation mode (controlled background)
Step 8: (Optional) Thêm auto-detect background → tự chọn mode
Step 9: (Optional) Implement watershed visual refinement nếu cần vẽ đường biên
```

---

## 12. Open-Source References

| Resource | License | Có thể dùng? | Ghi chú |
|----------|---------|--------------|---------|
| `@techstark/opencv-js` | Apache 2.0 | ✅ | WASM, dùng được ngay |
| `SARANGx/rtdetr-pill-detector` | Apache 2.0 | ✅ (fallback) | RT-DETR R18, 316 ảnh train, NMS-free, 20M params |
| `YOLOpills/pills-4xqlr` (Roboflow) | Public | ✅ | 447 ảnh, YOLO format |
| `celankannan/Pill-Detection` | ❌ No license | ❌ | Chỉ tham khảo thuật toán (HSV + distance transform + watershed) |
| `Rishita-Rao/Automatic-pill-counter` | ❌ No license | ❌ | Chỉ tham khảo thuật toán (super-res + watershed) |

---

## 13. Fallback Plan

Nếu OpenCV không đáp ứng được:

1. Dùng `SARANGx/rtdetr-pill-detector` (Apache 2.0) — load qua HuggingFace Inference API hoặc self-host
2. Hoặc fine-tune YOLO trên `YOLOpills` dataset
3. Giữ OpenRouter API như fallback cuối cùng (đã có sẵn code)

---

## 14. Ghi chú kỹ thuật

- **Color space:** Ảnh từ browser (base64) decode ra RGBA, không phải BGR → dùng `COLOR_RGBA2GRAY`, `COLOR_RGBA2RGB`, `COLOR_RGB2HSV`
- **WASM cold start:** ~8MB WASM binary, lần đầu load sẽ chậm. Init singleton ở module level để reuse
- **TypeScript:** Types có thể incomplete, dùng `as any` nếu cần
- **Canvas annotation:** Giữ nguyên `annotated-image.tsx` — chỉ cần thay đổi data source từ AI → OpenCV
- **distThreshold:** Giá trị 0.5 là starting point. Ảnh thực tế có thể cần 0.3-0.7. Tune bằng cách test với ảnh mẫu
- **Resize trước khi xử lý:** Ảnh lớn → resize max 1024px để tăng tốc, giảm memory
