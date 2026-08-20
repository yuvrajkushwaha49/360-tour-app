import React, { useState, useEffect } from 'react';
import {
  Compass,
  Share2,
  ExternalLink,
  Lock,
  Globe,
  Trash2,
  Eye,
  PlusCircle,
  Search,
  Check,
  Building2,
  Layers,
  UserCheck,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  Users,
  UserPlus,
  Mail,
  Shield,
  Crown,
  Edit3,
  X,
  Archive
} from 'lucide-react';
import { exportProjectToZip } from '../utils/exportZip';
import { API_BASE_URL } from '../utils/apiConfig';
import { loadLargeDraft } from '../utils/dbStorage';

interface ProjectItem {
  id: string;
  user_id: string;
  name: string;
  client_name?: string;
  client_email?: string;
  is_public: boolean;
  is_draft?: boolean;
  created_at?: string;
  data: {
    description?: string;
    locations?: any[];
    activeLocationId?: string;
    resolution?: number;
    [key: string]: any;
  };
}

// Helper to determine if a 360 virtual tour project has all faces/stitched pano completed
export function isProjectCompleted(project: ProjectItem): boolean {
  if (project.is_draft) return false;
  const locations = project.data?.locations || [];
  if (locations.length === 0) return false;

  for (const loc of locations) {
    if (loc.stitchedPanoPath) continue;
    const dirs = loc.directions || {};
    const faces = ['F', 'B', 'L', 'R', 'U', 'D'];
    const hasAnyFace = faces.some(face => dirs[face] && dirs[face].length > 0);
    if (!hasAnyFace) return false;
  }
  return true;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ClientDashboardProps {
  user: { id: string; name: string; email: string; role: string };
  token: string;
  onOpenProject: (project: ProjectItem) => void;
  onBackToStudio?: () => void;
  onCreateNewProject?: () => void;
  onOpenAddUserModal?: () => void;
  onLaunchPublicView: (tourId: string) => void;
  onLogout?: () => void;
}

export default function ClientDashboard({
  user,
  token,
  onOpenProject,
  onBackToStudio,
  onCreateNewProject,
  onOpenAddUserModal,
  onLaunchPublicView,
  onLogout
}: ClientDashboardProps) {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'public' | 'private'>('all');
  const [activeDashboardTab, setActiveDashboardTab] = useState<'projects' | 'users'>('projects');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit Project Modal States (Admin Only)
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editTargetUserId, setEditTargetUserId] = useState<string>('');
  const [editIsPublic, setEditIsPublic] = useState<boolean>(true);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [exportProgressMsg, setExportProgressMsg] = useState<string | null>(null);
  const [exportPercent, setExportPercent] = useState<number>(0);

  const handleExportZip = async (project: ProjectItem) => {
    try {
      setExportProgressMsg('Preparing standalone package...');
      setExportPercent(5);
      await exportProjectToZip(project, (msg, pct) => {
        setExportProgressMsg(msg);
        setExportPercent(pct);
      });
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setTimeout(() => {
        setExportProgressMsg(null);
        setExportPercent(0);
      }, 800);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, [token]);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    let serverProjects: ProjectItem[] = [];

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401 || response.status === 403) {
        if (onLogout) {
          onLogout();
          return;
        }
      }
      if (response.ok) {
        serverProjects = await response.json();
      }
    } catch (err: any) {
      console.warn('Server project fetch error, falling back to local registry:', err);
    }

    // Merge with local projects and in-progress drafts ONLY if current user is Admin!
    let localList: ProjectItem[] = [];
    if (user.role === 'admin') {
      try {
        const localStr = localStorage.getItem('local_saved_projects');
        if (localStr) localList = JSON.parse(localStr);
      } catch (e) {}

      // Check for current in-progress unsaved Studio Draft
      try {
        const draft = await loadLargeDraft<any>('studio_draft_project');
        if (draft && draft.locations && draft.locations.length > 0) {
          const draftProject: ProjectItem = {
            id: 'studio-draft-in-progress',
            user_id: user.id,
            name: draft.projectDir ? `${draft.projectDir} (Unfinished Draft)` : 'Unfinished 360 Studio Draft',
            is_public: false,
            is_draft: true,
            created_at: new Date(draft.lastUpdated || Date.now()).toISOString(),
            data: {
              description: '⚡ In-progress draft currently being stitched/configured in Studio Mode.',
              locations: draft.locations,
              activeLocationId: draft.activeLocationId,
              resolution: draft.resolution
            }
          };
          const alreadyExists = localList.some(lp => lp.id === draftProject.id || lp.name === draftProject.name);
          if (!alreadyExists) {
            localList.unshift(draftProject);
          }
        }
      } catch (e) {}
    }

    const combined = [...serverProjects];
    if (user.role === 'admin') {
      localList.forEach(lp => {
        const exists = combined.some(sp => sp.id === lp.id || sp.name === lp.name);
        if (!exists) {
          combined.push(lp);
        }
      });
    }

    setProjects(combined);
    setLoading(false);
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsersList(data);
      } else if (response.status === 401 || response.status === 403) {
        if (onLogout) {
          onLogout();
          return;
        }
        setError('Your authentication token has expired or is invalid (403 Forbidden). Please sign out and log in again.');
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleOpenEditModal = (project: ProjectItem) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.data?.description || '');
    setEditTargetUserId(project.user_id || '');
    setEditIsPublic(project.is_public);
  };

  const handleSaveProjectDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim()) return;

    setIsSavingEdit(true);
    const updatedData = {
      ...editingProject.data,
      description: editDescription.trim()
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName.trim(),
          data: updatedData,
          is_public: editIsPublic,
          target_user_id: editTargetUserId || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update project details');
      }

      const assignedUser = usersList.find(u => u.id === editTargetUserId);

      // Update state locally
      setProjects(prev => prev.map(p => {
        if (p.id === editingProject.id) {
          return {
            ...p,
            name: editName.trim(),
            user_id: editTargetUserId || p.user_id,
            client_name: assignedUser ? assignedUser.name : p.client_name,
            client_email: assignedUser ? assignedUser.email : p.client_email,
            is_public: editIsPublic,
            data: updatedData
          };
        }
        return p;
      }));

      setCopiedId(`edited-${editingProject.id}`);
      setEditingProject(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const togglePublic = async (project: ProjectItem) => {
    const newIsPublic = !project.is_public;
    const updatedData = { ...project.data };
    if (!newIsPublic && updatedData.locations) {
      updatedData.locations = updatedData.locations.map((loc: any) => ({
        ...loc,
        isPublic: false,
        hotspots: (loc.hotspots || []).map((hs: any) => ({ ...hs, isPublic: false }))
      }));
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: project.name,
          data: updatedData,
          is_public: newIsPublic
        })
      });

      if (response.ok) {
        setProjects(prev =>
          prev.map(p => p.id === project.id ? { ...p, is_public: newIsPublic, data: updatedData } : p)
        );
      }
    } catch (err) {
      console.error('Failed to toggle public state:', err);
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this 360 tour project?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Failed to delete project on server:', err);
    }
    setProjects(prev => prev.filter(p => p.id !== id));
    try {
      const localStr = localStorage.getItem('local_saved_projects');
      if (localStr) {
        const list = JSON.parse(localStr).filter((p: any) => p.id !== id);
        localStorage.setItem('local_saved_projects', JSON.stringify(list));
      }
    } catch (e) {}
  };

  const copyShareLink = (tourId: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
    const url = `${base}/api/tours/${tourId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(tourId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const completedCount = projects.filter(p => isProjectCompleted(p)).length;
  const draftCount = projects.filter(p => !isProjectCompleted(p)).length;

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.client_name && p.client_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.data?.description && p.data.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (filterTab === 'completed') return matchesSearch && isProjectCompleted(p);
    if (filterTab === 'draft') return matchesSearch && !isProjectCompleted(p);
    if (filterTab === 'public') return matchesSearch && p.is_public;
    if (filterTab === 'private') return matchesSearch && !p.is_public;
    return matchesSearch;
  });

  const filteredUsers = usersList.filter(u =>
    u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const totalRooms = projects.reduce((acc, proj) => acc + (proj.data?.locations?.length || 0), 0);

  return (
    <div className="dashboard-container">
      {/* Export Web ZIP Progress Modal */}
      {exportProgressMsg && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-75 backdrop-blur-md d-flex align-items-center justify-content-center z-50 p-4">
          <div className="bg-dark p-4 rounded-4 border border-secondary border-opacity-50 text-white max-w-md w-100 shadow-2xl text-center">
            <div className="p-3 bg-success bg-opacity-15 border border-success border-opacity-30 rounded-circle text-success mx-auto mb-3 d-inline-flex">
              <Archive size={36} />
            </div>
            <h3 className="h5 font-weight-normal mb-1">Exporting Standalone Web Package</h3>
            <p className="small text-secondary mb-3">{exportProgressMsg}</p>
            <div className="progress bg-secondary bg-opacity-25 mb-2" style={{ height: '8px' }}>
              <div
                className="progress-bar bg-success progress-bar-striped progress-bar-animated"
                role="progressbar"
                style={{ width: `${exportPercent}%` }}
              ></div>
            </div>
            <div className="small text-secondary font-mono">{exportPercent}% Completed</div>
          </div>
        </div>
      )}

      {/* Hero Header Banner */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-glow-1"></div>
        <div className="dashboard-hero-glow-2"></div>

        <div className="position-relative z-1 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-4">
          <div>
            <span className="badge bg-primary bg-opacity-20 text-indigo-300 border border-primary border-opacity-30 px-3 py-2 rounded-pill uppercase tracking-wider small font-weight-normal mb-3 d-inline-flex align-items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-primary" />
              <span>Welcome, {user.name} ({user.role.toUpperCase()})</span>
            </span>
            <h1 className="display-6 hero-title-gradient mb-2">
              360° Virtual Tour CRM Portal
            </h1>
            <p className="text-secondary small max-w-2xl leading-relaxed mb-0 font-weight-normal">
              {user.role === 'admin'
                ? 'Manage all registered client accounts, edit project names & descriptions, preview HD 360° tours, and publish projects.'
                : 'Explore your custom assigned 360° virtual tours interactively or share public tour links with clients.'}
            </p>
          </div>

          {user.role === 'admin' && (
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {onBackToStudio && (
                <button
                  onClick={onBackToStudio}
                  className="btn btn-secondary text-white rounded-3 px-4 py-2.5 small font-weight-normal d-flex align-items-center gap-2 shadow-sm"
                  title="Go Back to 360 Studio Editor"
                >
                  <ArrowLeft className="w-4 h-4 text-info" />
                  <span>Back to Studio</span>
                </button>
              )}

              {onOpenAddUserModal && (
                <button
                  onClick={onOpenAddUserModal}
                  className="btn btn-warning text-dark font-weight-normal rounded-3 px-4 py-2.5 small d-flex align-items-center gap-2 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Create Client / User</span>
                </button>
              )}

              {onCreateNewProject && (
                <button
                  onClick={onCreateNewProject}
                  className="btn btn-primary font-weight-normal rounded-3 px-4 py-2.5 small d-flex align-items-center gap-2 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create New Project</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats Summary Cards (Admin Panel Only) */}
      {user.role === 'admin' && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-lg">
            <div
              onClick={() => setActiveDashboardTab('projects')}
              className={`kpi-card cursor-pointer ${activeDashboardTab === 'projects' ? 'active-indigo' : ''}`}
            >
              <div>
                <span className="small text-secondary font-weight-normal text-uppercase tracking-wider d-block mb-1">Total Tours</span>
                <span className="h3 font-weight-normal text-white mb-0">{projects.length}</span>
              </div>
              <div className="kpi-icon-box bg-primary bg-opacity-20 text-primary border border-primary border-opacity-30">
                <Compass className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg">
            <div
              onClick={() => setActiveDashboardTab('users')}
              className={`kpi-card cursor-pointer ${activeDashboardTab === 'users' ? 'active-amber' : ''}`}
            >
              <div>
                <span className="small text-secondary font-weight-normal text-uppercase tracking-wider d-block mb-1">Total Users</span>
                <span className="h3 font-weight-normal text-warning mb-0">{usersList.length}</span>
              </div>
              <div className="kpi-icon-box bg-warning bg-opacity-20 text-warning border border-warning border-opacity-30">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg">
            <div className="kpi-card">
              <div>
                <span className="small text-secondary font-weight-normal text-uppercase tracking-wider d-block mb-1">Public Tours</span>
                <span className="h3 font-weight-normal text-success mb-0">{projects.filter(p => p.is_public).length}</span>
              </div>
              <div className="kpi-icon-box bg-success bg-opacity-20 text-success border border-success border-opacity-30">
                <Globe className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg">
            <div className="kpi-card">
              <div>
                <span className="small text-secondary font-weight-normal text-uppercase tracking-wider d-block mb-1">Private Tours</span>
                <span className="h3 font-weight-normal text-warning mb-0">{projects.filter(p => !p.is_public).length}</span>
              </div>
              <div className="kpi-icon-box bg-warning bg-opacity-20 text-warning border border-warning border-opacity-30">
                <Lock className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg">
            <div className="kpi-card">
              <div>
                <span className="small text-secondary font-weight-normal text-uppercase tracking-wider d-block mb-1">360° Rooms</span>
                <span className="h3 font-weight-normal text-info mb-0">{totalRooms}</span>
              </div>
              <div className="kpi-icon-box bg-info bg-opacity-20 text-info border border-info border-opacity-30">
                <Layers className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard Navigation Bar: All Projects vs All Users */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4 pb-3 border-bottom border-secondary border-opacity-25">
        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => setActiveDashboardTab('projects')}
            className={`nav-tab-btn d-flex align-items-center gap-2 ${
              activeDashboardTab === 'projects' ? 'active-tab-projects' : 'btn-outline-secondary text-secondary'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>All 360° Projects ({projects.length})</span>
          </button>

          {user.role === 'admin' && (
            <button
              onClick={() => setActiveDashboardTab('users')}
              className={`nav-tab-btn d-flex align-items-center gap-2 ${
                activeDashboardTab === 'users' ? 'active-tab-users' : 'btn-outline-secondary text-secondary'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>All Registered Users ({usersList.length})</span>
            </button>
          )}
        </div>

        {user.role === 'admin' && onOpenAddUserModal && (
          <button
            onClick={onOpenAddUserModal}
            className="btn btn-outline-warning rounded-3 px-3 py-2 small font-weight-normal d-flex align-items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add New User / Client</span>
          </button>
        )}
      </div>

      {/* VIEW CONTENT 1: ALL REGISTERED USERS */}
      {activeDashboardTab === 'users' ? (
        <div>
          {/* User Search Bar */}
          <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mb-4 bg-dark bg-opacity-60 p-3 rounded-4 border border-secondary border-opacity-25">
            <div className="position-relative w-100 max-w-md">
              <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary w-4 h-4" />
              <input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="form-control search-input-box"
              />
            </div>

            <div className="small text-secondary font-weight-normal text-uppercase">
              Showing {filteredUsers.length} of {usersList.length} User Account{usersList.length !== 1 ? 's' : ''}
            </div>
          </div>

          {usersLoading ? (
            <div className="py-5 text-center text-secondary">
              <div className="spinner-border text-warning mb-3" role="status"></div>
              <p className="small font-weight-normal">Loading User Accounts...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-5 text-center bg-dark bg-opacity-50 border border-secondary border-opacity-25 rounded-4 p-4 max-w-md mx-auto">
              <Users className="w-12 h-12 text-secondary mx-auto mb-3" />
              <h3 className="h6 font-weight-normal text-white mb-1">No Users Found</h3>
              <p className="small text-secondary mb-0">No user accounts match your search query.</p>
            </div>
          ) : (
            <div className="row g-4">
              {filteredUsers.map((usr) => {
                const assignedCount = projects.filter(p => p.user_id === usr.id).length;
                const isAdmin = usr.role === 'admin';

                return (
                  <div key={usr.id} className="col-12 col-md-6 col-lg-4">
                    <div className="user-card h-100 d-flex flex-column justify-between">
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                          <div className="d-flex align-items-center gap-3">
                            <div className={`user-avatar ${isAdmin ? 'bg-warning text-dark' : 'bg-primary text-white'}`}>
                              {usr.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="h6 font-weight-normal text-white mb-0">{usr.name}</h3>
                              <span className="small text-secondary font-mono">ID: {usr.id}</span>
                            </div>
                          </div>

                          {isAdmin ? (
                            <span className="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25 px-2.5 py-1.5 rounded-pill small font-weight-normal">
                              <Crown className="w-3.5 h-3.5 me-1" />
                              <span>Admin</span>
                            </span>
                          ) : (
                            <span className="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25 px-2.5 py-1.5 rounded-pill small font-weight-normal">
                              <UserCheck className="w-3.5 h-3.5 me-1" />
                              <span>Client</span>
                            </span>
                          )}
                        </div>

                        <div className="bg-dark bg-opacity-60 p-3 rounded-3 border border-secondary border-opacity-25 mb-3">
                          <div className="d-flex align-items-center gap-2 small text-secondary mb-2">
                            <Mail className="w-4 h-4 text-secondary shrink-0" />
                            <span className="text-truncate">{usr.email}</span>
                          </div>
                          <div className="d-flex align-items-center justify-content-between small pt-2 border-top border-secondary border-opacity-25">
                            <span className="text-secondary font-weight-normal">Assigned Tours:</span>
                            <span className="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-30 font-weight-normal">
                              {assignedCount} Project{assignedCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-top border-secondary border-opacity-25">
                        <span className="small text-secondary font-weight-normal text-uppercase d-block mb-2">Assigned 360 Tours</span>
                        {assignedCount === 0 ? (
                          <span className="small text-secondary italic">No assigned projects yet</span>
                        ) : (
                          <div className="d-flex flex-column gap-1 max-h-24 overflow-y-auto">
                            {projects.filter(p => p.user_id === usr.id).map(p => (
                              <div
                                key={p.id}
                                onClick={() => onLaunchPublicView(p.id)}
                                className="small text-secondary bg-dark p-2 rounded-3 border border-secondary border-opacity-25 d-flex align-items-center justify-content-between cursor-pointer"
                              >
                                <span className="text-truncate font-weight-normal">{p.name}</span>
                                <Eye className="w-3.5 h-3.5 text-primary ms-1" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* VIEW CONTENT 2: ALL 360° PROJECTS */
        <div>
          {/* Search Bar & Filter Tabs */}
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
            <div className="position-relative w-100 max-w-md">
              <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary w-4 h-4" />
              <input
                type="text"
                placeholder="Search virtual tours by name, client, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-control search-input-box"
              />
            </div>

            <div className="btn-group rounded-3 p-1 bg-dark border border-secondary border-opacity-25 flex-wrap">
              <button
                onClick={() => setFilterTab('all')}
                className={`btn btn-sm ${filterTab === 'all' ? 'btn-primary font-weight-normal' : 'btn-dark text-secondary'}`}
              >
                All Projects ({projects.length})
              </button>
              <button
                onClick={() => setFilterTab('completed')}
                className={`btn btn-sm ${filterTab === 'completed' ? 'btn-success font-weight-normal' : 'btn-dark text-secondary'}`}
              >
                ✅ Completed ({completedCount})
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => setFilterTab('draft')}
                  className={`btn btn-sm ${filterTab === 'draft' ? 'btn-danger font-weight-normal' : 'btn-dark text-secondary'}`}
                >
                  📝 Drafts / Incomplete ({draftCount})
                </button>
              )}
              <button
                onClick={() => setFilterTab('private')}
                className={`btn btn-sm ${filterTab === 'private' ? 'btn-warning text-dark font-weight-normal' : 'btn-dark text-secondary'}`}
              >
                <Lock className="w-3.5 h-3.5 me-1" /> Private
              </button>
              <button
                onClick={() => setFilterTab('public')}
                className={`btn btn-sm ${filterTab === 'public' ? 'btn-info font-weight-normal text-white' : 'btn-dark text-secondary'}`}
              >
                <Globe className="w-3.5 h-3.5 me-1" /> Public
              </button>
            </div>
          </div>

          {/* Projects Grid */}
          <div>
            {loading ? (
              <div className="py-5 text-center text-secondary">
                <div className="spinner-border text-primary mb-3" role="status"></div>
                <p className="small font-weight-normal">Loading 360° Virtual Tour Projects...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-4 text-danger text-center max-w-md mx-auto">
                <h3 className="h6 font-weight-normal mb-1">⚠️ Connection Error</h3>
                <p className="small mb-3">{error}</p>
                {onLogout && (
                  <button onClick={onLogout} className="btn btn-sm btn-danger rounded-3">
                    Sign Out & Re-Login
                  </button>
                )}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="py-5 text-center bg-dark bg-opacity-50 border border-secondary border-opacity-25 rounded-4 p-4 max-w-md mx-auto">
                <Compass className="w-12 h-12 text-secondary mx-auto mb-3" />
                <h3 className="h6 font-weight-normal text-white mb-1">No 360° Tours Found</h3>
                <p className="small text-secondary mb-0">No virtual tour projects match your search query.</p>
              </div>
            ) : (
              <div className="row g-4">
                {filteredProjects.map((project) => {
                  const locationCount = project.data?.locations?.length || 0;

                  return (
                    <div key={project.id} className="col-12 col-md-6 col-lg-4">
                      <div className="project-card h-100">
                        {/* Card Header / Preview */}
                        <div className="project-card-header">
                          <div className="text-center position-relative z-1">
                            <div className="kpi-icon-box bg-primary bg-opacity-25 text-primary border border-primary border-opacity-30 mx-auto mb-2 shadow">
                              <Compass className="w-7 h-7" />
                            </div>
                            <span className="badge bg-dark bg-opacity-80 text-white border border-secondary border-opacity-25 rounded-pill px-3 py-1.5 small font-weight-normal">
                              {locationCount} Room{locationCount !== 1 ? 's' : ''} Configured
                            </span>
                          </div>

                          <div className="position-absolute top-0 start-0 m-3 z-2 d-flex gap-1.5 flex-wrap">
                            {!isProjectCompleted(project) ? (
                              <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-30 rounded-pill px-2.5 py-1.5 font-weight-normal">
                                📝 Incomplete Draft
                              </span>
                            ) : (
                              <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-30 rounded-pill px-2.5 py-1.5 font-weight-normal">
                                ✅ Ready
                              </span>
                            )}

                            {project.is_public ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (user.role === 'admin') togglePublic(project);
                                }}
                                className="badge bg-info bg-opacity-25 text-info border border-info border-opacity-30 rounded-pill px-2.5 py-1.5 cursor-pointer text-decoration-none font-weight-normal"
                              >
                                🌐 Public
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (user.role === 'admin') togglePublic(project);
                                }}
                                className="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-30 rounded-pill px-2.5 py-1.5 cursor-pointer text-decoration-none font-weight-normal"
                              >
                                🔒 Private
                              </button>
                            )}
                          </div>

                          {/* Hover Launch Overlay */}
                          <div
                            onClick={() => {
                              if (!isProjectCompleted(project)) {
                                onOpenProject(project);
                              } else {
                                onLaunchPublicView(project.id);
                              }
                            }}
                            className="project-card-header-overlay cursor-pointer"
                          >
                            <button className="btn btn-primary font-weight-normal rounded-3 px-4 py-2 small shadow-lg d-flex align-items-center gap-2">
                              <Eye className="w-4 h-4" />
                              <span>{!isProjectCompleted(project) ? '✏️ Resume in Studio' : 'Launch 360° Viewer'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="project-card-body">
                          <div>
                            <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                              <h3 className="h5 font-weight-normal text-white mb-0">{project.name}</h3>
                              {user.role === 'admin' && (
                                <button
                                  onClick={() => handleOpenEditModal(project)}
                                  className="btn btn-sm btn-outline-primary py-1 px-2.5 rounded-3 small shrink-0 d-flex align-items-center gap-1 font-weight-normal"
                                  title="Edit Title & Description"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>

                            {project.data?.description && (
                              <p className="small text-secondary fst-italic bg-dark p-2.5 rounded-3 border border-secondary border-opacity-25 mb-2">
                                "{project.data.description}"
                              </p>
                            )}

                            {project.client_name && (
                              <p className="small text-secondary mb-0">
                                Client: <strong className="text-white font-weight-normal">{project.client_name}</strong>
                              </p>
                            )}
                          </div>

                          <div className="pt-3 border-top border-secondary border-opacity-25 d-flex align-items-center justify-content-between gap-2 mt-3">
                            <div className="d-flex align-items-center gap-2">
                              <button
                                onClick={() => onLaunchPublicView(project.id)}
                                className="btn btn-sm btn-primary rounded-3 px-3 d-flex align-items-center gap-1 font-weight-normal"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View 360°</span>
                              </button>

                              {user.role === 'admin' && (
                                <button
                                  onClick={() => onOpenProject(project)}
                                  className="btn btn-sm btn-outline-secondary text-white rounded-3 px-3 d-flex align-items-center gap-1"
                                >
                                  <Compass className="w-3.5 h-3.5 text-info" />
                                  <span>Edit in Studio</span>
                                </button>
                              )}

                              <button
                                onClick={() => copyShareLink(project.id)}
                                className="btn btn-sm btn-outline-secondary p-2 rounded-3"
                                title="Copy Share Link"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleExportZip(project)}
                                className="btn btn-sm btn-outline-success p-2 rounded-3"
                                title="Export Standalone Web Package (.ZIP)"
                              >
                                <Archive className="w-3.5 h-3.5 text-success" />
                              </button>
                            </div>

                            {user.role === 'admin' && (
                              <button
                                onClick={() => deleteProject(project.id)}
                                className="btn btn-sm btn-outline-danger p-2 rounded-3"
                                title="Delete Project"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Project Details Modal (Admin Panel Only) */}
      {editingProject && user.role === 'admin' && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-dialog">
            <button
              onClick={() => setEditingProject(null)}
              className="btn-close btn-close-white position-absolute top-0 end-0 m-4"
            ></button>

            <div className="d-flex align-items-center gap-3 mb-4">
              <div className="kpi-icon-box bg-primary bg-opacity-25 text-primary border border-primary border-opacity-30">
                <Edit3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="h5 font-weight-normal text-white mb-0">Edit 360° Project Details</h3>
                <p className="small text-secondary mb-0">Modify title, description & assigned client</p>
              </div>
            </div>

            <form onSubmit={handleSaveProjectDetails}>
              <div className="mb-3">
                <label className="form-label small font-weight-normal text-secondary text-uppercase">Project Title *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="form-control bg-dark text-white border-secondary border-opacity-25 rounded-3"
                />
              </div>

              <div className="mb-3">
                <label className="form-label small font-weight-normal text-secondary text-uppercase">Project Description</label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="form-control bg-dark text-white border-secondary border-opacity-25 rounded-3"
                  placeholder="Enter property details & features..."
                />
              </div>

              <div className="mb-3">
                <label className="form-label small font-weight-normal text-secondary text-uppercase">Assigned Client Account</label>
                <select
                  value={editTargetUserId}
                  onChange={(e) => setEditTargetUserId(e.target.value)}
                  className="form-select bg-dark text-white border-secondary border-opacity-25 rounded-3"
                >
                  <option value="">-- No Client Assigned (Unassigned) --</option>
                  {usersList.filter(u => u.role === 'client').map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="d-flex align-items-center justify-content-between p-3 bg-dark rounded-3 border border-secondary border-opacity-25 mb-4">
                <div>
                  <span className="small font-weight-normal text-white d-block">Public Tour Link</span>
                  <span className="small text-secondary">Allow public visitors to view without login</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsPublic(!editIsPublic)}
                  className={`btn btn-sm ${editIsPublic ? 'btn-success' : 'btn-warning text-dark'}`}
                >
                  {editIsPublic ? '🌐 Public' : '🔒 Private'}
                </button>
              </div>

              <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top border-secondary border-opacity-25">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="btn btn-secondary rounded-3 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editName.trim()}
                  className="btn btn-primary rounded-3 px-4 font-weight-normal"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
