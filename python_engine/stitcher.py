import os
import sys
import json
import cv2
import numpy as np

def log_progress(step, total_steps, message):
    progress = int((step / total_steps) * 100)
    print(f"PROGRESS:{progress}:{message}", flush=True)

def detect_grid_size(image_paths):
    count = len(image_paths)
    if count <= 4:
        return 2, 2
    elif count <= 9:
        return 3, 3
    elif count <= 25:
        return 5, 5
    elif count <= 81:
        return 9, 9
    else:
        side = int(np.sqrt(count))
        return side, side

def stitch_images(image_paths, direction_name):
    """Stitches a list of images using OpenCV Stitcher class, falling back to sequential homography if it fails."""
    log_progress(1, 10, f"Loading images for {direction_name}...")
    images = []
    for path in image_paths:
        img = cv2.imread(path)
        if img is not None:
            images.append(img)
            
    if not images:
        raise ValueError(f"No valid images loaded for direction {direction_name}")
        
    if len(images) == 1:
        log_progress(9, 10, f"Single image detected for {direction_name}. Skipping stitching.")
        return images[0]
        
    log_progress(3, 10, f"Stitching {len(images)} images for {direction_name} using OpenCV...")
    
    # Try OpenCV Stitcher first
    try:
        stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
        status, stitched = stitcher.stitch(images)
        if status == cv2.Stitcher_OK:
            log_progress(9, 10, f"Successfully stitched {direction_name} panorama!")
            return stitched
    except Exception as e:
        log_progress(4, 10, f"OpenCV C++ Stitcher raised exception: {str(e)}. Attempting manual fallback...")
    
    log_progress(4, 10, "OpenCV Stitcher failed or needs overlap help. Falling back to feature matching...")
    
    # Fallback: sequential stitching
    sift = cv2.SIFT_create()
    bf = cv2.BFMatcher(cv2.NORM_L2, crossCheck=True)
    
    current_pano = images[0]
    
    for i in range(1, len(images)):
        log_progress(4 + int(5 * i / len(images)), 10, f"Matching image {i+1}/{len(images)} for {direction_name}...")
        next_img = images[i]
        
        # Detect features
        kp1, des1 = sift.detectAndCompute(current_pano, None)
        kp2, des2 = sift.detectAndCompute(next_img, None)
        
        if des1 is None or des2 is None:
            continue
            
        matches = bf.match(des1, des2)
        matches = sorted(matches, key=lambda x: x.distance)
        
        if len(matches) < 4:
            continue
            
        pts1 = np.float32([kp1[m.queryIdx].pt for m in matches]).reshape(-1, 1, 2)
        pts2 = np.float32([kp2[m.trainIdx].pt for m in matches]).reshape(-1, 1, 2)
        
        H, mask = cv2.findHomography(pts2, pts1, cv2.RANSAC, 5.0)
        if H is None:
            continue
            
        # Warp next image onto panorama size
        h1, w1 = current_pano.shape[:2]
        h2, w2 = next_img.shape[:2]
        
        pts = np.float32([[0, 0], [0, h2], [w2, h2], [w2, 0]]).reshape(-1, 1, 2)
        dst = cv2.perspectiveTransform(pts, H)
        
        # Calculate boundaries of stitched image
        all_pts = np.concatenate((np.float32([[0, 0], [0, h1], [w1, h1], [w1, 0]]).reshape(-1, 1, 2), dst), axis=0)
        [x_min, y_min] = np.int32(all_pts.min(axis=0).flatten())
        [x_max, y_max] = np.int32(all_pts.max(axis=0).flatten())
        
        translation = np.array([[1, 0, -x_min], [0, 1, -y_min], [0, 0, 1]], dtype=np.float32)
        H_translated = translation.dot(H)
        
        stitched = cv2.warpPerspective(next_img, H_translated, (x_max - x_min, y_max - y_min))
        
        # Overwrite with current panorama
        stitched[-y_min:h1 - y_min, -x_min:w1 - x_min] = current_pano
        current_pano = stitched
        
    log_progress(9, 10, f"Stitched {direction_name} via fallback method.")
    return current_pano

def cubemap_to_equirectangular(faces, out_width=4096, out_height=2048):
    """Converts 6 cube faces to a single 360 equirectangular image using vectorized NumPy mapping."""
    log_progress(90, 100, "Starting cubemap to equirectangular projection...")
    
    # Create coordinate grid for equirectangular image
    u = np.linspace(0, out_width - 1, out_width)
    v = np.linspace(0, out_height - 1, out_height)
    uu, vv = np.meshgrid(u, v)
    
    # Map to spherical coordinates
    theta = (uu / out_width) * 2.0 * np.pi - np.pi
    phi = (vv / out_height) * np.pi - (np.pi / 2.0)
    
    # Convert to 3D Cartesian coordinates
    x = np.cos(phi) * np.sin(theta)
    y = np.sin(phi)
    z = np.cos(phi) * np.cos(theta)
    
    # Find maximum absolute coordinate to determine face
    abs_x = np.abs(x)
    abs_y = np.abs(y)
    abs_z = np.abs(z)
    
    max_axis = np.maximum(np.maximum(abs_x, abs_y), abs_z)
    
    # Initialize output image
    out_img = np.zeros((out_height, out_width, 3), dtype=np.uint8)
    
    # Define mapping for each face
    # Faces list/dict keys: 'R', 'L', 'U', 'D', 'F', 'B'
    # R: +x, L: -x, U: +y, D: -y, F: +z, B: -z
    
    face_masks = {
        'R': (abs_x == max_axis) & (x > 0),
        'L': (abs_x == max_axis) & (x < 0),
        'U': (abs_y == max_axis) & (y > 0),
        'D': (abs_y == max_axis) & (y < 0),
        'F': (abs_z == max_axis) & (z > 0),
        'B': (abs_z == max_axis) & (z < 0)
    }
    
    for face_key, mask in face_masks.items():
        if not np.any(mask):
            continue
            
        face_img = faces.get(face_key)
        if face_img is None:
            # If a face is missing, fill with placeholder color or default to black
            continue
            
        fh, fw = face_img.shape[:2]
        
        # Projection formulas mapping unit vector to face texture coordinates (s, t) in [0, 1]
        if face_key == 'R':
            s = 0.5 * (-z[mask] / x[mask]) + 0.5
            t = 0.5 * (-y[mask] / x[mask]) + 0.5
        elif face_key == 'L':
            s = 0.5 * (z[mask] / abs(x[mask])) + 0.5
            t = 0.5 * (-y[mask] / abs(x[mask])) + 0.5
        elif face_key == 'U':
            s = 0.5 * (x[mask] / y[mask]) + 0.5
            t = 0.5 * (z[mask] / y[mask]) + 0.5
        elif face_key == 'D':
            s = 0.5 * (x[mask] / abs(y[mask])) + 0.5
            t = 0.5 * (-z[mask] / abs(y[mask])) + 0.5
        elif face_key == 'F':
            s = 0.5 * (x[mask] / z[mask]) + 0.5
            t = 0.5 * (-y[mask] / z[mask]) + 0.5
        elif face_key == 'B':
            s = 0.5 * (-x[mask] / abs(z[mask])) + 0.5
            t = 0.5 * (-y[mask] / abs(z[mask])) + 0.5
            
        # Convert to pixel indices
        px = np.clip((s * fw).astype(np.int32), 0, fw - 1)
        py = np.clip((t * fh).astype(np.int32), 0, fh - 1)
        
        out_img[mask] = face_img[py, px]
        
    log_progress(100, 100, "Cubemap to equirectangular conversion complete!")
    return out_img

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No arguments provided"}))
        return
        
    config_file = sys.argv[1]
    with open(config_file, 'r') as f:
        config = json.load(f)
        
    project_dir = config.get("projectDir")
    directions = config.get("directions") # dict of face_key: [image_paths]
    output_path = config.get("outputPath")
    resolution = config.get("resolution", 4096)
    
    # 1. Stitch each direction
    stitched_faces = {}
    total_steps = len(directions) + 2
    step = 0
    
    for face_key, paths in directions.items():
        if not paths:
            continue
        try:
            step += 1
            log_progress(step, total_steps, f"Stitching {face_key} direction...")
            stitched_img = stitch_images(paths, face_key)
            
            # Save intermediate stitched face
            face_out_path = os.path.join(project_dir, f"stitched_{face_key}.png")
            cv2.imwrite(face_out_path, stitched_img)
            stitched_faces[face_key] = stitched_img
            
        except Exception as e:
            print(f"ERROR: Failed stitching {face_key}: {str(e)}", file=sys.stderr)
            
    # If we don't have enough faces, we can't complete the full cubemap, but we'll try to convert whatever we have
    if not stitched_faces:
        print(json.dumps({"error": "No directions stitched successfully"}))
        sys.exit(1)
        
    # Fill missing faces with black images matching size of first successful face
    ref_face = list(stitched_faces.values())[0]
    ref_shape = ref_face.shape
    for key in ['R', 'L', 'U', 'D', 'F', 'B']:
        if key not in stitched_faces:
            stitched_faces[key] = np.zeros(ref_shape, dtype=np.uint8)
            
    # 2. Convert Cubemap to Equirectangular
    try:
        equi_img = cubemap_to_equirectangular(
            stitched_faces, 
            out_width=resolution, 
            out_height=resolution // 2
        )
        
        cv2.imwrite(output_path, equi_img)
        print(json.dumps({"status": "SUCCESS", "outputPath": output_path}))
    except Exception as e:
        print(json.dumps({"error": f"Failed equirectangular conversion: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
