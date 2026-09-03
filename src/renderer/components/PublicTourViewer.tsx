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
  Image as ImageIcon,
  FileText,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCw,
  Target,
  Plus,
  Minus,
  Upload,
  Trash2,
  Edit3,
  ZoomIn,
  Info
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

  // Master Plan States
  const [isEditingMasterPlan, setIsEditingMasterPlan] = useState<boolean>(false);
  const [mpTitle, setMpTitle] = useState<string>('');
  const [mpMessage, setMpMessage] = useState<string>('');
  const [mpImage, setMpImage] = useState<string>('');
  const [isUploadingMp, setIsUploadingMp] = useState<boolean>(false);
  const [isSavingMp, setIsSavingMp] = useState<boolean>(false);

  // Gallery States
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [isUploadingGallery, setIsUploadingGallery] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Check if current logged-in user is admin
  const currentUser = (() => {
    try {
      const saved = localStorage.getItem('crm_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();
  const isAdmin = currentUser?.role === 'admin';

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

      // Initialize Master Plan
      if (data.tourData?.masterPlan) {
        setMpTitle(data.tourData.masterPlan.title || '');
        setMpMessage(data.tourData.masterPlan.message || '');
        setMpImage(data.tourData.masterPlan.imageUrl || '');
      }

      // Initialize Gallery
      if (data.tourData?.gallery && Array.isArray(data.tourData.gallery)) {
        setGalleryPhotos(data.tourData.gallery);
      }

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

  const handleUploadMasterPlanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMp(true);
    try {
      const token = localStorage.getItem('crm_token');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: formData
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to upload master plan image');

      setMpImage(resData.url);
    } catch (err: any) {
      alert(err.message || 'Image upload failed');
    } finally {
      setIsUploadingMp(false);
    }
  };

  const handleSaveMasterPlan = async () => {
    setIsSavingMp(true);
    try {
      const token = localStorage.getItem('crm_token');
      const updatedMasterPlan = {
        title: mpTitle || `${displayName} Master Plan`,
        message: mpMessage,
        imageUrl: mpImage
      };

      const updatedTourData = {
        ...(tourData || {}),
        masterPlan: updatedMasterPlan
      };

      const res = await fetch(`${API_BASE_URL}/api/projects/${tourId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          name: tourName,
          data: updatedTourData
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save master plan');
      }

      setTourData(updatedTourData);
      setIsEditingMasterPlan(false);
    } catch (err: any) {
      alert(err.message || 'Could not save master plan');
    } finally {
      setIsSavingMp(false);
    }
  };

  const handleUploadGalleryPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingGallery(true);
    try {
      const token = localStorage.getItem('crm_token');
      const newUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);

        const res = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          },
          body: formData
        });

        const resData = await res.json();
        if (res.ok && resData.url) {
          newUrls.push(resData.url);
        }
      }

      if (newUrls.length > 0) {
        const updatedGallery = [...galleryPhotos, ...newUrls];
        const updatedTourData = {
          ...(tourData || {}),
          gallery: updatedGallery
        };

        await fetch(`${API_BASE_URL}/api/projects/${tourId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            name: tourName,
            data: updatedTourData
          })
        });

        setGalleryPhotos(updatedGallery);
        setTourData(updatedTourData);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload gallery photos');
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const handleDeleteGalleryPhoto = async (indexToDelete: number) => {
    if (!confirm('Are you sure you want to remove this photo from the gallery?')) return;

    const updatedGallery = galleryPhotos.filter((_, idx) => idx !== indexToDelete);
    try {
      const token = localStorage.getItem('crm_token');
      const updatedTourData = {
        ...(tourData || {}),
        gallery: updatedGallery
      };

      await fetch(`${API_BASE_URL}/api/projects/${tourId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          name: tourName,
          data: updatedTourData
        })
      });

      setGalleryPhotos(updatedGallery);
      setTourData(updatedTourData);
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo');
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

          <div className="smart-portal-logo">
            {clientLogo && (
              <div
                style={{
                  height: '36px',
                  maxWidth: '140px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <img
                  src={toCloudFrontUrl(clientLogo)}
                  alt="Client Brand Logo"
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
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
            <ImageIcon size={14} />
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
            <div className="smart-menu-icon"><ImageIcon size={15} /></div>
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
          onNavigate={(targetId: string) => {
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

      {/* 1. MASTER PLAN MODAL OVERLAY */}
      {activeNavTab === 'masterplan' && (
        <div className="smart-content-overlay" onClick={() => setActiveNavTab('overview')}>
          <div className="smart-content-modal" onClick={(e) => e.stopPropagation()}>
            <div className="smart-content-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.18)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8'
                }}>
                  <Map size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '0.02em' }}>
                    {mpTitle || `${displayName} - Master Plan Blueprint`}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                    Strategic zoning layout, infrastructure corridors & visionary development
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isAdmin && (
                  <button
                    onClick={() => setIsEditingMasterPlan(!isEditingMasterPlan)}
                    style={{
                      background: isEditingMasterPlan ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.25)',
                      border: `1px solid ${isEditingMasterPlan ? 'rgba(239, 68, 68, 0.5)' : 'rgba(99, 102, 241, 0.5)'}`,
                      color: isEditingMasterPlan ? '#fca5a5' : '#c7d2fe',
                      padding: '6px 14px',
                      borderRadius: '10px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Edit3 size={14} />
                    <span>{isEditingMasterPlan ? 'Cancel Edit' : 'Edit Master Plan'}</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveNavTab('overview')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Close Master Plan"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="smart-content-modal-body">
              {isEditingMasterPlan ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Master Plan Title
                      </label>
                      <input
                        type="text"
                        value={mpTitle}
                        onChange={(e) => setMpTitle(e.target.value)}
                        placeholder="e.g. Phase 1 Master Plan Blueprint"
                        style={{
                          width: '100%',
                          background: '#070913',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          color: '#ffffff',
                          fontSize: '0.9rem',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Master Plan Image (Blueprint / 2D Map)
                      </label>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px dashed rgba(99, 102, 241, 0.4)',
                        borderRadius: '10px',
                        padding: '9px 14px',
                        color: '#c7d2fe',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}>
                        <Upload size={16} />
                        <span>{isUploadingMp ? 'Uploading Image...' : mpImage ? 'Replace Master Plan Image' : 'Upload Blueprint Image'}</span>
                        <input type="file" accept="image/*" onChange={handleUploadMasterPlanImage} hidden />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Master Plan Message & Vision Details
                    </label>
                    <textarea
                      rows={5}
                      value={mpMessage}
                      onChange={(e) => setMpMessage(e.target.value)}
                      placeholder="Enter detailed message, zone details, road infrastructure highlights, phases, and vision..."
                      style={{
                        width: '100%',
                        background: '#070913',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        color: '#ffffff',
                        fontSize: '0.88rem',
                        lineHeight: 1.5,
                        outline: 'none'
                      }}
                    />
                  </div>

                  {mpImage && (
                    <div style={{
                      height: '180px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: '#070913',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img src={toCloudFrontUrl(mpImage)} alt="Master Plan Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsEditingMasterPlan(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#cbd5e1',
                        padding: '8px 18px',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingMp || isUploadingMp}
                      onClick={handleSaveMasterPlan}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        border: 'none',
                        color: '#ffffff',
                        padding: '8px 24px',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(99,102,241,0.4)'
                      }}
                    >
                      {isSavingMp ? 'Saving Master Plan...' : 'Save Master Plan'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="smart-masterplan-layout">
                  {/* Left Blueprint Map Image */}
                  <div className="smart-masterplan-img-card">
                    {mpImage ? (
                      <img
                        src={toCloudFrontUrl(mpImage)}
                        alt="Master Plan Blueprint"
                        className="smart-masterplan-img"
                        onClick={() => {
                          const idx = galleryPhotos.indexOf(mpImage);
                          if (idx !== -1) setLightboxIndex(idx);
                          else {
                            setGalleryPhotos([mpImage, ...galleryPhotos]);
                            setLightboxIndex(0);
                          }
                        }}
                        title="Click to Enlarge"
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <Map size={48} style={{ color: '#4f46e5', margin: '0 auto 12px auto' }} />
                        <h4 style={{ color: '#ffffff', fontSize: '1.05rem', margin: '0 0 6px 0' }}>No Master Plan Image Uploaded</h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '0 0 16px 0', maxWidth: '300px' }}>
                          Upload the high-resolution master plan or architectural blueprint to display here.
                        </p>
                        {isAdmin && (
                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            padding: '8px 18px',
                            borderRadius: '10px',
                            color: '#ffffff',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}>
                            <Upload size={15} />
                            <span>Upload Master Plan</span>
                            <input type="file" accept="image/*" onChange={handleUploadMasterPlanImage} hidden />
                          </label>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Master Plan Details & Message */}
                  <div className="smart-masterplan-info">
                    <div className="smart-masterplan-msg-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#818cf8', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Info size={16} />
                        <span>Master Plan Message & Overview</span>
                      </div>
                      <div style={{ whiteSpace: 'pre-line', color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.6 }}>
                        {mpMessage || 'Welcome to the Master Plan overview. Explore the comprehensive master planning, strategic zoning, infrastructure networks, and eco-friendly corridors designed for state-of-the-art urban excellence.'}
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '1rem',
                      padding: '1.25rem'
                    }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                        Strategic Zone Highlights
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#e2e8f0' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#a855f7' }} />
                          <span>Industrial & Manufacturing Hub</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#e2e8f0' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }} />
                          <span>Commercial & High-Tech Core</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#e2e8f0' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                          <span>Eco Corridors & Public Green Space</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. PHOTO GALLERY MODAL OVERLAY */}
      {activeNavTab === 'gallery' && (
        <div className="smart-content-overlay" onClick={() => setActiveNavTab('overview')}>
          <div className="smart-content-modal" onClick={(e) => e.stopPropagation()}>
            <div className="smart-content-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.18)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8'
                }}>
                  <ImageIcon size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '0.02em' }}>
                    PROJECT PHOTO GALLERY
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                    High-resolution photographs, site captures, and visual gallery for {displayName}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isAdmin && (
                  <label style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '7px 16px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 16px rgba(99,102,241,0.35)'
                  }}>
                    <Upload size={14} />
                    <span>{isUploadingGallery ? 'Uploading...' : '+ Add Photos'}</span>
                    <input type="file" multiple accept="image/*" onChange={handleUploadGalleryPhotos} hidden />
                  </label>
                )}

                <button
                  onClick={() => setActiveNavTab('overview')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Close Gallery"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="smart-content-modal-body">
              {galleryPhotos && galleryPhotos.length > 0 ? (
                <div className="smart-gallery-grid">
                  {galleryPhotos.map((photoUrl, idx) => (
                    <div
                      key={idx}
                      className="smart-gallery-item"
                      onClick={() => setLightboxIndex(idx)}
                    >
                      <img
                        src={toCloudFrontUrl(photoUrl)}
                        alt={`Gallery Photo ${idx + 1}`}
                        className="smart-gallery-img"
                      />
                      <div className="smart-gallery-overlay">
                        <span style={{ fontSize: '0.74rem', color: '#ffffff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ZoomIn size={14} /> Click to view
                        </span>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGalleryPhoto(idx);
                          }}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(239, 68, 68, 0.85)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#ffffff',
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                            zIndex: 10
                          }}
                          title="Delete photo"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                  <ImageIcon size={54} style={{ color: '#4f46e5', margin: '0 auto 16px auto' }} />
                  <h4 style={{ color: '#ffffff', fontSize: '1.1rem', margin: '0 0 6px 0' }}>No Photos in Gallery Yet</h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 20px 0', maxWidth: '340px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Upload property photos, progress pictures, and visual captures to display in this interactive gallery.
                  </p>
                  {isAdmin && (
                    <label style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      padding: '10px 22px',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 6px 20px rgba(99,102,241,0.4)'
                    }}>
                      <Upload size={16} />
                      <span>Upload Photos to Gallery</span>
                      <input type="file" multiple accept="image/*" onChange={handleUploadGalleryPhotos} hidden />
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. LIGHTBOX FULLSCREEN PHOTO VIEWER */}
      {lightboxIndex !== null && galleryPhotos[lightboxIndex] && (
        <div className="smart-lightbox" onClick={() => setLightboxIndex(null)}>
          <button
            onClick={() => setLightboxIndex(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 100001
            }}
          >
            <X size={20} />
          </button>

          {galleryPhotos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex - 1 + galleryPhotos.length) % galleryPhotos.length);
                }}
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0, 0, 0, 0.65)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 100001
                }}
              >
                <ChevronLeft size={24} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex + 1) % galleryPhotos.length);
                }}
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0, 0, 0, 0.65)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 100001
                }}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            <img
              src={toCloudFrontUrl(galleryPhotos[lightboxIndex])}
              alt="Enlarged View"
            />
            <div style={{
              marginTop: '12px',
              fontSize: '0.85rem',
              color: '#94a3b8',
              fontWeight: 600,
              background: 'rgba(0,0,0,0.6)',
              padding: '4px 14px',
              borderRadius: '20px'
            }}>
              Photo {lightboxIndex + 1} of {galleryPhotos.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
