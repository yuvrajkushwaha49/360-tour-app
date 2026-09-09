import { useState, useEffect } from 'react';
import {
  Compass,
  Share2,
  Check,
  Lock,
  Globe,
  Trash2,
  Eye,
  PlusCircle,
  Search,
  Layers,
  UserCheck,
  ArrowLeft,
  Users,
  UserPlus,
  Mail,
  Crown,
  Edit3,
  X,
  Sparkles,
  Calendar,
  Link2,
  MoreHorizontal,
  Box,
  User,
  FileText
} from 'lucide-react';
import { API_BASE_URL, toCloudFrontUrl } from '../utils/apiConfig';
import { loadLargeDraft, deleteLargeDraft } from '../utils/dbStorage';
import EditUserModal from './EditUserModal';
import { createShareUrl } from '../utils/shareSecurity';

export interface ProjectItem {
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

// Helper to extract the first available image/thumbnail for a 360 project
export function getProjectThumbnail(project: ProjectItem): string | null {
  const locs = project.data?.locations || [];
  for (const loc of locs) {
    if (loc.thumbnailUrl) return toCloudFrontUrl(loc.thumbnailUrl);
    if (loc.thumbnailPath) return toCloudFrontUrl(loc.thumbnailPath);
    if (loc.stitchedPanoPath) return toCloudFrontUrl(loc.stitchedPanoPath);
    const dirs = loc.directions || {};
    for (const d of ['F', 'B', 'L', 'R', 'U', 'D']) {
      if (dirs[d] && dirs[d][0]) {
        const item = dirs[d][0];
        const p = item.url || item.path;
        if (p) return toCloudFrontUrl(p);
      }
    }
  }
  return null;
}

export function formatProjectDate(dateStr?: string): string {
  if (!dateStr) return 'May 13, 2025';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently Created';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recently Created';
  }
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
  logo_url?: string;
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
  const [filterTab, setFilterTab] = useState<'all' | 'public' | 'private' | 'completed' | 'draft'>('all');
  const [activeDashboardTab, setActiveDashboardTab] = useState<'projects' | 'users'>('projects');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'info' | 'error' } | null>(null);

  // Edit Project Modal States (Admin Only)
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editTargetUserId, setEditTargetUserId] = useState<string>('');
  const [editIsPublic, setEditIsPublic] = useState<boolean>(true);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);


  useEffect(() => {
    fetchProjects();
    fetchUsers();

    const handleRefreshUsers = () => {
      fetchUsers();
    };

    window.addEventListener('refresh-crm-users', handleRefreshUsers);
    return () => window.removeEventListener('refresh-crm-users', handleRefreshUsers);
  }, [token]);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    let serverProjects: ProjectItem[] = [];

    const activeToken = token || localStorage.getItem('crm_token');

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        headers: { ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}) }
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
      } catch (e) { }

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
      } catch (e) { }
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
    const activeToken = token || localStorage.getItem('crm_token');

    try {
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}) }
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

  const handleSaveEdit = async () => {
    if (!editingProject) return;
    setIsSavingEdit(true);

    const activeToken = token || localStorage.getItem('crm_token');

    try {
      const updatedData = {
        ...(editingProject.data || {}),
        description: editDescription
      };

      const response = await fetch(`${API_BASE_URL}/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({
          name: editName,
          user_id: editTargetUserId || editingProject.user_id,
          is_public: editIsPublic,
          data: updatedData
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update project.');
      }

      // Update local storage if exists
      try {
        const localListStr = localStorage.getItem('local_saved_projects') || '[]';
        const localList: any[] = JSON.parse(localListStr);
        const idx = localList.findIndex((p: any) => p.id === editingProject.id);
        if (idx >= 0) {
          localList[idx].name = editName;
          localList[idx].is_public = editIsPublic;
          localList[idx].data = updatedData;
          localStorage.setItem('local_saved_projects', JSON.stringify(localList));
        }
      } catch (e) { }

      setToast({ message: `Project "${editName}" updated successfully!`, type: 'success' });
      setEditingProject(null);
      fetchProjects();
    } catch (err: any) {
      setToast({ message: err.message || 'Error updating project', type: 'error' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (id === 'studio-draft-in-progress') {
      if (confirm('Delete current unsaved in-progress Studio draft? This will clear memory and reset the studio.')) {
        await deleteLargeDraft('studio_draft_project');
        try { localStorage.removeItem('studio_draft_project'); } catch (e) { }
        window.dispatchEvent(new CustomEvent('clear-studio-draft'));
        fetchProjects();
        setToast({ message: 'Studio draft cleared successfully.', type: 'info' });
      }
      return;
    }

    if (!confirm('Are you sure you want to delete this 360° virtual tour project?')) return;

    const activeToken = token || localStorage.getItem('crm_token');

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
        method: 'DELETE',
        headers: { ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}) }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete project.');
      }

      try {
        const localListStr = localStorage.getItem('local_saved_projects') || '[]';
        const localList = JSON.parse(localListStr).filter((p: any) => p.id !== id);
        localStorage.setItem('local_saved_projects', JSON.stringify(localList));
      } catch (e) { }

      setToast({ message: 'Project deleted successfully.', type: 'info' });
      setProjects(projects.filter(p => p.id !== id));
    } catch (err: any) {
      setToast({ message: err.message || 'Error deleting project.', type: 'error' });
    }
  };

  const togglePublic = async (project: ProjectItem) => {
    const updatedStatus = !project.is_public;
    const activeToken = token || localStorage.getItem('crm_token');

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({
          name: project.name,
          is_public: updatedStatus,
          data: project.data
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update public visibility status.');
      }

      setProjects(projects.map(p => p.id === project.id ? { ...p, is_public: updatedStatus } : p));
      setToast({
        message: `Project is now ${updatedStatus ? 'Public' : 'Private'}.`,
        type: 'success'
      });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to toggle visibility.', type: 'error' });
    }
  };

  const copyShareLink = (tourId: string) => {
    try {
      const fullUrl = createShareUrl(tourId, 0);
      navigator.clipboard.writeText(fullUrl);
      setCopiedId(tourId);
      setToast({ message: 'Shareable 360° tour link copied to clipboard!', type: 'success' });
      setTimeout(() => setCopiedId(null), 2500);
    } catch (e) {
      const fallbackUrl = `${window.location.origin}/?tour=${tourId}`;
      navigator.clipboard.writeText(fallbackUrl);
      setCopiedId(tourId);
      setToast({ message: 'Link copied to clipboard!', type: 'success' });
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
  const publicProjectsCount = projects.filter(p => p.is_public).length;
  const privateProjectsCount = projects.filter(p => !p.is_public).length;

  return (
    <div className="dashboard-container">
      {/* Toast Notification Alert */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            fontSize: '0.86rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backdropFilter: 'blur(8px)'
          }}
        >
          {toast.type === 'error' ? '⚠️' : '✅'} {toast.message}
        </div>
      )}


      {/* Hero Header Banner with 3D Orbital Showcase */}
      <div className="dashboard-hero-card">
        <div className="dashboard-hero-glow-1"></div>
        <div className="dashboard-hero-glow-2"></div>

        <div>
          <div className="hero-welcome-badge">
            <span>Welcome, {user.name} </span>
            <span>👋</span>
          </div>
          <h1 className="hero-title-main">
            360° Virtual Tour <span className="hero-title-gradient-text">CRM Portal</span>
          </h1>
          <p className="hero-subtitle-text">
            {user.role === 'admin'
              ? 'Manage all registered client accounts, edit project names & descriptions, preview HD 360° tours, and publish projects.'
              : 'Explore your custom assigned 360° virtual tours interactively or share public tour links with clients.'}
          </p>

          {user.role === 'admin' && (
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {onBackToStudio && (
                <button
                  onClick={onBackToStudio}
                  className="btn btn-secondary text-white rounded-3 px-3 py-2 small font-weight-normal d-flex align-items-center gap-2"
                  title="Go Back to 360 Studio Editor"
                >
                  <ArrowLeft size={14} className="text-info" />
                  <span>Back to Studio</span>
                </button>
              )}

              {onCreateNewProject && (
                <button
                  onClick={onCreateNewProject}
                  className="btn-view-360-primary"
                  style={{ padding: '0.5rem 1.15rem' }}
                >
                  <PlusCircle size={15} />
                  <span>Create New Project</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3D Showcase Graphic */}
        <div className="hero-3d-showcase">
          <img
            src="/images/home_page_hero.png"
            alt="360° Virtual Tour Showcase"
            className="hero-3d-main-img"
          />
        </div>
      </div>

      {/* 4 Stats Cards Grid Row (Only for Admin) */}
      {user.role === 'admin' && (
        <div className="stats-grid-row">
          {/* Card 1: Total 360° Projects */}
          <div
            className="stat-metric-card cursor-pointer"
            onClick={() => setActiveDashboardTab('projects')}
          >
            <div className="stat-icon-wrapper stat-icon-purple">
              <Box size={22} />
            </div>
            <div className="stat-metric-content">
              <span className="stat-metric-label">Total 360° Projects</span>
              <span className="stat-metric-value">{projects.length}</span>
              <span className="stat-metric-subtext">All projects in your account</span>
            </div>
          </div>

          {/* Card 2: Private Projects */}
          <div
            className="stat-metric-card cursor-pointer"
            onClick={() => { setActiveDashboardTab('projects'); setFilterTab('private'); }}
          >
            <div className="stat-icon-wrapper stat-icon-blue">
              <Lock size={22} />
            </div>
            <div className="stat-metric-content">
              <span className="stat-metric-label">Private Projects</span>
              <span className="stat-metric-value">{privateProjectsCount}</span>
              <span className="stat-metric-subtext">Only visible to you</span>
            </div>
          </div>

          {/* Card 3: Public Projects */}
          <div
            className="stat-metric-card cursor-pointer"
            onClick={() => { setActiveDashboardTab('projects'); setFilterTab('public'); }}
          >
            <div className="stat-icon-wrapper stat-icon-green">
              <Globe size={22} />
            </div>
            <div className="stat-metric-content">
              <span className="stat-metric-label">Public Projects</span>
              <span className="stat-metric-value">{publicProjectsCount}</span>
              <span className="stat-metric-subtext">Shared with everyone</span>
            </div>
          </div>

          {/* Card 4: Rooms Configured */}
          <div className="stat-metric-card">
            <div className="stat-icon-wrapper stat-icon-amber">
              <Layers size={22} />
            </div>
            <div className="stat-metric-content">
              <span className="stat-metric-label">Rooms Configured</span>
              <span className="stat-metric-value">{totalRooms}</span>
              <span className="stat-metric-subtext">Total rooms across projects</span>
            </div>
          </div>
        </div>
      )}

      {/* Admin Tab Switch (Projects vs Users) */}
      {user.role === 'admin' && (
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3 pb-2 border-bottom border-secondary border-opacity-25">
          <div className="d-flex align-items-center gap-2">
            <button
              onClick={() => setActiveDashboardTab('projects')}
              className={`filter-pill-btn ${activeDashboardTab === 'projects' ? 'active' : ''}`}
            >
              <Compass size={15} />
              <span>All 360° Projects ({projects.length})</span>
            </button>
            <button
              onClick={() => setActiveDashboardTab('users')}
              className={`filter-pill-btn ${activeDashboardTab === 'users' ? 'active' : ''}`}
            >
              <Users size={15} />
              <span>Registered Users ({usersList.length})</span>
            </button>
          </div>

          {onOpenAddUserModal && (
            <button
              onClick={onOpenAddUserModal}
              className="btn btn-sm btn-outline-warning rounded-3 px-3 py-1.5 d-flex align-items-center gap-2"
            >
              <UserPlus size={14} />
              <span>+ Add Client User</span>
            </button>
          )}
        </div>
      )}

      {/* VIEW 1: USERS LIST (ADMIN ONLY) */}
      {activeDashboardTab === 'users' && user.role === 'admin' ? (
        <div>
          {/* User Search Bar */}
          <div className="search-filter-row">
            <div className="search-bar-wrapper">
              <Search size={16} className="search-icon-inside" />
              <input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="search-bar-input"
              />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Showing {filteredUsers.length} of {usersList.length} User Accounts
            </div>
          </div>

          {usersLoading ? (
            <div className="py-5 text-center text-secondary">
              <div className="spinner-border text-warning mb-3" role="status"></div>
              <p className="small">Loading User Accounts...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-5 text-center bg-dark bg-opacity-50 border border-secondary border-opacity-25 rounded-4 p-4 max-w-md mx-auto">
              <Users className="w-12 h-12 text-secondary mx-auto mb-3" />
              <h3 className="h6 text-white mb-1">No Users Found</h3>
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
                            <div
                              className={`user-avatar ${isAdmin ? 'bg-warning text-dark' : 'bg-primary text-white'}`}
                              style={{ overflow: 'hidden', padding: 0 }}
                            >
                              {usr.logo_url ? (
                                <img
                                  src={toCloudFrontUrl(usr.logo_url)}
                                  alt={usr.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                usr.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <h3 className="h6 text-white mb-0">{usr.name}</h3>
                              <span className="small text-secondary font-mono">ID: {usr.id}</span>
                            </div>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            {isAdmin ? (
                              <span className="badge bg-opacity-25 text-warning border border-warning border-opacity-25 px-2.5 py-1.5 rounded-pill small">
                                <Crown size={12} className="me-1" />
                                <span>Admin</span>
                              </span>
                            ) : (
                              <span className="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25 px-2.5 py-1.5 rounded-pill small">
                                <UserCheck size={12} className="me-1" />
                                <span>Client</span>
                              </span>
                            )}

                            {user.role === 'admin' && (
                              <button
                                onClick={() => setEditingUser(usr)}
                                className="btn btn-sm btn-outline-secondary text-secondary p-1 rounded-2 border-0"
                                title="Edit Client Details & Brand Logo"
                              >
                                <Edit3 size={15} className="text-info" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="bg-dark bg-opacity-60 p-3 rounded-3 border border-secondary border-opacity-25 mb-3">
                          <div className="d-flex align-items-center gap-2 small text-secondary mb-2">
                            <Mail size={14} className="shrink-0" />
                            <span className="text-truncate">{usr.email}</span>
                          </div>
                          <div className="d-flex align-items-center justify-content-between small pt-2 border-top border-secondary border-opacity-25">
                            <span className="text-secondary">Assigned Tours:</span>
                            <span className="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-30">
                              {assignedCount} Project{assignedCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-top border-secondary border-opacity-25">
                        <span className="small text-secondary text-uppercase d-block mb-2">Assigned 360 Tours</span>
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
                                <span className="text-truncate">{p.name}</span>
                                <Eye size={13} className="text-primary ms-1" />
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
        /* VIEW 2: ALL 360° PROJECTS (HORIZONTAL CARDS) */
        <div>
          {/* Search Bar and Filter Tabs Row */}
          <div className="search-filter-row">
            <div className="search-bar-wrapper">
              <Search size={16} className="search-icon-inside" />
              <input
                type="text"
                placeholder="Search virtual tours by name, client, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-bar-input"
              />
            </div>

            {user.role === 'admin' && (
              <div className="filter-pills-group">
                <button
                  onClick={() => setFilterTab('all')}
                  className={`filter-pill-btn ${filterTab === 'all' ? 'active' : ''}`}
                >
                  All ({projects.length})
                </button>

                <button
                  onClick={() => setFilterTab('private')}
                  className={`filter-pill-btn ${filterTab === 'private' ? 'active' : ''}`}
                >
                  <Lock size={13} />
                  <span>Private ({privateProjectsCount})</span>
                </button>

                <button
                  onClick={() => setFilterTab('public')}
                  className={`filter-pill-btn ${filterTab === 'public' ? 'active' : ''}`}
                >
                  <Globe size={13} />
                  <span>Public ({publicProjectsCount})</span>
                </button>

                <button
                  onClick={() => setFilterTab('draft')}
                  className={`filter-pill-btn ${filterTab === 'draft' ? 'active' : ''}`}
                >
                  <span>Drafts ({projects.filter(p => !isProjectCompleted(p)).length})</span>
                </button>
              </div>
            )}
          </div>

          {/* Projects Horizontal List Cards */}
          <div>
            {loading ? (
              <div className="py-5 text-center text-secondary">
                <div className="spinner-border text-primary mb-3" role="status"></div>
                <p className="small">Loading 360° Virtual Tour Projects...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-4 text-danger text-center max-w-md mx-auto">
                <h3 className="h6 mb-1">⚠️ Connection Error</h3>
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
                <h3 className="h6 text-white mb-1">No 360° Tours Found</h3>
                <p className="small text-secondary mb-0">No virtual tour projects match your search query.</p>
              </div>
            ) : (
              <div className="projects-horizontal-list">
                {filteredProjects.map((project) => {
                  const locationCount = project.data?.locations?.length || 0;
                  const thumbnail = getProjectThumbnail(project);
                  const isCompleted = isProjectCompleted(project);

                  return (
                    <div key={project.id} className="project-horizontal-card">
                      {/* Three Dots More Menu (Admin Only) */}
                      {user.role === 'admin' && (
                        <button
                          onClick={() => handleOpenEditModal(project)}
                          className="btn-card-more-menu"
                          title="Edit Project Details"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      )}

                      {/* Left Thumbnail Image Container */}
                      <div
                        className="card-thumb-container cursor-pointer"
                        onClick={() => {
                          if (!isCompleted && user.role === 'admin') {
                            onOpenProject(project);
                          } else {
                            onLaunchPublicView(project.id);
                          }
                        }}
                      >
                        {/* Status Pill on Top-Left */}
                        <div
                          className="badge-thumb-topleft"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (user.role === 'admin') togglePublic(project);
                          }}
                          style={{ cursor: user.role === 'admin' ? 'pointer' : 'default' }}
                          title={user.role === 'admin' ? 'Click to toggle Public / Private status' : undefined}
                        >
                          {!isCompleted ? (
                            <span className="badge-draft-pill">📝 Draft</span>
                          ) : project.is_public ? (
                            <span className="badge-public-pill">
                              <Globe size={11} /> Public
                            </span>
                          ) : (
                            <span className="badge-private-pill">
                              <Lock size={11} /> Private
                            </span>
                          )}
                        </div>

                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={project.name}
                            className="card-thumb-img"
                          />
                        ) : (
                          <div className="card-thumb-fallback">
                            <Compass size={36} />
                            <span style={{ fontSize: '0.72rem', marginTop: '6px', opacity: 0.8 }}>360° Panorama</span>
                          </div>
                        )}

                        {/* 360° Circular Badge on Bottom-Right */}
                        <div className="badge-thumb-360">
                          <span>360°</span>
                        </div>
                      </div>

                      {/* Middle Content Details */}
                      <div className="card-content-middle">
                        <div className="card-title-row">
                          <h3 className="card-title-heading">{project.name}</h3>
                          <Sparkles size={16} className="card-sparkle-icon" />
                        </div>

                        <div className="card-info-item">
                          <User size={14} />
                          <span>Client: <strong style={{ color: '#ffffff', fontWeight: 600 }}>{project.client_name || user.name}</strong></span>
                        </div>

                        <div className="card-info-item">
                          <Box size={14} />
                          <span>{locationCount} Room{locationCount !== 1 ? 's' : ''} Configured</span>
                        </div>

                        <div className="card-info-item">
                          <FileText size={14} />
                          <span style={{ fontStyle: 'italic', opacity: 0.85 }}>{project.data?.description || 'No description provided'}</span>
                        </div>

                        {/* Meta Row: Created Date and Shareable Link */}
                        <div className="card-meta-pills-row">
                          <div className="meta-pill-tag">
                            <Calendar size={13} />
                            <span>Created: {formatProjectDate(project.created_at)}</span>
                          </div>

                          {user.role === 'admin' && (
                            <button
                              onClick={() => copyShareLink(project.id)}
                              className="meta-pill-link-btn"
                              title="Click to copy shareable public tour link"
                            >
                              {copiedId === project.id ? (
                                <>
                                  <Check size={13} style={{ color: '#34d399' }} />
                                  <span style={{ color: '#34d399' }}>Link Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Link2 size={13} />
                                  <span>Shareable Link</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="card-actions-right">
                        <button
                          onClick={() => onLaunchPublicView(project.id)}
                          className="btn-view-360-primary"
                          title="Open interactive 360° tour viewer"
                        >
                          <Eye size={16} />
                          <span>View 360° Tour</span>
                        </button>

                        {user.role === 'admin' && (
                          <button
                            onClick={() => copyShareLink(project.id)}
                            className="btn-action-square"
                            title="Share 360° Tour Link"
                          >
                            {copiedId === project.id ? <Check size={16} style={{ color: '#34d399' }} /> : <Share2 size={16} />}
                          </button>
                        )}

                        {user.role === 'admin' && (
                          <button
                            onClick={() => deleteProject(project.id)}
                            className="btn-action-square btn-action-square-delete"
                            title="Delete project"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Project Modal (Admin Only) */}
      {editingProject && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-dialog">
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-secondary border-opacity-25">
              <h3 className="h5 text-white mb-0">Edit Tour Settings</h3>
              <button
                onClick={() => setEditingProject(null)}
                className="btn btn-sm btn-outline-secondary p-1 border-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-3">
              <label className="form-label small text-secondary">Project Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="form-control bg-dark text-white border-secondary border-opacity-50"
                placeholder="e.g. Luxury Apartment 360"
              />
            </div>

            <div className="mb-3">
              <label className="form-label small text-secondary">Description / Tagline</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="form-control bg-dark text-white border-secondary border-opacity-50"
                rows={3}
                placeholder="Brief notes, amenities, highlights..."
              ></textarea>
            </div>

            {user.role === 'admin' && (
              <div className="mb-3">
                <label className="form-label small text-secondary">Assign to Registered Client</label>
                <select
                  value={editTargetUserId}
                  onChange={(e) => setEditTargetUserId(e.target.value)}
                  className="form-select bg-dark text-white border-secondary border-opacity-50"
                >
                  <option value="">-- No Specific Client (Admin / General) --</option>
                  {usersList.filter(u => u.role === 'client').map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <div className="form-check form-switch">
                <input
                  type="checkbox"
                  id="editIsPublicSwitch"
                  checked={editIsPublic}
                  onChange={(e) => setEditIsPublic(e.target.checked)}
                  className="form-check-input"
                />
                <label htmlFor="editIsPublicSwitch" className="form-check-label text-white small">
                  {editIsPublic ? '🌐 Public Visibility (Available on shared links)' : '🔒 Private (Restricted to logged-in user)'}
                </label>
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-end gap-2 pt-2 border-top border-secondary border-opacity-25">
              <button
                onClick={() => setEditingProject(null)}
                className="btn btn-sm btn-secondary text-white rounded-3 px-3"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="btn btn-sm btn-primary rounded-3 px-4 font-weight-normal"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal (Admin Only) */}
      {editingUser && (
        <EditUserModal
          isOpen={!!editingUser}
          user={editingUser}
          token={token || localStorage.getItem('crm_token') || ''}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            fetchUsers();
            fetchProjects();
          }}
        />
      )}

      {/* Modern Dashboard Footer */}
      <footer className="dashboard-copyright-footer">
        © 2025 360 Virtual Tour Studio. All rights reserved.
      </footer>
    </div>
  );
}
