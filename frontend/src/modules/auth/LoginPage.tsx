import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Lock, Mail, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('manager@jcb.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      await login(identifier, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const setDemo = (role: 'manager' | 'admin' | 'store') => {
    if (role === 'manager') setIdentifier('manager@jcb.com');
    if (role === 'admin') setIdentifier('admin@jcb.com');
    if (role === 'store') setIdentifier('store@jcb.com');
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-700">
        {/* Brand Banner */}
        <div className="bg-jcb-charcoal p-6 text-center border-b border-slate-800">
          <div className="inline-block bg-jcb-yellow text-black font-black text-3xl px-4 py-1 rounded shadow mb-3 tracking-wider">
            JCB
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">Smart Machine CMMS</h2>
          <p className="text-xs text-slate-400 mt-1">Maintenance & Asset Performance Management</p>
        </div>

        {/* Demo Persona Bar */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-2">Quick Demo Sign-In:</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDemo('manager')}
              className={`flex-1 py-1 text-xs font-bold rounded border transition ${
                identifier.includes('manager')
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Manager
            </button>
            <button
              type="button"
              onClick={() => setDemo('admin')}
              className={`flex-1 py-1 text-xs font-bold rounded border transition ${
                identifier.includes('admin')
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setDemo('store')}
              className={`flex-1 py-1 text-xs font-bold rounded border transition ${
                identifier.includes('store')
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Store
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Employee ID or Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                placeholder="e.g. manager@jcb.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                placeholder="Enter password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-extrabold rounded-lg text-sm tracking-wider uppercase transition shadow-md hover:shadow flex items-center justify-center gap-2 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In to Management Portal'}
          </button>
        </form>
      </div>
    </div>
  );
};

