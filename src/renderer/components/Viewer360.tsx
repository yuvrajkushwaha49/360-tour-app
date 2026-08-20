import React, { useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { RotateCw, ZoomIn, ZoomOut, Maximize2, Compass, Play, Pause, PlusCircle, XCircle, CheckCircle, MapPin, ArrowUpCircle, Info } from 'lucide-react';
import { API_BASE_URL, toCloudFrontUrl } from '../utils/apiConfig';

interface ProjectImage {
  name: string;
  path: string;
}

interface HotspotItem {
  id: string;
  targetLocationId?: string;
  name: string;
  area?: string;
  description?: string;
  position: [number, number, number];
  polygonPoints?: [number, number, number][];
  icon?: 'arrow' | 'pin' | 'info';
  isPublic?: boolean;
  assignedUserId?: string;
  assignedUserName?: string;
}

interface TileMeshProps {
  imagePath: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  onDoubleClick?: (e: any) => void;
}

const TileMesh: React.FC<TileMeshProps> = ({ imagePath, position, rotation, size, onDoubleClick }) => {
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
    <mesh position={position} rotation={rotation} onDoubleClick={onDoubleClick}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
};

const EquirectangularPano: React.FC<{ imagePath: string }> = ({ imagePath }) => {
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
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
};

interface GridFaceProps {
  images: ProjectImage[];
  faceKey: string;
  gridSize: number;
  onTileDoubleClick?: (e: any) => void;
}

const GridFace: React.FC<GridFaceProps> = ({ images, faceKey, gridSize, onTileDoubleClick }) => {
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
        />
      );
    }
  }

  return <group>{tiles}</group>;
};

const getPolygonMesh = (pts: [number, number, number][]) => {
  if (pts.length < 3) return null;
  const vertices = new Float32Array(pts.flatMap(p => p));
  const indices: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    indices.push(0, i, i + 1);
  }
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
}

const SceneGroup: React.FC<SceneGroupProps> = ({
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
  areaType
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
          />
        </React.Suspense>
      ))}

      {/* Render 3D saved hotspots and area lines with Public vs Private authorization */}
      {safeHotspots
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

          // Dynamic colors based on Area Style
          let lineColor = '#a855f7'; // Purple / Violet
          let overlayColor = '#a855f7';
          let overlayOpacity = 0.35;

          if (resolvedAreaType === 'river') {
            lineColor = '#3b82f6';
            overlayColor = '#3b82f6';
            overlayOpacity = 0.45;
          } else if (resolvedAreaType === 'road') {
            lineColor = '#fbbf24';
            overlayColor = '#fbbf24';
            overlayOpacity = 0.35;
          }

          return (
            <React.Fragment key={h.id}>
              {/* 1. Draw Area Overlay (Purple/Blue/Yellow semi-transparent shape on hover for Building/Land only) */}
              {hasPolygon && isOpen && resolvedAreaType !== 'road' && resolvedAreaType !== 'river' && (() => {
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
                    />
                  </mesh>
                );
              })()}

              {/* 2. Draw Area Outline Line */}
              {hasPolygon && (
                <Line
                  points={(resolvedAreaType === 'road' || resolvedAreaType === 'river') ? h.polygonPoints! : [...h.polygonPoints!, h.polygonPoints![0]]}
                  color={lineColor}
                  lineWidth={4}
                  depthTest={false}
                />
              )}

              {/* 2b. If Road, render directional arrows along the path */}
              {resolvedAreaType === 'road' && h.polygonPoints && h.polygonPoints.length > 1 && (
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

              {!isPlacingHotspot && (() => {
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
                      hasDetails={!!hasDetails}
                      setActiveInfoId={setActiveInfoId}
                      onEditHotspot={onEditHotspot}
                      onDeleteHotspot={onDeleteHotspot}
                      onAddAreaOutline={onAddAreaOutline}
                      onNavigate={onNavigate}
                    />
                  );
                }

                return (
                  <Html position={h.position} center zIndexRange={[0, 50]}>
                    <div
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        transform: 'translateY(-50%) translateY(8px)',
                        pointerEvents: 'auto'
                      }}
                      onMouseEnter={() => { if (hasDetails && contextMenuId !== h.id) setActiveInfoId(h.id); }}
                      onMouseLeave={() => { if (hasDetails) setActiveInfoId(null); }}
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

                      {/* Details Card (Above Pin) */}
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

                      {/* 1. The Top Text Card (Button) */}
                      <button
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
                          background: '#13508a',
                          border: '2px solid white',
                          borderRadius: '4px',
                          padding: '8px 16px',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontFamily: 'inherit',
                          outline: 'none'
                        }}
                        title="Left-click to Navigate. Right-click for options."
                      >
                        {h.isPublic === false ? '🔒 ' : ''}{h.name}
                      </button>

                      {/* 2. Standard Pin Icon */}
                      <div style={{
                        marginTop: '4px',
                        display: 'flex',
                        justifyContent: 'center',
                        color: 'white',
                        filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.6))'
                      }}>
                        {(h.icon === 'pin' || !h.icon) && <MapPin size={32} strokeWidth={2.5} />}
                        {h.icon === 'arrow' && <ArrowUpCircle size={32} strokeWidth={2.5} style={{ transform: 'rotate(180deg)' }} />}
                        {h.icon === 'info' && <Info size={32} strokeWidth={2.5} />}
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

      {/* Render temporary vertex markers as small spheres */}
      {drawingPoints.map((pt, idx) => (
        <mesh key={idx} position={pt}>
          <sphereGeometry args={[10, 8, 8]} />
          <meshBasicMaterial color="#a855f7" />
        </mesh>
      ))}
    </group>
  );
};

interface Viewer360Props {
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
}

const CameraZoomEffect: React.FC<{ isZooming: boolean; targetPos: [number, number, number] | null; controlsRef: any }> = ({ isZooming, targetPos, controlsRef }) => {
  useFrame(({ camera }) => {
    if (isZooming) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, 30, 0.025);
      camera.updateProjectionMatrix();

      if (targetPos && controlsRef.current) {
        const pinVec = new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2]).normalize();
        const cameraPos = camera.position.clone();
        const desiredTarget = cameraPos.clone().add(pinVec.multiplyScalar(100));
        controlsRef.current.target.lerp(desiredTarget, 0.025);
        controlsRef.current.update();
      }
    }
  });
  return null;
};

export const Viewer360: React.FC<Viewer360Props> = ({
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
  readOnly = false
}) => {
  const [autoRotate, setAutoRotate] = useState(false);
  const [heading, setHeading] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [isBlurring, setIsBlurring] = useState(false);
  const [zoomTargetPos, setZoomTargetPos] = useState<[number, number, number] | null>(null);
  const controlsRef = useRef<any>(null);
  const headingTextRef = useRef<HTMLSpanElement>(null);
  const compassContainerRef = useRef<HTMLDivElement>(null);

  const handleNavigateWithZoom = (targetId: string, hotspotPos?: [number, number, number]) => {
    if (!targetId) return;
    if (hotspotPos) setZoomTargetPos(hotspotPos);
    setIsZooming(true);

    setTimeout(() => {
      setIsBlurring(true);
      setTimeout(() => {
        onNavigate(targetId);
        setTimeout(() => {
          setIsBlurring(false);
          setIsZooming(false);
          setZoomTargetPos(null);
        }, 250);
      }, 250);
    }, 500);
  };

  const [isPreloading, setIsPreloading] = useState<boolean>(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);

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
    if (allImageUrls.length === 0 || hasLoadedOnce) {
      setIsPreloading(false);
      return;
    }

    setIsPreloading(true);

    let loadedCount = 0;
    const totalCount = allImageUrls.length;
    const loader = new THREE.TextureLoader();

    allImageUrls.forEach(url => {
      loader.load(
        url,
        () => {
          if (!isMounted) return;
          loadedCount++;
          if (loadedCount >= totalCount) {
            if (isMounted) {
              setIsPreloading(false);
              setHasLoadedOnce(true);
            }
          }
        },
        undefined,
        () => {
          if (!isMounted) return;
          loadedCount++;
          if (loadedCount >= totalCount) {
            if (isMounted) {
              setIsPreloading(false);
              setHasLoadedOnce(true);
            }
          }
        }
      );
    });

    return () => { isMounted = false; };
  }, [allImageUrls, hasLoadedOnce]);

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
        document.exitFullscreen();
      }
    }
  };

  return (
    <div id="viewer-canvas-container" className="viewer-wrapper" style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Soft Light VR Blur Transition Overlay */}
      <div
        className={`absolute inset-0 z-40 bg-black/10 pointer-events-none transition-all duration-300 ${isBlurring ? 'opacity-100 backdrop-blur-[1px]' : 'opacity-0 backdrop-blur-none'
          }`}
      />

      {/* Sleek Minimal Preloader Overlay (Zero Text, Fast & Clean) */}
      {isPreloading && (
        <div className="absolute inset-0 z-50 bg-[#07080f]/90 backdrop-blur-md flex items-center justify-center pointer-events-none transition-opacity duration-300">
          <div className="w-10 h-10 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      )}

      <Canvas camera={{ position: [0, 0, 1], fov: 75 }}>
        <CameraZoomEffect isZooming={isZooming} targetPos={zoomTargetPos} controlsRef={controlsRef} />
        <ambientLight intensity={1.5} />
        <SceneGroup
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

        <button className="btn btn-sm" onClick={() => setAutoRotate(!autoRotate)}>
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
        </button>
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

      {/* Compass HUD */}
      <div style={{
        position: 'absolute',
        top: '24px',
        right: '24px',
        background: 'rgba(19, 21, 27, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border-color)',
        padding: '10px',
        borderRadius: '50%',
        zIndex: 10
      }}>
        <div
          ref={compassContainerRef}
          style={{
            transition: 'transform 0.05s linear',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Compass size={24} style={{ color: 'var(--accent-color)' }} />
        </div>
      </div>

      <div style={{
        position: 'absolute',
        top: '24px',
        left: '24px',
        background: 'rgba(19, 21, 27, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border-color)',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '0.8rem',
        zIndex: 10
      }}>
        Heading: <span ref={headingTextRef} style={{ fontWeight: 'bold' }}>0°</span>
      </div>
    </div>
  );
};

export default Viewer360;
