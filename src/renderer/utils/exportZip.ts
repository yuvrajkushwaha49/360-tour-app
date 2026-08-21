import { API_BASE_URL } from './apiConfig';

export interface ExportProgressCallback {
  (message: string, progressPercent: number): void;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks to prevent call stack limits
  for (let i = 0; i < len; i += chunkSize) {
    const subArray = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, subArray as any);
  }
  return btoa(binary);
}

async function getJSZip(): Promise<any> {
  if ((window as any).JSZip) return (window as any).JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve((window as any).JSZip);
    script.onerror = () => reject(new Error('Failed to load JSZip library from CDN'));
    document.head.appendChild(script);
  });
}

export async function exportProjectToZip(
  project: any,
  onProgress?: ExportProgressCallback
): Promise<void> {
  if (onProgress) onProgress('Initializing 360 Standalone Exporter...', 5);

  const JSZipClass = await getJSZip();
  const zip = new JSZipClass();
  const projectName = project.name || '360_Virtual_Tour';
  const sanitizedFolderName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');

  const assetsFolder = zip.folder('assets');
  const rawLocations = project.data?.locations || [];
  const exportedLocations: any[] = [];

  // Helper to fetch an image path and return { arrayBuffer, base64DataUri, mimeType }
  async function fetchImageAssets(rawImgPath: string) {
    if (!rawImgPath) return null;
    let fetchUrl = rawImgPath;
    if (!rawImgPath.startsWith('http://') && !rawImgPath.startsWith('https://') && !rawImgPath.startsWith('data:')) {
      if (rawImgPath.startsWith('/uploads/')) {
        fetchUrl = `${API_BASE_URL}${rawImgPath}`;
      } else {
        const cleanPath = rawImgPath.replace(/^file:\/\/\/?/, '');
        fetchUrl = `${API_BASE_URL}/api/local-image?path=${encodeURIComponent(cleanPath)}`;
      }
    }
    if (rawImgPath.startsWith('data:')) {
      try {
        const base64Data = rawImgPath.split(',')[1];
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let idx = 0; idx < len; idx++) {
          bytes[idx] = binaryStr.charCodeAt(idx);
        }
        const ext = rawImgPath.includes('image/png') ? 'png' : rawImgPath.includes('image/webp') ? 'webp' : 'jpg';
        return { base64DataUri: rawImgPath, arrayBuffer: bytes.buffer, ext };
      } catch {
        return { base64DataUri: rawImgPath, arrayBuffer: null, ext: 'jpg' };
      }
    }
    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const ext = rawImgPath.toLowerCase().endsWith('.png') ? 'png' : rawImgPath.toLowerCase().endsWith('.webp') ? 'webp' : 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const base64DataUri = `data:${mimeType};base64,${arrayBufferToBase64(arrayBuffer)}`;
      return { base64DataUri, arrayBuffer, ext };
    } catch {
      return null;
    }
  }

  for (let i = 0; i < rawLocations.length; i++) {
    const loc = rawLocations[i];
    const locId = loc.id || `loc-${i + 1}`;
    const rawImgPath = loc.stitchedPanoPath || loc.imagePath;

    let panoramaDataUri = '';

    // --- MODE 1: Stitched Panorama ---
    if (rawImgPath) {
      if (onProgress) {
        onProgress(`Embedding panorama for room: "${loc.name}" (${i + 1}/${rawLocations.length})...`, 10 + Math.floor((i / rawLocations.length) * 40));
      }
      const ext = rawImgPath.toLowerCase().endsWith('.png') ? 'png' : rawImgPath.toLowerCase().endsWith('.webp') ? 'webp' : 'jpg';
      const fileName = `room_${i + 1}_${locId}.${ext}`;
      const result = await fetchImageAssets(rawImgPath);
      if (result?.arrayBuffer && assetsFolder) {
        assetsFolder.file(fileName, result.arrayBuffer);
      }
      panoramaDataUri = result?.base64DataUri || '';
    }

    // --- MODE 2: F/B/L/R/U/D Direction Images in dedicated subfolders (F/, B/, L/, R/, U/, D/) with row_col naming ---
    const directions = loc.directions || {};
    const gridConfigs = loc.gridConfigs || {};
    const FACE_DIRS = ['F', 'B', 'L', 'R', 'U', 'D'] as const;
    const hasFaceImages = FACE_DIRS.some(d => directions[d] && directions[d].length > 0);

    const cubeFaceData: Record<string, { gridSize: number; tiles: { row: number; col: number; src: string; dataUri?: string }[] }> = {};

    if (hasFaceImages) {
      const totalFaceImgs = FACE_DIRS.reduce((sum, d) => sum + (directions[d]?.length || 0), 0);
      let embeddedCount = 0;

      const roomFolder = assetsFolder ? assetsFolder.folder(`room_${i + 1}`) : null;

      for (const dir of FACE_DIRS) {
        const faceImages: any[] = directions[dir] || [];
        if (faceImages.length === 0) continue;

        const dirFolder = roomFolder ? roomFolder.folder(dir) : null;
        const grid = gridConfigs[dir] || 'auto';

        let N = 3;
        if (grid === '2x2') N = 2;
        else if (grid === '3x3') N = 3;
        else if (grid === '5x5') N = 5;
        else if (grid === '9x9') N = 9;
        else {
          const count = faceImages.length;
          if (count <= 1) N = 1;
          else if (count <= 4) N = 2;
          else if (count <= 9) N = 3;
          else if (count <= 25) N = 5;
          else N = 9;
        }

        const tiles: { row: number; col: number; src: string; dataUri?: string }[] = [];

        for (let fi = 0; fi < faceImages.length; fi++) {
          const faceImg = faceImages[fi];
          const facePath = faceImg.path || faceImg.filePath || faceImg.src || '';
          if (!facePath) continue;

          const r = Math.floor(fi / N);
          const c = fi % N;

          embeddedCount++;
          if (onProgress) {
            onProgress(
              `Room "${loc.name}" — Saving ${dir}/${r}_${c} (${embeddedCount}/${totalFaceImgs})...`,
              10 + Math.floor((i / rawLocations.length) * 40)
            );
          }

          const faceExt = facePath.toLowerCase().endsWith('.png') ? 'png' : facePath.toLowerCase().endsWith('.webp') ? 'webp' : 'jpg';
          const faceFileName = `${r}_${c}.${faceExt}`;
          const relativeAssetPath = `assets/room_${i + 1}/${dir}/${faceFileName}`;

          const faceResult = await fetchImageAssets(facePath);
          if (faceResult) {
            if (faceResult.arrayBuffer && dirFolder) {
              dirFolder.file(faceFileName, faceResult.arrayBuffer);
            }
            tiles.push({
              row: r,
              col: c,
              src: relativeAssetPath,
              dataUri: faceResult.base64DataUri || undefined
            });
          }
        }

        if (tiles.length > 0) {
          cubeFaceData[dir] = { gridSize: N, tiles };
        }
      }
    }

    exportedLocations.push({
      ...loc,
      panoramaDataUri,
      cubeFaceData: Object.keys(cubeFaceData).length > 0 ? cubeFaceData : undefined,
      // Keep legacy fields
      stitchedPanoPath: panoramaDataUri,
      imagePath: panoramaDataUri,
    });
  }


  if (onProgress) onProgress('Embedding offline 3D rendering engine (Three.js)...', 70);


  let threeJsSource = '';
  let orbitControlsSource = '';

  try {
    const threeRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    if (threeRes.ok) {
      threeJsSource = await threeRes.text();
    }
    const orbitRes = await fetch('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    if (orbitRes.ok) {
      orbitControlsSource = await orbitRes.text();
    }
  } catch (err) {
    console.warn('Could not fetch online Three.js engine source, falling back to CDN tags', err);
  }

  if (onProgress) onProgress('Generating standalone tour configuration...', 85);

  const tourDataJson = {
    id: project.id,
    name: projectName,
    description: project.data?.description || '',
    activeLocationId: project.data?.activeLocationId || (exportedLocations[0]?.id || ''),
    locations: exportedLocations
  };

  const jsonStringified = JSON.stringify(tourDataJson, null, 2);

  zip.file('tour_data.json', jsonStringified);

  const threeScriptTag = threeJsSource
    ? `<script>${threeJsSource}</script>`
    : `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>`;

  const orbitScriptTag = orbitControlsSource
    ? `<script>${orbitControlsSource}</script>`
    : `<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>`;

  const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - 360° Interactive Virtual Tour</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: #07080d; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #fff; }
    #canvas-container { width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: 1; }
    
    /* Top Floating Header */
    .top-header {
      position: absolute; top: 1rem; left: 50%; transform: translateX(-50%); z-index: 100;
      background: rgba(15, 18, 28, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 1.25rem; padding: 0.6rem 1.5rem;
      display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
      max-width: 90vw;
    }
    .tour-title { font-size: 1rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 0.6rem; white-space: nowrap; }
    .vr-badge { font-size: 0.65rem; font-weight: 700; color: #818cf8; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.35); padding: 0.2rem 0.6rem; border-radius: 50rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .location-subtitle { font-size: 0.78rem; color: #a5b4fc; font-weight: 600; padding-left: 0.75rem; border-left: 1px solid rgba(255,255,255,0.15); white-space: nowrap; }

    /* Top Left Heading HUD */
    .heading-hud {
      position: absolute; top: 1.25rem; left: 1.25rem; z-index: 100;
      background: rgba(19, 21, 27, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.12); padding: 6px 14px; border-radius: 8px;
      font-size: 0.8rem; font-weight: 600; color: #94a3b8; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    }
    .heading-hud span { color: #fff; font-weight: 700; }

    /* Top Right Compass HUD */
    .compass-hud {
      position: absolute; top: 1.25rem; right: 1.25rem; z-index: 100;
      background: rgba(19, 21, 27, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.12); width: 44px; height: 44px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    }
    .compass-dial { width: 26px; height: 26px; transition: transform 0.05s linear; display: flex; align-items: center; justify-content: center; }

    /* Floating Controls Bar (Bottom Center) */
    .floating-controls {
      position: absolute; bottom: 5.2rem; left: 50%; transform: translateX(-50%); z-index: 100;
      background: rgba(19, 21, 27, 0.88); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12); padding: 6px 14px; border-radius: 30px;
      display: flex; align-items: center; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
    }
    .ctrl-btn {
      background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.08); color: #cbd5e1;
      width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.2s ease;
    }
    .ctrl-btn:hover { background: rgba(99, 102, 241, 0.3); color: #fff; border-color: rgba(99, 102, 241, 0.5); transform: translateY(-1px); }
    .ctrl-btn.active { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border-color: transparent; }

    /* Bottom Room Navigation Bar */
    .room-bar {
      position: absolute; bottom: 1.25rem; left: 50%; transform: translateX(-50%); z-index: 100;
      background: rgba(15, 18, 28, 0.88); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 1.25rem; padding: 0.4rem 0.6rem;
      display: flex; align-items: center; gap: 0.4rem; max-width: 92vw; overflow-x: auto; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .room-bar::-webkit-scrollbar { height: 4px; }
    .room-bar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
    .room-btn {
      padding: 0.45rem 0.9rem; border-radius: 0.75rem; font-size: 0.78rem; font-weight: 600; white-space: nowrap;
      transition: all 0.2s ease; border: 1px solid transparent; cursor: pointer; color: #94a3b8; background: rgba(255, 255, 255, 0.06);
      display: flex; align-items: center; gap: 0.4rem;
    }
    .room-btn.active {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #fff; border-color: rgba(168, 85, 247, 0.4); box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
    }
    .room-btn:hover:not(.active) { background: rgba(255, 255, 255, 0.12); color: #fff; }

    /* 3D Hotspot Screen Projection Elements */
    .hotspot-wrapper {
      position: absolute; transform: translate(-50%, -100%); z-index: 50; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; pointer-events: auto;
      transition: transform 0.15s ease-out;
    }
    .hotspot-tag {
      background: #13508a; border: 2px solid #ffffff; border-radius: 4px; padding: 6px 14px;
      color: #ffffff; font-size: 11px; font-weight: 700; text-align: center; white-space: nowrap;
      box-shadow: 0 4px 15px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 5px;
      transition: all 0.2s ease;
    }
    .hotspot-wrapper:hover .hotspot-tag { background: #1d6fc2; transform: scale(1.05); }
    .hotspot-icon {
      margin-top: 4px; display: flex; justify-content: center; color: #ffffff;
      filter: drop-shadow(0px 2px 5px rgba(0,0,0,0.8));
    }

    /* Hotspot Details Card (Hover Popup) */
    .hotspot-card {
      position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%);
      background: rgba(15, 17, 26, 0.96); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 10px; padding: 12px 16px; width: 240px;
      box-shadow: 0 16px 36px rgba(0,0,0,0.8); z-index: 100; pointer-events: auto;
      display: none; animation: popFade 0.2s ease;
    }
    .hotspot-wrapper:hover .hotspot-card { display: block; }
    .hotspot-card-title { font-weight: 700; font-size: 0.88rem; color: #a5b4fc; margin-bottom: 4px; }
    .hotspot-card-area { font-size: 0.75rem; color: #f59e0b; font-weight: 700; margin-bottom: 6px; }
    .hotspot-card-desc { font-size: 0.74rem; color: #94a3b8; line-height: 1.4; word-break: break-word; }
    .hotspot-card-btn {
      margin-top: 8px; width: 100%; padding: 5px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 700;
      background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border: none; cursor: pointer; text-align: center;
    }

    /* Soft Blur VR Transition Overlay */
    .transition-overlay {
      position: absolute; inset: 0; z-index: 90; background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); opacity: 0;
      pointer-events: none; transition: opacity 0.35s ease;
    }
    .transition-overlay.active { opacity: 1; }

    @keyframes popFade {
      from { opacity: 0; transform: translateX(-50%) translateY(6px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  </style>
  ${threeScriptTag}
  ${orbitScriptTag}
  <script>
    window.EMBEDDED_TOUR_DATA = ${jsonStringified};
  </script>
</head>
<body>
  <div id="canvas-container"></div>
  <div id="hotspot-overlay-container" style="position: absolute; inset: 0; pointer-events: none; z-index: 50;"></div>
  <div id="transition-overlay" class="transition-overlay"></div>

  <!-- Top Header -->
  <div class="top-header">
    <div class="tour-title">
      <span>${projectName}</span>
      <span class="vr-badge">360° VR</span>
    </div>
    <div class="location-subtitle" id="active-location-name">Loading...</div>
  </div>

  <!-- Top Left Heading HUD -->
  <div class="heading-hud">
    Heading: <span id="heading-text">0°</span>
  </div>

  <!-- Top Right Compass HUD -->
  <div class="compass-hud">
    <div class="compass-dial" id="compass-dial">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="#818cf8"></polygon>
      </svg>
    </div>
  </div>

  <!-- Floating Controls Bar -->
  <div class="floating-controls">
    <button class="ctrl-btn" id="autorotate-btn" title="Toggle Auto Rotate" onclick="toggleAutoRotate()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
    </button>
    <button class="ctrl-btn" title="Zoom In" onclick="zoomIn()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
    </button>
    <button class="ctrl-btn" title="Zoom Out" onclick="zoomOut()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
    </button>
    <button class="ctrl-btn" title="Reset View" onclick="resetView()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
    </button>
    <button class="ctrl-btn" title="Fullscreen" onclick="toggleFullscreen()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
    </button>
  </div>

  <!-- Bottom Room Navigation Carousel -->
  <div class="room-bar" id="room-bar"></div>

  <script>
    let tourData = null;
    let currentLocation = null;
    let scene, camera, renderer, controls, sphereMesh;

    function applyAdjustmentsToMaterial(material, adjustments) {
      if (!adjustments) return;
      var adj = adjustments;
      material.onBeforeCompile = function(shader) {
        shader.uniforms.uBrightness = { value: adj.brightness || 0 };
        shader.uniforms.uContrast = { value: adj.contrast || 0 };
        shader.uniforms.uExposure = { value: adj.exposure || 0 };
        shader.uniforms.uSaturation = { value: adj.saturation || 0 };
        shader.uniforms.uHue = { value: adj.hue || 0 };
        shader.uniforms.uTemperature = { value: adj.temperature || 0 };
        shader.uniforms.uSharpen = { value: adj.sharpen || 0 };
        shader.uniforms.uVignette = { value: adj.vignette || 0 };

        shader.fragmentShader = 'uniform float uBrightness; uniform float uContrast; uniform float uExposure; uniform float uSaturation; uniform float uHue; uniform float uTemperature; uniform float uSharpen; uniform float uVignette;\n' + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          '#include <map_fragment>\n' +
          'diffuseColor.rgb *= pow(2.0, uExposure / 50.0);\n' +
          'diffuseColor.rgb += uBrightness / 100.0;\n' +
          'diffuseColor.rgb = (diffuseColor.rgb - 0.5) * (1.0 + uContrast / 100.0) + 0.5;\n' +
          'diffuseColor.r += uTemperature / 250.0;\n' +
          'diffuseColor.g += uTemperature / 500.0;\n' +
          'diffuseColor.b -= uTemperature / 250.0;\n' +
          'float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));\n' +
          'diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 1.0 + uSaturation / 100.0);\n' +
          'if (abs(uHue) > 0.1) {\n' +
          '  float angle = uHue * 0.01745329251;\n' +
          '  float cosA = cos(angle);\n' +
          '  float sinA = sin(angle);\n' +
          '  mat3 hueMat = mat3(\n' +
          '    0.299 + 0.701 * cosA + 0.168 * sinA, 0.587 - 0.587 * cosA + 0.330 * sinA, 0.114 - 0.114 * cosA - 0.497 * sinA,\n' +
          '    0.299 - 0.299 * cosA - 0.328 * sinA, 0.587 + 0.413 * cosA + 0.035 * sinA, 0.114 - 0.114 * cosA + 0.292 * sinA,\n' +
          '    0.299 - 0.300 * cosA + 1.250 * sinA, 0.587 - 0.588 * cosA - 1.050 * sinA, 0.114 + 0.886 * cosA - 0.203 * sinA\n' +
          '  );\n' +
          '  diffuseColor.rgb = clamp(hueMat * diffuseColor.rgb, 0.0, 1.0);\n' +
          '}\n' +
          'if (uSharpen > 0.1) { vec3 avgColor = vec3(lum); diffuseColor.rgb += (diffuseColor.rgb - avgColor) * (uSharpen / 200.0); }\n' +
          'if (uVignette > 0.1) { vec2 centerUv = vUv - vec2(0.5); float dist = length(centerUv); float vigFactor = smoothstep(0.75, 0.2, dist * (uVignette / 50.0)); diffuseColor.rgb *= mix(1.0, vigFactor, uVignette / 100.0); }\n' +
          'diffuseColor.rgb = clamp(diffuseColor.rgb, 0.0, 1.0);'
        );
      };
    }

    let autoRotate = false;
    const hotspotElements = [];
    const polygonMeshes = [];

    function showError(msg) {
      document.getElementById('active-location-name').innerText = msg;
    }

    function initTour() {
      try {
        tourData = window.EMBEDDED_TOUR_DATA;
        if (!tourData) { showError('Error: No tour data found'); return; }

        const locations = tourData.locations || [];
        if (locations.length === 0) {
          showError('No rooms found in this tour');
          return;
        }

        currentLocation = locations.find(l => l.id === tourData.activeLocationId) || locations[0];
        setupThreeJS();
        renderRoomTabs();
        loadRoom(currentLocation.id);
      } catch (e) {
        console.error('Tour init error:', e);
        showError('Error loading tour: ' + e.message);
      }
    }

    function setupThreeJS() {
      const container = document.getElementById('canvas-container');
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
      camera.position.set(0, 0, 0.1);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputEncoding = THREE.sRGBEncoding;
      container.appendChild(renderer.domElement);

      const OrbitControlsClass = (THREE.OrbitControls) || (window.OrbitControls);
      if (OrbitControlsClass) {
        controls = new OrbitControlsClass(camera, renderer.domElement);
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.rotateSpeed = -0.4;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 0.6;
      }

      const geometry = new THREE.SphereGeometry(500, 60, 40);
      geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0x07080d });
      sphereMesh = new THREE.Mesh(geometry, material);
      scene.add(sphereMesh);

      window.addEventListener('resize', onWindowResize);
      animate();
    }

    let currentCubeGroup = null;
    const textureLoader = new THREE.TextureLoader();

    // Render 100% Original Lossless Multi-Tile Cubemap with 16x Anisotropy Ultra-HD Quality
    function renderCubeTiles(cubeFaceData) {
      if (currentCubeGroup) {
        scene.remove(currentCubeGroup);
        currentCubeGroup.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        });
        currentCubeGroup = null;
      }

      currentCubeGroup = new THREE.Group();
      const L = 1000;
      const faceKeys = Object.keys(cubeFaceData);
      const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 16;

      faceKeys.forEach(dirKey => {
        const faceData = cubeFaceData[dirKey];
        if (!faceData || !faceData.tiles) return;

        const gridSize = faceData.gridSize || 9;
        const W = L / gridSize;

        faceData.tiles.forEach(tile => {
          const r = tile.row;
          const c = tile.col;

          const isHorizontalFace = dirKey === 'F' || dirKey === 'B' || dirKey === 'L' || dirKey === 'R';
          const isUpOrDown = dirKey === 'U' || dirKey === 'D';

          const colIndex = (isHorizontalFace || isUpOrDown) ? (gridSize - 1 - c) : c;
          const rowIndex = isUpOrDown ? (gridSize - 1 - r) : r;

          const offsetX = -L / 2 + (colIndex + 0.5) * W;
          const offsetY = L / 2 - (rowIndex + 0.5) * W;

          let pos = [0, 0, 0];
          let rot = [0, 0, 0];

          if (dirKey === 'F') {
            pos = [offsetX, offsetY, L / 2];
            rot = [0, Math.PI, 0];
          } else if (dirKey === 'B') {
            pos = [-offsetX, offsetY, -L / 2];
            rot = [0, 0, 0];
          } else if (dirKey === 'L') {
            pos = [L / 2, offsetY, -offsetX];
            rot = [0, -Math.PI / 2, 0];
          } else if (dirKey === 'R') {
            pos = [-L / 2, offsetY, offsetX];
            rot = [0, Math.PI / 2, 0];
          } else if (dirKey === 'U') {
            const offsetZ = L / 2 - (rowIndex + 0.5) * W;
            pos = [offsetX, L / 2, offsetZ];
            rot = [Math.PI / 2, 0, Math.PI];
          } else if (dirKey === 'D') {
            const offsetZ = -L / 2 + (rowIndex + 0.5) * W;
            pos = [offsetX, -L / 2, offsetZ];
            rot = [-Math.PI / 2, 0, Math.PI];
          }

          const planeGeom = new THREE.PlaneGeometry(W, W);
          const isFileProtocol = window.location.protocol === 'file:';
          const imgSrc = (isFileProtocol && tile.dataUri) ? tile.dataUri : (tile.src || tile.dataUri);
          const texture = textureLoader.load(imgSrc);
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = maxAniso;
          texture.encoding = THREE.sRGBEncoding;
          const planeMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
          applyAdjustmentsToMaterial(planeMat, currentLocation ? currentLocation.adjustments : null);
          const planeMesh = new THREE.Mesh(planeGeom, planeMat);
          planeMesh.position.set(pos[0], pos[1], pos[2]);
          planeMesh.rotation.set(rot[0], rot[1], rot[2]);
          currentCubeGroup.add(planeMesh);
        });
      });

      scene.add(currentCubeGroup);
    }

    function loadRoom(locationId) {
      const loc = tourData.locations.find(l => l.id === locationId);
      if (!loc) return;
      currentLocation = loc;

      const overlay = document.getElementById('transition-overlay');
      overlay.classList.add('active');

      setTimeout(() => {
        document.getElementById('active-location-name').innerText = loc.name;

        // Clear existing 3D polygon outline meshes
        polygonMeshes.forEach(m => scene.remove(m));
        polygonMeshes.length = 0;

        // Render 3D Area Boundary Outlines (Road / River / Building)
        (loc.hotspots || []).forEach(h => {
          if (h.polygonPoints && h.polygonPoints.length > 1) {
            const pts = h.polygonPoints.map(p => new THREE.Vector3(p[0], p[1], p[2]));
            // Close polygon loop
            if (pts.length > 2) pts.push(pts[0].clone());

            const resolvedAreaType = h.areaType || (h.icon === 'arrow' ? 'road' : 'building');
            let lineColor = 0xa5b4fc;
            if (resolvedAreaType === 'road') lineColor = 0xfbbf24;
            else if (resolvedAreaType === 'river') lineColor = 0x3b82f6;

            const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
            const lineMat = new THREE.LineBasicMaterial({ color: lineColor, linewidth: 2, transparent: true, opacity: 0.85 });
            const lineMesh = new THREE.Line(lineGeom, lineMat);
            scene.add(lineMesh);
            polygonMeshes.push(lineMesh);
          }
        });

        // Mode A: 100% Original Lossless Multi-Tile Cubemap
        if (loc.cubeFaceData && Object.keys(loc.cubeFaceData).length > 0) {
          sphereMesh.visible = false;
          renderCubeTiles(loc.cubeFaceData);
          overlay.classList.remove('active');
          renderHotspots(loc.hotspots || []);
          renderRoomTabs();
          return;
        }

        // Clean up cube group if switching to equirectangular pano
        if (currentCubeGroup) {
          scene.remove(currentCubeGroup);
          currentCubeGroup = null;
        }

        // Mode B: Equirectangular Panorama
        sphereMesh.visible = true;
        scene.background = null;

        const imgPath = loc.panoramaDataUri || loc.stitchedPanoPath || loc.imagePath || '';
        if (!imgPath || imgPath.trim() === '') {
          sphereMesh.material.map = null;
          sphereMesh.material.needsUpdate = true;
          overlay.classList.remove('active');
          renderHotspots(loc.hotspots || []);
          renderRoomTabs();
          return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
          const texture = new THREE.CanvasTexture(img);
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          sphereMesh.material.map = texture;
          applyAdjustmentsToMaterial(sphereMesh.material, loc.adjustments);
          sphereMesh.material.needsUpdate = true;
          overlay.classList.remove('active');
        };
        img.onerror = function() {
          overlay.classList.remove('active');
        };
        img.src = imgPath;

        renderHotspots(loc.hotspots || []);
        renderRoomTabs();
      }, 250);
    }

    function renderRoomTabs() {
      const bar = document.getElementById('room-bar');
      bar.innerHTML = '';
      (tourData.locations || []).forEach(loc => {
        const btn = document.createElement('button');
        btn.className = 'room-btn' + (loc.id === currentLocation.id ? ' active' : '');
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' + loc.name;
        btn.onclick = () => loadRoom(loc.id);
        bar.appendChild(btn);
      });
    }

    function renderHotspots(hotspots) {
      const container = document.getElementById('hotspot-overlay-container');
      container.innerHTML = '';
      hotspotElements.length = 0;

      hotspots.forEach(hs => {
        const wrapper = document.createElement('div');
        wrapper.className = 'hotspot-wrapper';

        const iconType = hs.icon || 'pin';
        let iconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
        if (iconType === 'arrow') {
          iconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="16 12 12 8 8 12"></polyline><line x1="12" y1="16" x2="12" y2="8"></line></svg>';
        } else if (iconType === 'info') {
          iconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        }

        const tag = document.createElement('div');
        tag.className = 'hotspot-tag';
        tag.innerHTML = (hs.isPublic === false ? '🔒 ' : '') + hs.name;

        const iconDiv = document.createElement('div');
        iconDiv.className = 'hotspot-icon';
        iconDiv.innerHTML = iconSvg;

        // Hover Card
        const hasDetails = hs.area || hs.description || hs.targetLocationId;
        if (hasDetails) {
          const card = document.createElement('div');
          card.className = 'hotspot-card';
          let html = '<div class="hotspot-card-title">' + hs.name + '</div>';
          if (hs.area) html += '<div class="hotspot-card-area">📐 Area: ' + hs.area + '</div>';
          if (hs.description) html += '<div class="hotspot-card-desc">' + hs.description + '</div>';
          if (hs.targetLocationId) {
            html += '<button class="hotspot-card-btn">Explore Room ➔</button>';
          }
          card.innerHTML = html;
          wrapper.appendChild(card);
        }

        wrapper.appendChild(tag);
        wrapper.appendChild(iconDiv);

        wrapper.onclick = () => {
          if (hs.targetLocationId) {
            loadRoom(hs.targetLocationId);
          }
        };

        container.appendChild(wrapper);
        hotspotElements.push({
          element: wrapper,
          pos: new THREE.Vector3(...(hs.position || [0, 0, -400]))
        });
      });
    }

    function updateHotspotsPosition() {
      if (!camera || hotspotElements.length === 0) return;
      const width = window.innerWidth;
      const height = window.innerHeight;

      hotspotElements.forEach(item => {
        const p = item.pos.clone();
        p.project(camera);

        if (p.z < 1) {
          const x = (p.x * 0.5 + 0.5) * width;
          const y = (-(p.y * 0.5) + 0.5) * height;
          item.element.style.display = 'flex';
          item.element.style.left = x + 'px';
          item.element.style.top = y + 'px';
        } else {
          item.element.style.display = 'none';
        }
      });
    }

    function updateHUD() {
      if (!camera) return;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const rad = Math.atan2(dir.x, dir.z);
      let deg = Math.round(rad * (180 / Math.PI));
      deg = (deg + 180) % 360;

      const headingElem = document.getElementById('heading-text');
      if (headingElem) headingElem.innerText = deg + '°';

      const compassElem = document.getElementById('compass-dial');
      if (compassElem) compassElem.style.transform = 'rotate(' + (-deg) + 'deg)';
    }

    function animate() {
      requestAnimationFrame(animate);
      if (controls) controls.update();
      updateHotspotsPosition();
      updateHUD();
      if (renderer && scene && camera) renderer.render(scene, camera);
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function toggleAutoRotate() {
      autoRotate = !autoRotate;
      if (controls) controls.autoRotate = autoRotate;
      const btn = document.getElementById('autorotate-btn');
      if (btn) {
        btn.classList.toggle('active', autoRotate);
        btn.innerHTML = autoRotate
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
      }
    }

    function zoomIn() {
      if (camera && camera.fov > 30) {
        camera.fov -= 5;
        camera.updateProjectionMatrix();
      }
    }

    function zoomOut() {
      if (camera && camera.fov < 95) {
        camera.fov += 5;
        camera.updateProjectionMatrix();
      }
    }

    function resetView() {
      if (camera && controls) {
        camera.fov = 75;
        camera.updateProjectionMatrix();
        controls.reset();
      }
    }

    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    }

    window.onload = initTour;
  </script>
</body>
</html>`;

  zip.file('index.html', indexHtmlContent);

  // Minimal Node.js HTTP server - zero dependencies, works if Node.js is installed
  zip.file(
    'server.js',
    `const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 8080;

const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp' };

http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('\\n✅ 360 Virtual Tour server running at: http://localhost:' + PORT);
  console.log('   Open your browser and visit: http://localhost:' + PORT);
  console.log('   Press Ctrl+C to stop.\\n');
});
`
  );

  zip.file(
    'run_tour_server.bat',
    `@echo off
title 360 Virtual Tour - Local Server
echo.
echo  =============================================
echo   360 Virtual Tour - Starting Local Server
echo  =============================================
echo.
echo  Opening: http://localhost:8080
echo.

where node >nul 2>nul
if %ERRORLEVEL% == 0 (
  start "" "http://localhost:8080"
  node server.js
) else (
  where python >nul 2>nul
  if %ERRORLEVEL% == 0 (
    start "" "http://localhost:8080"
    python -m http.server 8080
  ) else (
    echo ERROR: Node.js or Python not found. Please install Node.js from https://nodejs.org
    echo Or simply double-click index.html to open the tour directly.
    pause
  )
)
pause
`
  );

  zip.file(
    'README.txt',
    `======================================================
  ${projectName} - 360° Standalone Virtual Tour
======================================================

HOW TO VIEW YOUR 360° VIRTUAL TOUR:

------------------------------------------------------
OPTION A - Double-click index.html (Easiest, No setup)
------------------------------------------------------
  Just open index.html directly in Chrome, Edge, or Firefox.
  The tour works 100% offline with full 360 panorama quality.

------------------------------------------------------
OPTION B - Local Server Mode (Best, No console notices)
------------------------------------------------------
  Method 1: If Windows blocks run_tour_server.bat:
    > Right-click "run_tour_server.bat" > Properties
    > Check "Unblock" at the bottom > Apply > OK
    > Now double-click it - browser opens http://localhost:8080

  Method 2: Via Command Prompt (No unblocking needed):
    > Shift + Right-click in this folder > "Open in Terminal"
    > Type:  node server.js
    > Open browser: http://localhost:8080
    (Requires Node.js from https://nodejs.org)

  Method 3: Via Python (if Python is installed):
    > Shift + Right-click in this folder > "Open in Terminal"
    > Type:  python -m http.server 8080
    > Open browser: http://localhost:8080

------------------------------------------------------
OPTION C - Upload to Web Hosting
------------------------------------------------------
  Upload all extracted files to any web hosting provider.
  Works on any server - no backend/database required.

No internet required to view the tour! Works 100% offline.
`
  );

  if (onProgress) onProgress('Compacting ZIP archive...', 90);

  const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata: any) => {
    if (onProgress) {
      onProgress(`Compressing package (${Math.round(metadata.percent)}%)...`, 90 + Math.floor((metadata.percent / 100) * 10));
    }
  });

  if (onProgress) onProgress('Download starting...', 100);

  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${sanitizedFolderName}_360_Tour.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}
