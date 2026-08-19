import React, { useState } from 'react';
import { X, UserPlus, Mail, User, Lock, ShieldCheck, CheckCircle2, Building2, Sparkles } from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  token: string | null;
  onClose: () => void;
  onSuccess: (newUser: { id: string; name: string; email: string; role: string }) => void;
}

export default function AddUserModal({ isOpen, token, onClose, onSuccess }: AddUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('123456'); // default initial password
  const [role, setRole] = useState<'client' | 'admin'>('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/api/users/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, email, password, role })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add new user');
      }

      onSuccess(data.user);
      onClose();
      // Reset form
      setName('');
      setEmail('');
      setPassword('123456');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#12141d] border border-gray-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 relative overflow-hidden">
        
        {/* Top Glow Background */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4 relative z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add New Client Account</h3>
              <p className="text-xs text-gray-400">Create a user for assigning 360° virtual tours</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
              Error: {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
              Client / User Name *
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
              <input
                type="text"
                required
                placeholder="e.g. Acme Properties / John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0b0c12] border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
              Client Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
              <input
                type="email"
                required
                placeholder="client@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0b0c12] border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
              Initial Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
              <input
                type="text"
                required
                placeholder="Initial login password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0b0c12] border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Default password provided for initial client login.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">Account Role</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('client')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  role === 'client'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white'
                    : 'bg-[#0b0c12] border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  {role === 'client' && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                </div>
                <span className="text-xs font-bold block">Client Account</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  role === 'admin'
                    ? 'bg-purple-600/15 border-purple-500 text-white'
                    : 'bg-[#0b0c12] border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  {role === 'admin' && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                </div>
                <span className="text-xs font-bold block">Admin Account</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-gray-800 text-gray-300 hover:text-white rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name || !email}
              className="py-2.5 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center space-x-2"
            >
              {loading ? (
                <span>Creating Client...</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Client Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
