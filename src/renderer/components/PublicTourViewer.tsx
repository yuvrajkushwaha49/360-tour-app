import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Globe,
  Share2,
  Check,
  ShieldAlert,
  Compass,
  Lock,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Menu,
  X,
  Sun,
  Sunset,
  Moon,
  Building2,
  Map,
  Network,
  Image,
  FileText,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCw,
  Target,
  Plus,
  Minus
} from 'lucide-react';
import Viewer360 from './Viewer360';
import { API_BASE_URL, toCloudFrontUrl } from '../utils/apiConfig';
import { ImageAdjustments, DEFAULT_ADJUSTMENTS } from '../utils/imageAdjustmentEngine';

interface PublicTourViewerProps {
  tourId: string;
  onBack: () => void;
  onLogin?: () => void;
}

export default function PublicTourViewer({ tourId, onBack, onLogin }: PublicTourViewerProps) {
  const [tourName, setTourName] = useState<string>('');
  const [tourData, setTourData] = useState<any>(null);
  const [clientLogo, setClientLogo] = useState<string>('');
  const [activeLocationId, setActiveLocationId] = useState<string>(() => {
    return localStorage.getItem(`active_public_loc_${tourId}`) || '';
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Smart City Portal UI States
  const [activeNavTab, setActiveNavTab] = useState<string>('overview');
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'night'>('day');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const carouselScrollRef = useRef<HTMLDivElement>(null);

  const handleLocationChange = (locId: string) => {
    setActiveLocationId(locId);
    localStorage.setItem(`active_public_loc_${tourId}`, locId);
  };

  useEffect(() => {
    fetchTour();
  }, [tourId]);

  const fetchTour = async () => {
    setLoading(true);
    setError(null);
    setIsPrivate(false);
    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch(`${API_BASE_URL}/api/tours/${tourId}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      const data = await response.json();

      if (response.status === 403 || data.is_private) {
        setIsPrivate(true);
        setError('This virtual tour is private.');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load tour');
      }

      setTourName(data.name);
      setTourData(data.tourData);
      const foundLogo = data.clientLogo || data.client_logo || data.tourData?.client_logo || data.tourData?.clientLogo || '';
      setClientLogo(foundLogo);

      const locations = data.tourData?.locations || [];
      if (locations.length > 0) {
        const savedLocId = localStorage.getItem(`active_public_loc_${tourId}`);
        const isValidSavedLoc = savedLocId && locations.some((l: any) => l.id === savedLocId);
        if (isValidSavedLoc) {
          setActiveLocationId(savedLocId);
        } else {
          const firstLocId = locations[0].id;
          setActiveLocationId(firstLocId);
          localStorage.setItem(`active_public_loc_${tourId}`, firstLocId);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error loading 360 tour');
    } finally {
      setLoading(false);
    }
  };

  const copyShareLink = () => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
    const url = `${base}/api/tours/${tourId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselScrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      carouselScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleZoom = (inOrOut: 'in' | 'out') => {
    const canvasEl = document.getElementById('viewer-canvas-container');
    if (canvasEl) {
      const deltaY = inOrOut === 'in' ? -150 : 150;
      canvasEl.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true }));
    }
  };

  if (loading) {
    return (
      <div className="public-viewer-page d-flex flex-column align-items-center justify-content-center text-white" style={{ background: '#050713' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '20px' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.45), rgba(168, 85, 247, 0.45))',
            filter: 'blur(16px)',
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
            inset: '8px',
            borderRadius: '50%',
            background: '#0d122b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)'
          }}>
            <Compass size={32} className="spin" style={{ animationDuration: '6s' }} />
          </div>
        </div>
        <h3 style={{
          fontSize: '1.2rem',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #ffffff 40%, #c7d2fe 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '6px'
        }}>
          Loading 360° Virtual Tour
        </h3>
        <p className="small text-secondary mt-0 mb-0">Initializing panorama projection & 3D beacons...</p>
      </div>
    );
  }

  // Private Virtual Tour Screen
  if (isPrivate || (error && error.toLowerCase().includes('private'))) {
    return (
      <div className="public-viewer-page d-flex flex-column align-items-center justify-content-center text-white p-4 text-center">
        <div className="p-4   bg-opacity-15 border border-warning border-opacity-30 rounded-circle text-warning mb-4 shadow-lg">
          <Lock size={48} className="text-warning" />
        </div>

        <span className="badge   bg-opacity-20 text-warning border border-warning border-opacity-30 px-3 py-1.5 rounded-pill uppercase tracking-wider small font-weight-normal mb-3">
          🔒 Private Virtual Tour
        </span>

        <h2 className="h3 font-weight-normal text-white mb-2">
          This Virtual Tour is Private
        </h2>
        <p className="small text-secondary max-w-md mx-auto leading-relaxed mb-4">
          The owner of this 360° virtual tour has marked it as Private. Only authorized clients or administrators can view this property tour.
        </p>

        <div className="d-flex align-items-center gap-3">
          <button
            onClick={onBack}
            className="btn btn-secondary rounded-3 px-4 py-2.5 small font-weight-normal d-flex align-items-center gap-2 shadow-sm"
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>

          {onLogin && (
            <button
              onClick={onLogin}
              className="btn btn-warning text-dark font-weight-normal rounded-3 px-4 py-2.5 small d-flex align-items-center gap-2 shadow-sm"
            >
              <ShieldCheck size={16} />
              <span>Sign In for Access</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // General Error Screen
  if (error || !tourData) {
    return (
      <div className="public-viewer-page d-flex flex-column align-items-center justify-content-center text-white p-4 text-center">
        <div className="p-4 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-4 text-danger mb-4">
          <ShieldAlert size={40} />
        </div>
        <h3 className="h4 font-weight-normal text-white mb-2">Tour Unavailable</h3>
        <p className="small text-secondary max-w-md mx-auto mb-4">{error}</p>
        <button
          onClick={onBack}
          className="btn btn-primary rounded-3 px-4 py-2.5 small font-weight-normal d-flex align-items-center gap-2"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  const locations = tourData.locations || [];
  const currentLocation = locations.find((l: any) => l.id === activeLocationId) || locations[0];

  // Calculate dynamic adjustments based on Time-of-Day mode
  const baseAdjustments: ImageAdjustments = currentLocation?.adjustments || DEFAULT_ADJUSTMENTS;
  let dynamicAdjustments: ImageAdjustments = { ...baseAdjustments };

  if (timeOfDay === 'sunset') {
    dynamicAdjustments = {
      ...dynamicAdjustments,
      exposure: (dynamicAdjustments.exposure || 0) + 8,
      temperature: (dynamicAdjustments.temperature || 0) + 25,
      saturation: (dynamicAdjustments.saturation || 0) + 18,
      hue: (dynamicAdjustments.hue || 0) + 4
    };
  } else if (timeOfDay === 'night') {
    dynamicAdjustments = {
      ...dynamicAdjustments,
      exposure: (dynamicAdjustments.exposure || 0) - 28,
      contrast: (dynamicAdjustments.contrast || 0) + 22,
      temperature: (dynamicAdjustments.temperature || 0) - 20,
      vignette: Math.max(dynamicAdjustments.vignette || 0, 35)
    };
  }

  const displayName = tourName || 'dholera';

  return (
    <div className="public-viewer-page">
      {/* Top Glassmorphic Navigation Bar */}
      <div className="smart-portal-header">
        {/* Left Branding Logo */}
        <div className="smart-portal-brand">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="smart-tool-btn"
            style={{ width: '2.25rem', height: '2.25rem' }}
            title={sidebarOpen ? 'Hide Menu' : 'Show Menu'}
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>

          <div className="smart-portal-logo" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            {clientLogo && (
              <div
                style={{
                  width: '15%',

                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: '8px',
                  flexShrink: 0,
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6)'
                }}
              >
                <img
                  src={toCloudFrontUrl(clientLogo)}
                  alt="Client Brand Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            )}

          </div>
        </div>



        {/* Center Category Nav Pills */}
        <div className="smart-nav-pills">
          <button
            onClick={() => setActiveNavTab('overview')}
            className={`smart-nav-btn ${activeNavTab === 'overview' ? 'active' : ''}`}
          >
            <Compass size={14} />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveNavTab('masterplan')}
            className={`smart-nav-btn ${activeNavTab === 'masterplan' ? 'active' : ''}`}
          >
            <Map size={14} />
            <span>Master Plan</span>
          </button>
          <button
            onClick={() => setActiveNavTab('infrastructure')}
            className={`smart-nav-btn ${activeNavTab === 'infrastructure' ? 'active' : ''}`}
          >
            <Building2 size={14} />
            <span>Infrastructure</span>
          </button>
          <button
            onClick={() => setActiveNavTab('connectivity')}
            className={`smart-nav-btn ${activeNavTab === 'connectivity' ? 'active' : ''}`}
          >
            <Network size={14} />
            <span>Connectivity</span>
          </button>
          <button
            onClick={() => setActiveNavTab('gallery')}
            className={`smart-nav-btn ${activeNavTab === 'gallery' ? 'active' : ''}`}
          >
            <Image size={14} />
            <span>Gallery</span>
          </button>
        </div>

        {/* Right Controls (Dropdowns, Time-of-Day, Share, Fullscreen, Back) */}
        <div className="smart-top-right">



          {/* Share Button */}
          <button
            onClick={copyShareLink}
            className="smart-tool-btn"
            style={{ width: '2.25rem', height: '2.25rem' }}
            title="Share Tour Link"
          >
            {copied ? <Check size={15} className="text-emerald-400" /> : <Share2 size={15} />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="smart-tool-btn"
            style={{ width: '2.25rem', height: '2.25rem' }}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* Back to Dashboard */}
          <button
            onClick={onBack}
            className="smart-tool-btn"
            style={{ width: '2.25rem', height: '2.25rem', color: '#a5b4fc' }}
            title="Back to Dashboard"
          >
            <ArrowLeft size={15} />
          </button>
        </div>
      </div>

      {/* Left Collapsible Glassmorphic Sidebar (Fixed to Left Side) */}
      <div className={`smart-portal-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="smart-sidebar-title">
          EXPLORE {displayName.toUpperCase()}
        </div>

        {/* 360 Aerial View CTA Card */}
        <div
          className="smart-cta-card"
          onClick={() => {
            if (locations.length > 0) handleLocationChange(locations[0].id);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} className="text-indigo-400" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#ffffff' }}>360° AERIAL VIEW</div>
              <div style={{ fontSize: '0.66rem', color: '#cbd5e1' }}>Explore {displayName} in 360°</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-indigo-400" />
        </div>

        {/* Sidebar Feature Links */}
        <div className="smart-sidebar-menu">
          <div className="smart-menu-item" onClick={() => setActiveNavTab('masterplan')}>
            <div className="smart-menu-icon"><Map size={15} /></div>
            <div>
              <div className="smart-menu-label">MASTER PLAN</div>
              <div className="smart-menu-sub">View city planning</div>
            </div>
          </div>

          <div className="smart-menu-item" onClick={() => setActiveNavTab('infrastructure')}>
            <div className="smart-menu-icon"><Building2 size={15} /></div>
            <div>
              <div className="smart-menu-label">INFRASTRUCTURE</div>
              <div className="smart-menu-sub">World class infrastructure</div>
            </div>
          </div>

          <div className="smart-menu-item" onClick={() => setActiveNavTab('connectivity')}>
            <div className="smart-menu-icon"><Network size={15} /></div>
            <div>
              <div className="smart-menu-label">CONNECTIVITY</div>
              <div className="smart-menu-sub">Road • Rail • Air • Sea</div>
            </div>
          </div>

          <div className="smart-menu-item" onClick={() => alert(`${displayName}: The Future Is Here`)}>
            <div className="smart-menu-icon"><Star size={15} /></div>
            <div>
              <div className="smart-menu-label">WHY {displayName.toUpperCase()}?</div>
              <div className="smart-menu-sub">The future is here</div>
            </div>
          </div>

          <div className="smart-menu-item" onClick={() => setActiveNavTab('gallery')}>
            <div className="smart-menu-icon"><Image size={15} /></div>
            <div>
              <div className="smart-menu-label">GALLERY</div>
              <div className="smart-menu-sub">Photos & videos</div>
            </div>
          </div>

          <div className="smart-menu-item" onClick={copyShareLink}>
            <div className="smart-menu-icon"><FileText size={15} /></div>
            <div>
              <div className="smart-menu-label">DOWNLOADS</div>
              <div className="smart-menu-sub">Brochures & documents</div>
            </div>
          </div>
        </div>

        {/* Zone Legend */}
        <div className="smart-legend-box">
          <div className="smart-legend-title">
            ZONE LEGEND
          </div>
          <div className="smart-legend-item">
            <span className="smart-legend-dot" style={{ background: '#a855f7', color: '#a855f7' }} />
            <span>Industrial</span>
          </div>
          <div className="smart-legend-item">
            <span className="smart-legend-dot" style={{ background: '#eab308', color: '#eab308' }} />
            <span>Residential</span>
          </div>
          <div className="smart-legend-item">
            <span className="smart-legend-dot" style={{ background: '#3b82f6', color: '#3b82f6' }} />
            <span>Commercial</span>
          </div>
          <div className="smart-legend-item">
            <span className="smart-legend-dot" style={{ background: '#f97316', color: '#f97316' }} />
            <span>High Access Corridor</span>
          </div>
          <div className="smart-legend-item">
            <span className="smart-legend-dot" style={{ background: '#10b981', color: '#10b981' }} />
            <span>Green & Recreation</span>
          </div>
        </div>
      </div>

      {/* 360 Canvas View with 3D Beacons */}
      <div className="public-viewer-canvas" id="viewer-canvas-container">
        <Viewer360
          readOnly={true}
          directions={currentLocation?.directions || { F: [], B: [], L: [], R: [], U: [], D: [] }}
          gridConfigs={currentLocation?.gridConfigs || {}}
          hotspots={currentLocation?.hotspots || []}
          stitchedPanoPath={currentLocation?.stitchedPanoPath || currentLocation?.imagePath}
          adjustments={dynamicAdjustments}
          autoRotate={autoRotate}
          onImageNotFound={onBack}
          onNavigate={(targetId) => {
            const targetLoc = locations.find((l: any) => l.id === targetId);
            if (targetLoc) handleLocationChange(targetLoc.id);
          }}
        />
      </div>

      {/* Bottom Floating Quick Explore Carousel */}
      {locations.length > 0 && (
        <div className="smart-bottom-carousel-wrapper">
          <div className="smart-carousel-title">
            QUICK EXPLORE
          </div>

          <div className="smart-carousel-container">
            {locations.length > 4 && (
              <button onClick={() => scrollCarousel('left')} className="smart-carousel-arrow" title="Previous">
                <ChevronLeft size={16} />
              </button>
            )}

            <div className="smart-carousel-scroll" ref={carouselScrollRef}>
              {locations.map((loc: any, idx: number) => {
                const isActive = loc.id === activeLocationId;
                const paddedNum = String(idx + 1).padStart(2, '0');

                // Determine thumbnail image
                let thumbSrc = '';
                if (loc.stitchedPanoPath) {
                  thumbSrc = loc.stitchedPanoPath.startsWith('http') || loc.stitchedPanoPath.startsWith('data:')
                    ? toCloudFrontUrl(loc.stitchedPanoPath)
                    : `${API_BASE_URL}${loc.stitchedPanoPath.startsWith('/') ? '' : '/'}${loc.stitchedPanoPath}`;
                } else if (loc.directions?.F?.[0]?.path) {
                  const p = loc.directions.F[0].path;
                  thumbSrc = p.startsWith('http') || p.startsWith('data:')
                    ? toCloudFrontUrl(p)
                    : `${API_BASE_URL}${p.startsWith('/') ? '' : '/'}${p}`;
                }

                return (
                  <div
                    key={loc.id}
                    onClick={() => handleLocationChange(loc.id)}
                    className={`smart-thumb-card ${isActive ? 'active' : ''}`}
                    title={loc.name}
                  >
                    {thumbSrc ? (
                      <img src={thumbSrc} alt={loc.name} className="smart-thumb-img" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1e1b4b, #0f172a)' }} />
                    )}

                    <div className="smart-thumb-overlay">
                      <span className="smart-thumb-num">{paddedNum}</span>
                      <span className="smart-thumb-name">{loc.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {locations.length > 4 && (
              <button onClick={() => scrollCarousel('right')} className="smart-carousel-arrow" title="Next">
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom Center Floating Toolbar */}
      <div className="smart-bottom-toolbar">
        <button
          className="smart-tool-btn"
          onClick={() => handleZoom('out')}
          title="Zoom Out (-)"
        >
          <Minus size={15} />
        </button>

        <button
          className="smart-tool-btn"
          onClick={() => {
            const canvasEl = document.getElementById('viewer-canvas-container');
            if (canvasEl) {
              const resetBtn = canvasEl.querySelector('button[title*="Reset"], button[title*="Center"]');
              if (resetBtn) (resetBtn as HTMLElement).click();
            }
          }}
          title="Reset View"
        >
          <Target size={15} />
        </button>

        <button
          className={`smart-tool-btn ${autoRotate ? 'active-360' : ''}`}
          onClick={() => setAutoRotate(!autoRotate)}
          title="Toggle 360° Auto-Rotation"
        >
          <RotateCw size={15} />
        </button>

        <button
          className="smart-tool-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="Toggle Zone & Master Plan"
        >
          <Map size={15} />
        </button>

        <button
          className="smart-tool-btn"
          onClick={() => handleZoom('in')}
          title="Zoom In (+)"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Bottom Right Realistic 3D Compass & Zoom Controls */}
      <div className="smart-compass-widget">
        <div className="smart-zoom-controls">
          <button className="smart-zoom-btn" onClick={() => handleZoom('in')} title="Zoom In">
            <Plus size={13} />
          </button>
          <button className="smart-zoom-btn" onClick={() => handleZoom('out')} title="Zoom Out">
            <Minus size={13} />
          </button>
        </div>

        <div
          className="smart-compass-dial"
          onClick={() => {
            const canvasEl = document.getElementById('viewer-canvas-container');
            if (canvasEl) {
              const compassEl = canvasEl.querySelector('div[style*="rotate"]');
              if (compassEl) (compassEl as HTMLElement).click();
            }
          }}
          title="Orientation Compass (Click to reset North)"
        >
          <div className="smart-compass-needle">
            <div className="smart-needle-north" />
            <div className="smart-needle-south" />
          </div>
          <span className="smart-compass-n">N</span>
        </div>
      </div>
    </div>
  );
}
