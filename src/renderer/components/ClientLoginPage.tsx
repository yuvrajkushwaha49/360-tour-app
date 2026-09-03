import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../utils/apiConfig';
import StarfieldBackground from './StarfieldBackground';

interface ClientLoginPageProps {
  onSuccess: (user: { id: string; name: string; email: string; role: string }, token: string) => void;
  onBack?: () => void;
}

export default function ClientLoginPage({ onSuccess, onBack }: ClientLoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const loginEmail = customEmail || email;
    const loginPassword = customPass || password;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Invalid username or password.');
      }

      onSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Server connection failed. Please check server connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    alert('Please contact your administrator to reset your password or access credentials.');
  };

  return (
    <div className="universe-login-container select-none">
      <StarfieldBackground />
      <div className="universe-login-overlay"></div>

      <div className="universe-login-content">
        {/* Left Side: Universe Branding Text */}
        <div className="universe-hero-brand">
          <div className="universe-welcome-tag">
            WELCOME TO
          </div>
          <h1 className="universe-title">
            UNIVERSE
          </h1>
          <div className="universe-accent-bar"></div>
          <div className="universe-taglines">
            <div>One platform.</div>
            <div>Infinite possibilities.</div>
          </div>
        </div>

        {/* Right Side: Glassmorphic Floating Login Card */}
        <div className="universe-glass-card premium-box ">
          <div className="glow glow-purple"></div>
          <div className="glow glow-yellow"></div>
          <div className="glow glow-blue"></div>

          <div className="universe-card-header">
            <h2 className="universe-card-title">Login</h2>
            <p className="universe-card-subtitle">
              Access your <span className="universe-highlight">Universe</span>
            </p>
          </div>

          <form onSubmit={(e) => handleSubmit(e)}>
            {error && (
              <div className="universe-alert-error">
                ⚠️ {error}
              </div>
            )}

            {/* Username / Email Input */}
            <div className="universe-input-group">
              <div className="universe-input-icon-left">
                <User size={18} />
              </div>
              <input
                type="text"
                required
                placeholder="Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="universe-input"
                autoComplete="username"
                style={{
                  backgroundColor: '#000000',
                  background: '#000000',
                  color: '#ffffff',
                  border: '1px solid rgb(16 0 96)'
                }}
              />
            </div>

            {/* Password Input */}
            <div className="universe-input-group">
              <div className="universe-input-icon-left">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="universe-input"
                autoComplete="current-password"
                style={{
                  backgroundColor: '#000000',
                  background: '#000000',
                  color: '#ffffff',
                  border: '1px solid rgb(16 0 96)',
                  paddingRight: '3.25rem'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="universe-input-icon-right"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="universe-form-row">
              <label className="universe-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="universe-checkbox"
                />
                <span>Remember me</span>
              </label>

              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  handleForgotPassword();
                }}
                className="universe-forgot-link"
              >
                Forgot Password?
              </a>
            </div>

            {/* Vibrant Purple-to-Amber Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="universe-login-btn "
            >
              <span>{loading ? 'Logging in...' : 'Login'}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
