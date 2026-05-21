# Tuning & Accuracy Improvements: OpenCV Pill Counter POC

## Context

Project đang chuyển từ AI vision model sang OpenCV server-side processing cho POC pill counter.

Các constraint chính:

- Không control được background color 100%. App chỉ có thể gợi ý user dùng nền tương phản/tốt hơn.
- 90%+ case sẽ có viên thuốc chạm nhau.
- Mức độ chạm nhau không control được: có thể 10 viên, cũng có thể 30+ viên/lần.
- Mục tiêu POC là giảm complexity bằng CV heuristic, nhưng vẫn cần độ chính xác đủ tốt và dễ debug/tune.

## Main Takeaway

Plan OpenCV hiện tại đúng hướng cho baseline, nhưng không nên thiết kế như một pipeline fixed duy nhất.

Approach nên chuyển thành:

```text
auto segmentation candidates
-> chọn foreground mask tốt nhất
-> split từng cluster touching pills
-> filter/merge points
-> trả count + confidence/debug
```

Không nên assume trước màu background. HSV fixed range cho nền đen/xanh/trắng chỉ nên là hint/fallback, không phải default chính.

## Recommended Pipeline

```text
1. Decode + resize ảnh
2. Normalize nhẹ ánh sáng / blur noise
3. Tạo nhiều foreground mask candidates:
   - background color distance từ viền/corners
   - Otsu binary
   - Otsu inverse
   - adaptive threshold binary
   - adaptive threshold inverse
   - HSV nếu background detect được rõ
4. Chấm điểm mask candidates
5. Chọn mask tốt nhất
6. Morphology cleanup
7. Tìm connected blobs
8. Với blob nhỏ/đơn giản: count 1
9. Với blob lớn/touching cluster:
   - distance transform per blob
   - local maxima / markers
   - watershed hoặc marker expansion
10. Filter/merge points
11. Output count + points + debug info
```

## Segmentation Strategy

### Background-Agnostic First

Vì background không cố định, segmentation nên ưu tiên estimate background từ ảnh thay vì hardcode màu.

Gợi ý:

- Lấy pixel từ 4 cạnh/corners hoặc border band.
- Estimate background color trong Lab/HSV/RGB.
- Foreground là pixel khác background đủ nhiều.
- Dùng foreground ratio và component stats để kiểm tra mask có hợp lý không.

### Multi-Candidate Masks

Tạo nhiều mask rồi chọn mask tốt nhất thường ổn định hơn chọn một mode cố định.

Candidate examples:

- `otsu_binary`
- `otsu_inverse`
- `adaptive_binary`
- `adaptive_inverse`
- `background_distance_lab`
- `hsv_detected_background`

Mask score có thể dựa trên:

- Foreground ratio không quá thấp/quá cao.
- Noise vụn ít sau morphology.
- Foreground không dính quá nhiều vào viền ảnh.
- Component sizes có phân bố hợp lý.
- Số blob/cluster sau cleanup không bất thường.

## Touching Pills Strategy

Touching pills nên được xem là case chính, không phải edge case.

### Per-Blob Split

Không nên chỉ chạy distance transform global toàn ảnh.

Nên:

- Segment foreground trước.
- Tìm connected components/blobs.
- Blob nhỏ, đơn giản thì count 1.
- Blob lớn hoặc có shape phức tạp thì xử lý như cluster và split riêng trong ROI.

Cách này giảm rủi ro một threshold global làm sai toàn ảnh.

### Distance Transform + Markers

Distance transform vẫn là hướng đúng để split touching pills, nhưng threshold distance map một lần là baseline khá yếu.

Nên cân nhắc:

- Detect local maxima trên distance map.
- Non-max suppression theo minimum distance giữa peaks.
- Marker-based watershed hoặc marker expansion để tách cluster.

Nếu skip watershed phase đầu, local maxima count vẫn nên được dùng thay vì chỉ `threshold(dist, 0.5)` rồi `connectedComponents`.

### Overlap Limitation

OpenCV heuristic xử lý được case viên chạm nhau ở biên.

Nếu viên chồng lên/che khuất nhau nhiều, classical CV khó đảm bảo chính xác. POC nên ghi rõ limitation này hoặc show warning khi confidence thấp.

## What "Tuning" Means Here

OpenCV không fine-tune như ML model. Nhưng pipeline OpenCV có nhiều tham số heuristic cần calibrate.

Ví dụ:

- `adaptiveBlockSize`: 11, 21, 31...
- `adaptiveC`: 2, 5, 10...
- `distThreshold`: 0.35, 0.45, 0.55...
- `minArea`, `maxArea`
- morphology kernel: 3x3, 5x5...
- number of erosion/dilation/open/close iterations
- minimum distance giữa peaks
- color distance threshold giữa foreground/background

Các giá trị này phụ thuộc vào:

- Độ phân giải ảnh.
- Kích thước viên thuốc.
- Ánh sáng và bóng đổ.
- Nền sáng/tối/màu/tạp.
- Thuốc trắng, vàng, xanh, capsule trong suốt.
- Số lượng viên và mức độ chạm nhau.

Tuning ở đây là calibrate rule-based algorithm, không phải train model.

## Why Evaluation Set Is Needed

Evaluation set không phải dataset train. Nó chỉ là bộ ảnh test nhỏ có expected count thật.

Mục đích:

- Biết thay đổi threshold có cải thiện tổng thể không.
- Tránh fix một ảnh nhưng làm hỏng ảnh khác.
- Định lượng được POC đang đúng/sai ở nhóm case nào.

Gợi ý bộ ảnh POC:

- Ảnh nền trắng/xám.
- Ảnh nền đen/tối.
- Ảnh nền màu/tạp.
- Ảnh 10 viên.
- Ảnh 30+ viên.
- Ảnh touching nhẹ.
- Ảnh touching nhiều.
- Ảnh có bóng/reflection.

Mỗi ảnh chỉ cần lưu expected count. Không cần annotation điểm từng viên ở phase đầu.

Ví dụ report:

```text
image_01: expected 10, got 10
image_02: expected 12, got 11
image_03: expected 30, got 34
```

## Debug Output For POC

API nên có debug output nội bộ hoặc bật bằng flag/query trong development.

Ví dụ:

```ts
{
  count,
  points,
  debug: {
    selectedMode: "background_distance_lab",
    foregroundRatio: 0.18,
    candidateScores: [...],
    rejectedComponents: 4,
    clustersSplit: 3,
    warnings: []
  }
}
```

Debug visualization rất hữu ích:

- Original resized image.
- Selected foreground mask.
- Cleaned mask.
- Distance map.
- Local maxima/markers.
- Final points.

Không nhất thiết show cho end user, nhưng nên có trong dev để tune nhanh.

## User Guidance

Vì không control được background hoàn toàn, UI nên gợi ý thay vì yêu cầu cứng.

Gợi ý user:

- Dùng nền phẳng, ít hoa văn.
- Nền tương phản với màu thuốc.
- Tránh nền có màu giống viên thuốc.
- Tránh bóng gắt/reflection.
- Chụp từ trên xuống, camera càng vuông góc càng tốt.
- Trải thuốc một lớp, hạn chế chồng lên nhau. Chạm nhau thì được, che khuất nhau sẽ khó đếm chính xác.

## Plan Adjustments

Nên chỉnh `implement_plan.md` theo hướng:

- Đưa background-agnostic segmentation lên làm default.
- HSV controlled background là fallback/candidate, không phải assumption.
- Đưa touching split lên core pipeline, không để optional.
- Dùng per-blob/ROI distance transform thay vì chỉ global distance transform.
- Cân nhắc local maxima + NMS hoặc marker-based watershed cho cluster lớn.
- Thêm mask scoring và debug output.
- Thêm evaluation set nhỏ để calibrate heuristic.

## Practical Conclusion

OpenCV approach vẫn phù hợp cho POC nếu app chấp nhận heuristic + controlled guidance.

Hướng có khả năng chính xác hơn:

```text
background-agnostic segmentation
-> multi-candidate mask selection
-> per-blob distance/local-maxima split
-> confidence/debug-driven tuning
```

Đây là hướng tốt hơn so với pipeline fixed kiểu:

```text
```
