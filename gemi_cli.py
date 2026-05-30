import cv2
import numpy as np
import glob
import json
import os

def count_pills_in_image(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return None, 0
        
    output_img = img.copy()
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 1. Glare-Resistant Preprocessing
    # Using a stronger blur and Adaptive Thresholding for bags/silver trays
    blur = cv2.GaussianBlur(gray, (11, 11), 0)
    thresh = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                   cv2.THRESH_BINARY, 21, 4)

    # 2. Clean Up Noise & Fill Imprints
    kernel = np.ones((3,3), np.uint8)
    opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
    sure_bg = cv2.dilate(opening, kernel, iterations=3)

    # 3. Distance Transform (Tuned for the test1.jpg 18-pill stack)
    dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    
    # Lowered multiplier from 0.4 to 0.25 to catch heavily stacked/overlapping pills
    _, sure_fg = cv2.threshold(dist_transform, 0.25 * dist_transform.max(), 255, 0)

    # 4. Watershed Algorithm
    sure_fg = np.uint8(sure_fg)
    unknown = cv2.subtract(sure_bg, sure_fg)
    _, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    markers = cv2.watershed(img, markers)

    # 5. Filter and Annotate
    pill_count = 0
    for marker_id in np.unique(markers):
        if marker_id == -1 or marker_id == 1:
            continue

        mask = np.zeros(gray.shape, dtype="uint8")
        mask[markers == marker_id] = 255

        contours, _ = cv2.findContours(mask.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
            
        c = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(c)

        # STRICT FILTER 1: Area (Ignores dust AND massive paper labels/spatulas)
        if area < 150 or area > 6000:
            continue

        # STRICT FILTER 2: Aspect Ratio (Ignores long items like labels/spatulas)
        x, y, w, h = cv2.boundingRect(c)
        aspect_ratio = float(w) / max(h, 1) # Prevent division by zero
        if aspect_ratio > 3.0 or aspect_ratio < 0.33:
            continue

        pill_count += 1
        
        # Calculate center for red dot
        M = cv2.moments(c)
        if M["m00"] != 0:
            cX = int(M["m10"] / M["m00"])
            cY = int(M["m01"] / M["m00"])
        else:
            cX, cY = 0, 0

        cv2.circle(output_img, (cX, cY), 6, (0, 0, 255), -1)
        cv2.putText(output_img, str(pill_count), (cX - 15, cY - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    return output_img, pill_count

def generate_inventory_report(folder_path):
    report = []
    for image_path in glob.glob(os.path.join(folder_path, "*.jpg")):
        output_img, pill_count = count_pills_in_image(image_path)
        if output_img is not None:
            cv2.imwrite(f"output_{os.path.basename(image_path)}", output_img)
        report.append({
            "filename": os.path.basename(image_path),
            "pill_count": pill_count
        })
    
    with open("inventory_report.json", "w") as f:
        json.dump(report, f)

if __name__ == "__main__":
    generate_inventory_report("./test_img")