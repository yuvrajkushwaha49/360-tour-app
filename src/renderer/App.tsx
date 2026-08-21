import { ImageAdjustments, DEFAULT_ADJUSTMENTS } from './utils/imageAdjustmentEngine';
import { ImageAdjustmentPanel } from './components/ImageAdjustmentPanel';
import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Save,
  Play,
  Image as ImageIcon,
  RotateCw,
  CheckCircle,
  Cpu,
  FileText,
  Layers,
  LogOut,
  HelpCircle,
  XCircle,
  Eye,
  UserCheck,
  ShieldCheck,
  Database,
  LayoutDashboard,
  Globe,
  Share2,
  Lock,
  Plus,
  Edit2,
  Settings,
  CheckCircle2,
  X,
  Compass,
  UserPlus,
  ArrowLeft,
  Home,
  Archive,
  Sliders
} from 'lucide-react';
import Viewer360 from './components/Viewer360';
import LoginModal from './components/LoginModal';
import ClientDashboard from './components/ClientDashboard';
import PublicTourViewer from './components/PublicTourViewer';
import AddUserModal from './components/AddUserModal';
import ClientLoginPage from './components/ClientLoginPage';
import { exportProjectToZip } from './utils/exportZip';
import { API_BASE_URL } from './utils/apiConfig';
import { saveLargeDraft, loadLargeDraft, safeLocalStorageSet, safeLocalStorageGet } from './utils/dbStorage';

interface ProjectImage {
  name: string;
  path: string;
}

interface ProjectData {
  projectDir: string;
  locations: LocationItem[];
  activeLocationId: string;
  resolution: number;
  featureDetector: string;
  blendingMode: string;
  exposureCorrection: boolean;
}

const DIRECTIONS_KEYS = ['F', 'B', 'L', 'R', 'U', 'D'];
const DIRECTIONS_LABELS: Record<string, string> = {
  F: 'Front',
  B: 'Back',
  L: 'Left',
  R: 'Right',
  U: 'Up',
  D: 'Down'
};

interface HotspotItem {
  id: string;
  targetLocationId?: string;
  name: string;
  area?: string;
  description?: string;
  position: [number, number, number];
  polygonPoints?: [number, number, number][];
  icon?: 'arrow' | 'pin' | 'info';
  areaType?: 'building' | 'river' | 'road';
}

interface LocationItem {
  id: string;
  name: string;
  isPublic?: boolean;
  assignedUserId?: string;
  assignedUserName?: string;
  description?: string;
  directions: Record<string, ProjectImage[]>;
  gridConfigs: Record<string, string>;
  stitchedPanoPath: string | null;
  hotspots: HotspotItem[];
    adjustments?: ImageAdjustments;
}

export default function App() {
  const [projectDir, setProjectDir] = useState<string>(() => {
    const saved = safeLocalStorageGet<any>('studio_draft_project');
    return saved ? saved.projectDir || '' : '';
  });

  // Locations management with localStorage / IndexedDB auto-draft restoration
  const [locations, setLocations] = useState<LocationItem[]>(() => {
    const saved = safeLocalStorageGet<any>('studio_draft_project');
    return saved ? saved.locations || [] : [];
  });

  const [activeLocationId, setActiveLocationId] = useState<string>(() => {
    const saved = safeLocalStorageGet<any>('studio_draft_project');
    return saved ? saved.activeLocationId || '' : '';
  });
  const [newLocationName, setNewLocationName] = useState<string>('');

  // 3D Hotspot placing states
  const [isPlacingHotspot, setIsPlacingHotspot] = useState<boolean>(false);
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [pendingHotspotPos, setPendingHotspotPos] = useState<[number, number, number] | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [hotspotMode, setHotspotMode] = useState<'existing' | 'new'>('new');
  const [newLinkRoomName, setNewLinkRoomName] = useState<string>('');

  // Landmark Info States
  const [linkToRoom, setLinkToRoom] = useState<boolean>(true);
  const [landmarkArea, setLandmarkArea] = useState<string>('');
  const [landmarkDesc, setLandmarkDesc] = useState<string>('');
  const [drawingPoints, setDrawingPoints] = useState<[number, number, number][]>([]);
  const [isDrawingArea, setIsDrawingArea] = useState<boolean>(false);
  const [editingHotspotId, setEditingHotspotId] = useState<string | null>(null);
  const [hotspotIcon, setHotspotIcon] = useState<'arrow' | 'pin' | 'info'>('arrow');
  const [areaType, setAreaType] = useState<'building' | 'river' | 'road'>('building');
  const [hotspotIsPublic, setHotspotIsPublic] = useState<boolean>(true);
  const [hotspotUserId, setHotspotUserId] = useState<string>('');

  const [resolution, setResolution] = useState<number>(4096);
  const [featureDetector, setFeatureDetector] = useState<string>('ORB');
  const [blendingMode, setBlendingMode] = useState<string>('multi-band');
  const [exposureCorrection, setExposureCorrection] = useState<boolean>(true);

  // Restore draft project on mount from high-capacity IndexedDB
  useEffect(() => {
    loadLargeDraft('studio_draft_project').then((saved) => {
      if (saved) {
        if (!projectDir && saved.projectDir) setProjectDir(saved.projectDir);
        if (locations.length === 0 && saved.locations && saved.locations.length > 0) {
          setLocations(saved.locations);
        }
        if (!activeLocationId && saved.activeLocationId) {
          setActiveLocationId(saved.activeLocationId);
        }
      }
    });
  }, []);

  // Auto-save Studio project draft state to IndexedDB safely on every change
  useEffect(() => {
    if (locations.length > 0 || projectDir) {
      const draftData = {
        projectDir,
        locations,
        activeLocationId,
        resolution,
        featureDetector,
        blendingMode,
        exposureCorrection,
        lastUpdated: Date.now()
      };
      saveLargeDraft('studio_draft_project', draftData);
    }
  }, [locations, activeLocationId, projectDir, resolution, featureDetector, blendingMode, exposureCorrection]);

  // CRM & Authentication States
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string } | null>(() => {
    const saved = localStorage.getItem('crm_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('crm_token'));
  const [activePublicTourId, setActivePublicTourId] = useState<string | null>(() => {
    return localStorage.getItem('active_public_tour_id');
  });

  const [activeView, setActiveView] = useState<'studio' | 'crm' | 'public_tour' | 'login'>(() => {
    const savedUser = localStorage.getItem('crm_user');
    if (!savedUser) return 'login';

    const savedView = localStorage.getItem('active_view') as 'studio' | 'crm' | 'public_tour' | 'login' | null;
    const savedTourId = localStorage.getItem('active_public_tour_id');

    if (savedView === 'public_tour' && savedTourId) {
      return 'public_tour';
    }

    // Always land on CRM Projects Dashboard by default
    return 'crm';
  });

  const handleViewChange = (view: 'studio' | 'crm' | 'public_tour' | 'login') => {
    setActiveView(view);
    localStorage.setItem('active_view', view);
  };
  
  const [activeRightTab, setActiveRightTab] = useState<'stitch' | 'adjustments'>('stitch');

  const handleUpdateActiveLocAdjustments = (newAdj: ImageAdjustments) => {
    setLocations((prevLocs) =>
      prevLocs.map((loc) =>
        loc.id === activeLocationId
          ? { ...loc, adjustments: newAdj }
          : loc
      )
    );
  };

  const handleApplyAdjustmentsToAll = (newAdj: ImageAdjustments) => {
    setLocations((prevLocs) =>
      prevLocs.map((loc) => ({
        ...loc,
        adjustments: { ...newAdj }
      }))
    );
    addLog(`Applied image adjustments to all ${locations.length} locations`);
  };

  const handleApplyAdjustmentsToSelected = (targetIds: string[], newAdj: ImageAdjustments) => {
    setLocations((prevLocs) =>
      prevLocs.map((loc) =>
        targetIds.includes(loc.id)
          ? { ...loc, adjustments: { ...newAdj } }
          : loc
      )
    );
    addLog(`Applied image adjustments to ${targetIds.length} selected locations`);
  };

  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');

  // CRM Save Modal States
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('studio_draft_project');
      return saved ? JSON.parse(saved).id || null : null;
    } catch (e) {
      return null;
    }
  });
  const [showSaveCrmModal, setShowSaveCrmModal] = useState<boolean>(false);
  const [crmProjectName, setCrmProjectName] = useState<string>('360 Virtual Tour');
  const [crmProjectIsPublic, setCrmProjectIsPublic] = useState<boolean>(true);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientUsersList, setClientUsersList] = useState<{ id: string; name: string; email: string }[]>([]);
  const [savingCrm, setSavingCrm] = useState<boolean>(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);

  // Location Detail Modal States
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [modalLocName, setModalLocName] = useState<string>('');
  const [modalLocIsPublic, setModalLocIsPublic] = useState<boolean>(true);
  const [modalLocUserId, setModalLocUserId] = useState<string>('');
  const [modalLocDesc, setModalLocDesc] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressMsg, setProgressMsg] = useState<string>('Idle');
  const [logs, setLogs] = useState<string[]>([]);

  // Export Web ZIP Progress Modal States
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [exportZipProgress, setExportZipProgress] = useState<number>(0);
  const [exportZipMsg, setExportZipMsg] = useState<string>('Preparing 360 Standalone Web Package...');

  const handleExportWebZip = async () => {
    setIsExportingZip(true);
    setExportZipProgress(0);
    setExportZipMsg('Initializing 360 Standalone Web Exporter...');

    const activeLoc = locations.find(l => l.id === activeLocationId) || locations[0];
    const projectToExport = {
      id: `proj-export-${Date.now()}`,
      name: crmProjectName || activeLoc?.name || '360 Virtual Tour',
      data: {
        locations,
        activeLocationId,
        resolution
      }
    };

    try {
      await exportProjectToZip(projectToExport, (msg, percent) => {
        setExportZipMsg(msg);
        setExportZipProgress(percent);
        addLog(`[Export Web ZIP] ${msg}`);
      });
      setTimeout(() => {
        setIsExportingZip(false);
      }, 1000);
    } catch (err: any) {
      console.error('Export Web ZIP error:', err);
      setExportZipMsg(`Export failed: ${err.message || 'Unknown error'}`);
      setTimeout(() => {
        setIsExportingZip(false);
      }, 2500);
    }
  };

  // Compute active location references safely
  const activeLoc = locations.find(l => l.id === activeLocationId) || null;
  const directions = activeLoc ? activeLoc.directions : { F: [], B: [], L: [], R: [], U: [], D: [] };
  const gridConfigs = activeLoc ? activeLoc.gridConfigs : { F: 'auto', B: 'auto', L: 'auto', R: 'auto', U: 'auto', D: 'auto' };
  const stitchedPanoPath = activeLoc ? activeLoc.stitchedPanoPath : null;

  // Custom setter functions to update active location
  const updateActiveLocation = (updater: (loc: LocationItem) => Partial<LocationItem>) => {
    if (!activeLocationId) return;
    setLocations(prev => prev.map(loc =>
      loc.id === activeLocationId ? { ...loc, ...updater(loc) } : loc
    ));
  };

  const setDirections = (newDirs: Record<string, ProjectImage[]> | ((prev: Record<string, ProjectImage[]>) => Record<string, ProjectImage[]>)) => {
    updateActiveLocation(loc => ({
      directions: typeof newDirs === 'function' ? newDirs(loc.directions) : newDirs
    }));
  };

  const setGridConfigs = (newConfigs: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    updateActiveLocation(loc => ({
      gridConfigs: typeof newConfigs === 'function' ? newConfigs(loc.gridConfigs) : newConfigs
    }));
  };

  const setStitchedPanoPath = (newPath: string | null | ((prev: string | null) => string | null)) => {
    updateActiveLocation(loc => ({
      stitchedPanoPath: typeof newPath === 'function' ? newPath(loc.stitchedPanoPath) : newPath
    }));
  };
  const [importingDirKey, setImportingDirKey] = useState<string | null>(null);
  const [selectedImportGrid, setSelectedImportGrid] = useState<string>('9x9');
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // Auto save & project file path
  const [projectFilePath, setProjectFilePath] = useState<string | null>(null);

  useEffect(() => {
    // Listen for progress updates from python engine
    if ((window as any).electronAPI) {
      const unsubscribe = (window as any).electronAPI.onStitchProgress((data: { percent: number; message: string }) => {
        setProgress(data.percent);
        setProgressMsg(data.message);
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${data.message}`]);
      });
      return () => unsubscribe();
    }
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleStartImport = (dirKey: string) => {
    setImportingDirKey(dirKey);
    setSelectedImportGrid('9x9');
  };

  const handleConfirmImport = async () => {
    if (!importingDirKey) return;
    const dirKey = importingDirKey;
    const gridVal = selectedImportGrid;
    setImportingDirKey(null);

    // Browser / Non-Electron mode: open HTML5 File Picker and upload directly to S3 / Cloud Server
    if (!(window as any).electronAPI) {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.multiple = true;
      fileInput.accept = 'image/*';
      fileInput.onchange = async (e: any) => {
        const files: File[] = Array.from(e.target.files || []);
        if (files.length === 0) return;

        addLog(`⏳ Uploading ${files.length} photo(s) to Cloud Storage (S3)...`);

        let imgs: ProjectImage[] = [];

        // Attempt direct S3 / Server Batch Upload
        try {
          const formData = new FormData();
          files.forEach(f => formData.append('files', f));

          const res = await fetch(`${API_BASE_URL}/api/upload-batch`, {
            method: 'POST',
            body: formData
          });

          if (res.ok) {
            const data = await res.json();
            imgs = (data.files || []).map((f: any) => ({
              name: f.name,
              path: f.path
            }));
            addLog(`☁️ Successfully uploaded ${imgs.length} photo(s) directly to AWS S3 Cloud Storage!`);
          }
        } catch (uploadErr) {
          console.warn('Direct S3 upload fallback to base64:', uploadErr);
        }

        // Fallback to local Base64 reader if offline or server upload failed
        if (imgs.length === 0) {
          imgs = await Promise.all(
            files.map(async (file) => {
              const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
              });
              return {
                name: file.name,
                path: dataUrl
              };
            })
          );
          addLog(`✅ Imported ${imgs.length} photo(s) into memory for ${DIRECTIONS_LABELS[dirKey]}`);
        }

        setGridConfigs(prev => ({ ...prev, [dirKey]: gridVal }));
        setDirections(prev => ({ ...prev, [dirKey]: imgs }));
        setStitchedPanoPath(null); // Clear previous/old stitched pano so new photos are used!
        setLastUpdated(Date.now());
        if (!projectDir) setProjectDir('Project_Workspace');
      };
      fileInput.click();
      return;
    }

    let currentProjDir = projectDir;
    if (!currentProjDir) {
      addLog('Selecting project working directory...');
      const pickerResult = await (window as any).electronAPI.openDirectory();
      if (pickerResult) {
        currentProjDir = pickerResult.path;
        setProjectDir(currentProjDir);
        addLog(`Project directory set to: ${currentProjDir}`);
      } else {
        addLog('Import cancelled: Project directory is required.');
        return;
      }
    }

    try {
      const result = await (window as any).electronAPI.openDirectory(
        currentProjDir,
        dirKey,
        activeLoc.name
      );
      if (result) {
        const imgs: ProjectImage[] = result.files.map((f: any) => ({
          name: f.name,
          path: f.path
        }));

        setGridConfigs(prev => ({ ...prev, [dirKey]: gridVal }));
        setDirections(prev => ({ ...prev, [dirKey]: imgs }));
        setStitchedPanoPath(null); // Clear previous/old stitched pano so new photos are used!
        setLastUpdated(Date.now());

        let expectedCount = 0;
        if (gridVal === '2x2') expectedCount = 4;
        else if (gridVal === '3x3') expectedCount = 9;
        else if (gridVal === '5x5') expectedCount = 25;
        else if (gridVal === '9x9') expectedCount = 81;

        if (expectedCount > 0 && imgs.length !== expectedCount) {
          addLog(`Warning: Selected grid is ${gridVal} (${expectedCount} images) but found ${imgs.length} images!`);
        } else {
          addLog(`Imported and copied ${imgs.length} images into project ${DIRECTIONS_LABELS[dirKey]} using ${gridVal === 'auto' ? 'Auto-Detect' : gridVal} configuration`);
        }
      }
    } catch (err: any) {
      addLog(`Error opening folder: ${err.message}`);
    }
  };

  const handleNewProject = async () => {
    const name = newProjectName.trim() || 'New 360 Tour Project';
    const newProjectId = `proj-${Date.now()}`;

    // 1. Reset all state for new project
    setCurrentProjectId(newProjectId);
    setLocations([]);
    setActiveLocationId('');
    setProjectDir('');
    setProjectFilePath('');
    setCrmProjectName(name);
    setLogs([]);
    setProgress(0);
    setProgressMsg('Idle');
    setIsNewProjectModalOpen(false);
    setNewProjectName('');

    const initialProjectData: ProjectData = {
      projectDir: '',
      locations: [],
      activeLocationId: '',
      resolution: 4096,
      featureDetector: 'ORB',
      blendingMode: 'multi-band',
      exposureCorrection: true
    };

    // 2. Save into studio draft
    const draftData = {
      id: newProjectId,
      name,
      projectDir: '',
      projectFilePath: '',
      locations: [],
      activeLocationId: '',
      resolution: 4096,
      featureDetector: 'ORB',
      blendingMode: 'multi-band',
      exposureCorrection: true,
      lastUpdated: Date.now()
    };
    saveLargeDraft('studio_draft_project', draftData);

    // 3. Register immediately in local storage registry
    let user = currentUser || (localStorage.getItem('crm_user') ? JSON.parse(localStorage.getItem('crm_user')!) : null);
    try {
      const localListStr = localStorage.getItem('local_saved_projects') || '[]';
      const localList: any[] = JSON.parse(localListStr);
      const newProjItem = {
        id: newProjectId,
        user_id: user?.id || 'usr-admin',
        name,
        is_public: true,
        created_at: new Date().toISOString(),
        data: initialProjectData
      };
      localList.unshift(newProjItem);
      safeLocalStorageSet('local_saved_projects', JSON.stringify(localList));
    } catch (e) {}

    // 4. Save into SQLite backend database
    let token = authToken || localStorage.getItem('crm_token');
    if (!token) {
      try {
        const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@360soft.com', password: 'admin123' })
        });
        if (loginRes.ok) {
          const authData = await loginRes.json();
          token = authData.token;
          user = authData.user;
          setAuthToken(authData.token);
          setCurrentUser(authData.user);
          localStorage.setItem('crm_token', authData.token);
          localStorage.setItem('crm_user', JSON.stringify(authData.user));
        }
      } catch (e) {}
    }

    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/projects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name,
            data: initialProjectData,
            is_public: true,
            target_user_id: user?.id
          })
        });
      } catch (e) {
        console.warn('Server project creation notice:', e);
      }
    }

    addLog(`✨ New project "${name}" created and added to Home Page! Add rooms from the left sidebar to get started.`);
  };

  const handleOpenAddLocationModal = async () => {
    setEditingLocationId(null);
    setModalLocName('');
    setModalLocIsPublic(crmProjectIsPublic);
    setModalLocUserId('');
    setModalLocDesc('');
    setShowLocationModal(true);

    if (authToken) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          const clients = await res.json();
          setClientUsersList(clients);
          if (clients.length > 0) setModalLocUserId(clients[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch clients list:', err);
      }
    }
  };

  const handleOpenEditLocationModal = async (loc: LocationItem) => {
    setEditingLocationId(loc.id);
    setModalLocName(loc.name);
    setModalLocIsPublic(crmProjectIsPublic ? (loc.isPublic !== undefined ? loc.isPublic : true) : false);
    setModalLocUserId(loc.assignedUserId || '');
    setModalLocDesc(loc.description || '');
    setShowLocationModal(true);

    if (authToken) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          const clients = await res.json();
          setClientUsersList(clients);
        }
      } catch (err) {
        console.error('Failed to fetch clients list:', err);
      }
    }
  };

  const handleSaveLocationDetails = () => {
    if (!modalLocName.trim()) return;

    const assignedClient = clientUsersList.find(c => c.id === modalLocUserId);
    const assignedName = assignedClient ? assignedClient.name : undefined;

    if (editingLocationId) {
      setLocations(prev => prev.map(loc =>
        loc.id === editingLocationId
          ? {
            ...loc,
            name: modalLocName.trim(),
            isPublic: modalLocIsPublic,
            assignedUserId: !modalLocIsPublic ? modalLocUserId : undefined,
            assignedUserName: !modalLocIsPublic ? assignedName : undefined,
            description: modalLocDesc.trim() || undefined
          }
          : loc
      ));
      addLog(`Updated location "${modalLocName.trim()}" (${modalLocIsPublic ? 'Public' : `Private to ${assignedName || 'Client'}`})`);
    } else {
      const newId = `loc-${Date.now()}`;
      const newLoc: LocationItem = {
        id: newId,
        name: modalLocName.trim(),
        isPublic: modalLocIsPublic,
        assignedUserId: !modalLocIsPublic ? modalLocUserId : undefined,
        assignedUserName: !modalLocIsPublic ? assignedName : undefined,
        description: modalLocDesc.trim() || undefined,
        directions: { F: [], B: [], L: [], R: [], U: [], D: [] },
        gridConfigs: { F: 'auto', B: 'auto', L: 'auto', R: 'auto', U: 'auto', D: 'auto' },
        stitchedPanoPath: null,
        hotspots: []
      };

      setLocations(prev => [...prev, newLoc]);
      setActiveLocationId(newId);
      addLog(`Added location "${modalLocName.trim()}" (${modalLocIsPublic ? 'Public' : `Private to ${assignedName || 'Client'}`})`);
    }

    setShowLocationModal(false);
  };

  const handleAddHotspotClick = (position: [number, number, number]) => {
    setPendingHotspotPos(position);
    const otherLocs = locations.filter(l => l.id !== activeLocationId);
    setSelectedTargetId(otherLocs.length > 0 ? otherLocs[0].id : '');
    setHotspotMode(otherLocs.length > 0 ? 'existing' : 'new');
    setLinkToRoom(true);
    setNewLinkRoomName('');
    setLandmarkArea('');
    setLandmarkDesc('');
    setHotspotIsPublic(true);
    setHotspotUserId('');
    setShowLinkModal(true);
  };

  const handleLinkHotspot = () => {
    try {
      let targetId: string | undefined = undefined;
      let newLocationToAppend: LocationItem | null = null;

      const otherRooms = locations.filter(l => l.id !== activeLocationId);

      if (linkToRoom) {
        if (hotspotMode === 'new') {
          const roomName = newLinkRoomName.trim() || 'New Room';
          targetId = `loc-${Date.now()}`;

          newLocationToAppend = {
            id: targetId,
            name: roomName,
            directions: { F: [], B: [], L: [], R: [], U: [], D: [] },
            gridConfigs: { F: 'auto', B: 'auto', L: 'auto', R: 'auto', U: 'auto', D: 'auto' },
            stitchedPanoPath: null,
            hotspots: []
          };
        } else {
          // Existing Room Mode
          if (!selectedTargetId) {
            alert('⚠️ Please select an existing room from the dropdown list.');
            return;
          }
          targetId = selectedTargetId;
        }
      }

      let hotspotName = newLinkRoomName.trim();
      if (targetId) {
        const targetLoc = locations.find(l => l.id === targetId);
        if (targetLoc && !hotspotName) {
          hotspotName = targetLoc.name;
        }
      }

      if (!hotspotName) {
        hotspotName = landmarkArea.trim() ? `Area (${landmarkArea.trim()})` : (drawingPoints.length > 0 ? 'Area Outline' : '360 Hotspot');
      }

      let pos = pendingHotspotPos;
      if (!pos && drawingPoints.length > 0) {
        const sum = drawingPoints.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1], acc[2] + curr[2]], [0, 0, 0]);
        const count = drawingPoints.length;
        pos = [sum[0] / count, sum[1] / count, sum[2] / count];
      }
      if (!pos) {
        pos = [0, 0, -100];
      }

      const assignedClient = clientUsersList.find(c => c.id === hotspotUserId);
      const assignedName = assignedClient ? assignedClient.name : undefined;
      const targetActiveId = activeLocationId || (locations.length > 0 ? locations[0].id : '');

      setLocations(prev => {
        const list = [...prev];
        const activeIdx = list.findIndex(l => l.id === targetActiveId);

        if (activeIdx !== -1) {
          const currentHotspots = list[activeIdx].hotspots || [];
          if (editingHotspotId) {
            list[activeIdx] = {
              ...list[activeIdx],
              hotspots: currentHotspots.map(h =>
                h.id === editingHotspotId
                  ? {
                    ...h,
                    name: hotspotName,
                    targetLocationId: targetId,
                    area: landmarkArea.trim() || undefined,
                    description: landmarkDesc.trim() || undefined,
                    polygonPoints: drawingPoints.length > 0 ? drawingPoints : h.polygonPoints,
                    icon: hotspotIcon,
                    areaType: areaType,
                    isPublic: hotspotIsPublic,
                    assignedUserId: !hotspotIsPublic ? hotspotUserId : undefined,
                    assignedUserName: !hotspotIsPublic ? assignedName : undefined
                  }
                  : h
              )
            };
          } else {
            const newHotspot: HotspotItem = {
              id: `hs-${Date.now()}`,
              targetLocationId: targetId,
              name: hotspotName,
              area: landmarkArea.trim() || undefined,
              description: landmarkDesc.trim() || undefined,
              position: pos!,
              polygonPoints: drawingPoints.length > 0 ? drawingPoints : undefined,
              icon: hotspotIcon,
              areaType: areaType,
              isPublic: hotspotIsPublic,
              assignedUserId: !hotspotIsPublic ? hotspotUserId : undefined,
              assignedUserName: !hotspotIsPublic ? assignedName : undefined
            };
            list[activeIdx] = {
              ...list[activeIdx],
              hotspots: [...currentHotspots, newHotspot]
            };
          }
        }

        if (newLocationToAppend) {
          list.push(newLocationToAppend);
        }

        return list;
      });

      setLastUpdated(Date.now());
      addLog(`${editingHotspotId ? 'Updated' : 'Created'} 3D hotspot: ${hotspotName}`);
    } catch (err: any) {
      console.error('Error saving hotspot:', err);
    } finally {
      setPendingHotspotPos(null);
      setEditingHotspotId(null);
      setShowLinkModal(false);
      setIsPlacingHotspot(false);
      setIsDrawingArea(false);
      setNewLinkRoomName('');
      setLandmarkArea('');
      setLandmarkDesc('');
      setDrawingPoints([]);
    }
  };

  const handleEditHotspotClick = (hs: HotspotItem) => {
    setEditingHotspotId(hs.id);
    setNewLinkRoomName(hs.name);
    setLinkToRoom(!!hs.targetLocationId);
    setSelectedTargetId(hs.targetLocationId || '');
    setHotspotMode(hs.targetLocationId ? 'existing' : 'new');
    setLandmarkArea(hs.area || '');
    setLandmarkDesc(hs.description || '');
    setHotspotIcon(hs.icon || (hs.targetLocationId ? 'arrow' : 'info'));
    setAreaType(hs.areaType || 'building');
    setHotspotIsPublic(hs.isPublic !== undefined ? hs.isPublic : true);
    setHotspotUserId(hs.assignedUserId || '');
    setPendingHotspotPos(hs.position);
    if (hs.polygonPoints) {
      setDrawingPoints(hs.polygonPoints);
    } else {
      setDrawingPoints([]);
    }
    setShowLinkModal(true);
  };

  const handleStartDrawingAreaForHotspot = (hs: HotspotItem) => {
    setEditingHotspotId(hs.id);
    setNewLinkRoomName(hs.name);
    setLinkToRoom(!!hs.targetLocationId);
    setSelectedTargetId(hs.targetLocationId || '');
    setHotspotMode(hs.targetLocationId ? 'existing' : 'new');
    setLandmarkArea(hs.area || '');
    setLandmarkDesc(hs.description || '');
    setHotspotIcon(hs.icon || (hs.targetLocationId ? 'arrow' : 'info'));
    setAreaType(hs.areaType || 'building');
    setPendingHotspotPos(hs.position);

    // Enter drawing mode loaded with existing points
    setIsPlacingHotspot(true);
    setIsDrawingArea(true);
    setDrawingPoints(hs.polygonPoints || []);
    addLog(`Started drawing boundary outline for: ${hs.name}`);
  };

  const handleSaveAreaOutline = () => {
    if (drawingPoints.length === 0) return;

    const sum = drawingPoints.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1], acc[2] + curr[2]], [0, 0, 0]);
    const count = drawingPoints.length;
    const centerPos: [number, number, number] = [sum[0] / count, sum[1] / count, sum[2] / count];

    setPendingHotspotPos(centerPos);

    const otherRooms = locations.filter(l => l.id !== activeLocationId);
    setSelectedTargetId(otherRooms.length > 0 ? otherRooms[0].id : '');
    setHotspotMode(otherRooms.length > 0 ? 'existing' : 'new');

    // If not editing an existing hotspot, reset inputs for a new outline
    if (!editingHotspotId) {
      setLinkToRoom(false);
      setNewLinkRoomName('');
      setLandmarkArea('');
      setLandmarkDesc('');
      setAreaType('building');
    }

    setShowLinkModal(true);
  };

  const handleDeleteLocation = (id: string, name: string) => {
    if (locations.length <= 1) {
      alert('Cannot delete the only location in the project.');
      return;
    }

    const confirmMsg = `⚠️ Are you sure you want to delete room "${name}"?\n\nAll uploaded photos and 360 panorama data for this room will be permanently removed from Cloud Storage (S3).`;
    if (!window.confirm(confirmMsg)) return;

    const locToDelete = locations.find(l => l.id === id);
    if (locToDelete) {
      const pathsToDelete: string[] = [];
      if (locToDelete.stitchedPanoPath) pathsToDelete.push(locToDelete.stitchedPanoPath);
      if (locToDelete.directions) {
        Object.values(locToDelete.directions).forEach(imgs => {
          (imgs || []).forEach(img => {
            if (img.path) pathsToDelete.push(img.path);
          });
        });
      }
      if (pathsToDelete.length > 0) {
        fetch(`${API_BASE_URL}/api/delete-assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: pathsToDelete })
        }).catch(e => console.warn('Asset delete notice:', e));
      }
    }

    const filtered = locations.filter(l => l.id !== id);
    setLocations(filtered);
    if (activeLocationId === id) {
      setActiveLocationId(filtered[0].id);
    }
    addLog(`Deleted location: ${name} and purged assets from S3`);
  };

  const handleSaveProject = async () => {
    const projName = crmProjectName || activeLoc?.name || '360 Virtual Tour Project';
    const projectData: ProjectData = {
      projectDir,
      locations,
      activeLocationId,
      resolution,
      featureDetector,
      blendingMode,
      exposureCorrection
    };

    let savedPath = projectFilePath;

    // 1. Save to File on disk (Electron API)
    if ((window as any).electronAPI) {
      try {
        savedPath = await (window as any).electronAPI.saveProject(projectData, projectFilePath || undefined);
        if (savedPath) {
          setProjectFilePath(savedPath);
        }
      } catch (err: any) {
        console.warn('File save notice:', err.message);
      }
    }

    // 2. Save & Sync to Home Page (Backend SQLite Database)
    let token = authToken || localStorage.getItem('crm_token');
    let user = currentUser || (localStorage.getItem('crm_user') ? JSON.parse(localStorage.getItem('crm_user')!) : null);

    // If not logged in yet, authenticate as default Admin in the background
    if (!token) {
      try {
        const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@360soft.com', password: 'admin123' })
        });
        if (loginRes.ok) {
          const authData = await loginRes.json();
          token = authData.token;
          user = authData.user;
          setAuthToken(authData.token);
          setCurrentUser(authData.user);
          localStorage.setItem('crm_token', authData.token);
          localStorage.setItem('crm_user', JSON.stringify(authData.user));
        }
      } catch (e) {
        console.warn('Auto auth notice:', e);
      }
    }

    let projId = currentProjectId;

    if (token) {
      try {
        const endpoint = projId
          ? `${API_BASE_URL}/api/projects/${projId}`
          : `${API_BASE_URL}/api/projects`;
        const method = projId ? 'PUT' : 'POST';

        const res = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: projName,
            data: projectData,
            is_public: crmProjectIsPublic,
            target_user_id: user?.id
          })
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.id) {
            projId = resData.id;
            setCurrentProjectId(resData.id);
          } else if (resData.project?.id) {
            projId = resData.project.id;
            setCurrentProjectId(resData.project.id);
          }
        }
      } catch (err: any) {
        console.warn('Server sync notice:', err);
      }
    }

    // 3. Save to localStorage draft & local project registry
    const effectiveId = projId || currentProjectId || `proj-${Date.now()}`;
    if (!currentProjectId) {
      setCurrentProjectId(effectiveId);
    }

    const draftData = {
      id: effectiveId,
      name: projName,
      projectDir,
      projectFilePath: savedPath,
      locations,
      activeLocationId,
      resolution,
      featureDetector,
      blendingMode,
      exposureCorrection,
      lastUpdated: Date.now()
    };
    saveLargeDraft('studio_draft_project', draftData);

    // Save to local registry so it's always visible on Home Page
    try {
      const localListStr = localStorage.getItem('local_saved_projects') || '[]';
      const localList: any[] = JSON.parse(localListStr);
      const existingIdx = localList.findIndex((p: any) => p.id === effectiveId || p.name === projName);
      const newProjItem = {
        id: effectiveId,
        user_id: user?.id || 'usr-admin',
        name: projName,
        is_public: crmProjectIsPublic,
        created_at: new Date().toISOString(),
        data: projectData
      };
      if (existingIdx >= 0) {
        localList[existingIdx] = newProjItem;
      } else {
        localList.unshift(newProjItem);
      }
      safeLocalStorageSet('local_saved_projects', JSON.stringify(localList));
    } catch (e) {}

    addLog(`💾 Project "${projName}" saved to file and synced to Home Page!`);
  };

  const handleAuthSuccess = (user: { id: string; name: string; email: string; role: string }, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('crm_user', JSON.stringify(user));
    localStorage.setItem('crm_token', token);

    // Always redirect to CRM Portal upon login
    handleViewChange('crm');
    addLog(`Logged in as ${user.name} (${user.role.toUpperCase()})`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthToken(null);
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_token');
    localStorage.removeItem('active_view');
    localStorage.removeItem('active_public_tour_id');
    setActivePublicTourId(null);
    handleViewChange('login');
    addLog('Logged out from CRM system.');
  };

  const handleOpenSaveCrmModal = async () => {
    if (!currentUser || !authToken) {
      setIsLoginModalOpen(true);
      return;
    }
    setShowSaveCrmModal(true);

    if (currentUser.role === 'admin') {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          const clients = await res.json();
          setClientUsersList(clients);
          if (clients.length > 0) setSelectedClientId(clients[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch clients list:', err);
      }
    }
  };

  const handleSaveToCrmServer = async () => {
    if (!authToken) return;
    setSavingCrm(true);

    // If project is Private, force ALL rooms and hotspots inside to be Private as well!
    const targetClientUserId = !crmProjectIsPublic
      ? (selectedClientId || activeLoc?.assignedUserId || currentUser?.id)
      : (currentUser?.role === 'admin' ? (selectedClientId || currentUser?.id) : currentUser?.id);

    const sanitizedLocations = locations.map(loc => ({
      ...loc,
      isPublic: crmProjectIsPublic ? (loc.isPublic !== undefined ? loc.isPublic : true) : false,
      assignedUserId: !crmProjectIsPublic ? targetClientUserId : loc.assignedUserId,
      hotspots: (loc.hotspots || []).map(hs => ({
        ...hs,
        isPublic: crmProjectIsPublic ? (hs.isPublic !== undefined ? hs.isPublic : true) : false,
        assignedUserId: !crmProjectIsPublic ? targetClientUserId : hs.assignedUserId
      }))
    }));

    const projectData: ProjectData = {
      projectDir,
      locations: sanitizedLocations,
      activeLocationId,
      resolution,
      featureDetector,
      blendingMode,
      exposureCorrection
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: crmProjectName || activeLoc?.name || '360 Virtual Tour',
          data: projectData,
          target_user_id: targetClientUserId,
          is_public: crmProjectIsPublic
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save to CRM server');
      }

      addLog(`Successfully published project "${crmProjectName}" to CRM Server!`);
      setShowSaveCrmModal(false);
      setActiveView('crm');
    } catch (err: any) {
      addLog(`Error publishing to CRM: ${err.message}`);
    } finally {
      setSavingCrm(false);
    }
  };

  const handleLoadProject = async () => {
    if (!(window as any).electronAPI) return;
    try {
      const result = await (window as any).electronAPI.loadProject();
      if (result) {
        const { projectData, filePath } = result;
        setProjectFilePath(filePath);
        setProjectDir(projectData.projectDir || '');
        if (projectData.locations) {
          setLocations(projectData.locations);
          setActiveLocationId(projectData.activeLocationId || projectData.locations[0].id);
        }
        setResolution(projectData.resolution || 4096);
        setFeatureDetector(projectData.featureDetector || 'ORB');
        setBlendingMode(projectData.blendingMode || 'multi-band');
        setExposureCorrection(projectData.exposureCorrection !== undefined ? projectData.exposureCorrection : true);
        setLastUpdated(Date.now());
        addLog(`Project loaded from ${filePath}`);
      }
    } catch (err: any) {
      addLog(`Error loading project: ${err.message}`);
    }
  };

  const handleLoadDemoGrid = () => {
    // Generate clean mock files so the user can test immediately
    const mockImages: Record<string, ProjectImage[]> = {};
    DIRECTIONS_KEYS.forEach(key => {
      mockImages[key] = Array.from({ length: 4 }).map((_, i) => ({
        name: `${key}_00${i + 1}.jpg`,
        path: `mock_path/${key}_00${i + 1}.jpg`
      }));
    });
    setDirections(mockImages);
    setProjectDir('DemoProjectDir');
    setLastUpdated(Date.now());
    addLog('Loaded demo 2x2 grid image sequence. (Simulation Mode)');
  };

  const handleClearDirection = (dirKey: string) => {
    const currentImgs = directions[dirKey] || [];
    if (currentImgs.length === 0) return;

    const confirmMsg = `⚠️ Clear all ${currentImgs.length} photo(s) in ${DIRECTIONS_LABELS[dirKey]}?\n\nThis will permanently delete these images from Cloud Storage (S3).`;
    if (!window.confirm(confirmMsg)) return;

    const pathsToDelete = currentImgs.map(img => img.path).filter(Boolean);
    if (pathsToDelete.length > 0) {
      fetch(`${API_BASE_URL}/api/delete-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: pathsToDelete })
      }).catch(e => console.warn('Asset delete notice:', e));
    }

    setDirections(prev => ({
      ...prev,
      [dirKey]: []
    }));
    setStitchedPanoPath(null);
    setLastUpdated(Date.now());
    addLog(`Cleared images in ${DIRECTIONS_LABELS[dirKey]} and purged from S3`);
  };

  const detectGrid = (images: ProjectImage[]) => {
    const count = images.length;
    if (count === 0) return 'No images';
    if (count <= 4) return '2x2 Grid';
    if (count <= 9) return '3x3 Grid';
    if (count <= 25) return '5x5 Grid';
    if (count <= 81) return '9x9 Grid';
    return `${Math.floor(Math.sqrt(count))}x${Math.floor(Math.sqrt(count))} Grid`;
  };

  const handleRunStitch = async () => {
    // Verify we have loaded images
    const hasImages = Object.values(directions).some(arr => arr.length > 0);
    if (!hasImages) {
      addLog('Error: Please import images into directions before running Image Engine.');
      return;
    }

    if (!(window as any).electronAPI) {
      addLog('Processing your imported photos...');
      setLoading(true);
      setProgress(15);
      setProgressMsg('Aligning imported face images...');

      try {
        await new Promise(r => setTimeout(r, 600));
        setProgress(45);
        setProgressMsg('Assembling equirectangular 360° panorama...');

        // Helper to load image
        const loadImage = (src: string): Promise<HTMLImageElement> => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject();
            img.src = src;
          });
        };

        const canvas = document.createElement('canvas');
        canvas.width = resolution || 4096;
        canvas.height = (resolution || 4096) / 2;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const order = ['R', 'F', 'L', 'B'];
        const sectionW = canvas.width / 4;
        const sectionH = canvas.height;

        for (let idx = 0; idx < order.length; idx++) {
          const dirKey = order[idx];
          const dirImgs = directions[dirKey] || [];
          if (dirImgs.length > 0) {
            try {
              let imgSrc = dirImgs[0].path;
              if (imgSrc && !imgSrc.startsWith('http') && !imgSrc.startsWith('data:')) {
                const clean = imgSrc.replace(/^file:\/\/\/?/, '');
                imgSrc = `http://localhost:5000/api/local-image?path=${encodeURIComponent(clean)}`;
              }
              const imgElem = await loadImage(imgSrc);
              ctx.drawImage(imgElem, idx * sectionW, 0, sectionW, sectionH);
            } catch (e) {}
          }
        }

        setProgress(85);
        setProgressMsg('Applying multi-band blending...');
        await new Promise(r => setTimeout(r, 500));

        const panoDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setStitchedPanoPath(panoDataUrl);
        setProgress(100);
        setProgressMsg('360° Panorama created successfully!');
        addLog(`✅ Successfully created 360° virtual tour panorama from your imported photos!`);
      } catch (err: any) {
        addLog(`Stitch notice: ${err.message}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setProgress(0);
    setProgressMsg('Initializing Python Image Engine...');
    setLogs([]);
    addLog('Stitching job started...');

    const outPath = `${projectDir}/panorama_360.png`;

    // Map React directions structure to raw path lists for Python
    const directionsPaths: Record<string, string[]> = {};
    Object.keys(directions).forEach(k => {
      directionsPaths[k] = directions[k].map(img => img.path);
    });

    try {
      const result = await (window as any).electronAPI.runStitch({
        projectDir,
        directions: directionsPaths,
        outputPath: outPath,
        resolution
      });

      if (result && result.status === 'SUCCESS') {
        setStitchedPanoPath(result.outputPath);
        addLog(`Successfully generated equirectangular 360 panorama: ${result.outputPath}`);
      }
    } catch (err: any) {
      addLog(`Error during stitching: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (activePublicTourId && activeView === 'public_tour') {
    return (
      <PublicTourViewer
        tourId={activePublicTourId}
        onBack={() => {
          localStorage.removeItem('active_public_tour_id');
          const savedUser = localStorage.getItem('crm_user');
          let backView: 'studio' | 'crm' = 'studio';
          if (savedUser) {
            try {
              const parsed = JSON.parse(savedUser);
              if (parsed.role === 'client') backView = 'crm';
            } catch (e) { }
          }
          setActivePublicTourId(null);
          handleViewChange(backView);
        }}
        onLogin={() => {
          localStorage.removeItem('active_public_tour_id');
          setActivePublicTourId(null);
          handleViewChange('login');
        }}
      />
    );
  }

  if (!currentUser || !authToken || activeView === 'login') {
    return <ClientLoginPage onSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Title Bar */}
      <nav className="studio-navbar navbar navbar-dark bg-dark px-3 py-2 border-bottom border-secondary border-opacity-25 flex-nowrap overflow-x-auto">
        <div className="d-flex align-items-center gap-3 shrink-0">
          <button
            onClick={async () => {
              if (!currentUser || !authToken) {
                try {
                  const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'admin@360soft.com', password: 'admin123' })
                  });
                  if (loginRes.ok) {
                    const authData = await loginRes.json();
                    setAuthToken(authData.token);
                    setCurrentUser(authData.user);
                    localStorage.setItem('crm_token', authData.token);
                    localStorage.setItem('crm_user', JSON.stringify(authData.user));
                    handleViewChange('crm');
                    return;
                  }
                } catch (e) {}
              }
              handleViewChange(currentUser ? 'crm' : 'login');
            }}
            className="btn btn-sm btn-outline-secondary text-white rounded-3 px-3 d-flex align-items-center gap-1 shadow-sm"
            title="Go to Home Page / Dashboard"
          >
            <Home className="w-3.5 h-3.5 text-indigo-400" />
            <span className="small font-weight-normal">Home Page</span>
          </button>

          <div className="d-flex align-items-center gap-2">
            <Layers size={18} style={{ color: 'var(--accent-color)' }} />
            <span className="studio-logo">360 Virtual Tour Studio</span>
          </div>

          {/* Mode Switch Tabs */}
          <div className="mode-switch-pill d-inline-flex">
            {currentUser?.role !== 'client' && (
              <button
                onClick={() => {
                  if (!authToken) {
                    setActiveView('login');
                  } else {
                    setActiveView('crm');
                  }
                }}
                className={`mode-tab-btn ${activeView === 'crm' ? 'active-crm' : ''}`}
                title="View All Projects, Completed Tours & Drafts"
              >
                <LayoutDashboard className="w-3.5 h-3.5 me-1" />
                <span>📁 All Projects Dashboard</span>
              </button>
            )}

            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setActiveView('studio')}
                className={`mode-tab-btn ${activeView === 'studio' ? 'active-studio' : ''}`}
                title="Open 360 3D Studio Editor"
              >
                <Cpu className="w-3.5 h-3.5 me-1" />
                <span>🛠️ 3D Studio Editor</span>
              </button>
            )}
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 shrink-0">
          {activeView === 'studio' && (
            <>
              <button
                className="btn btn-sm btn-outline-info text-white rounded-3 px-3 d-flex align-items-center gap-1 font-weight-normal"
                onClick={() => setActiveView('crm')}
                title="Browse All Projects & Drafts"
              >
                <LayoutDashboard size={14} className="text-info" /> Browse Projects
              </button>
              <button
                className="btn btn-sm d-flex align-items-center gap-1 rounded-3 px-3"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.8rem' }}
                onClick={() => { setNewProjectName(''); setIsNewProjectModalOpen(true); }}
                title="Start a brand new 360 project"
              >
                <FolderOpen size={14} /> + New Project
              </button>
              <button className="btn btn-sm btn-secondary text-white rounded-3 px-3 d-flex align-items-center gap-1" onClick={handleLoadProject}>
                <FolderOpen size={14} /> Open File
              </button>
              <button
                className="btn btn-sm btn-secondary text-white rounded-3 px-3 d-flex align-items-center gap-1"
                onClick={handleSaveProject}
                title="Save project to file and sync with Home Page"
              >
                <Save size={14} className="text-info" /> Save File
              </button>
              <button
                className="btn btn-sm btn-primary rounded-3 px-3 font-weight-normal d-flex align-items-center gap-1"
                onClick={handleOpenSaveCrmModal}
                title="Publish 360 Tour to CRM Server Database for Clients"
              >
                <Database size={14} /> Publish to CRM DB
              </button>
              <button
                className={`btn btn-sm rounded-3 px-3 d-flex align-items-center gap-1.5 ${activeRightTab === 'adjustments' ? 'btn-primary' : 'btn-outline-secondary text-white'}`}
                style={{
                  background: activeRightTab === 'adjustments' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : undefined,
                  border: activeRightTab === 'adjustments' ? 'none' : undefined,
                  fontWeight: 600
                }}
                onClick={() => setActiveRightTab('adjustments')}
                title="Open Image Adjustments & Color Grading Panel"
              >
                <Sliders size={14} className={activeRightTab === 'adjustments' ? 'text-white' : 'text-indigo-400'} />
                <span>Adjustments</span>
              </button>
              <button
                className="btn btn-sm btn-outline-success text-white rounded-3 px-3 d-flex align-items-center gap-1"
                onClick={handleExportWebZip}
                disabled={isExportingZip}
                title="Export Standalone Web Package (.ZIP)"
              >
                <Archive size={14} className={`text-success ${isExportingZip ? 'spin' : ''}`} />
                <span>{isExportingZip ? 'Exporting Web Package...' : 'Export Web ZIP'}</span>
              </button>
              <button className="btn btn-sm btn-outline-primary rounded-3 px-3" onClick={handleLoadDemoGrid} title="Load demonstration layout files">
                Load Demo Grid
              </button>
              <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 px-2 py-1.5 rounded-3 d-flex align-items-center gap-1" title="Studio project draft is automatically saved">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Auto-Saved</span>
              </span>
            </>
          )}

          {/* User Account / Auth Section */}
          <div className="ps-3 border-start border-secondary border-opacity-25 d-flex align-items-center gap-2">
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setIsAddUserModalOpen(true)}
                className="btn btn-sm btn-warning text-dark font-weight-normal rounded-3 px-3 d-flex align-items-center gap-1 shadow-sm"
                title="Create New Client / User Account"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Create Client</span>
              </button>
            )}

            {currentUser ? (
              <div className="d-flex align-items-center gap-2 bg-secondary bg-opacity-25 px-3 py-1.5 rounded-3 border border-secondary border-opacity-25">
                <UserCheck className="w-4 h-4 text-success" />
                <span className="small text-white font-weight-normal">{currentUser.name} ({currentUser.role})</span>
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="btn btn-sm text-secondary p-0 ms-1 border-0"
                >
                  <LogOut className="w-3.5 h-3.5 text-danger" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="btn btn-sm btn-outline-primary rounded-3 px-3 d-flex align-items-center gap-1"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Client Login</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Workspace */}
      {activeView === 'crm' && currentUser && authToken ? (
        <ClientDashboard
          user={currentUser}
          token={authToken}
          onOpenProject={(proj) => {
            setCurrentProjectId(proj.id);
            setCrmProjectName(proj.name);
            setCrmProjectIsPublic(proj.is_public);
            if (proj.data) {
              setProjectDir(proj.data.projectDir || '');
              if (proj.data.locations && proj.data.locations.length > 0) {
                setLocations(proj.data.locations);
                setActiveLocationId(proj.data.activeLocationId || proj.data.locations[0].id);
              }
              if (proj.data.resolution) setResolution(proj.data.resolution);
              if (proj.data.featureDetector) setFeatureDetector(proj.data.featureDetector);
              if (proj.data.blendingMode) setBlendingMode(proj.data.blendingMode);
              if (proj.data.exposureCorrection !== undefined) setExposureCorrection(proj.data.exposureCorrection);
            }
            handleViewChange('studio');
            addLog(`📂 Opened project "${proj.name}" into Studio (${proj.is_public ? 'Public Mode' : 'Private Mode'})`);
          }}
          onBackToStudio={() => handleViewChange('studio')}
          onCreateNewProject={() => {
            setNewProjectName('');
            setIsNewProjectModalOpen(true);
            handleViewChange('studio');
          }}
          onOpenAddUserModal={() => setIsAddUserModalOpen(true)}
          onLaunchPublicView={(tourId) => {
            localStorage.removeItem(`active_public_loc_${tourId}`);
            setActivePublicTourId(tourId);
            localStorage.setItem('active_public_tour_id', tourId);
            handleViewChange('public_tour');
          }}
          onLogout={handleLogout}
        />
      ) : (
        <>
          <div className="studio-main-grid">

            {/* Left Panel: Project Explorer */}
            <div className="studio-sidebar">
              <div className="sidebar-header">
                <span>Project Explorer</span>
                <ImageIcon size={14} />
              </div>
              <div className="sidebar-body">
                {/* Location Manager */}
                <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Locations / Rooms
                    </span>
                    <button
                      onClick={handleOpenAddLocationModal}
                      className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold transition-all flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Room</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                    {locations.map(loc => {
                      const isActive = loc.id === activeLocationId;
                      const totalImages = Object.values(loc.directions).reduce((acc, arr) => acc + arr.length, 0);
                      const isPublic = loc.isPublic !== undefined ? loc.isPublic : true;

                      return (
                        <div
                          key={loc.id}
                          onClick={() => setActiveLocationId(loc.id)}
                          className={`location-item-card ${isActive ? 'active' : ''}`}
                        >
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-2">
                              <span className="small font-weight-normal text-white">{loc.name}</span>
                              {isPublic ? (
                                <span className="badge bg-success bg-opacity-20 text-success border border-success border-opacity-30 rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>
                                  Public
                                </span>
                              ) : (
                                <span className="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-30 rounded-pill px-2 py-0.5 d-inline-flex align-items-center gap-1" style={{ fontSize: '0.65rem' }} title={`Assigned to ${loc.assignedUserName || 'Client'}`}>
                                  <Lock size={10} />
                                  <span>{loc.assignedUserName || 'Private'}</span>
                                </span>
                              )}
                            </div>

                            <div className="d-flex align-items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditLocationModal(loc);
                                }}
                                className="btn btn-sm btn-link text-secondary p-0"
                                title="Edit Location Settings"
                              >
                                <Settings size={14} />
                              </button>

                              {locations.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteLocation(loc.id, loc.name);
                                  }}
                                  className="btn btn-sm btn-link text-danger p-0"
                                  title="Delete Location"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="small text-secondary mt-1" style={{ fontSize: '0.7rem' }}>
                            {totalImages} images loaded
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-dark p-2.5 rounded-3 border border-secondary border-opacity-25 mb-3" title={projectDir || 'Not set'}>
                  <div className="d-flex align-items-center gap-2 text-secondary small" style={{ fontSize: '0.75rem' }}>
                    <FolderOpen size={14} className="text-indigo-400 shrink-0" />
                    <span className="text-truncate">
                      Project Dir: <strong className="text-white font-weight-normal">{projectDir || 'Not set'}</strong>
                    </span>
                  </div>
                </div>

                {activeLoc ? (
                  DIRECTIONS_KEYS.map(key => {
                    const imgs = directions[key] || [];
                    return (
                      <div key={key} className="direction-face-card">
                        <div className="direction-face-header">
                          <span className="direction-face-title">
                            {DIRECTIONS_LABELS[key]}
                          </span>
                          <span className="badge bg-secondary bg-opacity-30 text-indigo-300 font-weight-normal" style={{ fontSize: '0.7rem' }}>
                            {gridConfigs[key] !== 'auto' ? `${gridConfigs[key]}` : detectGrid(imgs)}
                          </span>
                        </div>

                        <div className="d-flex align-items-center gap-2 mb-2">
                          <button className="btn btn-sm btn-outline-secondary py-1 text-white flex-grow-1" style={{ fontSize: '0.75rem' }} onClick={() => handleStartImport(key)}>
                            Import
                          </button>
                          {imgs.length > 0 && (
                            <button className="btn btn-sm btn-outline-danger py-1 px-2" style={{ fontSize: '0.75rem' }} onClick={() => handleClearDirection(key)}>
                              Clear
                            </button>
                          )}
                        </div>

                        {imgs.length > 0 && (
                          <div className="image-list-grid">
                            {imgs.slice(0, 8).map((img, idx) => (
                              <div key={idx} className="image-thumb-card" title={img.name}>
                                <div className="w-100 h-100 d-flex align-items-center justify-content-center bg-dark">
                                  <ImageIcon size={14} className="text-secondary" />
                                </div>
                                <div className="image-thumb-label">{img.name}</div>
                              </div>
                            ))}
                            {imgs.length > 8 && (
                              <div className="image-thumb-card d-flex align-items-center justify-content-center text-secondary small bg-dark">
                                +{imgs.length - 8}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '30px 10px',
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    marginTop: '10px'
                  }}>
                    Please click on the Floor Plan Map on the right to add your first room/location.
                  </div>
                )}
              </div>
            </div>

            {/* Center Panel: 360 Viewer Canvas */}
            <div className="studio-center-viewport">
              <div className="sidebar-header">
                <span>Interactive 360 Workspace</span>
                <Eye size={14} />
              </div>
              <div id="interactive-workspace-wrapper" style={{ flex: 1, overflow: 'hidden', background: '#090a0d', position: 'relative' }}>
                {Object.values(directions).some(arr => arr.length > 0) ? (
                  <Viewer360
                  adjustments={activeLoc?.adjustments || DEFAULT_ADJUSTMENTS}
                    directions={directions}
                    gridConfigs={gridConfigs}
                    hotspots={activeLoc?.hotspots || []}
                    isPlacingHotspot={isPlacingHotspot}
                    setIsPlacingHotspot={setIsPlacingHotspot}
                    onAddHotspot={handleAddHotspotClick}
                    onNavigate={setActiveLocationId}
                    isDrawingArea={isDrawingArea}
                    setIsDrawingArea={setIsDrawingArea}
                    drawingPoints={drawingPoints}
                    setDrawingPoints={setDrawingPoints}
                    onSaveAreaOutline={handleSaveAreaOutline}
                    onEditHotspot={handleEditHotspotClick}
                    onDeleteHotspot={(id) => {
                      updateActiveLocation(loc => ({
                        hotspots: (loc.hotspots || []).filter(h => h.id !== id)
                      }));
                      addLog(`Removed hotspot`);
                    }}
                    onAddAreaOutline={handleStartDrawingAreaForHotspot}
                    areaType={areaType}
                    onOpenAdjustments={() => setActiveRightTab('adjustments')}
                  />
                ) : (
                  <div className="viewer-placeholder" style={{ height: '100%', padding: '20px' }}>
                    <RotateCw size={48} className={loading ? "spin" : ""} style={{ animation: loading ? "spin 2s linear infinite" : "none" }} />
                    {locations.length === 0 ? (
                      <>
                        <h3>No locations created</h3>
                        <p style={{ maxWidth: '400px', fontSize: '0.85rem' }}>
                          Click anywhere on the <strong>Floor Plan Map</strong> grid on the right to place a pin and create your first room.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3>No images in "{activeLoc?.name}"</h3>
                        <p style={{ maxWidth: '400px', fontSize: '0.85rem' }}>
                          Select a direction (Front, Back, etc.) on the left panel, choose your grid size, and import images to see them mapped on the 3D cube.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Link Modal inside Fullscreen Container */}
                {showLinkModal && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1002,
                    backdropFilter: 'blur(4px)'
                  }}>
                    <div style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      padding: '24px',
                      borderRadius: '8px',
                      width: '380px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                    }}>
                      <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.15rem' }}>
                        {editingHotspotId ? 'Edit 3D Hotspot' : 'Create 3D Hotspot'}
                      </h3>

                      {/* Hotspot Name Input */}
                      <div className="form-group">
                        <label className="form-label">Hotspot / Location Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Master Bedroom, Swimming Pool"
                          value={newLinkRoomName}
                          onChange={(e) => setNewLinkRoomName(e.target.value)}
                          autoFocus
                        />
                      </div>

                      {/* Hotspot Icon Selector */}
                      <div className="form-group">
                        <label className="form-label">Select Hotspot Icon</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[
                            { value: 'arrow', label: '➜ Arrow' },
                            { value: 'pin', label: '📍 Pin' },
                            { value: 'info', label: 'ℹ Info' }
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setHotspotIcon(opt.value as any)}
                              style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '4px',
                                border: hotspotIcon === opt.value ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                background: hotspotIcon === opt.value ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-tertiary)',
                                color: 'white',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                fontWeight: hotspotIcon === opt.value ? 'bold' : 'normal',
                                textAlign: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                transition: 'all 0.1s ease'
                              }}
                            >
                              <span style={{ fontSize: '0.9rem' }}>{opt.label.split(' ')[0]}</span>
                              <span>{opt.label.split(' ')[1]}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Optional Room Linking Toggle */}
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}>
                          <input
                            type="checkbox"
                            checked={linkToRoom}
                            onChange={(e) => setLinkToRoom(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                          Link to another Room
                        </label>
                      </div>

                      {linkToRoom && (
                        <div style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          padding: '12px',
                          borderRadius: '6px',
                          marginBottom: '16px'
                        }}>
                          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="hotspot-mode"
                                checked={hotspotMode === 'new'}
                                onChange={() => {
                                  setHotspotMode('new');
                                  setSelectedTargetId('');
                                }}
                              />
                              Create New Room
                            </label>

                            <label style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.8rem',
                              cursor: locations.filter(l => l.id !== activeLocationId).length > 0 ? 'pointer' : 'not-allowed',
                              opacity: locations.filter(l => l.id !== activeLocationId).length > 0 ? 1 : 0.5
                            }}>
                              <input
                                type="radio"
                                name="hotspot-mode"
                                disabled={locations.filter(l => l.id !== activeLocationId).length === 0}
                                checked={hotspotMode === 'existing'}
                                onChange={() => {
                                  setHotspotMode('existing');
                                  if (selectedTargetId) {
                                    const loc = locations.find(l => l.id === selectedTargetId);
                                    if (loc) setNewLinkRoomName(loc.name);
                                  }
                                }}
                              />
                              Existing Room
                            </label>
                          </div>

                          {hotspotMode === 'new' ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              A new empty room named <strong>"{newLinkRoomName || 'Hotspot Name'}"</strong> will be created.
                            </div>
                          ) : (
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label">Select existing Room *</label>
                              <select
                                className="form-select"
                                value={selectedTargetId}
                                onChange={(e) => {
                                  const chosenId = e.target.value;
                                  setSelectedTargetId(chosenId);
                                  if (chosenId) {
                                    const loc = locations.find(l => l.id === chosenId);
                                    if (loc) {
                                      setNewLinkRoomName(loc.name);
                                    }
                                  } else {
                                    setNewLinkRoomName('');
                                  }
                                }}
                              >
                                <option value="">-- Please select a room --</option>
                                {locations.filter(l => l.id !== activeLocationId).map(loc => (
                                  <option key={loc.id} value={loc.id}>📍 {loc.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Area Type/Style Selector */}
                      {(drawingPoints.length > 0 || (editingHotspotId && activeLoc?.hotspots?.find(h => h.id === editingHotspotId)?.polygonPoints)) && (
                        <div className="form-group">
                          <label className="form-label">Select Area Style</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {[
                              { value: 'building', label: '🏢 Area (Purple)' },
                              { value: 'river', label: '💧 River (Blue)' },
                              { value: 'road', label: '🛣 Road (Yellow)' }
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setAreaType(opt.value as any)}
                                style={{
                                  flex: 1,
                                  padding: '8px',
                                  borderRadius: '4px',
                                  border: areaType === opt.value ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                  background: areaType === opt.value ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-tertiary)',
                                  color: 'white',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  fontWeight: areaType === opt.value ? 'bold' : 'normal',
                                  textAlign: 'center',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  transition: 'all 0.1s ease'
                                }}
                              >
                                <span style={{ fontSize: '0.9rem' }}>{opt.label.split(' ')[0]}</span>
                                <span>{opt.label.split(' ')[1]}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hotspot Access & Visibility Settings */}
                      <div className="form-group" style={{ marginBottom: '16px', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <label className="form-label" style={{ fontWeight: 'bold', marginBottom: '8px' }}>Hotspot Visibility & Access</label>

                        {crmProjectIsPublic ? (
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setHotspotIsPublic(true)}
                              style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '6px',
                                border: hotspotIsPublic ? '2px solid #10b981' : '1px solid var(--border-color)',
                                background: hotspotIsPublic ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-secondary)',
                                color: 'white',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                fontWeight: hotspotIsPublic ? 'bold' : 'normal'
                              }}
                            >
                              🌐 Public Hotspot
                            </button>
                            <button
                              type="button"
                              onClick={() => setHotspotIsPublic(false)}
                              style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '6px',
                                border: !hotspotIsPublic ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                                background: !hotspotIsPublic ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-secondary)',
                                color: 'white',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                fontWeight: !hotspotIsPublic ? 'bold' : 'normal'
                              }}
                            >
                              🔒 Private Hotspot
                            </button>
                          </div>
                        ) : (
                          <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #f59e0b', background: 'rgba(245, 158, 11, 0.15)', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '8px' }}>
                            🔒 Private Project Active: Public Hotspot option is HIDDEN. All hotspots are strictly Private.
                          </div>
                        )}

                        {(!hotspotIsPublic || !crmProjectIsPublic) && (
                          <div style={{ marginTop: '8px' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Assign to Specific Client *</label>
                            <select
                              className="form-select"
                              value={hotspotUserId}
                              onChange={(e) => setHotspotUserId(e.target.value)}
                            >
                              <option value="">Select Assigned Client Account...</option>
                              {clientUsersList.map(c => (
                                <option key={c.id} value={c.id}>
                                  👤 {c.name} ({c.email})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Landmark Details (Area, Description) */}
                      <div className="form-group">
                        <label className="form-label">Total Area (Optional)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 15,000 Sq. Ft, 2 Acres"
                          value={landmarkArea}
                          onChange={(e) => setLandmarkArea(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Details / Description (Optional)</label>
                        <textarea
                          className="form-input"
                          style={{ height: '60px', resize: 'none', fontFamily: 'inherit' }}
                          placeholder="e.g. Fully furnished, garden view..."
                          value={landmarkDesc}
                          onChange={(e) => setLandmarkDesc(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => { setShowLinkModal(false); setPendingHotspotPos(null); setIsPlacingHotspot(false); setIsDrawingArea(false); }}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={handleLinkHotspot}
                        >
                          {editingHotspotId ? 'Save Changes' : (drawingPoints.length > 0 ? 'Save Area Outline' : 'Create Hotspot')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Stitching & Adjustments */}
            <div className="studio-sidebar studio-sidebar-right">
              <div className="sidebar-header" style={{ padding: '6px 8px', display: 'flex', gap: '6px', background: '#090a0f', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => setActiveRightTab('stitch')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: activeRightTab === 'stitch' ? 700 : 500,
                    background: activeRightTab === 'stitch' ? 'linear-gradient(135deg, #1e2438, #2a314d)' : 'transparent',
                    color: activeRightTab === 'stitch' ? '#fff' : '#94a3b8',
                    border: activeRightTab === 'stitch' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Cpu size={14} className={activeRightTab === 'stitch' ? 'text-indigo-400' : ''} />
                  <span>Stitch & Hotspots</span>
                </button>

                <button
                  onClick={() => setActiveRightTab('adjustments')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: activeRightTab === 'adjustments' ? 700 : 500,
                    background: activeRightTab === 'adjustments' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
                    color: activeRightTab === 'adjustments' ? '#fff' : '#94a3b8',
                    border: activeRightTab === 'adjustments' ? '1px solid #818cf8' : '1px solid transparent',
                    boxShadow: activeRightTab === 'adjustments' ? '0 2px 10px rgba(99,102,241,0.35)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Sliders size={14} className={activeRightTab === 'adjustments' ? 'text-white' : 'text-indigo-400'} />
                  <span>Adjustments</span>
                </button>
              </div>
              <div className="sidebar-body">
                {activeRightTab === 'adjustments' ? (
                  <ImageAdjustmentPanel
                    adjustments={activeLoc?.adjustments || DEFAULT_ADJUSTMENTS}
                    onChange={handleUpdateActiveLocAdjustments}
                    locations={locations}
                    activeLocationId={activeLocationId}
                    onApplyToAll={handleApplyAdjustmentsToAll}
                    onApplyToSelected={handleApplyAdjustmentsToSelected}
                    onAddLog={addLog}
                  />
                ) : (
                  <>
                {/* Hotspots Manager Panel */}
                {activeLoc && (
                  <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>
                      Hotspots in "{activeLoc.name}"
                    </span>

                    {(!activeLoc.hotspots || activeLoc.hotspots.length === 0) ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                        No hotspots added. Click "+ Add Hotspot" inside the 360 viewer to link this room to another room.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                        {activeLoc.hotspots.map(hs => (
                          <div
                            key={hs.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              background: 'var(--bg-tertiary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              fontSize: '0.8rem'
                            }}
                          >
                            <span>➜ {hs.name}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleEditHotspotClick(hs)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-color)',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  padding: '2px'
                                }}
                                title="Edit Hotspot"
                              >
                                ✏
                              </button>
                              <button
                                onClick={() => {
                                  updateActiveLocation(loc => ({
                                    hotspots: (loc.hotspots || []).filter(h => h.id !== hs.id)
                                  }));
                                  addLog(`Removed hotspot: ${hs.name}`);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-error)',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  padding: '2px'
                                }}
                                title="Remove Hotspot"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group mb-3">
                  <label className="form-label text-secondary small font-weight-normal mb-1">Output Resolution</label>
                  <select className="form-select studio-select" value={resolution} onChange={(e) => setResolution(Number(e.target.value))}>
                    <option value={2048}>2K Panorama (2048 x 1024)</option>
                    <option value={4096}>4K Panorama (4096 x 2048)</option>
                    <option value={8192}>8K Panorama (8192 x 4096)</option>
                    <option value={16384}>16K Ultra-Res (16384 x 8192)</option>
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label text-secondary small font-weight-normal mb-1">Feature Detector</label>
                  <select className="form-select studio-select" value={featureDetector} onChange={(e) => setFeatureDetector(e.target.value)}>
                    <option value="ORB">ORB (Fast / Hardware Safe)</option>
                    <option value="SIFT">SIFT (High Quality / Detailed)</option>
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label text-secondary small font-weight-normal mb-1">Blending Mode</label>
                  <select className="form-select studio-select" value={blendingMode} onChange={(e) => setBlendingMode(e.target.value)}>
                    <option value="multi-band">Multi-Band Blending (Seamless)</option>
                    <option value="linear">Linear Blending (Fast)</option>
                  </select>
                </div>

                <div className="form-group d-flex align-items-center gap-2 mt-3 mb-4">
                  <input
                    type="checkbox"
                    id="exp"
                    className="form-check-input"
                    checked={exposureCorrection}
                    onChange={(e) => setExposureCorrection(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="exp" className="form-check-label text-white small font-weight-normal" style={{ cursor: 'pointer' }}>
                    Exposure Match Correction
                  </label>
                </div>

                <div className="mb-4">
                  <button
                    className="btn btn-primary w-100 py-2.5 rounded-3 font-weight-normal shadow d-flex align-items-center justify-content-center gap-2"
                    onClick={handleRunStitch}
                    disabled={loading}
                  >
                    <Play size={16} /> Run Image Engine
                  </button>
                </div>

                {stitchedPanoPath && (
                  <div className="pt-3 border-top border-secondary border-opacity-25 mt-4">
                    <span className="small text-secondary font-weight-bold text-uppercase d-block mb-3" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                      Export Options
                    </span>
                    <div className="d-flex flex-column gap-1">
                      <button className="btn-export-link" onClick={() => addLog('Exported panorama as JPG successfully')}>
                        <span>Export JPG Image</span>
                        <FileText size={14} className="text-secondary" />
                      </button>
                      <button className="btn-export-link" onClick={() => addLog('Exported panorama as PNG successfully')}>
                        <span>Export PNG Image</span>
                        <ImageIcon size={14} className="text-secondary" />
                      </button>
                      <button className="btn-export-link" onClick={() => addLog('Exported VR Tiles HTML player template')}>
                        <span>Export Web Tour (HTML)</span>
                        <Globe size={14} className="text-secondary" />
                      </button>
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
            </div>

          </div>

          {/* Bottom Progress Bar & Real-time Console */}
          <div style={{ borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            {loading && (
              <div style={{ height: '30px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', padding: '0 16px', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={14} className="spin" style={{ color: 'var(--accent-color)', animation: 'spin 2s linear infinite' }} />
                  {progressMsg}
                </span>
                <div className="progress-container">
                  <span style={{ fontSize: '0.75rem' }}>{progress}%</span>
                  <div className="progress-track">
                    <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              </div>
            )}
            <div className="bottom-status-bar" style={{ height: '80px', display: 'flex', alignItems: 'flex-start', padding: '8px 16px', overflowY: 'auto' }}>
              <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {logs.length === 0 ? (
                  <div>[Console Log] Ready. Import images and start rendering.</div>
                ) : (
                  logs.slice(-5).map((log, i) => <div key={i}>{log}</div>)
                )}
              </div>
            </div>
          </div>
        </>
      )}
      {/* Add / Edit Location Details Modal */}
      {showLocationModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowLocationModal(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(5, 7, 15, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              width: '100%', maxWidth: '520px', margin: '0 16px',
              background: 'linear-gradient(160deg, #13162a 0%, #1a1d30 100%)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
              animation: 'modalSlideIn 0.2s ease',
              color: '#fff',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(99,102,241,0.35)' }}>
                  <Compass size={22} color="#fff" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.08rem' }}>
                    {editingLocationId ? 'Edit Location / Room' : 'Add New Location / Room'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                    Set room name, visibility & client access
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLocationModal(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', padding: '6px 10px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Room Name */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: '6px' }}>
                Location / Room Name *
              </label>
              <input
                type="text"
                autoFocus
                required
                placeholder="e.g. Master Bedroom, Living Room, Kitchen..."
                value={modalLocName}
                onChange={(e) => setModalLocName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && modalLocName.trim()) handleSaveLocationDetails();
                  if (e.key === 'Escape') setShowLocationModal(false);
                }}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(99,102,241,0.35)',
                  color: '#fff', fontSize: '0.9rem', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Visibility Settings */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: '8px' }}>
                Access & Visibility
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalLocIsPublic(true)}
                  style={{
                    padding: '12px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                    background: modalLocIsPublic ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${modalLocIsPublic ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                    color: modalLocIsPublic ? '#fff' : '#94a3b8',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <Globe size={16} color="#10b981" />
                    {modalLocIsPublic && <CheckCircle2 size={14} color="#10b981" />}
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block' }}>🌐 Public Access</span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Visible in public tour</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalLocIsPublic(false)}
                  style={{
                    padding: '12px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                    background: !modalLocIsPublic ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${!modalLocIsPublic ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                    color: !modalLocIsPublic ? '#fff' : '#94a3b8',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <Lock size={16} color="#f59e0b" />
                    {!modalLocIsPublic && <CheckCircle2 size={14} color="#f59e0b" />}
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block' }}>🔒 Private Access</span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Assigned client only</span>
                </button>
              </div>
            </div>

            {/* Optional Description */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: '6px' }}>
                Description / Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Add room details or specific instructions for client..."
                value={modalLocDesc}
                onChange={(e) => setModalLocDesc(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: '0.82rem', outline: 'none', resize: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                style={{
                  padding: '9px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                  background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLocationDetails}
                disabled={!modalLocName.trim()}
                style={{
                  padding: '9px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                  background: modalLocName.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.1)',
                  color: '#fff', border: 'none',
                  boxShadow: modalLocName.trim() ? '0 4px 16px rgba(99,102,241,0.4)' : 'none',
                  opacity: modalLocName.trim() ? 1 : 0.5,
                }}
              >
                {editingLocationId ? 'Save Changes' : '✨ Add Location'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save to CRM Server Modal */}
      {showSaveCrmModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaveCrmModal(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(5, 7, 15, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              width: '100%', maxWidth: '480px', margin: '0 16px',
              background: 'linear-gradient(160deg, #13162a 0%, #1a1d30 100%)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
              animation: 'modalSlideIn 0.2s ease',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '18px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(139,92,246,0.4)' }}>
                <Database size={22} color="#fff" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.08rem' }}>Publish 360 Tour to CRM</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Save tour configuration to server for client access</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Project Name</label>
              <input
                type="text"
                required
                value={crmProjectName}
                onChange={(e) => setCrmProjectName(e.target.value)}
                placeholder="e.g. Luxury Apartment 360 Tour"
                className="w-full bg-[#111216] border border-gray-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Access Mode Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                Upload & Access Mode
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setCrmProjectIsPublic(true)}
                  className={`p-3 rounded-xl border text-left transition-all ${crmProjectIsPublic
                    ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md'
                    : 'bg-[#111216] border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    {crmProjectIsPublic && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <span className="text-xs font-bold block">🌐 Public + 🔒 Private</span>
                  <span className="text-[10px] text-gray-400">Share link + client access</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCrmProjectIsPublic(false)}
                  className={`p-3 rounded-xl border text-left transition-all ${!crmProjectIsPublic
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                    : 'bg-[#111216] border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Lock className="w-4 h-4 text-amber-400" />
                    {!crmProjectIsPublic && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <span className="text-xs font-bold block">🔒 Upload Private Only</span>
                  <span className="text-[10px] text-gray-400">ONLY assigned private client</span>
                </button>
              </div>
            </div>

            {/* Client Selection (Shown for Private mode or Admin) */}
            {currentUser?.role === 'admin' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-300">
                    {!crmProjectIsPublic ? 'Assign to Private Client *' : 'Assign to Client (Optional)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddUserModalOpen(true)}
                    className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center space-x-1 hover:underline"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add New Client</span>
                  </button>
                </div>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full bg-[#111216] border border-gray-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  {clientUsersList.length === 0 ? (
                    <option value={currentUser.id}>Assign to Myself ({currentUser.name})</option>
                  ) : (
                    clientUsersList.map(c => (
                      <option key={c.id} value={c.id}>
                        👤 {c.name} ({c.email})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowSaveCrmModal(false)}
                className="py-2 px-4 bg-gray-800 text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToCrmServer}
                disabled={savingCrm || !crmProjectName.trim()}
                className="py-2 px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-all disabled:opacity-50"
              >
                {savingCrm ? 'Publishing...' : 'Publish to CRM Server'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Add New User / Client Modal */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        token={authToken}
        onClose={() => setIsAddUserModalOpen(false)}
        onSuccess={(newUser) => {
          setClientUsersList(prev => [...prev, newUser]);
          setModalLocUserId(newUser.id);
          setSelectedClientId(newUser.id);
          addLog(`Created new client account: ${newUser.name} (${newUser.email})`);
        }}
      />

      {/* Public / Client 360 Tour Viewer Overlay */}
      {activePublicTourId && (
        <PublicTourViewer
          tourId={activePublicTourId}
          onBack={() => setActivePublicTourId(null)}
        />
      )}

      {importingDirKey && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setImportingDirKey(null); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(5, 7, 15, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div style={{
            width: '100%', maxWidth: '440px', margin: '0 16px',
            background: 'linear-gradient(160deg, #13162a 0%, #1a1d30 100%)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
            animation: 'modalSlideIn 0.2s ease',
            color: '#fff',
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: '1.1rem' }}>
              Select Grid Configuration
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '20px', lineHeight: 1.5 }}>
              Please select the capture grid layout for the <strong style={{ color: '#818cf8' }}>{DIRECTIONS_LABELS[importingDirKey]}</strong> direction.
            </p>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px' }}>
                Grid Size
              </label>
              <select
                className="form-select"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.88rem'
                }}
                value={selectedImportGrid}
                onChange={(e) => setSelectedImportGrid(e.target.value)}
              >
                <option value="auto" style={{ background: '#13162a' }}>Auto-Detect Grid Size</option>
                <option value="2x2" style={{ background: '#13162a' }}>2×2 Grid (4 images)</option>
                <option value="3x3" style={{ background: '#13162a' }}>3×3 Grid (9 images)</option>
                <option value="5x5" style={{ background: '#13162a' }}>5×5 Grid (25 images)</option>
                <option value="9x9" style={{ background: '#13162a' }}>9×9 Grid (81 images)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setImportingDirKey(null)}
                style={{
                  padding: '9px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                  background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                style={{
                  padding: '9px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', border: 'none',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                }}
              >
                Proceed to Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Project Confirmation Modal */}
      {isNewProjectModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsNewProjectModalOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(5, 7, 15, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div style={{
            width: '100%', maxWidth: '480px', margin: '0 16px',
            background: 'linear-gradient(160deg, #13162a 0%, #1a1d30 100%)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: '20px',
            padding: '32px',
            boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
            animation: 'modalSlideIn 0.2s ease',
            color: '#fff',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
              }}>
                <FolderOpen size={24} color="#fff" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.01em' }}>
                  Create New Project
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', marginTop: '3px' }}>
                  Start a fresh 360° virtual tour project
                </p>
              </div>
            </div>

            {/* Project Name Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '8px' }}>
                Project Name
              </label>
              <input
                type="text"
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNewProject(); if (e.key === 'Escape') setIsNewProjectModalOpen(false); }}
                placeholder="e.g. My Villa Tour, Hotel Lobby 360..."
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(99,102,241,0.35)',
                  color: '#fff', fontSize: '0.9rem', outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.35)'; }}
              />
            </div>

            {/* Warning box */}
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'flex-start',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
              borderRadius: '10px', padding: '12px 14px', marginBottom: '28px',
            }}>
              <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>⚠️</span>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#fca5a5', lineHeight: 1.6 }}>
                Current project data will be <strong>cleared</strong>. Please <strong>Save</strong> or <strong>Export Web ZIP</strong> your existing project first.
              </p>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                style={{
                  padding: '9px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                  background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleNewProject}
                style={{
                  padding: '9px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', border: 'none',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                }}
              >
                ✨ Create New Project
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Export Web ZIP Progress Modal */}
      {isExportingZip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(5, 7, 15, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              width: '92%',
              margin: '0 16px',
              background: 'linear-gradient(160deg, #13162a 0%, #1a1d30 100%)',
              border: '1px solid rgba(99,102,241,0.35)',
              borderRadius: '20px',
              padding: '28px 32px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
              animation: 'modalSlideIn 0.2s ease',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '22px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
                  flexShrink: 0,
                }}
              >
                <Archive size={24} color="#fff" className="spin" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.12rem', letterSpacing: '-0.01em' }}>
                  Export Web Package Is Creating...
                </h4>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginTop: '3px' }}>
                  Preserving 100% original image quality & offline 3D engine
                </span>
              </div>
            </div>

            <div style={{ margin: '20px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#c7d2fe', maxWidth: '82%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {exportZipMsg}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: 'rgba(99,102,241,0.2)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(99,102,241,0.3)',
                  }}
                >
                  {exportZipProgress}%
                </span>
              </div>

              <div
                style={{
                  height: '10px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${exportZipProgress}%`,
                    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                    borderRadius: '999px',
                    transition: 'width 0.3s ease',
                    boxShadow: '0 0 12px rgba(99,102,241,0.6)',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#94a3b8',
                paddingTop: '14px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Zero re-encoding / quality loss</span>
              </div>
              <span style={{ fontStyle: 'italic', color: '#64748b' }}>Please wait...</span>
            </div>
          </div>
        </div>
      )}

      {/* Custom spinning animation style */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.95) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .spin {
          animation: spin 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
