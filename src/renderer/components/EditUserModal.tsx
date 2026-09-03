import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3, Mail, User, Lock, CheckCircle2, Building2, Sparkles, Eye, EyeOff, UploadCloud, ImageIcon, Trash2 } from 'lucide-react';
import { API_BASE_URL, toCloudFrontUrl } from '../utils/apiConfig';
import { uploadFileWithFallback } from '../utils/uploadWithFallback';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  logo_url?: string;
}

interface EditUserModalProps {
  isOpen: boolean;
  user: UserItem | null;
  token: string | null;
  onClose: () => void;
  onSuccess: (updatedUser: UserItem) => void;
}

export default function EditUserModal({ isOpen, user, token, onClose, onSuccess }: EditUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'client' | 'admin'>('client');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setRole((user.role as 'client' | 'admin') || 'client');
      setLogoUrl(user.logo_url || '');
      setPassword('');
      setError(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const activeToken = token || localStorage.getItem('crm_token');
      const data = await uploadFileWithFallback(
        `${API_BASE_URL}/api/upload`,
        formData,
        activeToken ? { Authorization: `Bearer ${activeToken}` } : {}
      );

      setLogoUrl(data.url);
    } catch (err: any) {
      if (!err.message?.includes('cancelled')) {
        setError(err.message || 'Logo upload failed');
      }
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const activeToken = token || localStorage.getItem('crm_token');

    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        logo_url: logoUrl || null
      };

      if (password && password.trim().length > 0) {
        payload.password = password.trim();
      }

      const response = await fetch(`${API_BASE_URL}/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user profile');
      }

      onSuccess(data.user);
      window.dispatchEvent(new CustomEvent('refresh-crm-users'));
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong while saving changes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(4, 6, 15, 0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'linear-gradient(165deg, rgba(17, 22, 42, 0.96) 0%, rgba(10, 13, 26, 0.98) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderRadius: '28px',
          padding: '28px 32px',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          position: 'relative',
          animation: 'modalSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          color: '#ffffff'
        }}
      >
        {/* Ambient Top Glow Orbs */}
        <div style={{
          position: 'absolute',
          top: '-80px',
          left: '-80px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.35) 0%, rgba(139, 92, 246, 0) 70%)',
          pointerEvents: 'none',
          filter: 'blur(30px)'
        }} />
        <div style={{
          position: 'absolute',
          top: '-60px',
          right: '-60px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(99, 102, 241, 0) 70%)',
          pointerEvents: 'none',
          filter: 'blur(30px)'
        }} />

        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '20px',
          marginBottom: '20px',
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(99, 102, 241, 0.35) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
              boxShadow: '0 8px 20px rgba(139, 92, 246, 0.25)'
            }}>
              <Edit3 size={22} />
            </div>
            <div>
              <h3 style={{
                margin: 0,
                fontSize: '1.2rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #ffffff 40%, #ddd6fe 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Edit Client / User Details
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                Update name, email, brand logo, role or password
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 2 }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '14px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontWeight: 700 }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Client Logo Upload Section */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#94a3b8',
              marginBottom: '6px'
            }}>
              Client Brand Logo
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleLogoUpload}
              style={{ display: 'none' }}
            />

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 16px',
              background: '#070913',
              border: '1px dashed rgba(139, 92, 246, 0.35)',
              borderRadius: '16px'
            }}>
              {/* Logo Preview Avatar */}
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: '#12162a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                {logoUrl ? (
                  <img
                    src={toCloudFrontUrl(logoUrl)}
                    alt="Client Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: '#c084fc'
                  }}>
                    {name ? name.charAt(0).toUpperCase() : <ImageIcon size={22} color="#64748b" />}
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    style={{
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.2))',
                      border: '1px solid rgba(139, 92, 246, 0.4)',
                      color: '#ddd6fe',
                      borderRadius: '10px',
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: isUploadingLogo ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <UploadCloud size={14} />
                    <span>{isUploadingLogo ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Client Logo'}</span>
                  </button>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        borderRadius: '10px',
                        padding: '6px 10px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Remove Logo"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  PNG or JPG image format supported
                </span>
              </div>
            </div>
          </div>

          {/* Client / User Name */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#94a3b8',
              marginBottom: '6px'
            }}>
              Client / User Name <span style={{ color: '#c084fc' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center'
              }}>
                <User size={17} />
              </div>
              <input
                type="text"
                required
                placeholder="e.g. Acme Realty / Priya Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#070913',
                  border: '1px solid #1e2438',
                  borderRadius: '14px',
                  padding: '11px 14px 11px 40px',
                  fontSize: '0.88rem',
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#8b5cf6';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#1e2438';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#94a3b8',
              marginBottom: '6px'
            }}>
              Email Address <span style={{ color: '#c084fc' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Mail size={17} />
              </div>
              <input
                type="email"
                required
                placeholder="client@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#070913',
                  border: '1px solid #1e2438',
                  borderRadius: '14px',
                  padding: '11px 14px 11px 40px',
                  fontSize: '0.88rem',
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#8b5cf6';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#1e2438';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Optional New Password */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#94a3b8',
                margin: 0
              }}>
                Update Password (Optional)
              </label>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Leave blank to keep unchanged</span>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Lock size={17} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password to reset"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#070913',
                  border: '1px solid #1e2438',
                  borderRadius: '14px',
                  padding: '11px 42px 11px 40px',
                  fontSize: '0.88rem',
                  color: '#ffffff',
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#8b5cf6';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#1e2438';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Account Role Cards */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#94a3b8',
              marginBottom: '8px'
            }}>
              Account Role
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Client Role Option */}
              <div
                onClick={() => setRole('client')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  border: role === 'client' ? '1px solid #6366f1' : '1px solid #1e2438',
                  background: role === 'client'
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(99, 102, 241, 0.06) 100%)'
                    : 'rgba(255, 255, 255, 0.02)',
                  boxShadow: role === 'client' ? '0 8px 20px rgba(99, 102, 241, 0.2)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    backgroundColor: role === 'client' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: role === 'client' ? '#818cf8' : '#94a3b8'
                  }}>
                    <Building2 size={16} />
                  </div>
                  {role === 'client' && <CheckCircle2 size={18} color="#818cf8" />}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: role === 'client' ? '#ffffff' : '#cbd5e1' }}>
                  Client Account
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.3 }}>
                  Can view assigned 360 virtual tours
                </div>
              </div>

              {/* Admin Role Option */}
              <div
                onClick={() => setRole('admin')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  border: role === 'admin' ? '1px solid #a855f7' : '1px solid #1e2438',
                  background: role === 'admin'
                    ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.18) 0%, rgba(168, 85, 247, 0.06) 100%)'
                    : 'rgba(255, 255, 255, 0.02)',
                  boxShadow: role === 'admin' ? '0 8px 20px rgba(168, 85, 247, 0.2)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    backgroundColor: role === 'admin' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: role === 'admin' ? '#c084fc' : '#94a3b8'
                  }}>
                    <Sparkles size={16} />
                  </div>
                  {role === 'admin' && <CheckCircle2 size={18} color="#c084fc" />}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: role === 'admin' ? '#ffffff' : '#cbd5e1' }}>
                  Admin Account
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.3 }}>
                  Full access to 3D studio, tours & users
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            marginTop: '4px'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || isUploadingLogo || !name.trim() || !email.trim()}
              style={{
                padding: '10px 24px',
                borderRadius: '12px',
                background: loading || isUploadingLogo || !name.trim() || !email.trim()
                  ? 'rgba(139, 92, 246, 0.3)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #4f46e5 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: loading || isUploadingLogo || !name.trim() || !email.trim() ? 'not-allowed' : 'pointer',
                boxShadow: loading || isUploadingLogo || !name.trim() || !email.trim()
                  ? 'none'
                  : '0 8px 24px rgba(139, 92, 246, 0.45)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                opacity: loading || isUploadingLogo || !name.trim() || !email.trim() ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading && !isUploadingLogo && name.trim() && email.trim()) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(139, 92, 246, 0.55)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(139, 92, 246, 0.45)';
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Edit3 size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
