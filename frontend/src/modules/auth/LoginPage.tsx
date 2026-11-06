import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth, getRoleHomeRoute, UserRole } from '../../context/AuthContext';
import { Lock, Mail, AlertCircle, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [identifier, setIdentifier] = useState('manager@jcb.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to user's home dashboard
  useEffect(() => {
    if (user) {
      navigate(getRoleHomeRoute(user.role), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setIdentifier(emailParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError('Please enter your Employee Code or Email address.');
      return;
    }

    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    try {
      setLoading(true);
      const loggedInUser = await login(cleanIdentifier, password);
      // Navigate directly to role-appropriate dashboard
      const targetRoute = getRoleHomeRoute(loggedInUser.role);
      navigate(targetRoute, { replace: true });
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Authentication failed. Please verify credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const setDemo = (role: UserRole) => {
    if (role === 'manager') setIdentifier('manager@jcb.com');
    if (role === 'admin') setIdentifier('admin@jcb.com');
    if (role === 'technician') setIdentifier('technician@jcb.com');
    if (role === 'operator') setIdentifier('operator@jcb.com');
    setPassword('password123');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-jcb-yellow selection:text-black">
      {/* Back to Welcome Link */}
      <div className="max-w-md w-full mb-4">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-600 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO JCB CMMS PORTAL</span>
        </Link>
      </div>

      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-zinc-200">
        {/* Brand Banner - Heavy JCB Black */}
        <div className="bg-black p-6 text-center border-b border-zinc-900 relative">
          <div className="inline-block bg-jcb-yellow text-black font-black text-3xl px-4 py-1.5 rounded-lg shadow-lg mb-3 tracking-widest border-2 border-jcb-yellowDark">
            JCB
          </div>
          <h2 className="text-xl font-black text-white tracking-wide">SMART CMMS</h2>
          <p className="text-xs text-zinc-400 mt-1 font-medium">Machine Maintenance Management System</p>
        </div>

        {/* 4 Core Roles Quick Select Bar */}
        <div className="bg-zinc-100 px-6 py-3 border-b border-zinc-200">
          <p className="text-[11px] font-black text-zinc-600 mb-2 uppercase tracking-wider">
            Quick Persona 1-Click Select:
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => setDemo('manager')}
              className={`py-1.5 text-[11px] font-bold rounded border transition ${
                identifier.includes('manager')
                  ? 'bg-jcb-yellow text-black border-jcb-yellow font-black shadow-sm'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              Manager
            </button>
            <button
              type="button"
              onClick={() => setDemo('admin')}
              className={`py-1.5 text-[11px] font-bold rounded border transition ${
                identifier.includes('admin')
                  ? 'bg-jcb-yellow text-black border-jcb-yellow font-black shadow-sm'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setDemo('technician')}
              className={`py-1.5 text-[11px] font-bold rounded border transition ${
                identifier.includes('technician')
                  ? 'bg-jcb-yellow text-black border-jcb-yellow font-black shadow-sm'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              Tech
            </button>
            <button
              type="button"
              onClick={() => setDemo('operator')}
              className={`py-1.5 text-[11px] font-bold rounded border transition ${
                identifier.includes('operator')
                  ? 'bg-jcb-yellow text-black border-jcb-yellow font-black shadow-sm'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              Operator
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Employee Code or Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. manager@jcb.com or EMP-MGR-001"
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-jcb-yellow focus:ring-1 focus:ring-jcb-yellow font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-jcb-yellow focus:ring-1 focus:ring-jcb-yellow font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 focus:outline-none"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-zinc-500 font-medium">
                Demo Password: <code className="font-bold text-zinc-700">password123</code>
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black py-3 rounded-xl transition duration-150 uppercase tracking-wider text-sm shadow-md hover:shadow-lg disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In To Portal</span>
            )}
          </button>

          {/* Plant Badges */}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-center gap-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
            <span>Ballabgarh</span>
            <span>•</span>
            <span>Pune</span>
            <span>•</span>
            <span>Jaipur</span>
          </div>
        </form>
      </div>
    </div>
  );
};

