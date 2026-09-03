import { ImageAdjustments, DEFAULT_ADJUSTMENTS, injectAdjustmentsShader } from '../utils/imageAdjustmentEngine';
import React, { useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Compass,
  Play,
  Pause,
  PlusCircle,
  XCircle,
  CheckCircle,
  MapPin,
  ArrowUpCircle,
  Info,
  Sliders,
  Building2,
  Plane,
  Zap,
  Droplets,
  Cpu,
  Utensils,
  Waves,
  Trees,
  Navigation2,
  ChevronRight
} from 'lucide-react';
import { API_BASE_URL, toCloudFrontUrl } from '../utils/apiConfig';

interface ProjectImage {
  name: string;
  path: string;
}

export interface HotspotItem {
  id: string;
  targetLocationId?: string;
  name: string;
  subtitle?: string; // e.g. "5 km" or "101 km"
  category?: string; // e.g. "Industrial" | "Residential" | "Commercial" | "Infrastructure" | "Connectivity"
  area?: string;
  description?: string;
  position: [number, number, number];
  polygonPoints?: [number, number, number][];
  icon?: string;
  customIconUrl?: string; // Uploaded custom PNG/SVG URL
  beaconColor?: string; // e.g. '#6366f1' | '#a855f7' | '#06b6d4' | '#10b981' | '#f59e0b'
  areaType?: 'building' | 'river' | 'road';
  isPublic?: boolean;
  assignedUserId?: string;
  assignedUserName?: string;
}

// Helper to render custom uploaded icon or matching category preset icon
export const renderHotspotIcon = (icon?: string, customIconUrl?: string, size = 18) => {
  if (customIconUrl) {
    const fullUrl = customIconUrl.startsWith('http') || customIconUrl.startsWith('data:')
      ? toCloudFrontUrl(customIconUrl)
      : `${API_BASE_URL}${customIconUrl.startsWith('/') ? '' : '/'}${customIconUrl}`;
    return (
      <img
        src={fullUrl}
        alt="icon"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          display: 'block'
        }}
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  switch (icon) {
    case 'building':
    case 'commercial':
      return <Building2 size={size} />;
    case 'airport':
    case 'flight':
      return <Plane size={size} />;
    case 'energy':
    case 'power':
      return <Zap size={size} />;
    case 'water':
    case 'reservoir':
      return <Droplets size={size} />;
    case 'factory':
    case 'chip':
    case 'semiconductor':
    case 'industrial':
      return <Cpu size={size} />;
    case 'food':
    case 'dining':
      return <Utensils size={size} />;
    case 'canal':
    case 'waterfront':
    case 'river':
      return <Waves size={size} />;
    case 'nature':
    case 'green':
    case 'park':
      return <Trees size={size} />;
    case 'road':
      return <Navigation2 size={size} />;
    case 'arrow':
      return <ArrowUpCircle size={size} style={{ transform: 'rotate(180deg)' }} />;
    case 'info':
      return <Info size={size} />;
    case 'pin':
    default:
      return <MapPin size={size} />;
  }
};


interface AdjustedMaterialProps {
  map: THREE.Texture;
  side?: THREE.Side;
  adjustments?: ImageAdjustments;
}

const AdjustedMaterial: React.FC<AdjustedMaterialProps> = ({ map, side = THREE.DoubleSide, adjustments = DEFAULT_ADJUSTMENTS }) => {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const uniformsRef = useRef({
    uBrightness: { value: 0 },
    uContrast: { value: 0 },
    uExposure: { value: 0 },
    uSaturation: { value: 0 },
    uHue: { value: 0 },
    uTemperature: { value: 0 },
    uSharpen: { value: 0 },
    uVignette: { value: 0 },
  });

  useFrame(() => {
    if (adjustments) {
      const b = adjustments.brightness || 0;
      const c = adjustments.contrast || 0;
      const exp = adjustments.exposure || 0;
      const s = adjustments.saturation || 0;
      const h = adjustments.hue || 0;
      const t = adjustments.temperature || 0;
      const sh = adjustments.sharpen || 0;
      const v = adjustments.vignette || 0;

      uniformsRef.current.uBrightness.value = b;
      uniformsRef.current.uContrast.value = c;
      uniformsRef.current.uExposure.value = exp;
      uniformsRef.current.uSaturation.value = s;
      uniformsRef.current.uHue.value = h;
      uniformsRef.current.uTemperature.value = t;
      uniformsRef.current.uSharpen.value = sh;
      uniformsRef.current.uVignette.value = v;

      if (matRef.current && (matRef.current as any).userData?.shader?.uniforms) {
        const u = (matRef.current as any).userData.shader.uniforms;
        if (u.uBrightness) u.uBrightness.value = b;
        if (u.uContrast) u.uContrast.value = c;
        if (u.uExposure) u.uExposure.value = exp;
        if (u.uSaturation) u.uSaturation.value = s;
        if (u.uHue) u.uHue.value = h;
        if (u.uTemperature) u.uTemperature.value = t;
        if (u.uSharpen) u.uSharpen.value = sh;
        if (u.uVignette) u.uVignette.value = v;
      }
    }
  });

  const onBeforeCompile = useCallback((shader: THREE.Shader) => {
    if (matRef.current) {
      (matRef.current as any).userData.shader = shader;
    }
    injectAdjustmentsShader(shader, uniformsRef);
  }, []);

  return (
    <meshBasicMaterial
      ref={matRef}
      map={map}
      side={side}
      onBeforeCompile={onBeforeCompile}
      customProgramCacheKey={() => 'adjusted_360_material_v1'}
    />
  );
};

interface TileMeshProps {
  adjustments?: ImageAdjustments;
  imagePath: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  onDoubleClick?: (e: any) => void;
}

const TileMesh: React.FC<TileMeshProps> = ({ imagePath, position, rotation, size, onDoubleClick, adjustments }) => {
  let resolvedUrl = imagePath;
  if (!imagePath) {
    resolvedUrl = '';
  } else if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
    resolvedUrl = toCloudFrontUrl(imagePath);
  } else if (imagePath.startsWith('/uploads/')) {
    resolvedUrl = `${API_BASE_URL}${imagePath}`;
  } else {
    const cleanPath = imagePath.replace(/^file:\/\/\/?/, '');
    resolvedUrl = `${API_BASE_URL}/api/local-image?path=${encodeURIComponent(cleanPath)}`;
  }

  const texture = useLoader(THREE.TextureLoader, resolvedUrl) as THREE.Texture;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  if ((THREE as any).SRGBColorSpace) {
    texture.colorSpace = (THREE as any).SRGBColorSpace;
  }

  return (
    <mesh position={position} rotation={rotation} onDoubleClick={onDoubleClick}>
      <planeGeometry args={size} />
      <AdjustedMaterial map={texture} side={THREE.DoubleSide} adjustments={adjustments} />
    </mesh>
  );
};

const EquirectangularPano: React.FC<{ imagePath: string; adjustments?: ImageAdjustments }> = ({ imagePath, adjustments }) => {
  let resolvedUrl = imagePath;
  if (!imagePath) {
    resolvedUrl = '';
  } else if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
    resolvedUrl = toCloudFrontUrl(imagePath);
  } else if (imagePath.startsWith('/uploads/')) {
    resolvedUrl = `${API_BASE_URL}${imagePath}`;
  } else {
    const cleanPath = imagePath.replace(/^file:\/\/\/?/, '');
    resolvedUrl = `${API_BASE_URL}/api/local-image?path=${encodeURIComponent(cleanPath)}`;
  }

  const texture = useLoader(THREE.TextureLoader, resolvedUrl);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  if ((THREE as any).SRGBColorSpace) {
    texture.colorSpace = (THREE as any).SRGBColorSpace;
  }

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 60, 40]} />
      <AdjustedMaterial map={texture} side={THREE.DoubleSide} adjustments={adjustments} />
    </mesh>
  );
};

interface GridFaceProps {
  adjustments?: ImageAdjustments;
  images: ProjectImage[];
  faceKey: string;
  gridSize: number;
  onTileDoubleClick?: (e: any) => void;
}

const GridFace: React.FC<GridFaceProps> = ({ images, faceKey, gridSize, onTileDoubleClick, adjustments }) => {
  const L = 1000;
  const W = L / gridSize;
  const tiles: React.ReactNode[] = [];

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const idx = r * gridSize + c;
      if (idx >= images.length) break;

      const img = images[idx];
      let pos: [number, number, number] = [0, 0, 0];
      let rot: [number, number, number] = [0, 0, 0];

      let targetFaceKey = faceKey;

      const isHorizontalFace = targetFaceKey === 'F' || targetFaceKey === 'B' || targetFaceKey === 'L' || targetFaceKey === 'R';
      const isUpOrDown = targetFaceKey === 'U' || targetFaceKey === 'D';

      const colIndex = (isHorizontalFace || isUpOrDown) ? (gridSize - 1 - c) : c;
      const rowIndex = isUpOrDown ? (gridSize - 1 - r) : r;

      const offsetX = -L / 2 + (colIndex + 0.5) * W;
      const offsetY = L / 2 - (rowIndex + 0.5) * W;

      if (targetFaceKey === 'F') {
        pos = [offsetX, offsetY, L / 2];
        rot = [0, Math.PI, 0];
      } else if (targetFaceKey === 'B') {
        pos = [-offsetX, offsetY, -L / 2];
        rot = [0, 0, 0];
      } else if (targetFaceKey === 'L') {
        pos = [L / 2, offsetY, -offsetX];
        rot = [0, -Math.PI / 2, 0];
      } else if (targetFaceKey === 'R') {
        pos = [-L / 2, offsetY, offsetX];
        rot = [0, Math.PI / 2, 0];
      } else if (targetFaceKey === 'U') {
        const offsetZ = L / 2 - (rowIndex + 0.5) * W;
        pos = [offsetX, L / 2, offsetZ];
        rot = [Math.PI / 2, 0, Math.PI];
      } else if (targetFaceKey === 'D') {
        const offsetZ = -L / 2 + (rowIndex + 0.5) * W;
        pos = [offsetX, -L / 2, offsetZ];
        rot = [-Math.PI / 2, 0, Math.PI];
      }

      tiles.push(
        <TileMesh
          key={`${faceKey}-${r}-${c}`}
          imagePath={img.path}
          position={pos}
          rotation={rot}
          size={[W, W]}
          onDoubleClick={onTileDoubleClick}
          adjustments={adjustments}
        />
      );
    }
  }

  return <group>{tiles}</group>;
};

const getPolygonMesh = (pts: [number, number, number][]) => {
  if (!pts || pts.length < 3) return null;

  // 1. Calculate Polygon Normal using Newell's method for arbitrary 3D orientation
  const normal = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < pts.length; i++) {
    const current = new THREE.Vector3(...pts[i]);
    const next = new THREE.Vector3(...pts[(i + 1) % pts.length]);
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  normal.normalize();

  // If normal is zero/degenerate, fallback to cross product of first 3 points
  if (normal.lengthSq() < 0.0001) {
    const v0 = new THREE.Vector3(...pts[0]);
    const v1 = new THREE.Vector3(...pts[1]);
    const v2 = new THREE.Vector3(...pts[2]);
    normal.crossVectors(v1.clone().sub(v0), v2.clone().sub(v0)).normalize();
  }

  // 2. Construct Orthonormal 2D basis (uAxis, vAxis) perpendicular to normal
  let uAxis = new THREE.Vector3(1, 0, 0);
  if (Math.abs(normal.dot(uAxis)) > 0.9) {
    uAxis = new THREE.Vector3(0, 1, 0);
  }
  const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();
  uAxis.crossVectors(vAxis, normal).normalize();

  // 3. Project 3D points onto 2D plane for clean planar triangulation
  const points2D = pts.map(p => {
    const vec = new THREE.Vector3(...p);
    return new THREE.Vector2(vec.dot(uAxis), vec.dot(vAxis));
  });

  // 4. Robust Ear-Clipping Triangulation using THREE.ShapeUtils
  let triangles: number[][] = [];
  try {
    triangles = THREE.ShapeUtils.triangulateShape(points2D, []);
  } catch (e) {
    triangles = [];
  }

  // Fallback if triangulation returned empty or failed
  if (!triangles || triangles.length === 0) {
    for (let i = 1; i < pts.length - 1; i++) {
      triangles.push([0, i, i + 1]);
    }
  }

  const indices: number[] = [];
  for (const tri of triangles) {
    indices.push(tri[0], tri[1], tri[2]);
  }

  const vertices = new Float32Array(pts.flatMap(p => p));
  return { vertices, indices: new Uint16Array(indices) };
};

const RoadArrowHelper = ({ start, end, color }: { start: [number, number, number], end: [number, number, number], color: string }) => {
  const ref = React.useRef<THREE.Mesh>(null);

  React.useEffect(() => {
    if (ref.current) {
      const midX = (start[0] + end[0]) / 2;
      const midY = (start[1] + end[1]) / 2;
      const midZ = (start[2] + end[2]) / 2;
      ref.current.position.set(midX, midY, midZ);

      const target = new THREE.Vector3(...end);
      ref.current.lookAt(target);
      ref.current.rotateX(Math.PI / 2);
    }
  }, [start, end]);

  return (
    <mesh ref={ref}>
      <coneGeometry args={[12, 35, 4]} />
      <meshBasicMaterial color={color} depthTest={false} />
    </mesh>
  );
};

const RoadArrowBanner = ({
  start,
  end,
  name,
  h,
  contextMenuId,
  setContextMenuId,
  isOpen,
  hasDetails,
  setActiveInfoId,
  onEditHotspot,
  onDeleteHotspot,
  onAddAreaOutline,
  onNavigate
}: {
  start: [number, number, number];
  end: [number, number, number];
  name: string;
  h: HotspotItem;
  contextMenuId: string | null;
  setContextMenuId: (id: string | null) => void;
  isOpen: boolean;
  hasDetails: boolean;
  setActiveInfoId: (id: string | null) => void;
  onEditHotspot: (hs: HotspotItem) => void;
  onDeleteHotspot: (id: string) => void;
  onAddAreaOutline: (hs: HotspotItem) => void;
  onNavigate: (targetId: string) => void;
}) => {
  const groupRef = React.useRef<THREE.Group>(null);

  const p1 = React.useMemo(() => new THREE.Vector3(...start), [start]);
  const p2 = React.useMemo(() => new THREE.Vector3(...end), [end]);
  const distance = React.useMemo(() => p1.distanceTo(p2), [p1, p2]);
  const midpoint = React.useMemo(() => p1.clone().add(p2).multiplyScalar(0.5), [p1, p2]);

  const shape = React.useMemo(() => {
    const s = new THREE.Shape();
    const halfL = distance / 2;
    const halfH = 10; // thinner height
    const tip = 20;   // balanced arrow tip depth

    s.moveTo(-halfL, 0);
    s.lineTo(-halfL + tip, halfH);
    s.lineTo(halfL - tip, halfH);
    s.lineTo(halfL, 0);
    s.lineTo(halfL - tip, -halfH);
    s.lineTo(-halfL + tip, -halfH);
    s.closePath();
    return s;
  }, [distance]);

  React.useEffect(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(p2);
    }
  }, [p2]);

  return (
    <group ref={groupRef} position={midpoint}>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color="#174d80" side={THREE.DoubleSide} depthTest={false} />
      </mesh>

      <Html position={[0, 0, 5]} center zIndexRange={[0, 50]}>
        <div
          style={{ position: 'relative', pointerEvents: 'auto' }}
          onMouseEnter={() => { if (hasDetails && contextMenuId !== h.id) setActiveInfoId(h.id); }}
          onMouseLeave={() => { if (hasDetails) setActiveInfoId(null); }}
        >
          {/* Context Menu (Above) */}
          {contextMenuId === h.id && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 10px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 17, 26, 0.98)',
              border: '1px solid #1f2330',
              borderRadius: '6px',
              padding: '4px',
              minWidth: '110px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              zIndex: 110,
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenuId(null);
                  onEditHotspot(h);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                ✏ Edit Details
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenuId(null);
                  onAddAreaOutline(h);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                📐 Area Outline
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenuId(null);
                  onDeleteHotspot(h.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-error)',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                ✕ Delete
              </button>
            </div>
          )}

          {/* Details Card */}
          {hasDetails && isOpen && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 10px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 17, 26, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #1f2330',
              borderRadius: '8px',
              padding: '12px 16px',
              width: '240px',
              color: 'white',
              boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              zIndex: 100,
              pointerEvents: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#a5b4fc' }}>{h.name}</span>
              </div>
              {h.area && (
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 'bold', marginBottom: '6px' }}>
                  📐 Area: {h.area}
                </div>
              )}
              {h.description && (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                  {h.description}
                </div>
              )}
            </div>
          )}

          <div
            onClick={(e) => {
              e.stopPropagation();
              if (h.targetLocationId) onNavigate(h.targetLocationId, h.position);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenuId(contextMenuId === h.id ? null : h.id);
            }}
            style={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: '18px',
              textAlign: 'center',
              textShadow: '0 2px 8px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              userSelect: 'none',
              pointerEvents: 'auto',
              background: 'none',
              border: 'none',
              boxShadow: 'none'
            }}
          >
            {name}
          </div>
        </div>
      </Html>
    </group>
  );
};

interface SceneGroupProps {
  adjustments?: ImageAdjustments;
  directions: Record<string, ProjectImage[]>;
  gridConfigs: Record<string, string>;
  hotspots: HotspotItem[];
  stitchedPanoPath?: string;
  autoRotate: boolean;
  isPlacingHotspot: boolean;
  isDrawingArea: boolean;
  onAddHotspot: (position: [number, number, number]) => void;
  onNavigate: (targetId: string) => void;
  drawingPoints: [number, number, number][];
  setDrawingPoints: (pts: [number, number, number][]) => void;
  headingTextRef: React.RefObject<HTMLSpanElement>;
  compassContainerRef: React.RefObject<HTMLDivElement>;
  onEditHotspot: (hs: HotspotItem) => void;
  onDeleteHotspot: (id: string) => void;
  onAddAreaOutline: (hs: HotspotItem) => void;
  areaType: 'building' | 'river' | 'road';
  isPreloading?: boolean;
}

const SceneGroup: React.FC<SceneGroupProps> = ({
  adjustments,
  directions,
  gridConfigs,
  hotspots,
  stitchedPanoPath,
  autoRotate,
  isPlacingHotspot,
  isDrawingArea,
  onAddHotspot,
  onNavigate,
  drawingPoints,
  setDrawingPoints,
  headingTextRef,
  compassContainerRef,
  onEditHotspot,
  onDeleteHotspot,
  onAddAreaOutline,
  areaType,
  isPreloading = false
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  useFrame(() => {
    if (groupRef.current) {
      if (autoRotate) {
        groupRef.current.rotation.y += 0.001;
      }
      const deg = (groupRef.current.rotation.y * (180 / Math.PI)) % 360;
      const headingVal = Math.round(deg < 0 ? deg + 360 : deg);

      if (headingTextRef.current) {
        headingTextRef.current.innerText = `${headingVal}°`;
      }
      if (compassContainerRef.current) {
        compassContainerRef.current.style.transform = `rotate(${-headingVal}deg)`;
      }
    }
  });

  const safeDirections = directions || { F: [], B: [], L: [], R: [], U: [], D: [] };
  const safeGridConfigs = gridConfigs || {};
  const safeHotspots = hotspots || [];

  const getGridSize = (faceKey: string) => {
    const config = safeGridConfigs[faceKey] || 'auto';
    if (config === '2x2') return 2;
    if (config === '3x3') return 3;
    if (config === '5x5') return 5;
    if (config === '9x9') return 9;

    const count = safeDirections[faceKey]?.length || 0;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    if (count <= 25) return 5;
    return 9;
  };

  const handleGroupClick = (e: any) => {
    setContextMenuId(null);
    if (!isPlacingHotspot) return;
    e.stopPropagation();
    const localPoint = groupRef.current ? groupRef.current.worldToLocal(e.point.clone()) : e.point;
    const clickPos: [number, number, number] = [localPoint.x, localPoint.y, localPoint.z];

    if (isDrawingArea) {
      setDrawingPoints([...drawingPoints, clickPos]);
    } else {
      onAddHotspot(clickPos);
    }
  };

  const labelPositions: Record<string, [number, number, number]> = {
    F: [0, 0, 480],
    B: [0, 0, -480],
    L: [480, 0, 0],
    R: [-480, 0, 0],
    U: [0, 480, 0],
    D: [0, -480, 0]
  };

  const getLabelName = (key: string) => {
    if (key === 'F') return 'FRONT';
    if (key === 'B') return 'BACK';
    if (key === 'L') return 'LEFT';
    if (key === 'R') return 'RIGHT';
    if (key === 'U') return 'UP';
    if (key === 'D') return 'DOWN';
    return key;
  };

  return (
    <group ref={groupRef} onDoubleClick={handleGroupClick}>
      {Object.keys(safeDirections).map(faceKey => (
        <React.Suspense key={faceKey} fallback={null}>
          <GridFace
            images={safeDirections[faceKey] || []}
            faceKey={faceKey}
            gridSize={getGridSize(faceKey)}
            onTileDoubleClick={handleGroupClick}
            adjustments={adjustments}
          />
        </React.Suspense>
      ))}

      {/* Render 3D saved hotspots and area lines ONLY when isPreloading === false and NOT drawing area outline */}
      {!isPreloading && !isDrawingArea && safeHotspots
        .filter(h => {
          if (h.isPublic === false) {
            try {
              const saved = localStorage.getItem('crm_user');
              if (!saved) return false;
              const user = JSON.parse(saved);
              if (user.role === 'admin') return true;
              return user.id === h.assignedUserId;
            } catch (e) { return false; }
          }
          return true;
        })
        .map(h => {
          const hasPolygon = h.polygonPoints && h.polygonPoints.length > 1;
          const hasDetails = h.area || h.description;
          const isOpen = activeInfoId === h.id;

          // Healing fallback for older saved project files
          const resolvedAreaType = h.areaType || (hasPolygon && h.icon === 'arrow' ? 'road' : 'building');

          // Dynamic colors based on Area Style and Hotspot Beacon Color
          let lineColor = h.beaconColor || '#a855f7'; // Purple / Violet or configured theme
          let overlayColor = h.beaconColor || '#a855f7';
          let overlayOpacity = 0.25;

          if (resolvedAreaType === 'river') {
            lineColor = '#3b82f6';
            overlayColor = '#3b82f6';
            overlayOpacity = 0.35;
          } else if (resolvedAreaType === 'road') {
            lineColor = '#fbbf24';
            overlayColor = '#fbbf24';
            overlayOpacity = 0.25;
          }

          const shouldShowOutline = isOpen;

          return (
            <React.Fragment key={h.id}>
              {/* 1. Draw Area Overlay (Clean semi-transparent shape on hover for Building/Land only) */}
              {hasPolygon && shouldShowOutline && resolvedAreaType !== 'road' && resolvedAreaType !== 'river' && (() => {
                const meshData = getPolygonMesh(h.polygonPoints!);
                if (!meshData) return null;
                return (
                  <mesh
                    onClick={(e) => {
                      e.stopPropagation();
                      if (h.targetLocationId) onNavigate(h.targetLocationId, h.position);
                    }}
                  >
                    <bufferGeometry>
                      <bufferAttribute
                        attach="attributes-position"
                        args={[meshData.vertices, 3]}
                      />
                      <bufferAttribute
                        attach="index"
                        args={[meshData.indices, 1]}
                      />
                    </bufferGeometry>
                    <meshBasicMaterial
                      color={overlayColor}
                      opacity={overlayOpacity}
                      transparent={true}
                      side={THREE.DoubleSide}
                      depthTest={false}
                      depthWrite={false}
                    />
                  </mesh>
                );
              })()}

              {/* 2. Draw Area Outline Line (Shows only on hover or when editing) */}
              {hasPolygon && shouldShowOutline && (
                <Line
                  points={(resolvedAreaType === 'road' || resolvedAreaType === 'river') ? h.polygonPoints! : [...h.polygonPoints!, h.polygonPoints![0]]}
                  color={lineColor}
                  lineWidth={4}
                  depthTest={false}
                />
              )}

              {/* 2b. If Road, render directional arrows along the path on hover */}
              {resolvedAreaType === 'road' && shouldShowOutline && h.polygonPoints && h.polygonPoints.length > 1 && (
                <group>
                  {h.polygonPoints.slice(0, -1).map((pt, idx) => (
                    <RoadArrowHelper
                      key={idx}
                      start={pt}
                      end={h.polygonPoints![idx + 1]}
                      color={lineColor}
                    />
                  ))}
                </group>
              )}

              {(() => {
                const isRoadArrow = resolvedAreaType === 'road' && h.icon === 'arrow';

                if (isRoadArrow && h.polygonPoints && h.polygonPoints.length > 1) {
                  return (
                    <RoadArrowBanner
                      start={h.polygonPoints[0]}
                      end={h.polygonPoints[h.polygonPoints.length - 1]}
                      name={h.name}
                      h={h}
                      contextMenuId={contextMenuId}
                      setContextMenuId={setContextMenuId}
                      isOpen={isOpen}
                      hasDetails={hasDetails}
                      setActiveInfoId={setActiveInfoId}
                      onEditHotspot={onEditHotspot}
                      onDeleteHotspot={onDeleteHotspot}
                      onAddAreaOutline={onAddAreaOutline}
                      onNavigate={onNavigate}
                    />
                  );
                }

                return (
                  <Html position={h.position} center zIndexRange={[10, 50]}>
                    <div
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        transform: 'translateY(-50%) translateY(8px)',
                        pointerEvents: 'auto'
                      }}
                      onMouseEnter={() => { if (contextMenuId !== h.id) setActiveInfoId(h.id); }}
                      onMouseLeave={() => { setActiveInfoId(null); }}
                    >
                      {/* Context Menu (Above Pin) */}
                      {contextMenuId === h.id && (
                        <div style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 10px)',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'rgba(15, 17, 26, 0.98)',
                          border: '1px solid #1f2330',
                          borderRadius: '6px',
                          padding: '4px',
                          minWidth: '110px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                          zIndex: 99999,
                          pointerEvents: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContextMenuId(null);
                              onEditHotspot(h);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'white',
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            ✏ Edit Details
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContextMenuId(null);
                              onAddAreaOutline(h);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'white',
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            📐 Area Outline
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContextMenuId(null);
                              onDeleteHotspot(h.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-error)',
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            ✕ Delete
                          </button>
                        </div>
                      )}

                      {/* Details Card (Popup on Hover with Top z-index & Smart Positioning) */}
                      {hasDetails && isOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            ...(h.position[1] > 20
                              ? { top: 'calc(100% + 14px)' }
                              : { bottom: 'calc(100% + 14px)' }),
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(9, 13, 24, 0.96)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                            border: `1px solid ${h.beaconColor ? `${h.beaconColor}99` : 'rgba(99, 102, 241, 0.5)'}`,
                            borderRadius: '14px',
                            padding: '12px 16px',
                            width: '290px',
                            maxWidth: '85vw',
                            color: '#ffffff',
                            boxShadow: `0 25px 60px rgba(0,0,0,0.9), 0 0 25px ${h.beaconColor ? `${h.beaconColor}44` : 'rgba(99, 102, 241, 0.3)'}`,
                            zIndex: 99999,
                            pointerEvents: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          {/* Card Top Title Row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '6px',
                                  background: h.beaconColor ? `${h.beaconColor}33` : 'rgba(99, 102, 241, 0.2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: h.beaconColor || '#a5b4fc',
                                  flexShrink: 0
                                }}
                              >
                                {renderHotspotIcon(h.icon, h.customIconUrl, 14)}
                              </div>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ffffff' }}>{h.name}</span>
                            </div>
                            {h.subtitle && (
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 600,
                                  color: h.beaconColor || '#a5b4fc',
                                  background: h.beaconColor ? `${h.beaconColor}22` : 'rgba(99, 102, 241, 0.15)',
                                  border: `1px solid ${h.beaconColor ? `${h.beaconColor}55` : 'rgba(99, 102, 241, 0.3)'}`,
                                  padding: '1px 7px',
                                  borderRadius: '10px',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {h.subtitle}
                              </span>
                            )}
                          </div>

                          {/* Area Tag if present */}
                          {h.area && (
                            <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>📐 Area:</span>
                              <span style={{ color: '#fde68a' }}>{h.area}</span>
                            </div>
                          )}

                          {/* Description content */}
                          {h.description && (
                            <div
                              style={{
                                fontSize: '0.74rem',
                                color: '#cbd5e1',
                                lineHeight: '1.45',
                                wordBreak: 'break-word',
                                whiteSpace: 'normal',
                                maxHeight: '140px',
                                overflowY: 'auto'
                              }}
                            >
                              {h.description}
                            </div>
                          )}

                          {/* Target room action if linked */}
                          {h.targetLocationId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate(h.targetLocationId!, h.position);
                              }}
                              style={{
                                marginTop: '4px',
                                width: '100%',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                border: 'none',
                                color: '#ffffff',
                                fontWeight: 600,
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
                              }}
                            >
                              <span>Explore Location</span>
                              <ChevronRight size={13} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* 1. Smart City Futuristic Glassmorphic Hotspot Card (Reference Design) */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (h.targetLocationId) onNavigate(h.targetLocationId, h.position);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenuId(contextMenuId === h.id ? null : h.id);
                        }}
                        style={{
                          background: 'rgba(11, 15, 25, 0.88)',
                          backdropFilter: 'blur(16px)',
                          WebkitBackdropFilter: 'blur(16px)',
                          border: `1px solid ${h.beaconColor ? `${h.beaconColor}66` : 'rgba(255, 255, 255, 0.2)'}`,
                          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.75), 0 0 20px ${h.beaconColor ? `${h.beaconColor}44` : 'rgba(99, 102, 241, 0.25)'}`,
                          borderRadius: '16px',
                          padding: '8px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: '#ffffff',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: isOpen ? 'scale(1.06)' : 'scale(1)',
                          position: 'relative'
                        }}
                        className="smart-hotspot-pill"
                        title="Left-click to Navigate. Right-click for options."
                      >
                        {/* Icon Badge */}
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            background: h.beaconColor ? `linear-gradient(135deg, ${h.beaconColor}33, ${h.beaconColor}11)` : 'rgba(255, 255, 255, 0.08)',
                            border: `1px solid ${h.beaconColor ? `${h.beaconColor}88` : 'rgba(255, 255, 255, 0.15)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: h.beaconColor || '#a5b4fc',
                            flexShrink: 0,
                            boxShadow: `0 0 12px ${h.beaconColor ? `${h.beaconColor}44` : 'rgba(99, 102, 241, 0.3)'}`
                          }}
                        >
                          {renderHotspotIcon(h.icon, h.customIconUrl, 18)}
                        </div>

                        {/* Label Text + Subtitle / Distance */}
                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                          <div style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            letterSpacing: '0.02em',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            {h.isPublic === false && <span style={{ fontSize: '0.75rem' }}>🔒</span>}
                            <span>{h.name}</span>
                            {h.targetLocationId && (
                              <ChevronRight size={12} style={{ color: h.beaconColor || '#a5b4fc', opacity: 0.8 }} />
                            )}
                          </div>

                          {h.subtitle && (
                            <div style={{
                              fontSize: '0.7rem',
                              fontWeight: 500,
                              color: h.beaconColor ? h.beaconColor : '#94a3b8',
                              marginTop: '1px',
                              opacity: 0.95
                            }}>
                              {h.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Vertical Glowing Laser Pin extending down */}
                      <div
                        style={{
                          width: '1.5px',
                          height: '28px',
                          background: `linear-gradient(to bottom, ${h.beaconColor || '#a5b4fc'}, rgba(255, 255, 255, 0.95), ${h.beaconColor || '#6366f1'})`,
                          boxShadow: `0 0 8px ${h.beaconColor || '#6366f1'}, 0 0 2px #ffffff`,
                          position: 'relative'
                        }}
                      />

                      {/* 3. High-Tech Concentric Ground Beacon Ring on Terrain */}
                      <div
                        style={{
                          position: 'relative',
                          width: '26px',
                          height: '12px',
                          borderRadius: '50%',
                          background: h.beaconColor
                            ? `radial-gradient(ellipse at center, ${h.beaconColor}55 0%, ${h.beaconColor}15 60%, transparent 80%)`
                            : 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.5) 0%, rgba(99, 102, 241, 0.15) 60%, transparent 80%)',
                          border: `1.5px solid ${h.beaconColor || '#a5b4fc'}`,
                          boxShadow: `0 0 16px 2px ${h.beaconColor || '#6366f1'}, inset 0 0 8px ${h.beaconColor || '#6366f1'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '-1px'
                        }}
                      >
                        {/* Ground Laser Anchor Core Spark */}
                        <div
                          style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: `0 0 8px 2px #ffffff, 0 0 12px 4px ${h.beaconColor || '#818cf8'}`
                          }}
                        />
                      </div>
                    </div>
                  </Html>
                );
              })()}
            </React.Fragment>
          );
        })}

      {/* Render real-time drawing line preview */}
      {drawingPoints.length > 1 && (
        <>
          <Line
            points={(areaType === 'road' || areaType === 'river') ? drawingPoints : [...drawingPoints, drawingPoints[0]]}
            color={areaType === 'road' ? '#fbbf24' : areaType === 'river' ? '#3b82f6' : '#a855f7'}
            lineWidth={4}
            depthTest={false}
          />
          {areaType === 'road' && (
            <group>
              {drawingPoints.slice(0, -1).map((pt, idx) => (
                <RoadArrowHelper
                  key={idx}
                  start={pt}
                  end={drawingPoints[idx + 1]}
                  color="#fbbf24"
                />
              ))}
            </group>
          )}
        </>
      )}

      {/* Render temporary vertex markers as crisp constant-size 2D dots */}
      {drawingPoints.map((pt, idx) => (
        <Html key={idx} position={pt} center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: areaType === 'road' ? '#fbbf24' : areaType === 'river' ? '#3b82f6' : '#a855f7',
              border: '2px solid #ffffff',
              boxShadow: '0 0 6px rgba(0,0,0,0.8), 0 0 4px #ffffff',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none'
            }}
          />
        </Html>
      ))}
    </group>
  );
};

interface Viewer360Props {
  adjustments?: ImageAdjustments;
  directions?: Record<string, ProjectImage[]>;
  gridConfigs?: Record<string, string>;
  hotspots?: HotspotItem[];
  stitchedPanoPath?: string;
  isPlacingHotspot?: boolean;
  setIsPlacingHotspot?: (val: boolean) => void;
  onAddHotspot?: (position: [number, number, number]) => void;
  onNavigate?: (targetId: string) => void;
  isDrawingArea?: boolean;
  setIsDrawingArea?: (val: boolean) => void;
  drawingPoints?: [number, number, number][];
  setDrawingPoints?: (pts: [number, number, number][]) => void;
  onSaveAreaOutline?: () => void;
  onEditHotspot?: (hs: HotspotItem) => void;
  onDeleteHotspot?: (id: string) => void;
  onAddAreaOutline?: (hs: HotspotItem) => void;
  areaType?: 'building' | 'river' | 'road';
  readOnly?: boolean;
  autoRotate?: boolean;
  onOpenAdjustments?: () => void;
  onImageNotFound?: () => void;
}

export interface Viewer360Ref {
  navigateToLocation: (targetId: string, customPos?: [number, number, number], targetLocData?: any) => void;
}

const CameraZoomEffect: React.FC<{ isZooming: boolean; targetPos: [number, number, number] | null; controlsRef: any }> = ({ isZooming, targetPos, controlsRef }) => {
  useFrame(({ camera }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const pCam = camera as THREE.PerspectiveCamera;
      if (isZooming) {
        // Mild, gentle cinematic zoom (from 75 to 58 only instead of extreme zoom)
        pCam.fov = THREE.MathUtils.lerp(pCam.fov, 58, 0.035);
        pCam.updateProjectionMatrix();

        if (targetPos && controlsRef.current) {
          const pinVec = new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2]).normalize();
          const cameraPos = camera.position.clone();
          const desiredTarget = cameraPos.clone().add(pinVec.multiplyScalar(100));
          controlsRef.current.target.lerp(desiredTarget, 0.045);
          controlsRef.current.update();
        }
      } else if (pCam.fov < 74.5) {
        // Smoothly restore natural default FOV (75) for the new location
        pCam.fov = THREE.MathUtils.lerp(pCam.fov, 75, 0.06);
        pCam.updateProjectionMatrix();
      }
    }
  });
  return null;
};

export const Viewer360 = React.forwardRef<Viewer360Ref, Viewer360Props>(({
  adjustments = DEFAULT_ADJUSTMENTS,
  directions = { F: [], B: [], L: [], R: [], U: [], D: [] },
  gridConfigs = {},
  hotspots = [],
  stitchedPanoPath,
  isPlacingHotspot = false,
  setIsPlacingHotspot = () => { },
  onAddHotspot = () => { },
  onNavigate = () => { },
  isDrawingArea = false,
  setIsDrawingArea = () => { },
  drawingPoints = [],
  setDrawingPoints = () => { },
  onSaveAreaOutline = () => { },
  onEditHotspot = () => { },
  onDeleteHotspot = () => { },
  onAddAreaOutline = () => { },
  areaType = 'building',
  readOnly = false,
  onOpenAdjustments,
  onImageNotFound
}, ref) => {
  const [autoRotate, setAutoRotate] = useState(false);
  const [heading, setHeading] = useState(0);
  const [imageMissingError, setImageMissingError] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(4);
  const [isZooming, setIsZooming] = useState(false);
  const [isBlurring, setIsBlurring] = useState(false);
  const [zoomTargetPos, setZoomTargetPos] = useState<[number, number, number] | null>(null);
  const controlsRef = useRef<any>(null);
  const headingTextRef = useRef<HTMLSpanElement>(null);
  const compassContainerRef = useRef<HTMLDivElement>(null);

  // Smooth camera lookAt transition towards target hotspot + preload destination images
  const navigateToLocation = useCallback((targetId: string, customPos?: [number, number, number], targetLocData?: any) => {
    if (!targetId) return;

    // 1. Find hotspot matching targetId in current scene if position not explicitly provided
    let targetHotspotPos = customPos;
    if (!targetHotspotPos && hotspots && hotspots.length > 0) {
      const hs = hotspots.find(h => h.targetLocationId === targetId);
      if (hs?.position) {
        targetHotspotPos = hs.position;
      }
    }

    if (targetHotspotPos) {
      setZoomTargetPos(targetHotspotPos);
    }
    setIsZooming(true);

    // 2. Extract texture URLs to preload for target location
    const preloadUrls: string[] = [];
    const resolveUrl = (pathStr: string) => {
      if (!pathStr) return '';
      if (pathStr.startsWith('http://') || pathStr.startsWith('https://') || pathStr.startsWith('data:')) {
        return toCloudFrontUrl(pathStr);
      }
      if (pathStr.startsWith('/uploads/')) {
        return `${API_BASE_URL}${pathStr}`;
      }
      const cleanPath = pathStr.replace(/^file:\/\/\/?/, '');
      return `${API_BASE_URL}/api/local-image?path=${encodeURIComponent(cleanPath)}`;
    };

    if (targetLocData) {
      if (targetLocData.stitchedPanoPath) {
        preloadUrls.push(resolveUrl(targetLocData.stitchedPanoPath));
      } else if (targetLocData.directions) {
        Object.keys(targetLocData.directions).forEach(faceKey => {
          const imgs = targetLocData.directions[faceKey] || [];
          imgs.forEach((img: any) => {
            if (img.path) preloadUrls.push(resolveUrl(img.path));
          });
        });
      }
    }

    let isPreloadComplete = false;
    let isMinLookAtComplete = false;

    const executeFinalSwitch = () => {
      if (isPreloadComplete && isMinLookAtComplete) {
        setIsBlurring(true);
        setTimeout(() => {
          onNavigate(targetId);
          setTimeout(() => {
            setIsBlurring(false);
            setIsZooming(false);
            setZoomTargetPos(null);
          }, 300);
        }, 200);
      }
    };

    // Minimum camera lookAt animation time (650ms for smooth visual sweep towards hotspot)
    setTimeout(() => {
      isMinLookAtComplete = true;
      executeFinalSwitch();
    }, 650);

    if (preloadUrls.length === 0) {
      isPreloadComplete = true;
      executeFinalSwitch();
    } else {
      let loadedCount = 0;
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');

      const onTileDone = () => {
        loadedCount++;
        if (loadedCount >= preloadUrls.length) {
          isPreloadComplete = true;
          executeFinalSwitch();
        }
      };

      preloadUrls.forEach(url => {
        loader.load(
          url,
          () => onTileDone(),
          undefined,
          () => onTileDone()
        );
      });
    }
  }, [hotspots, onNavigate]);

  React.useImperativeHandle(ref, () => ({
    navigateToLocation
  }), [navigateToLocation]);

  const handleNavigateWithZoom = (targetId: string, hotspotPos?: [number, number, number]) => {
    navigateToLocation(targetId, hotspotPos);
  };

  const [isPreloading, setIsPreloading] = useState<boolean>(true);
  const [hasLoadedInitialTour, setHasLoadedInitialTour] = useState<boolean>(false);
  const [loadProgress, setLoadProgress] = useState<number>(0);

  // Extract all texture URLs to preload before showing 360 viewer
  const allImageUrls = React.useMemo(() => {
    const urls: string[] = [];
    const resolveUrl = (pathStr: string) => {
      if (!pathStr) return '';
      if (pathStr.startsWith('http://') || pathStr.startsWith('https://') || pathStr.startsWith('data:')) {
        return toCloudFrontUrl(pathStr);
      }
      if (pathStr.startsWith('/uploads/')) {
        return `${API_BASE_URL}${pathStr}`;
      }
      const cleanPath = pathStr.replace(/^file:\/\/\/?/, '');
      return `${API_BASE_URL}/api/local-image?path=${encodeURIComponent(cleanPath)}`;
    };

    if (stitchedPanoPath) {
      urls.push(resolveUrl(stitchedPanoPath));
    } else if (directions) {
      Object.keys(directions).forEach(faceKey => {
        const imgs = directions[faceKey] || [];
        imgs.forEach(img => {
          if (img.path) urls.push(resolveUrl(img.path));
        });
      });
    }
    return urls;
  }, [stitchedPanoPath, directions]);

  React.useEffect(() => {
    let isMounted = true;
    if (allImageUrls.length === 0 || hasLoadedInitialTour) {
      setIsPreloading(false);
      setLoadProgress(100);
      return;
    }

    setIsPreloading(true);
    setLoadProgress(15);
    setImageMissingError(false);

    let loadedCount = 0;
    let failedCount = 0;
    const totalCount = allImageUrls.length;
    const loader = new THREE.TextureLoader();

    allImageUrls.forEach(url => {
      loader.load(
        url,
        () => {
          if (!isMounted) return;
          loadedCount++;
          const pct = Math.min(100, Math.round((loadedCount / totalCount) * 100));
          setLoadProgress(pct);
          if (loadedCount >= totalCount) {
            setTimeout(() => {
              if (isMounted) {
                setIsPreloading(false);
                setHasLoadedInitialTour(true);
              }
            }, 250);
          }
        },
        undefined,
        () => {
          if (!isMounted) return;
          failedCount++;
          loadedCount++;
          const pct = Math.min(100, Math.round((loadedCount / totalCount) * 100));
          setLoadProgress(pct);
          if (failedCount >= totalCount && totalCount > 0) {
            if (isMounted) {
              setIsPreloading(false);
              setImageMissingError(true);
            }
          } else if (loadedCount >= totalCount) {
            setTimeout(() => {
              if (isMounted) {
                setIsPreloading(false);
                setHasLoadedInitialTour(true);
              }
            }, 250);
          }
        }
      );
    });

    return () => { isMounted = false; };
  }, [allImageUrls, hasLoadedInitialTour]);

  // Auto redirect to Home countdown if images are missing from S3
  React.useEffect(() => {
    if (!imageMissingError) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onImageNotFound) onImageNotFound();
          else window.location.href = '/';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [imageMissingError, onImageNotFound]);

  React.useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (controlsRef.current) {
        const camera = controlsRef.current.object;
        let zoomAmount = e.deltaY * 0.05;
        if (e.ctrlKey) {
          zoomAmount = e.deltaY * 0.1;
        }

        camera.fov = Math.max(20, Math.min(100, camera.fov + zoomAmount));
        camera.updateProjectionMatrix();
      }
    };
    const element = document.getElementById('viewer-canvas-container');
    if (element) {
      element.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (element) {
        element.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  // Reset camera view towards FRONT face (+Z) whenever switching rooms/locations
  React.useEffect(() => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      camera.position.set(0, 0, -0.01);
      controlsRef.current.target.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
      controlsRef.current.update();
    }
  }, [directions, stitchedPanoPath]);

  const handleZoomIn = () => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      camera.fov = Math.max(30, camera.fov - 10);
      camera.updateProjectionMatrix();
    }
  };

  const handleZoomOut = () => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      camera.fov = Math.min(100, camera.fov + 10);
      camera.updateProjectionMatrix();
    }
  };

  const toggleFullscreen = () => {
    const element = document.getElementById('interactive-workspace-wrapper');
    if (element) {
      if (!document.fullscreenElement) {
        element.requestFullscreen().catch(err => console.error(err));
      } else {
        document.exitFullscreen().catch(err => console.error(err));
      }
    }
  };

  return (
    <div
      id="viewer-canvas-container"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: isDrawingArea ? 'crosshair' : (isPlacingHotspot ? 'crosshair' : 'grab'),
        background: '#07080f',
        overflow: 'hidden'
      }}
    >
      {/* Soft Light VR Blur Transition Overlay */}
      <div
        className={`absolute inset-0 z-40 bg-black/10 pointer-events-none transition-all duration-300 ${isBlurring ? 'opacity-100 backdrop-blur-[1px]' : 'opacity-0 backdrop-blur-none'
          }`}
      />

      {/* 360 Panorama Texture Loading & Blur Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 9999,
          background: 'radial-gradient(ellipse at center, rgba(13, 18, 43, 0.88) 0%, rgba(6, 8, 19, 0.96) 100%)',
          backdropFilter: isPreloading ? 'blur(28px)' : 'blur(0px)',
          WebkitBackdropFilter: isPreloading ? 'blur(28px)' : 'blur(0px)',
          opacity: isPreloading ? 1 : 0,
          pointerEvents: isPreloading ? 'all' : 'none',
          transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 0.4s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff'
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          animation: 'modalSlideIn 0.3s ease',
          transform: isPreloading ? 'scale(1)' : 'scale(0.95)',
          transition: 'transform 0.4s ease'
        }}>
          {/* Animated Glowing Ring & Compass Icon */}
          <div style={{ position: 'relative', width: '76px', height: '76px' }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.45), rgba(168, 85, 247, 0.45))',
              filter: 'blur(14px)',
              animation: 'pulse 2s infinite'
            }} />
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid rgba(99, 102, 241, 0.2)',
              borderTopColor: '#818cf8',
              borderRightColor: '#c084fc',
              animation: 'spin 1.2s linear infinite'
            }} />
            <div style={{
              position: 'absolute',
              inset: '6px',
              borderRadius: '50%',
              background: '#0d122b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)'
            }}>
              <Compass size={30} className="spin" style={{ animationDuration: '6s' }} />
            </div>
          </div>

          {/* Loading Text & Status */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              background: 'linear-gradient(135deg, #ffffff 40%, #c7d2fe 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '4px'
            }}>
              Loading 360° Panorama
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Streaming high-resolution textures ({loadProgress}%)
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{
            width: '190px',
            height: '5px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div style={{
              height: '100%',
              width: `${loadProgress}%`,
              background: 'linear-gradient(90deg, #6366f1, #a855f7)',
              borderRadius: '999px',
              transition: 'width 0.25s ease',
              boxShadow: '0 0 12px rgba(99, 102, 241, 0.8)'
            }} />
          </div>
        </div>
      </div>

      {/* S3 Missing Image Fallback Error Overlay */}
      {imageMissingError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(7, 8, 15, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          color: '#ffffff'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            fontSize: '28px'
          }}>
            ⚠️
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
            360 Image Not Found on Cloud Storage (S3)
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', maxWidth: '420px', marginBottom: '24px', lineHeight: 1.5 }}>
            The 360 panorama assets for this location could not be found on AWS S3. Returning to Home Page in <strong style={{ color: '#a5b4fc' }}>{countdown}s</strong>...
          </p>
          <button
            onClick={() => {
              if (onImageNotFound) onImageNotFound();
              else window.location.href = '/';
            }}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.88rem',
              padding: '10px 24px',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>🏠 Return to Home Page Now</span>
          </button>
        </div>
      )}

      <Canvas camera={{ position: [0, 0, -0.01], fov: 75 }}>
        <CameraZoomEffect isZooming={isZooming} targetPos={zoomTargetPos} controlsRef={controlsRef} />
        <ambientLight intensity={1.5} />
        <SceneGroup
          adjustments={adjustments}
          directions={directions}
          gridConfigs={gridConfigs}
          hotspots={hotspots}
          stitchedPanoPath={stitchedPanoPath}
          autoRotate={autoRotate}
          isPlacingHotspot={isPlacingHotspot}
          isDrawingArea={isDrawingArea}
          onAddHotspot={onAddHotspot}
          onNavigate={handleNavigateWithZoom}
          drawingPoints={drawingPoints}
          setDrawingPoints={setDrawingPoints}
          headingTextRef={headingTextRef}
          compassContainerRef={compassContainerRef}
          onEditHotspot={onEditHotspot}
          onDeleteHotspot={onDeleteHotspot}
          onAddAreaOutline={onAddAreaOutline}
          areaType={areaType}
          isPreloading={isPreloading}
        />
        <OrbitControls
          ref={controlsRef}
          enableZoom={false}
          enablePan={false}
          rotateSpeed={-0.4}
        />
      </Canvas>

      {/* Floating Controls */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        background: 'rgba(19, 21, 27, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border-color)',
        padding: '8px 16px',
        borderRadius: '30px',
        zIndex: 10
      }}>
        {/* Hotspot Builder Buttons (Admin Only) */}
        {!readOnly && (
          <>
            {!isPlacingHotspot ? (
              <>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setIsPlacingHotspot(true);
                    setIsDrawingArea(false);
                    setDrawingPoints([]);
                  }}
                  title="Add Single Point Hotspot (Room Link or Info)"
                  style={{ borderRadius: '20px' }}
                >
                  <PlusCircle size={16} /> + Hotspot
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setIsPlacingHotspot(true);
                    setIsDrawingArea(true);
                    setDrawingPoints([]);
                  }}
                  title="Draw Building Area Boundary Outline"
                  style={{ borderRadius: '20px', background: 'linear-gradient(135deg, #a5b4fc, #6366f1)', border: 'none' }}
                >
                  <PlusCircle size={16} /> + Area Outline
                </button>
                {onOpenAdjustments && (
                  <button
                    className="btn btn-sm"
                    onClick={onOpenAdjustments}
                    title="Open Image Adjustments & Filters"
                    style={{
                      borderRadius: '20px',
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                      color: '#fff',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 12px',
                      fontWeight: 600,
                      boxShadow: '0 2px 8px rgba(99,102,241,0.3)'
                    }}
                  >
                    <Sliders size={14} /> Adjustments
                  </button>
                )}
              </>
            ) : (
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  setIsPlacingHotspot(false);
                  setIsDrawingArea(false);
                  setDrawingPoints([]);
                }}
                title="Cancel drawing"
                style={{ borderRadius: '20px' }}
              >
                <XCircle size={16} /> Cancel
              </button>
            )}

            {/* Show Save Area Button when drawing points exist */}
            {isPlacingHotspot && isDrawingArea && drawingPoints.length > 0 && (
              <button
                className="btn btn-sm btn-primary"
                onClick={onSaveAreaOutline}
                style={{ borderRadius: '20px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}
              >
                <CheckCircle size={16} /> Save Area ({drawingPoints.length} pts)
              </button>
            )}

            <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />
          </>
        )}

        {/* <button className="btn btn-sm" onClick={() => setAutoRotate(!autoRotate)}>
          {autoRotate ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="btn btn-sm" onClick={handleZoomIn}>
          <ZoomIn size={16} />
        </button>
        <button className="btn btn-sm" onClick={handleZoomOut}>
          <ZoomOut size={16} />
        </button>
        <button className="btn btn-sm" onClick={toggleFullscreen}>
          <Maximize2 size={16} />
        </button> */}
      </div>

      {isPlacingHotspot && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '4px',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          zIndex: 10,
          textAlign: 'center'
        }}>
          {isDrawingArea ? (
            <span>Double-click multiple points to draw a border. Then click "Save Area" below.</span>
          ) : (
            <span>Double-click anywhere to place a Hotspot.</span>
          )}
        </div>
      )}
    </div>
  );
});

Viewer360.displayName = 'Viewer360';

export default Viewer360;
