# Pill Counter - countPills Flow

## 1. Overview

```
User picks image → Client compress → POST /api/count → OpenRouter AI (JSON mode) → Server parse → Client filter+clamp → Annotate canvas
```

## 2. Component Call Graph

```
page.tsx (Home)
 ├── ImagePicker          → chọn/chụp ảnh, compress, lưu base64 vào state
 ├── Button "Đếm thuốc"   → trigger handleCount()
 └── ResultDisplay        → hiển thị count + AnnotatedImage
       └── AnnotatedImage → canvas vẽ circle markers lên ảnh
```

## 3. Chi tiết Flow

### Bước 1: Client - Chọn ảnh (`image-picker.tsx`)

- User click **Chọn ảnh** hoặc **Chụp ảnh** → trigger hidden `<input type="file">`
- `handleFile(file)` gọi `compressImage(file)` từ `lib/compress.ts`:
  - Resize ảnh nếu kích thước > 2048px (giữ tỉ lệ)
  - Normalize thành **vuông 1:1** (thêm white padding)
  - Giảm chất lượng JPEG từ 0.8 xuống tối thiểu 0.3 cho đến khi < 5MB
  - Trả về `base64` data URL
- Callback `onImageSelected(base64)` → `page.tsx` set state `image`

### Bước 2: Client - Gọi API (`page.tsx`)

User nhấn **"Đếm thuốc"** → `handleCount()`:
1. Tạo `FormData`, append `image` (base64 string)
2. `POST /api/count` với body là FormData

### Bước 3: Server - API Route (`app/api/count/route.ts`)

1. Đọc `formData.get("image")` → base64 string
2. Gọi `countPills(imageBase64)` từ `lib/openrouter.ts`

### Bước 4: Server - OpenRouter Call (`lib/openrouter.ts`)

1. Build prompt từ `buildPillCountPrompt()` (`lib/pill-common.ts`)
   - Hướng dẫn AI đếm pill, tìm tâm mỗi viên
   - Yêu cầu trả JSON: `{"count": N, "points": [{x, y}, ...]}`
   - Coordinates normalized 0.0-1.0
2. Gửi tới `POST https://openrouter.ai/api/v1/chat/completions`
   - Model: `openai/gpt-5.5`, temperature: 0.1
   - **`response_format: { type: "json_object" }`** — ép AI trả pure JSON
   - Messages: text prompt + image (base64 inline)
3. Extract `choices[0].message.content` → raw JSON string

### Bước 5: Server Post-Processing (`lib/openrouter.ts`)

- `JSON.parse(text)` trực tiếp (vì `response_format` đảm bảo pure JSON)
- Validate: `count` phải là number, `points` phải là array
- Return `PillCountResult` object → `route.ts` return JSON cho client

### Bước 6: Client Post-Processing (`page.tsx`)

1. Nhận `{ count, points }` từ API response (đã parsed sẵn)
2. **Filter & clamp** points:
   - Bỏ points không có `x`, `y` hợp lệ (number)
   - Clamp mỗi coordinate về [0, 1]
3. Set result: `count = points.length` (không dùng `count` từ AI, đếm lại từ array)

### Bước 7: Client - Render Annotation (`annotated-image.tsx`)

`ResultDisplay` nhận `count`, `imageSrc`, `points` → render:
1. **Badge**: "{count} viên thuốc"
2. **AnnotatedImage** (canvas):
   - Load ảnh vào `Image` object
   - Canvas size = container width × (img height × scale)
   - Handle **devicePixelRatio** cho Retina: canvas nội bộ = display size × dpr
   - `ctx.scale(dpr, dpr)` để vẽ sharp
   - Vẽ ảnh gốc lên canvas
   - Với mỗi point:
     - `x = point.x * width`, `y = point.y * height` (normalized → pixel)
     - Vẽ **circle** (radius 12-20px tuỳ kích thước ảnh):
       - Stroke đỏ `#ef4444`, width 3
       - Fill semi-transparent đỏ
     - Vẽ **số thứ tự** (1, 2, 3...) ở giữa circle, font bold
   - Responsive: lắng nghe `resize` event → redraw

## 4. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ CLIENT                                                           │
│                                                                  │
│  ImagePicker                page.tsx                  ResultDisp │
│  ┌──────────┐    base64    ┌──────────┐    result    ┌─────────┐│
│  │ File     │──compress──→ │ image    │              │ Badge   ││
│  │ Camera   │              │ state    │              │    +    ││
│  └──────────┘              │          │              │Annotated││
│                            │handleCt()│──parsed───→ │  Image  ││
│                            └────┬─────┘              └─────────┘│
│                                 │ POST FormData(base64)          │
│                                 ▼                                │
│  ┌──────────────────────────────────────────────────────┐        │
│  │                POST /api/count                       │        │
│  └──────────────────────────┬───────────────────────────┘        │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│ SERVER                                                           │
│                                                                  │
│  route.ts              openrouter.ts          pill-common.ts     │
│  ┌──────────┐  base64  ┌──────────────┐     ┌────────────────┐  │
│  │ parse    │────────→ │ countPills() │────→ │buildPrompt()   │  │
│  │ formData │          │              │      └────────────────┘  │
│  └──────────┘          │ OpenRouter   │                          │
│       ↑                │ json_object  │                          │
│       │ {count,points} │ JSON.parse   │                          │
│       └────────────────┴──────────────┘                          │
│              (returns parsed PillCountResult)                    │
└──────────────────────────────────────────────────────────────────┘
                              │
                    Client filter + clamp:
                    → filter valid points
                    → clamp to [0,1]
                    → setResult()
```

## 5. Key Design Notes

| Aspect | Detail |
|--------|--------|
| **JSON mode** | `response_format: { type: "json_object" }` ép AI trả pure JSON, không cần manual string parsing |
| **Server parse** | Server `JSON.parse` + validate, trả parsed object về client |
| **Client post-process** | Client chỉ filter valid points + clamp [0,1] |
| **Count trust** | `count` từ AI bị bỏ, client dùng `points.length` |
| **Image format** | Base64 data URL, gửi qua FormData (không upload file) |
| **Normalization** | Ảnh được pad thành vuông 1:1 ở client (`compress.ts:28-34`), coordinates 0-1 khớp với canvas |
| **Annotation style** | Circle đỏ + số thứ tự tại tâm mỗi viên thuốc |
| **Retina support** | Canvas nội bộ × dpr, CSS size giữ nguyên |
