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
  Building2,
  Map,
  Network,
  Image as ImageIcon,
  FileText,
  Star,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  RotateCcw,
  Gauge,
  Minus,
  Upload,
  Trash2,
  Edit3,
  ZoomIn,
  Info,
  Plane,
  Train,
  Car,
  Navigation,
  Anchor,
  Clock,
  Plus,
  Download,
  FileDown,
  FolderDown,
  File,
  ExternalLink,
  Camera,
  Loader2,
  Save,
  Copy
} from 'lucide-react';
import Viewer360, { Viewer360Ref } from './Viewer360';
import { API_BASE_URL, toCloudFrontUrl } from '../utils/apiConfig';
import { ImageAdjustments, DEFAULT_ADJUSTMENTS } from '../utils/imageAdjustmentEngine';
import { uploadFileWithFallback } from '../utils/uploadWithFallback';
import { createShareUrl, verifyShareParams } from '../utils/shareSecurity';

export interface ConnectivityItem {
  id: string;
  title: string;
  category: 'road' | 'rail' | 'air' | 'sea' | 'metro';
  distance: string;
  description: string;
}

export interface DownloadItem {
  id: string;
  title: string;
  category: 'brochure' | 'masterplan' | 'floorplan' | 'legal' | 'report';
  fileUrl: string;
  fileSize?: string;
  fileType?: string;
  description?: string;
}

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
  const [rightSidebarOpen, setRightSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tour_right_sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Temporary Share Link Expiration & Tamper-Proof Cryptographic Verification
  const initialShareStatus = (() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const exp = urlParams.get('exp') || urlParams.get('expires');
      const sig = urlParams.get('sig') || urlParams.get('signature');
      return verifyShareParams(tourId, exp, sig);
    } catch (e) {
      return { isExpiring: false, isValid: true, isExpired: false, remainingSeconds: null };
    }
  })();

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(initialShareStatus.remainingSeconds);
  const [isLinkExpired, setIsLinkExpired] = useState<boolean>(initialShareStatus.isExpired);

  // Admin Manual Share Modal States
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareMinutes, setShareMinutes] = useState<number>(5);
  const [shareLinkCopied, setShareLinkCopied] = useState<boolean>(false);

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
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Connectivity Network States
  const [connectivityList, setConnectivityList] = useState<ConnectivityItem[]>([]);
  const [isEditingConnectivity, setIsEditingConnectivity] = useState<boolean>(false);
  const [editingConnItem, setEditingConnItem] = useState<ConnectivityItem | null>(null);
  const [connFormTitle, setConnFormTitle] = useState<string>('');
  const [connFormCategory, setConnFormCategory] = useState<'road' | 'rail' | 'air' | 'sea' | 'metro'>('road');
  const [connFormDistance, setConnFormDistance] = useState<string>('');
  const [connFormDesc, setConnFormDesc] = useState<string>('');
  const [connCategoryFilter, setConnCategoryFilter] = useState<string>('all');
  const [isSavingConnectivity, setIsSavingConnectivity] = useState<boolean>(false);

  // Downloads & Documents States
  const [downloadsList, setDownloadsList] = useState<DownloadItem[]>([]);
  const [isEditingDownload, setIsEditingDownload] = useState<boolean>(false);
  const [editingDownloadItem, setEditingDownloadItem] = useState<DownloadItem | null>(null);
  const [dlFormTitle, setDlFormTitle] = useState<string>('');
  const [dlFormCategory, setDlFormCategory] = useState<'brochure' | 'masterplan' | 'floorplan' | 'legal' | 'report'>('brochure');
  const [dlFormFileUrl, setDlFormFileUrl] = useState<string>('');
  const [dlFormFileSize, setDlFormFileSize] = useState<string>('');
  const [dlFormFileType, setDlFormFileType] = useState<string>('PDF');
  const [dlFormDesc, setDlFormDesc] = useState<string>('');
  const [dlCategoryFilter, setDlCategoryFilter] = useState<string>('all');
  const [isUploadingDlFile, setIsUploadingDlFile] = useState<boolean>(false);
  const [isSavingDownload, setIsSavingDownload] = useState<boolean>(false);

  // Quick Explore Thumbnail Upload State
  const [uploadingThumbnailLocId, setUploadingThumbnailLocId] = useState<string | null>(null);

  // Hotspot Edit Modal States
  const [showEditHotspotModal, setShowEditHotspotModal] = useState<boolean>(false);
  const [editingHotspot, setEditingHotspot] = useState<any>(null);
  const [editHotspotName, setEditHotspotName] = useState<string>('');
  const [editHotspotSubtitle, setEditHotspotSubtitle] = useState<string>('');
  const [editHotspotCategory, setEditHotspotCategory] = useState<string>('Commercial');
  const [editHotspotTargetId, setEditHotspotTargetId] = useState<string>('');
  const [editHotspotBeaconColor, setEditHotspotBeaconColor] = useState<string>('#a855f7');
  const [editHotspotCustomIconUrl, setEditHotspotCustomIconUrl] = useState<string>('');
  const [editHotspotArea, setEditHotspotArea] = useState<string>('');
  const [editHotspotDesc, setEditHotspotDesc] = useState<string>('');
  const [editHotspotIsPublic, setEditHotspotIsPublic] = useState<boolean>(true);
  const [isSavingHotspot, setIsSavingHotspot] = useState<boolean>(false);
  const [isUploadingHotspotTargetThumb, setIsUploadingHotspotTargetThumb] = useState<boolean>(false);

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
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tour_left_sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [autoRotate, setAutoRotate] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tour_auto_rotate');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [autoRotateSpeed, setAutoRotateSpeed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tour_auto_rotate_speed');
      return saved !== null ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });
  const [speedMenuOpen, setSpeedMenuOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const carouselScrollRef = useRef<HTMLDivElement>(null);
  const viewer360Ref = useRef<Viewer360Ref>(null);

  // Sync autoRotate state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tour_auto_rotate', JSON.stringify(autoRotate));
    } catch (e) {
      console.warn('Failed to save autoRotate state to localStorage', e);
    }
  }, [autoRotate]);

  // Sync autoRotateSpeed to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tour_auto_rotate_speed', String(autoRotateSpeed));
    } catch (e) {
      console.warn('Failed to save autoRotateSpeed to localStorage', e);
    }
  }, [autoRotateSpeed]);

  // Close speed menu on outside click
  useEffect(() => {
    if (!speedMenuOpen) return;
    const handleOutside = () => setSpeedMenuOpen(false);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [speedMenuOpen]);

  // Sync sidebar open/close state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tour_left_sidebar_open', JSON.stringify(sidebarOpen));
    } catch (e) {
      console.warn('Failed to save sidebarOpen state to localStorage', e);
    }
  }, [sidebarOpen]);

  useEffect(() => {
    try {
      localStorage.setItem('tour_right_sidebar_open', JSON.stringify(rightSidebarOpen));
    } catch (e) {
      console.warn('Failed to save rightSidebarOpen state to localStorage', e);
    }
  }, [rightSidebarOpen]);

  // Countdown interval for temporary share link (5 minutes)
  useEffect(() => {
    if (isAdmin || remainingSeconds === null) return;

    if (remainingSeconds <= 0) {
      setIsLinkExpired(true);
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev === null || prev <= 1) {
          setIsLinkExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAdmin, remainingSeconds]);

  const handleLocationChange = (locId: string) => {
    setActiveLocationId(locId);
    localStorage.setItem(`active_public_loc_${tourId}`, locId);
  };

  const handleQuickExploreNavigate = (locId: string) => {
    if (locId === activeLocationId) return;
    const locationsList = tourData?.locations || [];
    const targetLoc = locationsList.find((l: any) => l.id === locId);
    if (!targetLoc) return;

    const currentLoc = locationsList.find((l: any) => l.id === activeLocationId) || locationsList[0];
    const matchingHotspot = currentLoc?.hotspots?.find((h: any) => h.targetLocationId === locId);

    if (viewer360Ref.current?.navigateToLocation) {
      viewer360Ref.current.navigateToLocation(locId, matchingHotspot?.position, targetLoc);
    } else {
      handleLocationChange(locId);
    }
  };

  // Sync Per-Location Details (Master Plan, Gallery, Connectivity, Downloads) when activeLocationId or tourData changes
  useEffect(() => {
    const locations = tourData?.locations || [];
    const currentLoc = locations.find((l: any) => l.id === activeLocationId) || locations[0];
    if (!currentLoc) return;

    // 1. Master Plan for active location
    const locMp = currentLoc.masterPlan;
    if (locMp) {
      setMpTitle(locMp.title || `${currentLoc.name} Master Plan`);
      setMpMessage(locMp.message || '');
      setMpImage(locMp.imageUrl || '');
    } else {
      setMpTitle(`${currentLoc.name} Master Plan`);
      setMpMessage('');
      setMpImage('');
    }

    // 2. Gallery for active location
    const locGallery = currentLoc.gallery || currentLoc.galleryPhotos || currentLoc.images || [];
    setGalleryPhotos(Array.isArray(locGallery) ? locGallery : []);

    // 3. Connectivity for active location
    const locConn = currentLoc.connectivity || [];
    setConnectivityList(Array.isArray(locConn) ? locConn : []);

    // 4. Downloads for active location
    const locDl = currentLoc.downloads || [];
    setDownloadsList(Array.isArray(locDl) ? locDl : []);
  }, [activeLocationId, tourData]);

  // Helper to persist location-specific updates to backend
  const saveUpdatedLocationData = async (locUpdates: Record<string, any>) => {
    if (!isAdmin) {
      console.warn('Unauthorized attempt to modify location data');
      return;
    }
    const locations = tourData?.locations || [];
    const targetLocId = activeLocationId || (locations[0] && locations[0].id);
    if (!targetLocId) return;

    const updatedLocations = locations.map((loc: any) => {
      if (loc.id === targetLocId) {
        return {
          ...loc,
          ...locUpdates
        };
      }
      return loc;
    });

    const updatedTourData = {
      ...(tourData || {}),
      locations: updatedLocations
    };

    const token = localStorage.getItem('crm_token') || localStorage.getItem('token');
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to save location data');
    }

    setTourData(updatedTourData);
    return updatedTourData;
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
      const urlParams = new URLSearchParams(window.location.search);
      const expParam = urlParams.get('exp') || urlParams.get('expires') || '';
      const sigParam = urlParams.get('sig') || urlParams.get('signature') || '';
      const queryParams = new URLSearchParams();
      if (expParam) queryParams.set('exp', expParam);
      if (sigParam) queryParams.set('sig', sigParam);
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const response = await fetch(`${API_BASE_URL}/api/tours/${tourId}${qs}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      const data = await response.json();

      if (response.status === 410 || data.is_expired) {
        setIsLinkExpired(true);
        setError('This share link has expired or is invalid.');
        return;
      }

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
        const targetId = isValidSavedLoc ? savedLocId : locations[0].id;
        setActiveLocationId(targetId);
        localStorage.setItem(`active_public_loc_${tourId}`, targetId);

        const currentLoc = locations.find((l: any) => l.id === targetId) || locations[0];
        if (currentLoc) {
          if (currentLoc.masterPlan) {
            setMpTitle(currentLoc.masterPlan.title || `${currentLoc.name} Master Plan`);
            setMpMessage(currentLoc.masterPlan.message || '');
            setMpImage(currentLoc.masterPlan.imageUrl || '');
          } else {
            setMpTitle(`${currentLoc.name} Master Plan`);
            setMpMessage('');
            setMpImage('');
          }
          const locGallery = currentLoc.gallery || currentLoc.galleryPhotos || currentLoc.images || [];
          setGalleryPhotos(Array.isArray(locGallery) ? locGallery : []);
          const locConn = currentLoc.connectivity || [];
          setConnectivityList(Array.isArray(locConn) ? locConn : []);
          const locDl = currentLoc.downloads || [];
          setDownloadsList(Array.isArray(locDl) ? locDl : []);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error loading 360 tour');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadMasterPlanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      alert('Permission denied: Only administrators can upload master plan images.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMp(true);
    try {
      const token = localStorage.getItem('crm_token');
      const formData = new FormData();
      formData.append('file', file);

      const resData = await uploadFileWithFallback(
        `${API_BASE_URL}/api/upload`,
        formData,
        token ? { Authorization: `Bearer ${token}` } : {}
      );

      if (resData && resData.url) {
        setMpImage(resData.url);
      }
    } catch (err: any) {
      if (!err.message?.includes('cancelled')) {
        alert(err.message || 'Image upload failed');
      }
    } finally {
      setIsUploadingMp(false);
    }
  };

  const handleSaveMasterPlan = async () => {
    if (!isAdmin) {
      alert('Permission denied: Only administrators can edit the master plan.');
      return;
    }
    setIsSavingMp(true);
    try {
      const updatedMasterPlan = {
        title: mpTitle || `${displayName} Master Plan`,
        message: mpMessage,
        imageUrl: mpImage
      };

      await saveUpdatedLocationData({ masterPlan: updatedMasterPlan });
      setIsEditingMasterPlan(false);
    } catch (err: any) {
      alert(err.message || 'Could not save master plan');
    } finally {
      setIsSavingMp(false);
    }
  };

  const handleUploadGalleryPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      alert('Permission denied: Only administrators can upload gallery photos.');
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingGallery(true);
    try {
      const token = localStorage.getItem('crm_token');
      const newUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);

        const resData = await uploadFileWithFallback(
          `${API_BASE_URL}/api/upload`,
          formData,
          token ? { Authorization: `Bearer ${token}` } : {}
        );

        if (resData && resData.url) {
          newUrls.push(resData.url);
        }
      }

      if (newUrls.length > 0) {
        const updatedGallery = [...galleryPhotos, ...newUrls];
        await saveUpdatedLocationData({ gallery: updatedGallery });
        setGalleryPhotos(updatedGallery);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload gallery photos');
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const handleDeleteGalleryPhoto = async (indexToDelete: number) => {
    if (!isAdmin) {
      alert('Permission denied: Only administrators can delete gallery photos.');
      return;
    }
    if (!confirm('Are you sure you want to remove this photo from the gallery?')) return;

    const updatedGallery = galleryPhotos.filter((_, idx) => idx !== indexToDelete);
    try {
      await saveUpdatedLocationData({ gallery: updatedGallery });
      setGalleryPhotos(updatedGallery);
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo');
    }
  };

  // Connectivity Handlers
  const handleOpenAddConnectivity = () => {
    if (!isAdmin) return;
    setEditingConnItem(null);
    setConnFormTitle('');
    setConnFormCategory('road');
    setConnFormDistance('');
    setConnFormDesc('');
    setIsEditingConnectivity(true);
  };

  const handleOpenEditConnectivity = (item: ConnectivityItem) => {
    if (!isAdmin) return;
    setEditingConnItem(item);
    setConnFormTitle(item.title);
    setConnFormCategory(item.category);
    setConnFormDistance(item.distance || '');
    setConnFormDesc(item.description || '');
    setIsEditingConnectivity(true);
  };

  const handleSaveConnectivityItem = async () => {
    if (!isAdmin) {
      alert('Permission denied: Only administrators can manage connectivity items.');
      return;
    }
    if (!connFormTitle.trim()) {
      alert('Please enter a name/title for the connectivity point.');
      return;
    }

    setIsSavingConnectivity(true);
    try {
      let updatedList: ConnectivityItem[];
      if (editingConnItem) {
        updatedList = connectivityList.map(item =>
          item.id === editingConnItem.id
            ? {
              ...item,
              title: connFormTitle.trim(),
              category: connFormCategory,
              distance: connFormDistance.trim(),
              description: connFormDesc.trim()
            }
            : item
        );
      } else {
        const newItem: ConnectivityItem = {
          id: `conn_${Date.now()}`,
          title: connFormTitle.trim(),
          category: connFormCategory,
          distance: connFormDistance.trim(),
          description: connFormDesc.trim()
        };
        updatedList = [...connectivityList, newItem];
      }

      await saveUpdatedLocationData({ connectivity: updatedList });
      setConnectivityList(updatedList);
      setIsEditingConnectivity(false);
      setEditingConnItem(null);
      setConnFormTitle('');
      setConnFormDistance('');
      setConnFormDesc('');
    } catch (err: any) {
      alert(err.message || 'Failed to save connectivity item');
    } finally {
      setIsSavingConnectivity(false);
    }
  };

  const handleDeleteConnectivityItem = async (idToDelete: string) => {
    if (!isAdmin) {
      alert('Permission denied: Only administrators can delete connectivity items.');
      return;
    }
    if (!confirm('Are you sure you want to remove this connectivity item?')) return;

    const updatedList = connectivityList.filter(item => item.id !== idToDelete);
    try {
      await saveUpdatedLocationData({ connectivity: updatedList });
      setConnectivityList(updatedList);
    } catch (err: any) {
      alert(err.message || 'Failed to delete connectivity item');
    }
  };

  // Downloads Handlers
  const handleUploadDownloadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      alert('Permission denied: Only administrators can upload documents.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDlFile(true);
    try {
      const token = localStorage.getItem('crm_token') || localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const resData = await uploadFileWithFallback(
        `${API_BASE_URL}/api/upload`,
        formData,
        token ? { Authorization: `Bearer ${token}` } : {}
      );

      if (resData && resData.url) {
        setDlFormFileUrl(resData.url);
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        setDlFormFileSize(`${sizeMb} MB`);
        const ext = file.name.split('.').pop()?.toUpperCase() || 'PDF';
        setDlFormFileType(ext);
        if (!dlFormTitle) {
          setDlFormTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload document file');
    } finally {
      setIsUploadingDlFile(false);
    }
  };

  const handleOpenAddDownload = () => {
    if (!isAdmin) return;
    setEditingDownloadItem(null);
    setDlFormTitle('');
    setDlFormCategory('brochure');
    setDlFormFileUrl('');
    setDlFormFileSize('');
    setDlFormFileType('PDF');
    setDlFormDesc('');
    setIsEditingDownload(true);
  };

  const handleOpenEditDownload = (item: DownloadItem) => {
    if (!isAdmin) return;
    setEditingDownloadItem(item);
    setDlFormTitle(item.title);
    setDlFormCategory(item.category);
    setDlFormFileUrl(item.fileUrl);
    setDlFormFileSize(item.fileSize || '');
    setDlFormFileType(item.fileType || 'PDF');
    setDlFormDesc(item.description || '');
    setIsEditingDownload(true);
  };

  const handleSaveDownloadItem = async () => {
    if (!isAdmin) {
      alert('Permission denied: Only administrators can save documents.');
      return;
    }
    if (!dlFormTitle.trim()) {
      alert('Please enter a title for the document.');
      return;
    }
    if (!dlFormFileUrl.trim()) {
      alert('Please upload a file or enter a document URL.');
      return;
    }

    setIsSavingDownload(true);
    try {
      let updatedList: DownloadItem[];
      if (editingDownloadItem) {
        updatedList = downloadsList.map(item =>
          item.id === editingDownloadItem.id
            ? {
              ...item,
              title: dlFormTitle.trim(),
              category: dlFormCategory,
              fileUrl: dlFormFileUrl.trim(),
              fileSize: dlFormFileSize.trim() || '2.5 MB',
              fileType: dlFormFileType.trim() || 'PDF',
              description: dlFormDesc.trim()
            }
            : item
        );
      } else {
        const newItem: DownloadItem = {
          id: `dl_${Date.now()}`,
          title: dlFormTitle.trim(),
          category: dlFormCategory,
          fileUrl: dlFormFileUrl.trim(),
          fileSize: dlFormFileSize.trim() || '2.5 MB',
          fileType: dlFormFileType.trim() || 'PDF',
          description: dlFormDesc.trim()
        };
        updatedList = [...downloadsList, newItem];
      }

      await saveUpdatedLocationData({ downloads: updatedList });
      setDownloadsList(updatedList);
      setIsEditingDownload(false);
      setEditingDownloadItem(null);
      setDlFormTitle('');
      setDlFormFileUrl('');
      setDlFormDesc('');
    } catch (err: any) {
      alert(err.message || 'Failed to save document');
    } finally {
      setIsSavingDownload(false);
    }
  };

  const handleDeleteDownloadItem = async (idToDelete: string) => {
    if (!isAdmin) {
      alert('Permission denied: Only administrators can delete documents.');
      return;
    }
    if (!confirm('Are you sure you want to remove this document?')) return;

    const updatedList = downloadsList.filter(item => item.id !== idToDelete);
    try {
      await saveUpdatedLocationData({ downloads: updatedList });
      setDownloadsList(updatedList);
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    }
  };

  // Hotspot Edit Handlers (Admin)
  const handleOpenEditHotspot = (hs: any) => {
    if (!isAdmin) return;
    setEditingHotspot(hs);
    setEditHotspotName(hs.name || '');
    setEditHotspotSubtitle(hs.subtitle || '');
    setEditHotspotCategory(hs.category || 'Commercial');
    setEditHotspotTargetId(hs.targetLocationId || '');
    setEditHotspotBeaconColor(hs.beaconColor || '#a855f7');
    setEditHotspotCustomIconUrl(hs.customIconUrl || '');
    setEditHotspotArea(hs.area || '');
    setEditHotspotDesc(hs.description || '');
    setEditHotspotIsPublic(hs.isPublic !== undefined ? hs.isPublic : true);
    setShowEditHotspotModal(true);
  };

  const handleUploadHotspotTargetRoomThumbnail = async (targetRoomId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file || !targetRoomId) return;

    setIsUploadingHotspotTargetThumb(true);
    try {
      const token = localStorage.getItem('crm_token') || localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const resData = await uploadFileWithFallback(
        `${API_BASE_URL}/api/upload`,
        formData,
        token ? { Authorization: `Bearer ${token}` } : {}
      );

      if (resData && resData.url) {
        const allLocs = tourData?.locations || [];
        const updatedLocations = allLocs.map((l: any) =>
          l.id === targetRoomId
            ? { ...l, thumbnailPath: resData.url, thumbnailUrl: resData.url }
            : l
        );

        const updatedTourData = {
          ...(tourData || {}),
          locations: updatedLocations
        };

        if (tourId) {
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
        }

        setTourData(updatedTourData);
      }
    } catch (err: any) {
      alert('Failed to upload thumbnail: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploadingHotspotTargetThumb(false);
    }
  };

  const handleSaveHotspotDetails = async () => {
    if (!isAdmin || !editingHotspot || !currentLocation) return;
    setIsSavingHotspot(true);
    try {
      const updatedHotspots = (currentLocation.hotspots || []).map((h: any) =>
        h.id === editingHotspot.id
          ? {
            ...h,
            name: editHotspotName.trim() || h.name,
            subtitle: editHotspotSubtitle.trim() || undefined,
            category: editHotspotCategory || undefined,
            targetLocationId: editHotspotTargetId || undefined,
            beaconColor: editHotspotBeaconColor || '#a855f7',
            customIconUrl: editHotspotCustomIconUrl || undefined,
            area: editHotspotArea.trim() || undefined,
            description: editHotspotDesc.trim() || undefined,
            isPublic: editHotspotIsPublic
          }
          : h
      );

      const allLocs = tourData?.locations || [];
      const updatedLocations = allLocs.map((loc: any) =>
        loc.id === currentLocation.id
          ? { ...loc, hotspots: updatedHotspots }
          : loc
      );

      const updatedTourData = {
        ...(tourData || {}),
        locations: updatedLocations
      };

      const token = localStorage.getItem('crm_token') || localStorage.getItem('token');
      if (tourId) {
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
      }

      setTourData(updatedTourData);
      setShowEditHotspotModal(false);
      setEditingHotspot(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save hotspot details');
    } finally {
      setIsSavingHotspot(false);
    }
  };

  const handleDeleteHotspot = async (hotspotIdToDelete: string) => {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to delete this hotspot?')) return;
    if (!currentLocation) return;

    try {
      const updatedHotspots = (currentLocation.hotspots || []).filter((h: any) => h.id !== hotspotIdToDelete);
      const allLocs = tourData?.locations || [];
      const updatedLocations = allLocs.map((loc: any) =>
        loc.id === currentLocation.id
          ? { ...loc, hotspots: updatedHotspots }
          : loc
      );

      const updatedTourData = {
        ...(tourData || {}),
        locations: updatedLocations
      };

      const token = localStorage.getItem('crm_token') || localStorage.getItem('token');
      if (tourId) {
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
      }

      setTourData(updatedTourData);
      setShowEditHotspotModal(false);
      setEditingHotspot(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete hotspot');
    }
  };

  // Upload Custom Room / Location Thumbnail Handler
  const handleUploadLocationThumbnail = async (locId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingThumbnailLocId(locId);
    try {
      const token = localStorage.getItem('crm_token') || localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const resData = await uploadFileWithFallback(
        `${API_BASE_URL}/api/upload`,
        formData,
        token ? { Authorization: `Bearer ${token}` } : {}
      );

      if (resData && resData.url) {
        const updatedLocations = (tourData?.locations || []).map((loc: any) => {
          if (loc.id === locId) {
            return {
              ...loc,
              thumbnailPath: resData.url,
              thumbnailUrl: resData.url
            };
          }
          return loc;
        });

        const updatedTourData = {
          ...(tourData || {}),
          locations: updatedLocations
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

        setTourData(updatedTourData);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload location thumbnail');
    } finally {
      setUploadingThumbnailLocId(null);
    }
  };

  const getGeneratedShareUrl = () => {
    return createShareUrl(tourId, shareMinutes);
  };

  const handleCopyShareModalLink = () => {
    const url = getGeneratedShareUrl();
    navigator.clipboard.writeText(url);
    setShareLinkCopied(true);
    setTimeout(() => setShareLinkCopied(false), 2500);
  };

  const copyShareLink = () => {
    setShowShareModal(true);
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

  // Temporary 5-Minute Link Expired Screen (Clients/Visitors only)
  if (isLinkExpired && !isAdmin) {
    return (
      <div className="public-viewer-page d-flex flex-column align-items-center justify-content-center text-white p-4 text-center" style={{ background: '#050713' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '2px solid rgba(239, 68, 68, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f87171',
          marginBottom: '20px',
          boxShadow: '0 0 30px rgba(239, 68, 68, 0.25)'
        }}>
          <Clock size={40} />
        </div>

        <span style={{
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          fontSize: '0.75rem',
          fontWeight: 700,
          padding: '4px 14px',
          borderRadius: '20px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '14px'
        }}>
          ⏰ Share Link Expired
        </span>

        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginBottom: '10px' }}>
          This 5-Minute Share Link Has Expired
        </h2>
        <p style={{ fontSize: '0.88rem', color: '#94a3b8', maxWidth: '440px', lineHeight: 1.6, marginBottom: '24px' }}>
          For privacy and security, temporary preview links are valid for 5 minutes. Please contact the administrator for a fresh link or sign in with authorized credentials.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              className="btn btn-primary rounded-3 px-4 py-2.5 small font-weight-normal d-flex align-items-center gap-2 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', border: 'none' }}
            >
              <ShieldCheck size={16} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    );
  }

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

  // Locations sorted: Private locations FIRST, then Public locations (without mentioning private/public labels)
  const sortedLocations = (locations && locations.length > 0)
    ? [...locations].sort((a: any, b: any) => {
      const aIsPrivate = a.isPublic === false || a.isPrivate === true || a.access === 'private';
      const bIsPrivate = b.isPublic === false || b.isPrivate === true || b.access === 'private';
      if (aIsPrivate && !bIsPrivate) return -1;
      if (!aIsPrivate && bIsPrivate) return 1;
      return 0;
    })
    : [];

  // Helper to render Location Indicator & Switcher inside all modals
  const renderModalLocationBadge = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
      <span style={{
        background: 'rgba(99, 102, 241, 0.22)',
        border: '1px solid rgba(99, 102, 241, 0.45)',
        color: '#c7d2fe',
        fontSize: '0.72rem',
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        📍 {currentLocation?.name || 'Current Space'}
      </span>
      {locations.length > 1 && (
        <select
          value={activeLocationId}
          onChange={(e) => handleLocationChange(e.target.value)}
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '3px 8px',
            outline: 'none',
            cursor: 'pointer'
          }}
          title="Switch active location details"
        >
          {locations.map((loc: any) => (
            <option key={loc.id} value={loc.id} style={{ background: '#090d1f', color: '#ffffff' }}>
              {loc.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );

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
        {/* Left Branding & Controls */}
        <div className="smart-portal-brand">
          {/* Back to Dashboard Button (Shifted to Left) */}
          <button
            onClick={onBack}
            className="smart-tool-btn"
            style={{ width: '2.25rem', height: '2.25rem', color: '#c7d2fe' }}
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>

          {/* Left Navbar Open/Close Toggle Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`smart-tool-btn ${sidebarOpen ? 'active' : ''}`}
            style={{
              width: '2.25rem',
              height: '2.25rem',
              background: sidebarOpen ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4))' : undefined,
              borderColor: sidebarOpen ? 'rgba(99, 102, 241, 0.7)' : undefined
            }}
            title={sidebarOpen ? 'Close Menu' : 'Open Menu'}
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
          <button
            onClick={() => setActiveNavTab('downloads')}
            className={`smart-nav-btn ${activeNavTab === 'downloads' ? 'active' : ''}`}
          >
            <FolderDown size={14} />
            <span>Downloads</span>
          </button>
        </div>

        {/* Right Controls (Right Navbar Toggle, Share, Fullscreen) */}
        <div className="smart-top-right">
          {/* Right Locations Navbar Open/Close Toggle Button */}
          <button
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            className={`smart-tool-btn ${rightSidebarOpen ? 'active' : ''}`}
            style={{
              width: '2.25rem',
              height: '2.25rem',
              background: rightSidebarOpen ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4))' : undefined,
              borderColor: rightSidebarOpen ? 'rgba(99, 102, 241, 0.7)' : undefined
            }}
            title={rightSidebarOpen ? "Close Locations Navbar" : "Open Locations Navbar"}
          >
            {rightSidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>

          {/* Share Button (Admin Only) */}
          {isAdmin && (
            <button
              onClick={copyShareLink}
              className="smart-tool-btn"
              style={{ width: '2.25rem', height: '2.25rem' }}
              title="Share Tour (Set Active Duration)"
            >
              <Share2 size={15} />
            </button>
          )}

          {/* Temporary Link Validity Countdown Pill (for shared clients) */}
          {!isAdmin && remainingSeconds !== null && remainingSeconds > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: remainingSeconds < 60 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(99, 102, 241, 0.22)',
              border: remainingSeconds < 60 ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(99, 102, 241, 0.4)',
              color: remainingSeconds < 60 ? '#fca5a5' : '#c7d2fe',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              boxShadow: remainingSeconds < 60 ? '0 0 10px rgba(239, 68, 68, 0.35)' : 'none'
            }} title="Temporary share link validity remaining">
              <Clock size={12} className={remainingSeconds < 60 ? 'spin' : ''} />
              <span>
                {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="smart-tool-btn"
            style={{ width: '2.25rem', height: '2.25rem' }}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
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
            if (locations.length > 0) handleQuickExploreNavigate(locations[0].id);
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
              <div className="smart-menu-sub">{currentLocation?.name || 'Space'} planning</div>
            </div>
          </div>

          <div className="smart-menu-item" onClick={() => setActiveNavTab('infrastructure')}>
            <div className="smart-menu-icon"><Building2 size={15} /></div>
            <div>
              <div className="smart-menu-label">INFRASTRUCTURE</div>
              <div className="smart-menu-sub">{currentLocation?.name || 'Space'} facilities</div>
            </div>
          </div>

          <div className="smart-menu-item" onClick={() => setActiveNavTab('connectivity')}>
            <div className="smart-menu-icon"><Network size={15} /></div>
            <div>
              <div className="smart-menu-label">CONNECTIVITY</div>
              <div className="smart-menu-sub">{currentLocation?.name || 'Space'} transit & routes</div>
            </div>
          </div>

          <div className="smart-menu-item" onClick={() => setActiveNavTab('why')}>
            <div className="smart-menu-icon"><Star size={15} /></div>
            <div>
              <div className="smart-menu-label">WHY {currentLocation?.name?.toUpperCase() || displayName.toUpperCase()}?</div>
              <div className="smart-menu-sub">Key features & insights</div>
            </div>
          </div>

          <div className="smart-menu-item" onClick={() => setActiveNavTab('gallery')}>
            <div className="smart-menu-icon"><ImageIcon size={15} /></div>
            <div>
              <div className="smart-menu-label">GALLERY</div>
              <div className="smart-menu-sub">{currentLocation?.name || 'Space'} photos ({galleryPhotos.length})</div>
            </div>
          </div>

          <div className="smart-menu-item" onClick={() => setActiveNavTab('downloads')}>
            <div className="smart-menu-icon"><FolderDown size={15} /></div>
            <div>
              <div className="smart-menu-label">DOWNLOADS</div>
              <div className="smart-menu-sub">{currentLocation?.name || 'Space'} docs ({downloadsList.length})</div>
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

      {/* Right Collapsible Glassmorphic Navbar (All Locations: Private First, then Public - No labels mentioned) */}
      <div className={`smart-portal-right-sidebar ${rightSidebarOpen ? 'open' : 'collapsed'}`}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '12px'
        }}>
          <div className="smart-cta-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
                border: '1px solid rgba(99, 102, 241, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a5b4fc'
              }}>
                <Compass size={15} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
                  ALL LOCATIONS
                </div>

                <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>
                  {sortedLocations.length} Interactive Spaces
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRightSidebarOpen(false)}
              className="smart-close-btn"
              title="Close List"
            >
              <X size={18} />
            </button>
          </div>

        </div>

        {/* Locations List Items */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflowY: 'auto',
          paddingRight: '4px',
          flex: 1,
          scrollbarWidth: 'thin'
        }}>
          {sortedLocations.map((loc: any) => {
            const isCurrent = currentLocation?.id === loc.id;

            return (
              <div
                key={loc.id}
                onClick={() => handleQuickExploreNavigate(loc.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: isCurrent
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.4) 0%, rgba(168, 85, 247, 0.3) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: isCurrent
                    ? '1px solid rgba(99, 102, 241, 0.75)'
                    : '1px solid rgba(255, 255, 255, 0.07)',
                  boxShadow: isCurrent
                    ? '0 4px 16px rgba(99, 102, 241, 0.35)'
                    : '0 2px 8px rgba(0, 0, 0, 0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.transform = 'translateX(-3px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  {/* Glowing Indicator Dot */}
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isCurrent ? '#818cf8' : 'rgba(255, 255, 255, 0.35)',
                    boxShadow: isCurrent ? '0 0 10px #818cf8' : 'none',
                    flexShrink: 0
                  }} />

                  {/* Hotspot / Location Name Only */}
                  <span style={{
                    fontSize: '0.84rem',
                    fontWeight: isCurrent ? 800 : 600,
                    color: isCurrent ? '#ffffff' : '#e2e8f0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {loc.name}
                  </span>
                </div>

                {/* Arrow Icon */}
                <div style={{
                  color: isCurrent ? '#c7d2fe' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0
                }}>
                  <ChevronRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 360 Canvas View with 3D Beacons */}
      <div className="public-viewer-canvas" id="viewer-canvas-container">
        <Viewer360
          ref={viewer360Ref}
          readOnly={true}
          directions={currentLocation?.directions || { F: [], B: [], L: [], R: [], U: [], D: [] }}
          gridConfigs={currentLocation?.gridConfigs || {}}
          hotspots={currentLocation?.hotspots || []}
          stitchedPanoPath={currentLocation?.stitchedPanoPath || currentLocation?.imagePath}
          adjustments={dynamicAdjustments}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
          onImageNotFound={onBack}
          onNavigate={(targetId: string, position?: [number, number, number]) => {
            const targetLoc = locations.find((l: any) => l.id === targetId);
            if (targetLoc) handleLocationChange(targetLoc.id);
          }}
          onEditHotspot={isAdmin ? handleOpenEditHotspot : undefined}
          isAdmin={isAdmin}
          galleryPhotos={galleryPhotos}
          locations={locations}
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

                const isUploadingThisThumb = uploadingThumbnailLocId === loc.id;

                // Determine thumbnail image (custom uploaded thumbnail > stitched pano > direction face)
                let thumbSrc = '';
                if (loc.thumbnailPath || loc.thumbnailUrl || loc.thumb) {
                  const t = loc.thumbnailPath || loc.thumbnailUrl || loc.thumb;
                  thumbSrc = t.startsWith('http') || t.startsWith('data:')
                    ? toCloudFrontUrl(t)
                    : `${API_BASE_URL}${t.startsWith('/') ? '' : '/'}${t}`;
                } else if (loc.stitchedPanoPath) {
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
                    onClick={() => handleQuickExploreNavigate(loc.id)}
                    className={`smart-thumb-card ${isActive ? 'active' : ''}`}
                    title={loc.name}
                  >
                    {thumbSrc ? (
                      <img src={thumbSrc} alt={loc.name} className="smart-thumb-img" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1e1b4b, #0f172a)' }} />
                    )}

                    {/* Admin Upload Thumbnail Button */}
                    {isAdmin && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="smart-thumb-upload-btn"
                        title={`Upload custom thumbnail photo for ${loc.name}`}
                      >
                        <Camera size={12} />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadLocationThumbnail(loc.id, e)}
                          hidden
                        />
                      </label>
                    )}

                    {/* Uploading Loading Indicator */}
                    {isUploadingThisThumb && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.75)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        zIndex: 15
                      }}>
                        <Loader2 size={16} className="spin" color="#818cf8" />
                        <span style={{ fontSize: '0.6rem', color: '#cbd5e1' }}>Uploading...</span>
                      </div>
                    )}

                    <div className="smart-thumb-info">
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

      {/* Bottom Right Realistic 3D Compass & Controls (Zoom + Autoplay + Compass + Speed) */}
      <div className="smart-compass-widget">
        {/* Speed Pill Toggle Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSpeedMenuOpen(!speedMenuOpen);
            }}
            title="360° Auto-Rotate Speed & Direction Settings"
            style={{
              padding: '0 8px',
              width: 'auto',
              minWidth: '2.5rem',
              height: '1.75rem',
              borderRadius: '12px',
              fontSize: '0.68rem',
              fontWeight: 800,
              gap: '4px',
              background: speedMenuOpen ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(9, 13, 24, 0.85)',
              border: speedMenuOpen ? '1.5px solid rgba(168, 85, 247, 0.8)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              boxShadow: speedMenuOpen ? '0 0 12px rgba(99, 102, 241, 0.6)' : '0 4px 12px rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              letterSpacing: '0.02em',
              transition: 'all 0.2s ease'
            }}
          >
            <Gauge size={11} color={speedMenuOpen ? '#ffffff' : '#a5b4fc'} />
            <span>{Math.abs(autoRotateSpeed)}x</span>
          </button>

          {/* Floating Speed Control Popover */}
          {speedMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 12px)',
                right: 0,
                width: '250px',
                background: 'rgba(9, 13, 24, 0.96)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(99, 102, 241, 0.45)',
                borderRadius: '16px',
                padding: '14px 16px',
                color: '#ffffff',
                boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 25px rgba(99, 102, 241, 0.3)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                userSelect: 'none'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                    <Gauge size={14} />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.84rem', color: '#ffffff' }}>Rotation Speed</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#818cf8', background: 'rgba(99, 102, 241, 0.2)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
                    {Math.abs(autoRotateSpeed).toFixed(1)}x
                  </span>
                  <button
                    onClick={() => setSpeedMenuOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Custom Speed Slider with - and + Control Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Minus (-) Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const currentMag = Math.abs(autoRotateSpeed);
                      const newMag = Math.max(0.1, parseFloat((currentMag - 0.1).toFixed(1)));
                      const sign = autoRotateSpeed < 0 ? -1 : 1;
                      setAutoRotateSpeed(parseFloat((newMag * sign).toFixed(1)));
                    }}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)'; e.currentTarget.style.borderColor = '#6366f1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}
                    title="Decrease Speed (-0.1x)"
                  >
                    <Minus size={13} />
                  </button>

                  {/* Range Slider */}
                  <input
                    type="range"
                    min="0.1"
                    max="4.0"
                    step="0.1"
                    value={Math.abs(autoRotateSpeed)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      const sign = autoRotateSpeed < 0 ? -1 : 1;
                      setAutoRotateSpeed(parseFloat((val * sign).toFixed(1)));
                    }}
                    style={{
                      flex: 1,
                      accentColor: '#6366f1',
                      cursor: 'pointer',
                      height: '6px'
                    }}
                  />

                  {/* Plus (+) Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const currentMag = Math.abs(autoRotateSpeed);
                      const newMag = Math.min(4.0, parseFloat((currentMag + 0.1).toFixed(1)));
                      const sign = autoRotateSpeed < 0 ? -1 : 1;
                      setAutoRotateSpeed(parseFloat((newMag * sign).toFixed(1)));
                    }}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)'; e.currentTarget.style.borderColor = '#6366f1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}
                    title="Increase Speed (+0.1x)"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, padding: '0 2px' }}>
                  <span>0.1x (Slow)</span>
                  <span>4.0x (Fast)</span>
                </div>
              </div>

              {/* Direction Toggle Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (autoRotateSpeed > 0) setAutoRotateSpeed(-Math.abs(autoRotateSpeed));
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: autoRotateSpeed < 0 ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                      border: autoRotateSpeed < 0 ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: autoRotateSpeed < 0 ? '#ffffff' : '#94a3b8',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Rotate Counter-Clockwise (Left)"
                  >
                    <RotateCcw size={11} />
                    <span>Left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (autoRotateSpeed < 0) setAutoRotateSpeed(Math.abs(autoRotateSpeed));
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: autoRotateSpeed > 0 ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                      border: autoRotateSpeed > 0 ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: autoRotateSpeed > 0 ? '#ffffff' : '#94a3b8',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Rotate Clockwise (Right)"
                  >
                    <RotateCw size={11} />
                    <span>Right</span>
                  </button>
                </div>

                {/* Reset Button */}
                <button
                  type="button"
                  onClick={() => setAutoRotateSpeed(1.0)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#818cf8',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '4px 6px'
                  }}
                  title="Reset to default 1.0x"
                >
                  Reset (1.0x)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Autoplay / Auto-Rotate 360 Toggle Button */}
        <button
          className={`smart-zoom-btn ${autoRotate ? 'active-360' : ''}`}
          onClick={() => setAutoRotate(!autoRotate)}
          title={autoRotate ? `Pause 360° Auto-Rotation (${Math.abs(autoRotateSpeed)}x)` : `Start 360° Auto-Rotation (${Math.abs(autoRotateSpeed)}x)`}
          style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '50%',
            background: autoRotate ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(9, 13, 24, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: autoRotate ? '1.5px solid rgba(168, 85, 247, 0.8)' : '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: autoRotate ? '0 0 16px rgba(99, 102, 241, 0.65)' : '0 4px 14px rgba(0, 0, 0, 0.45)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <RotateCw
            size={15}
            className={autoRotate ? 'spin' : ''}
            style={autoRotate ? {
              animationDuration: `${Math.max(0.6, Math.min(10, 4 / Math.abs(autoRotateSpeed || 1)))}s`,
              animationDirection: autoRotateSpeed < 0 ? 'reverse' : 'normal'
            } : undefined}
          />
        </button>

        {/* Zoom Controls */}
        <div className="smart-zoom-controls">
          <button className="smart-zoom-btn" onClick={() => handleZoom('in')} title="Zoom In">
            <Plus size={13} />
          </button>
          <button className="smart-zoom-btn" onClick={() => handleZoom('out')} title="Zoom Out">
            <Minus size={13} />
          </button>
        </div>

        {/* Orientation Compass Dial */}
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
                    {mpTitle || `${currentLocation?.name || displayName} - Master Plan Blueprint`}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                    Strategic zoning layout, infrastructure corridors & visionary development
                  </p>
                  {renderModalLocationBadge()}
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
                  type="button"
                  onClick={() => setActiveNavTab('overview')}
                  className="smart-close-btn"
                  title="Close Master Plan"
                >
                  <X size={18} />
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
                        onClick={() => setPreviewImageUrl(mpImage)}
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
                    PHOTO GALLERY • {currentLocation?.name?.toUpperCase() || displayName.toUpperCase()}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                    High-resolution photographs and visual gallery for {currentLocation?.name || displayName}
                  </p>
                  {renderModalLocationBadge()}
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
                  type="button"
                  onClick={() => setActiveNavTab('overview')}
                  className="smart-close-btn"
                  title="Close Gallery"
                >
                  <X size={18} />
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

      {/* 3. CONNECTIVITY & ACCESS NETWORK MODAL OVERLAY */}
      {activeNavTab === 'connectivity' && (
        <div className="smart-content-overlay" onClick={() => { if (!isEditingConnectivity) setActiveNavTab('overview'); }}>
          <div className="smart-content-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
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
                  <Network size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '0.02em' }}>
                    CONNECTIVITY • {currentLocation?.name?.toUpperCase() || displayName.toUpperCase()}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                    Strategic transit corridors, routes & access points for {currentLocation?.name || displayName}
                  </p>
                  {renderModalLocationBadge()}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isAdmin && !isEditingConnectivity && (
                  <button
                    onClick={handleOpenAddConnectivity}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Connectivity Hub</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsEditingConnectivity(false);
                    setActiveNavTab('overview');
                  }}
                  className="smart-close-btn"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="smart-content-modal-body">
              {/* Category Filter Pills (when not editing) */}
              {!isEditingConnectivity && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.25rem' }}>
                  {[
                    { id: 'all', label: 'All Corridors', icon: Network, count: connectivityList.length },
                    { id: 'road', label: 'Roadways & Expressways', icon: Car, count: connectivityList.filter(c => c.category === 'road').length },
                    { id: 'air', label: 'Airports & Flight', icon: Plane, count: connectivityList.filter(c => c.category === 'air').length },
                    { id: 'rail', label: 'Railways & Trains', icon: Train, count: connectivityList.filter(c => c.category === 'rail').length },
                    { id: 'metro', label: 'Metro & City Transit', icon: Navigation, count: connectivityList.filter(c => c.category === 'metro').length },
                    { id: 'sea', label: 'Ports & Maritime', icon: Anchor, count: connectivityList.filter(c => c.category === 'sea').length }
                  ].map(tab => {
                    const IconComp = tab.icon;
                    const isActive = connCategoryFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setConnCategoryFilter(tab.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          background: isActive ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255, 255, 255, 0.05)',
                          border: isActive ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: isActive ? '#ffffff' : '#94a3b8',
                          boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.35)' : 'none'
                        }}
                      >
                        <IconComp size={13} />
                        <span>{tab.label}</span>
                        {tab.count > 0 && (
                          <span style={{
                            background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            padding: '1px 6px',
                            fontSize: '0.66rem',
                            fontWeight: 800
                          }}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Add / Edit Connectivity Form (Admin) */}
              {isEditingConnectivity ? (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '1.25rem',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Edit3 size={16} className="text-indigo-400" />
                      <span>{editingConnItem ? 'Edit Connectivity Hub' : 'Add New Connectivity Hub'}</span>
                    </h4>
                    <button
                      onClick={() => setIsEditingConnectivity(false)}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Category Type Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Hub Type / Category
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {[
                        { id: 'road', label: 'Road / Expressway', icon: Car, color: '#fbbf24' },
                        { id: 'air', label: 'Airport / Aviation', icon: Plane, color: '#22d3ee' },
                        { id: 'rail', label: 'Railway / Train', icon: Train, color: '#c084fc' },
                        { id: 'metro', label: 'Metro / Rapid Transit', icon: Navigation, color: '#34d399' },
                        { id: 'sea', label: 'Port / Maritime', icon: Anchor, color: '#60a5fa' }
                      ].map(cat => {
                        const IconComponent = cat.icon;
                        const isSelected = connFormCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setConnFormCategory(cat.id as any)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '10px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                              border: isSelected ? `2px solid ${cat.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                              color: isSelected ? '#ffffff' : '#cbd5e1'
                            }}
                          >
                            <IconComponent size={14} style={{ color: cat.color }} />
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hub Name / Title */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Hub / Transit Name *
                    </label>
                    <input
                      type="text"
                      value={connFormTitle}
                      onChange={(e) => setConnFormTitle(e.target.value)}
                      placeholder="e.g. Indira Gandhi International Airport (DEL) or NH-48 Expressway"
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        color: '#ffffff',
                        fontSize: '0.88rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Distance / ETA */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Distance / Travel Time (ETA)
                    </label>
                    <input
                      type="text"
                      value={connFormDistance}
                      onChange={(e) => setConnFormDistance(e.target.value)}
                      placeholder="e.g. 12 Km • 15 Mins Drive"
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        color: '#ffffff',
                        fontSize: '0.88rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Route Highlights / Description */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Route Highlights & Connectivity Details
                    </label>
                    <textarea
                      value={connFormDesc}
                      onChange={(e) => setConnFormDesc(e.target.value)}
                      rows={3}
                      placeholder="e.g. Direct 6-lane signal-free expressway access connecting key business districts and regional industrial corridors."
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  {/* Form Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsEditingConnectivity(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#cbd5e1',
                        padding: '8px 18px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveConnectivityItem}
                      disabled={isSavingConnectivity}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        border: 'none',
                        color: '#ffffff',
                        padding: '8px 24px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                        opacity: isSavingConnectivity ? 0.7 : 1
                      }}
                    >
                      {isSavingConnectivity ? 'Saving...' : (editingConnItem ? 'Update Hub' : 'Save Hub')}
                    </button>
                  </div>
                </div>
              ) : (
                /* Connectivity Cards Grid */
                (() => {
                  const filtered = connectivityList.filter(item => {
                    if (connCategoryFilter === 'all') return true;
                    return item.category === connCategoryFilter;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                        <Network size={54} style={{ color: '#4f46e5', margin: '0 auto 16px auto' }} />
                        <h4 style={{ color: '#ffffff', fontSize: '1.1rem', margin: '0 0 6px 0' }}>No Connectivity Points Added Yet</h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 20px 0', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
                          Add key connectivity hubs such as nearby airports, national highways, expressways, metro lines, and railway links.
                        </p>
                        {isAdmin && (
                          <button
                            onClick={handleOpenAddConnectivity}
                            style={{
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
                              border: 'none',
                              boxShadow: '0 6px 20px rgba(99,102,241,0.4)'
                            }}
                          >
                            <Plus size={16} />
                            <span>Add First Connectivity Hub</span>
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="smart-connectivity-grid">
                      {filtered.map(item => {
                        let IconComp = Car;
                        let catClass = 'smart-conn-road';
                        let catLabel = 'Roadway / Highway';

                        if (item.category === 'air') {
                          IconComp = Plane;
                          catClass = 'smart-conn-air';
                          catLabel = 'Aviation / Airport';
                        } else if (item.category === 'rail') {
                          IconComp = Train;
                          catClass = 'smart-conn-rail';
                          catLabel = 'Railway Station';
                        } else if (item.category === 'metro') {
                          IconComp = Navigation;
                          catClass = 'smart-conn-metro';
                          catLabel = 'Metro / Rapid Transit';
                        } else if (item.category === 'sea') {
                          IconComp = Anchor;
                          catClass = 'smart-conn-sea';
                          catLabel = 'Maritime / Port';
                        }

                        return (
                          <div key={item.id} className="smart-connectivity-card">
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className={`smart-connectivity-icon-box ${catClass}`}>
                                  <IconComp size={20} />
                                </div>
                                <div>
                                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.01em' }}>
                                    {item.title}
                                  </h4>
                                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    {catLabel}
                                  </span>
                                </div>
                              </div>

                              {/* Admin Actions */}
                              {isAdmin && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    onClick={() => handleOpenEditConnectivity(item)}
                                    style={{
                                      background: 'rgba(99, 102, 241, 0.18)',
                                      border: '1px solid rgba(99, 102, 241, 0.4)',
                                      borderRadius: '8px',
                                      color: '#818cf8',
                                      padding: '5px 10px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                    title="Edit hub details"
                                  >
                                    <Edit3 size={12} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteConnectivityItem(item.id)}
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      border: '1px solid rgba(239, 68, 68, 0.35)',
                                      borderRadius: '8px',
                                      color: '#ef4444',
                                      width: '28px',
                                      height: '28px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                    title="Delete hub"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Distance / ETA Badge */}
                            {item.distance && (
                              <div>
                                <span className="smart-conn-badge">
                                  <Clock size={11} className="text-indigo-400" />
                                  <span>{item.distance}</span>
                                </span>
                              </div>
                            )}

                            {/* Description */}
                            {item.description && (
                              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                                {item.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. DOWNLOADS & PROJECT BROCHURES MODAL OVERLAY */}
      {activeNavTab === 'downloads' && (
        <div className="smart-content-overlay" onClick={() => { if (!isEditingDownload) setActiveNavTab('overview'); }}>
          <div className="smart-content-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
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
                  <FolderDown size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '0.02em' }}>
                    DOWNLOADS • {currentLocation?.name?.toUpperCase() || displayName.toUpperCase()}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                    Official e-brochures, floor layouts & documents for {currentLocation?.name || displayName}
                  </p>
                  {renderModalLocationBadge()}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isAdmin && !isEditingDownload && (
                  <button
                    onClick={handleOpenAddDownload}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                    }}
                  >
                    <Plus size={14} />
                    <span>Upload Document</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsEditingDownload(false);
                    setActiveNavTab('overview');
                  }}
                  className="smart-close-btn"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="smart-content-modal-body">
              {/* Category Filter Pills (when not editing) */}
              {!isEditingDownload && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.25rem' }}>
                  {[
                    { id: 'all', label: 'All Documents', icon: FolderDown, count: downloadsList.length },
                    { id: 'brochure', label: 'Project Brochures', icon: FileText, count: downloadsList.filter(d => d.category === 'brochure').length },
                    { id: 'masterplan', label: 'Master Plans', icon: Map, count: downloadsList.filter(d => d.category === 'masterplan').length },
                    { id: 'floorplan', label: 'Floor Plans & Layouts', icon: Building2, count: downloadsList.filter(d => d.category === 'floorplan').length },
                    { id: 'legal', label: 'Legal & Approvals', icon: File, count: downloadsList.filter(d => d.category === 'legal').length },
                    { id: 'report', label: 'Reports & Specs', icon: FileDown, count: downloadsList.filter(d => d.category === 'report').length }
                  ].map(tab => {
                    const IconComp = tab.icon;
                    const isActive = dlCategoryFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setDlCategoryFilter(tab.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          background: isActive ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255, 255, 255, 0.05)',
                          border: isActive ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: isActive ? '#ffffff' : '#94a3b8',
                          boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.35)' : 'none'
                        }}
                      >
                        <IconComp size={13} />
                        <span>{tab.label}</span>
                        {tab.count > 0 && (
                          <span style={{
                            background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            padding: '1px 6px',
                            fontSize: '0.66rem',
                            fontWeight: 800
                          }}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Add / Edit Download Form (Admin) */}
              {isEditingDownload ? (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '1.25rem',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Edit3 size={16} className="text-indigo-400" />
                      <span>{editingDownloadItem ? 'Edit Document Details' : 'Upload / Add New Document'}</span>
                    </h4>
                    <button
                      onClick={() => setIsEditingDownload(false)}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Category Type Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Document Category
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {[
                        { id: 'brochure', label: 'Project Brochure', icon: FileText, color: '#818cf8' },
                        { id: 'masterplan', label: 'Master Plan PDF', icon: Map, color: '#34d399' },
                        { id: 'floorplan', label: 'Floor Plan / Layout', icon: Building2, color: '#38bdf8' },
                        { id: 'legal', label: 'Legal & Approvals', icon: File, color: '#fbbf24' },
                        { id: 'report', label: 'Report / Specs', icon: FileDown, color: '#c084fc' }
                      ].map(cat => {
                        const IconComponent = cat.icon;
                        const isSelected = dlFormCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setDlFormCategory(cat.id as any)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '10px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                              border: isSelected ? `2px solid ${cat.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                              color: isSelected ? '#ffffff' : '#cbd5e1'
                            }}
                          >
                            <IconComponent size={14} style={{ color: cat.color }} />
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Document Title */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Document Title *
                    </label>
                    <input
                      type="text"
                      value={dlFormTitle}
                      onChange={(e) => setDlFormTitle(e.target.value)}
                      placeholder="e.g. Official Project E-Brochure (2026 Edition)"
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        color: '#ffffff',
                        fontSize: '0.88rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* File Upload / File URL */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Document File (Upload PDF/Doc or Enter URL) *
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={dlFormFileUrl}
                        onChange={(e) => setDlFormFileUrl(e.target.value)}
                        placeholder="https://... or upload below"
                        style={{
                          flex: 1,
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          color: '#ffffff',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        padding: '10px 18px',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                        opacity: isUploadingDlFile ? 0.6 : 1
                      }}>
                        <Upload size={15} />
                        <span>{isUploadingDlFile ? 'Uploading...' : 'Upload File'}</span>
                        <input type="file" accept=".pdf,.doc,.docx,.zip,.dwg,.png,.jpg,.jpeg" onChange={handleUploadDownloadFile} hidden />
                      </label>
                    </div>
                  </div>

                  {/* File Size & Format */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                        File Format (e.g. PDF, ZIP, DWG)
                      </label>
                      <input
                        type="text"
                        value={dlFormFileType}
                        onChange={(e) => setDlFormFileType(e.target.value)}
                        placeholder="e.g. PDF"
                        style={{
                          width: '100%',
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          color: '#ffffff',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                        File Size (e.g. 4.8 MB)
                      </label>
                      <input
                        type="text"
                        value={dlFormFileSize}
                        onChange={(e) => setDlFormFileSize(e.target.value)}
                        placeholder="e.g. 4.8 MB"
                        style={{
                          width: '100%',
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          color: '#ffffff',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Document Description & Highlights
                    </label>
                    <textarea
                      value={dlFormDesc}
                      onChange={(e) => setDlFormDesc(e.target.value)}
                      rows={3}
                      placeholder="e.g. Comprehensive 32-page brochure containing unit layouts, specifications, amenities, and developer credentials."
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  {/* Form Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsEditingDownload(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#cbd5e1',
                        padding: '8px 18px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDownloadItem}
                      disabled={isSavingDownload || isUploadingDlFile}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        border: 'none',
                        color: '#ffffff',
                        padding: '8px 24px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                        opacity: isSavingDownload || isUploadingDlFile ? 0.7 : 1
                      }}
                    >
                      {isSavingDownload ? 'Saving...' : (editingDownloadItem ? 'Update Document' : 'Save Document')}
                    </button>
                  </div>
                </div>
              ) : (
                /* Documents Cards Grid */
                (() => {
                  const filtered = downloadsList.filter(item => {
                    if (dlCategoryFilter === 'all') return true;
                    return item.category === dlCategoryFilter;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                        <FolderDown size={54} style={{ color: '#4f46e5', margin: '0 auto 16px auto' }} />
                        <h4 style={{ color: '#ffffff', fontSize: '1.1rem', margin: '0 0 6px 0' }}>No Documents or Brochures Added Yet</h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 20px 0', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
                          Upload project e-brochures, master plan maps, unit floor plans, and technical specification sheets for clients to download.
                        </p>
                        {isAdmin && (
                          <button
                            onClick={handleOpenAddDownload}
                            style={{
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
                              border: 'none',
                              boxShadow: '0 6px 20px rgba(99,102,241,0.4)'
                            }}
                          >
                            <Plus size={16} />
                            <span>Upload First Document</span>
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="smart-downloads-grid">
                      {filtered.map(item => {
                        let IconComp = FileText;
                        let catClass = 'smart-doc-brochure';
                        let catLabel = 'Project Brochure';

                        if (item.category === 'masterplan') {
                          IconComp = Map;
                          catClass = 'smart-doc-plan';
                          catLabel = 'Master Plan PDF';
                        } else if (item.category === 'floorplan') {
                          IconComp = Building2;
                          catClass = 'smart-doc-plan';
                          catLabel = 'Floor Plan Layout';
                        } else if (item.category === 'legal') {
                          IconComp = File;
                          catClass = 'smart-doc-legal';
                          catLabel = 'Legal & Approval';
                        } else if (item.category === 'report') {
                          IconComp = FileDown;
                          catClass = 'smart-doc-pdf';
                          catLabel = 'Project Report';
                        }

                        const resolvedUrl = toCloudFrontUrl(item.fileUrl);

                        return (
                          <div key={item.id} className="smart-download-card">
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className={`smart-doc-icon-box ${catClass}`}>
                                  <IconComp size={20} />
                                </div>
                                <div>
                                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.01em' }}>
                                    {item.title}
                                  </h4>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      {catLabel}
                                    </span>
                                    {item.fileSize && (
                                      <span style={{
                                        fontSize: '0.66rem',
                                        fontWeight: 700,
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        color: '#cbd5e1'
                                      }}>
                                        {item.fileType || 'PDF'} • {item.fileSize}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Admin Actions */}
                              {isAdmin && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    onClick={() => handleOpenEditDownload(item)}
                                    style={{
                                      background: 'rgba(99, 102, 241, 0.18)',
                                      border: '1px solid rgba(99, 102, 241, 0.4)',
                                      borderRadius: '8px',
                                      color: '#818cf8',
                                      padding: '5px 10px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                    title="Edit document details"
                                  >
                                    <Edit3 size={12} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDownloadItem(item.id)}
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      border: '1px solid rgba(239, 68, 68, 0.35)',
                                      borderRadius: '8px',
                                      color: '#ef4444',
                                      width: '28px',
                                      height: '28px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                    title="Delete document"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Description */}
                            {item.description && (
                              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                                {item.description}
                              </p>
                            )}

                            {/* Download Action Button */}
                            <div>
                              <a
                                href={resolvedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                className="smart-doc-btn"
                              >
                                <Download size={14} />
                                <span>Download / View Document</span>
                                <ExternalLink size={12} style={{ opacity: 0.7 }} />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. INFRASTRUCTURE & SPATIAL HIGHLIGHTS MODAL OVERLAY */}
      {activeNavTab === 'infrastructure' && (
        <div className="smart-content-overlay" onClick={() => setActiveNavTab('overview')}>
          <div className="smart-content-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
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
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '0.02em' }}>
                    INFRASTRUCTURE & HIGHLIGHTS • {currentLocation?.name?.toUpperCase() || displayName.toUpperCase()}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                    Spatial architecture, connected beacons & utilities for {currentLocation?.name || displayName}
                  </p>
                  {renderModalLocationBadge()}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setActiveNavTab('overview')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="smart-content-modal-body">
              {/* Space Overview Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                    {currentLocation?.name || 'Active Location'}
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                    {currentLocation?.subtitle || 'Interactive 360° Node'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '0.66rem', color: '#94a3b8', display: 'block' }}>BEACONS</span>
                    <strong style={{ fontSize: '1rem', color: '#818cf8' }}>
                      {currentLocation?.hotspots?.length || 0}
                    </strong>
                  </div>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '0.66rem', color: '#94a3b8', display: 'block' }}>GALLERY</span>
                    <strong style={{ fontSize: '1rem', color: '#c084fc' }}>
                      {galleryPhotos.length}
                    </strong>
                  </div>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '0.66rem', color: '#94a3b8', display: 'block' }}>DOCS</span>
                    <strong style={{ fontSize: '1rem', color: '#34d399' }}>
                      {downloadsList.length}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Hotspots / Interactive Beacons in this location */}
              <h5 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={14} className="text-indigo-400" />
                <span>Connected Spatial Beacons & Waypoints ({currentLocation?.hotspots?.length || 0})</span>
              </h5>

              {(!currentLocation?.hotspots || currentLocation.hotspots.length === 0) ? (
                <div style={{
                  padding: '30px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '14px',
                  border: '1px dashed rgba(255, 255, 255, 0.1)'
                }}>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>
                    No linked beacons configured for this space yet.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                  {currentLocation.hotspots.map((hs: any, idx: number) => {
                    const targetLoc = locations.find((l: any) => l.id === hs.targetLocationId);
                    return (
                      <div
                        key={hs.id || idx}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '8px',
                            background: 'rgba(99, 102, 241, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#818cf8',
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}>
                            {idx + 1}
                          </div>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#ffffff' }}>
                            {hs.title || targetLoc?.name || `Waypoint #${idx + 1}`}
                          </span>
                        </div>
                        {hs.description && (
                          <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4 }}>
                            {hs.description}
                          </p>
                        )}
                        {targetLoc && (
                          <div style={{
                            marginTop: 'auto',
                            paddingTop: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <span style={{ fontSize: '0.68rem', color: '#6366f1' }}>
                              Links to: {targetLoc.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                handleQuickExploreNavigate(targetLoc.id);
                                setActiveNavTab('overview');
                              }}
                              style={{
                                background: 'rgba(99, 102, 241, 0.2)',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                borderRadius: '6px',
                                color: '#c7d2fe',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                cursor: 'pointer'
                              }}
                            >
                              Jump ➔
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. WHY LOCATION / SPOTLIGHT MODAL OVERLAY */}
      {activeNavTab === 'why' && (
        <div className="smart-content-overlay" onClick={() => setActiveNavTab('overview')}>
          <div className="smart-content-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
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
                  <Star size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '0.02em' }}>
                    WHY {currentLocation?.name?.toUpperCase() || displayName.toUpperCase()}?
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                    Unique architecture, spatial advantages & highlights of {currentLocation?.name || displayName}
                  </p>
                  {renderModalLocationBadge()}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveNavTab('overview')}
                  className="smart-close-btn"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="smart-content-modal-body">
              {/* Feature Highlights Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '16px'
                }}>
                  <div style={{ color: '#818cf8', marginBottom: '8px' }}>
                    <Globe size={22} />
                  </div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                    360° Spherical Immersion
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    Full 8K resolution panorama projection capturing all angles of {currentLocation?.name || 'this space'}.
                  </p>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '16px'
                }}>
                  <div style={{ color: '#c084fc', marginBottom: '8px' }}>
                    <Navigation size={22} />
                  </div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                    Interactive Wayfinding
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    Seamless transitions and instant teleports to surrounding rooms and exterior views.
                  </p>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '16px'
                }}>
                  <div style={{ color: '#34d399', marginBottom: '8px' }}>
                    <ImageIcon size={22} />
                  </div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                    Dedicated Media & Gallery
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    Curated high-resolution photo highlights, plans, and architectural documentations.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveNavTab('overview')}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#ffffff',
                    padding: '12px 28px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(99, 102, 241, 0.4)'
                  }}
                >
                  Explore {currentLocation?.name || 'Space'} in 360°
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. LIGHTBOX FULLSCREEN PHOTO VIEWER */}
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

      {/* 8. SINGLE IMAGE PREVIEW FULLSCREEN MODAL (e.g. Master Plan Blueprint) */}
      {previewImageUrl && (
        <div className="smart-lightbox" onClick={() => setPreviewImageUrl(null)}>
          <button
            onClick={() => setPreviewImageUrl(null)}
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
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            <img
              src={toCloudFrontUrl(previewImageUrl)}
              alt="Preview Blueprint"
              style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '12px' }}
            />
          </div>
        </div>
      )}

      {/* Hotspot & Room Link Edit Modal (Admin) */}
      {showEditHotspotModal && editingHotspot && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(165deg, rgba(17, 22, 42, 0.98) 0%, rgba(10, 13, 26, 0.99) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            padding: '24px 28px',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.85)',
            position: 'relative',
            color: '#ffffff',
            animation: 'modalSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '16px',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
                  border: '1px solid rgba(99, 102, 241, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8'
                }}>
                  <Navigation size={20} />
                </div>
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #ffffff 40%, #c7d2fe 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    Edit 3D Hotspot & Room Link
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                    Configure 3D beacon navigation, visuals & client access
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setShowEditHotspotModal(false); setEditingHotspot(null); }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Hotspot Name / Title */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '6px' }}>
                Hotspot Title *
              </label>
              <input
                type="text"
                value={editHotspotName}
                onChange={(e) => setEditHotspotName(e.target.value)}
                placeholder="e.g. Master Bedroom, Clubhouse, Infinity Pool"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Subtitle / Distance Badge */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '6px' }}>
                Distance / Subtitle Badge (Optional)
              </label>
              <input
                type="text"
                value={editHotspotSubtitle}
                onChange={(e) => setEditHotspotSubtitle(e.target.value)}
                placeholder="e.g. 5 km, Phase 1, 2 BHK Luxury"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Target Room Link & Custom Thumbnail Box */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '14px',
              padding: '14px',
              marginBottom: '16px'
            }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#818cf8', marginBottom: '6px' }}>
                🔗 Linked Target Room
              </label>
              <select
                value={editHotspotTargetId}
                onChange={(e) => setEditHotspotTargetId(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#070913',
                  border: '1px solid #1e2438',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  color: '#ffffff',
                  outline: 'none',
                  marginBottom: editHotspotTargetId ? '12px' : '0'
                }}
              >
                <option value="">-- No Link (Standalone Landmark) --</option>
                {locations.filter((l: any) => l.id !== currentLocation?.id).map((loc: any) => (
                  <option key={loc.id} value={loc.id}>📍 {loc.name}</option>
                ))}
              </select>

              {/* Target Room Thumbnail Card with 1-Click Upload */}
              {editHotspotTargetId && (() => {
                const targetRoom = locations.find((l: any) => l.id === editHotspotTargetId);
                if (!targetRoom) return null;

                const targetThumb = (targetRoom.thumbnailPath || targetRoom.thumbnailUrl)
                  ? toCloudFrontUrl(targetRoom.thumbnailPath || targetRoom.thumbnailUrl)
                  : targetRoom.stitchedPanoPath
                    ? toCloudFrontUrl(targetRoom.stitchedPanoPath)
                    : (targetRoom.directions?.F?.[0]?.path || (Object.values(targetRoom.directions || {}).flat() as any)[0]?.path)
                      ? toCloudFrontUrl(targetRoom.directions?.F?.[0]?.path || (Object.values(targetRoom.directions || {}).flat() as any)[0]?.path)
                      : '';

                return (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.4)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: '80px',
                        height: '52px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#070913',
                        border: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {targetThumb ? (
                          <img src={targetThumb} alt={targetRoom.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '1.2rem' }}>🌐</span>
                        )}
                      </div>

                      {/* Direct Thumbnail Upload Button */}
                      <label
                        style={{
                          position: 'absolute',
                          bottom: '-4px',
                          right: '-4px',
                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          border: '1px solid #ffffff',
                          borderRadius: '6px',
                          padding: '2px 6px',
                          color: '#ffffff',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                          zIndex: 10
                        }}
                        title="Upload Custom Room Thumbnail Photo"
                      >
                        <Camera size={10} />
                        <span>{isUploadingHotspotTargetThumb ? '...' : 'Edit'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadHotspotTargetRoomThumbnail(targetRoom.id, e)}
                          hidden
                        />
                      </label>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>{targetRoom.name}</div>
                      <div style={{ fontSize: '0.7rem', color: targetRoom.thumbnailPath ? '#10b981' : '#94a3b8', marginTop: '2px' }}>
                        {targetRoom.thumbnailPath ? '✓ Custom Thumbnail Set' : 'Using default panorama thumbnail'}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Beacon Color & Category */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '6px' }}>
                  Glow Theme Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={editHotspotBeaconColor}
                    onChange={(e) => setEditHotspotBeaconColor(e.target.value)}
                    style={{ width: '36px', height: '36px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: editHotspotBeaconColor, fontWeight: 700 }}>
                    {editHotspotBeaconColor}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  value={editHotspotCategory}
                  onChange={(e) => setEditHotspotCategory(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    fontSize: '0.82rem',
                    color: '#ffffff',
                    outline: 'none'
                  }}
                >
                  <option value="Commercial">🏢 Commercial</option>
                  <option value="Residential">🏠 Residential</option>
                  <option value="Transport">🚆 Transport</option>
                  <option value="Green">🌳 Green & Park</option>
                  <option value="Civic">🏛️ Civic</option>
                  <option value="Facility">⚡ Facility</option>
                </select>
              </div>
            </div>

            {/* Description / Notes */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '6px' }}>
                Description / Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={editHotspotDesc}
                onChange={(e) => setEditHotspotDesc(e.target.value)}
                placeholder="Add room details or specific highlights..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => handleDeleteHotspot(editingHotspot.id)}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  borderRadius: '10px',
                  padding: '9px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditHotspotModal(false); setEditingHotspot(null); }}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#94a3b8',
                    borderRadius: '10px',
                    padding: '9px 16px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveHotspotDetails}
                  disabled={isSavingHotspot}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '10px',
                    padding: '9px 20px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isSavingHotspot ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                  <span>{isSavingHotspot ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Share Duration Modal Popup */}
      {showShareModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowShareModal(false)}
        >
          <div
            style={{
              background: '#090d1f',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 35px rgba(99, 102, 241, 0.2)',
              position: 'relative',
              color: '#ffffff'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3))',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#c084fc'
                }}>
                  <Share2 size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>Share Virtual Tour</h4>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8' }}>Set active validity duration for client preview</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Duration Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '10px' }}>
                <Clock size={14} className="text-indigo-400" />
                <span>Link Active Duration:</span>
              </label>

              {/* Quick Presets */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                {[
                  { label: '5 Mins', val: 5 },
                  { label: '15 Mins', val: 15 },
                  { label: '30 Mins', val: 30 },
                  { label: '1 Hour', val: 60 },
                  { label: '24 Hours', val: 1440 },
                  { label: 'Permanent', val: 0 }
                ].map(preset => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setShareMinutes(preset.val)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '10px',
                      fontSize: '0.76rem',
                      fontWeight: shareMinutes === preset.val ? 700 : 500,
                      background: shareMinutes === preset.val
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(168, 85, 247, 0.35))'
                        : 'rgba(255, 255, 255, 0.04)',
                      border: shareMinutes === preset.val
                        ? '1.5px solid rgba(168, 85, 247, 0.7)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      color: shareMinutes === preset.val ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Minutes Input */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Custom Minutes:</span>
                <input
                  type="number"
                  min="1"
                  max="43200"
                  value={shareMinutes === 0 ? '' : shareMinutes}
                  placeholder="e.g. 10"
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setShareMinutes(isNaN(v) ? 0 : Math.max(0, v));
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '6px 10px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>min</span>
              </div>

              {/* Expiry summary info badge */}
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                fontSize: '0.74rem',
                color: '#c7d2fe',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Clock size={13} className="text-indigo-400" />
                <span>
                  {shareMinutes > 0
                    ? `Link will automatically expire in ${shareMinutes} minute${shareMinutes > 1 ? 's' : ''}`
                    : 'Permanent link with no expiration time'}
                </span>
              </div>
            </div>

            {/* Generated Link Preview & Copy Button */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Shareable Link:
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '4px 6px 4px 12px',
                gap: '8px'
              }}>
                <input
                  type="text"
                  readOnly
                  value={getGeneratedShareUrl()}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '0.76rem',
                    outline: 'none',
                    textOverflow: 'ellipsis'
                  }}
                />
                <button
                  type="button"
                  onClick={handleCopyShareModalLink}
                  style={{
                    background: shareLinkCopied ? '#059669' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)'
                  }}
                >
                  {shareLinkCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{shareLinkCopied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  borderRadius: '10px',
                  padding: '9px 18px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCopyShareModalLink();
                  setTimeout(() => setShowShareModal(false), 1000);
                }}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '9px 20px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {shareLinkCopied ? <Check size={15} /> : <Share2 size={15} />}
                <span>{shareLinkCopied ? 'Link Copied!' : 'Copy & Close'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
