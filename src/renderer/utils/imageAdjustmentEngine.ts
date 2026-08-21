
export interface ImageAdjustments {
  brightness: number;  // -100 to +100
  contrast: number;    // -100 to +100
  exposure: number;    // -100 to +100
  saturation: number;  // -100 to +100
  hue: number;         // -180 to +180
  temperature: number; // -100 to +100
  sharpen: number;     // 0 to +100
  vignette: number;    // 0 to +100
  preset?: string;     // Preset name or 'Custom'
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  exposure: 0,
  saturation: 0,
  hue: 0,
  temperature: 0,
  sharpen: 0,
  vignette: 0,
  preset: 'Original',
};

export const PRESETS: Record<string, ImageAdjustments> = {
  Original: { brightness: 0, contrast: 0, exposure: 0, saturation: 0, hue: 0, temperature: 0, sharpen: 0, vignette: 0, preset: 'Original' },
  Vintage: { brightness: 5, contrast: 10, exposure: 0, saturation: -15, hue: 0, temperature: 20, sharpen: 10, vignette: 25, preset: 'Vintage' },
  Cinematic: { brightness: -5, contrast: 25, exposure: -5, saturation: -10, hue: -5, temperature: -10, sharpen: 15, vignette: 30, preset: 'Cinematic' },
  'Black & White': { brightness: 0, contrast: 15, exposure: 0, saturation: -100, hue: 0, temperature: 0, sharpen: 10, vignette: 10, preset: 'Black & White' },
  Warm: { brightness: 5, contrast: 5, exposure: 5, saturation: 10, hue: 0, temperature: 35, sharpen: 0, vignette: 5, preset: 'Warm' },
  Cool: { brightness: 0, contrast: 5, exposure: 0, saturation: 5, hue: 0, temperature: -35, sharpen: 0, vignette: 5, preset: 'Cool' },
  'High Contrast': { brightness: 0, contrast: 45, exposure: 5, saturation: 15, hue: 0, temperature: 0, sharpen: 20, vignette: 15, preset: 'High Contrast' },
  Natural: { brightness: 5, contrast: 8, exposure: 0, saturation: 12, hue: 0, temperature: 5, sharpen: 8, vignette: 0, preset: 'Natural' },
};

/**
  Inject GLSL shader chunks into Three.js MeshBasicMaterial for 60 FPS GPU image adjustment
 */
export function injectAdjustmentsShader(shader: any, uniformsRef: React.MutableRefObject<any>) {
  shader.uniforms.uBrightness = uniformsRef.current.uBrightness;
  shader.uniforms.uContrast = uniformsRef.current.uContrast;
  shader.uniforms.uExposure = uniformsRef.current.uExposure;
  shader.uniforms.uSaturation = uniformsRef.current.uSaturation;
  shader.uniforms.uHue = uniformsRef.current.uHue;
  shader.uniforms.uTemperature = uniformsRef.current.uTemperature;
  shader.uniforms.uSharpen = uniformsRef.current.uSharpen;
  shader.uniforms.uVignette = uniformsRef.current.uVignette;

  shader.fragmentShader = `
    uniform float uBrightness;
    uniform float uContrast;
    uniform float uExposure;
    uniform float uSaturation;
    uniform float uHue;
    uniform float uTemperature;
    uniform float uSharpen;
    uniform float uVignette;
    ${shader.fragmentShader}
  `;

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <map_fragment>',
    `
    #include <map_fragment>

    // 1. Exposure
    diffuseColor.rgb *= pow(2.0, uExposure / 50.0);

    // 2. Brightness
    diffuseColor.rgb += uBrightness / 100.0;

    // 3. Contrast
    diffuseColor.rgb = (diffuseColor.rgb - 0.5) * (1.0 + uContrast / 100.0) + 0.5;

    // 4. Temperature (Warm = +, Cool = -)
    diffuseColor.r += uTemperature / 250.0;
    diffuseColor.g += uTemperature / 500.0;
    diffuseColor.b -= uTemperature / 250.0;

    // 5. Saturation
    float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 1.0 + uSaturation / 100.0);

    // 6. Hue Shift
    if (abs(uHue) > 0.1) {
      float angle = uHue * 0.01745329251;
      float cosA = cos(angle);
      float sinA = sin(angle);
      mat3 hueMat = mat3(
        0.299 + 0.701 * cosA + 0.168 * sinA, 0.587 - 0.587 * cosA + 0.330 * sinA, 0.114 - 0.114 * cosA - 0.497 * sinA,
        0.299 - 0.299 * cosA - 0.328 * sinA, 0.587 + 0.413 * cosA + 0.035 * sinA, 0.114 - 0.114 * cosA + 0.292 * sinA,
        0.299 - 0.300 * cosA + 1.250 * sinA, 0.587 - 0.588 * cosA - 1.050 * sinA, 0.114 + 0.886 * cosA - 0.203 * sinA
      );
      diffuseColor.rgb = clamp(hueMat * diffuseColor.rgb, 0.0, 1.0);
    }

    // 7. Sharpening simulation
    if (uSharpen > 0.1) {
      vec3 avgColor = vec3(lum);
      diffuseColor.rgb += (diffuseColor.rgb - avgColor) * (uSharpen / 200.0);
    }

    // 8. Vignette
    #ifdef USE_MAP
    if (uVignette > 0.1) {
      vec2 centerUv = vMapUv - vec2(0.5);
      float dist = length(centerUv);
      float vigFactor = smoothstep(0.75, 0.2, dist * (uVignette / 50.0));
      diffuseColor.rgb *= mix(1.0, vigFactor, uVignette / 100.0);
    }
    #endif

    diffuseColor.rgb = clamp(diffuseColor.rgb, 0.0, 1.0);
    `
  );
}

/**
  Canvas 2D image processing utility for 2D export, offline rendering, and thumbnail generation
 */
export function applyAdjustmentsToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  adjustments: ImageAdjustments = DEFAULT_ADJUSTMENTS
) {
  const { brightness, contrast, exposure, saturation, hue, temperature, sharpen, vignette } = adjustments;

  if (
    brightness === 0 &&
    contrast === 0 &&
    exposure === 0 &&
    saturation === 0 &&
    hue === 0 &&
    temperature === 0 &&
    sharpen === 0 &&
    vignette === 0
  ) {
    return;
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const len = data.length;

  const expFactor = Math.pow(2.0, exposure / 50.0);
  const brightOffset = (brightness / 100.0) * 255;
  const contrastFactor = 1.0 + contrast / 100.0;
  const satFactor = 1.0 + saturation / 100.0;
  const tempR = (temperature / 250.0) * 255;
  const tempG = (temperature / 500.0) * 255;
  const tempB = -(temperature / 250.0) * 255;

  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const vigVal = vignette / 100.0;

  let angle = hue * 0.01745329251;
  let cosA = Math.cos(angle);
  let sinA = Math.sin(angle);
  let hasHue = Math.abs(hue) > 0.1;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r = r * expFactor + brightOffset;
    g = g * expFactor + brightOffset;
    b = b * expFactor + brightOffset;

    r = (r - 127.5) * contrastFactor + 127.5;
    g = (g - 127.5) * contrastFactor + 127.5;
    b = (b - 127.5) * contrastFactor + 127.5;

    r += tempR;
    g += tempG;
    b += tempB;

    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + (r - lum) * satFactor;
    g = lum + (g - lum) * satFactor;
    b = lum + (b - lum) * satFactor;

    if (hasHue) {
      let nr = r * (0.299 + 0.701 * cosA + 0.168 * sinA) + g * (0.587 - 0.587 * cosA + 0.330 * sinA) + b * (0.114 - 0.114 * cosA - 0.497 * sinA);
      let ng = r * (0.299 - 0.299 * cosA - 0.328 * sinA) + g * (0.587 + 0.413 * cosA + 0.035 * sinA) + b * (0.114 - 0.114 * cosA + 0.292 * sinA);
      let nb = r * (0.299 - 0.300 * cosA + 1.250 * sinA) + g * (0.587 - 0.588 * cosA - 1.050 * sinA) + b * (0.114 + 0.886 * cosA - 0.203 * sinA);
      r = nr; g = ng; b = nb;
    }

    if (sharpen > 0.1) {
      r += (r - lum) * (sharpen / 200.0);
      g += (g - lum) * (sharpen / 200.0);
      b += (b - lum) * (sharpen / 200.0);
    }

    if (vigVal > 0.01) {
      let px = (i / 4) % width;
      let py = Math.floor((i / 4) / width);
      let dx = px - cx;
      let dy = py - cy;
      let dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      let factor = 1.0 - Math.min(1.0, dist * (vigVal * 1.5));
      r *= factor;
      g *= factor;
      b *= factor;
    }

    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }

  ctx.putImageData(imageData, 0, 0);
}
