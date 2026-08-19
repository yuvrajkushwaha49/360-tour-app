import React, { useState, useEffect } from 'react';
import { ArrowLeft, Globe, Share2, Copy, Check, ShieldAlert, Compass, Layers, Lock, ShieldCheck } from 'lucide-react';
import Viewer360 from './Viewer360';

interface PublicTourViewerProps {
  tourId: string;
  onBack: () => void;
  onLogin?: () => void;
}

export default function PublicTourViewer({ tourId, onBack, onLogin }: PublicTourViewerProps) {
  const [tourName, setTourName] = useState<string>('');
  const [tourData, setTourData] = useState<any>(null);
  const [activeLocationId, setActiveLocationId] = useState<string>(() => {
    return localStorage.getItem(`active_public_loc_${tourId}`) || '';
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

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
      const response = await fetch(`http://localhost:5000/api/tours/${tourId}`, {
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
    const url = `http://localhost:5000/api/tours/${tourId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="public-viewer-page d-flex flex-column align-items-center justify-content-center text-white">
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}></div>
        <h3 className="h5 font-weight-normal tracking-wide">Loading 360° Virtual Tour...</h3>
        <p className="small text-secondary mt-1 mb-0">Preparing high-definition panorama projection</p>
      </div>
    );
  }

  // Private Virtual Tour Screen
  if (isPrivate || (error && error.toLowerCase().includes('private'))) {
    return (
      <div className="public-viewer-page d-flex flex-column align-items-center justify-content-center text-white p-4 text-center">
        <div className="p-4 bg-warning bg-opacity-15 border border-warning border-opacity-30 rounded-circle text-warning mb-4 shadow-lg">
          <Lock size={48} className="text-warning" />
        </div>

        <span className="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-30 px-3 py-1.5 rounded-pill uppercase tracking-wider small font-weight-normal mb-3">
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

  return (
    <div className="public-viewer-page">
      {/* Floating Header */}
      <div className="public-viewer-header">
        <div className="d-flex align-items-center gap-3">
          <button
            onClick={onBack}
            className="btn btn-sm btn-outline-secondary text-white rounded-3 px-3 d-flex align-items-center gap-1 shadow-sm"
            title="Go Back"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
            <span className="small font-weight-normal">Back</span>
          </button>
          <div>
            <div className="public-viewer-title">
              <span>{tourName}</span>
              <span className="badge bg-primary bg-opacity-20 text-primary border border-primary border-opacity-30 rounded-pill px-2.5 py-1 small font-weight-normal">
                360° Interactive VR
              </span>
            </div>
            <p className="public-viewer-subtitle">
              Location: <span className="text-white">{currentLocation?.name || 'Main Room'}</span>
            </p>
          </div>
        </div>

        {/* Share Button */}
        <button
          onClick={copyShareLink}
          className="btn btn-sm btn-primary rounded-3 px-3.5 py-2 font-weight-normal d-flex align-items-center gap-2 shadow-sm"
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>Link Copied!</span>
            </>
          ) : (
            <>
              <Share2 size={14} />
              <span>Share Tour</span>
            </>
          )}
        </button>
      </div>

      {/* 360 Canvas View */}
      <div className="public-viewer-canvas">
        <Viewer360
          readOnly={true}
          directions={currentLocation?.directions || { F: [], B: [], L: [], R: [], U: [], D: [] }}
          gridConfigs={currentLocation?.gridConfigs || {}}
          hotspots={currentLocation?.hotspots || []}
          stitchedPanoPath={currentLocation?.stitchedPanoPath || currentLocation?.imagePath}
          onNavigate={(targetId) => {
            const targetLoc = locations.find((l: any) => l.id === targetId);
            if (targetLoc) handleLocationChange(targetLoc.id);
          }}
        />

        {/* Floating Bottom Room Selector Carousel */}
        {locations.length > 1 && (
          <div className="public-viewer-room-bar">
            {locations.map((loc: any) => (
              <button
                key={loc.id}
                onClick={() => handleLocationChange(loc.id)}
                className={`room-tab-btn ${loc.id === activeLocationId ? 'active' : 'inactive'}`}
              >
                <Layers size={14} />
                <span>{loc.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
