import React, { useState } from 'react';
import { Mail, Lock, Layers, ShieldCheck, Sparkles } from 'lucide-react';

interface ClientLoginPageProps {
  onSuccess: (user: { id: string; name: string; email: string; role: string }, token: string) => void;
  onBack?: () => void;
}

export default function ClientLoginPage({ onSuccess, onBack }: ClientLoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const loginEmail = customEmail || email;
    const loginPassword = customPass || password;

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Invalid email or password.');
      }

      onSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Server connection failed. Please start server on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container select-none">
      {/* Deep Blue Background Radial Gradient */}
      <div className="login-radial-bg"></div>

      {/* Main Glass Split Card Container */}
      <div className="container max-w-6xl z-1 position-relative my-auto">
        <div className="row g-4 align-items-stretch">
          
          {/* Left Box: Login Form Card */}
          <div className="col-12 col-lg-6">
            <div className="login-glass-card h-100 d-flex flex-column justify-between">
              <div>
                {/* Header Title & Subtitle */}
                <div className="text-center mb-4">
                  <h1 className="h2 font-weight-black text-white mb-2">Welcome Back</h1>
                  <p className="small text-secondary max-w-sm mx-auto mb-0">
                    Sign in to your 360 Panorama Studio account to view your Virtual Tours
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={(e) => handleSubmit(e)} className="max-w-md mx-auto">
                  {error && (
                    <div className="alert alert-danger py-2.5 px-3 rounded-3 small text-center mb-3">
                      ⚠️ {error}
                    </div>
                  )}

                  {/* Email Address */}
                  <div className="mb-3">
                    <label className="form-label small font-weight-bold text-secondary">Email Address</label>
                    <div className="position-relative">
                      <div className="login-input-icon">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="form-control login-input-box"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="mb-4">
                    <label className="form-label small font-weight-bold text-secondary">Password</label>
                    <div className="position-relative">
                      <div className="login-input-icon">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="form-control login-input-box"
                      />
                    </div>
                  </div>

                  {/* Sign In Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-light w-100 py-3 font-weight-black text-dark rounded-3 shadow-lg"
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Right Box: 360 VR Showcase */}
          <div className="col-12 col-lg-6">
            <div className="login-glass-card h-100 d-flex flex-column align-items-center justify-between text-center">
              <div className="w-100 d-flex justify-content-end mb-3">
                <span className="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25 rounded-pill px-3 py-1 small">
                  360° Panorama VR Engine
                </span>
              </div>

              <div className="my-4 position-relative">
                <div className="kpi-icon-box bg-primary bg-opacity-25 text-primary border border-primary border-opacity-50 p-4 rounded-circle mx-auto shadow-lg">
                  <Layers className="w-12 h-12" />
                </div>
              </div>

              <div>
                <h2 className="h4 font-weight-bold text-white mb-2">Virtual Tour Studio</h2>
                <p className="small text-secondary max-w-xs mx-auto mb-0">
                  Experience interactive 360° panoramas & real-time virtual tours
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
