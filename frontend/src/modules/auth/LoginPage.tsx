import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, getRoleHomeRoute } from '../../context/AuthContext';
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Activity,
  Wrench,
  Calendar,
  ClipboardList,
  Info,
  X,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Inputs strictly initialize empty by default — no prefill or hardcoded demo credentials
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  // If already authenticated, redirect to user's role-specific dashboard
  useEffect(() => {
    if (user) {
      navigate(getRoleHomeRoute(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submission
    if (loading) return;

    setError('');

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError('Please enter your email or Employee ID.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      setLoading(true);
      const loggedInUser = await login(cleanIdentifier, password, rememberMe);

      // Check for preserved redirect destination
      const fromLocation = (location.state as any)?.from;
      const intendedPath = fromLocation?.pathname;

      const targetRoute =
        intendedPath && intendedPath !== '/login' && intendedPath !== '/'
          ? intendedPath
          : getRoleHomeRoute(loggedInUser.role);

      navigate(targetRoute, { replace: true });
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Invalid credentials. Please verify your email / Employee ID and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-2 font-sans selection:bg-amber-400 selection:text-black overflow-x-hidden">
      {/* =========================================================================
          1. LEFT PANEL (Hero & Industrial Branding Section) - 50% split on desktop
          ========================================================================= */}
      <div className="w-full flex flex-col justify-between p-8 sm:p-12 lg:p-14 xl:p-16 relative overflow-hidden bg-zinc-950 text-white min-h-[560px] lg:min-h-screen">
        {/* Background Visual: Heavy machinery with modern deep charcoal & amber gradient overlay */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
          <img
            src="/jcb-login-hero.jpg"
            alt="JCB Construction Machinery"
            className="w-full h-full object-cover object-center scale-105 filter brightness-85 contrast-115"
          />
          {/* Deep charcoal/industrial black fading into rich tones so text is crisp and readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E17] via-[#0A0E17]/85 to-[#0A0E17]/65" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0E17]/95 via-[#0A0E17]/75 to-[#0A0E17]/50" />
          {/* Subtle amber ambient glow in the lower left corner */}
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl" />
          {/* Subtle industrial grid accent */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>

        {/* Top Branding: Official JCB yellow box alongside clean text */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="bg-jcb-yellow text-zinc-950 font-black text-2xl px-3 py-1 rounded-md shadow-md tracking-wider border border-amber-400 shrink-0">
            JCB
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-wider text-white uppercase leading-none">
              SMART CMMS
            </span>
            <span className="text-[10px] font-bold text-amber-400/90 tracking-widest uppercase mt-1">
              MACHINE MAINTENANCE MANAGEMENT
            </span>
          </div>
        </div>

        {/* Hero Messaging & Feature Pills */}
        <div className="relative z-10 max-w-lg my-auto py-8 lg:py-10 space-y-5">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30 backdrop-blur-md text-[11px] font-bold text-amber-300 tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-jcb-yellow animate-pulse" />
            <span>INDUSTRIAL OPERATIONS PLATFORM</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-md">
            JCB Smart CMMS
          </h1>

          {/* Subtext */}
          <p className="text-sm sm:text-base text-zinc-300 font-normal leading-relaxed max-w-md">
            A centralized platform for managing machine maintenance and industrial operations.
          </p>

          {/* 4 Feature Pills / Grid (sleek, semi-translucent glassmorphism) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-amber-400/40 backdrop-blur-md transition-all shadow-md group">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">Machine Management</span>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-amber-400/40 backdrop-blur-md transition-all shadow-md group">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                <Wrench className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">Breakdown Tracking</span>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-amber-400/40 backdrop-blur-md transition-all shadow-md group">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">Preventive Maintenance</span>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-amber-400/40 backdrop-blur-md transition-all shadow-md group">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                <ClipboardList className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">Work Order Management</span>
            </div>
          </div>
        </div>

        {/* Footer Metadata */}
        <div className="relative z-10 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-zinc-400 border-t border-white/10">
          <span className="font-medium text-zinc-300">Ballabgarh • Pune • Jaipur Manufacturing Works</span>
          <span className="font-medium text-zinc-400 sm:text-right">ISO 9001:2015 & ISO 14001:2015 Compliant</span>
        </div>
      </div>

      {/* =========================================================================
          2. RIGHT PANEL (Authentication Form Section) - 50% split on desktop
          ========================================================================= */}
      <div className="w-full flex flex-col justify-between p-8 sm:p-12 lg:p-16 xl:p-20 bg-[#F9FAFB] min-h-screen z-10">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Back to Home</span>
          </Link>

          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
            JCB INDIA PORTAL
          </span>
        </div>

        {/* Centered Form Container */}
        <div className="w-full max-w-md mx-auto my-auto py-8">
          <div className="mb-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">
              Welcome Back
            </h2>
            <p className="text-sm text-zinc-500 font-medium mt-1.5">
              Sign in to access your workspace.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          {/* Centralized Governance Notice */}
          {showForgotNotice && (
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl text-xs relative shadow-2xs">
              <button
                type="button"
                onClick={() => setShowForgotNotice(false)}
                className="absolute top-2.5 right-2.5 text-zinc-400 hover:text-zinc-700 transition cursor-pointer"
                aria-label="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-start gap-2.5 pr-4">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-900">Centralized Access Governance</p>
                  <p className="text-zinc-700 text-[11px] leading-relaxed">
                    Employee credentials and password resets are managed centrally by JCB Plant Administration. Please contact your Plant System Administrator or Shift In-Charge for access assistance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email / Employee ID */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
                Email or Employee ID
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your email or employee ID"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition font-medium shadow-2xs disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition font-medium shadow-2xs disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Row: Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-600 font-medium hover:text-zinc-900 transition">
                <input
                  type="checkbox"
                  disabled={loading}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-zinc-300 cursor-pointer"
                />
                <span>Remember Me</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotNotice(true)}
                className="text-amber-600 hover:text-amber-700 font-bold transition cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            {/* Prominent JCB Yellow Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FFB800] hover:bg-[#F59E0B] active:scale-[0.99] text-zinc-950 font-black py-3.5 rounded-lg transition-all duration-150 text-sm uppercase tracking-wider shadow-md hover:shadow-lg disabled:opacity-50 mt-3 flex items-center justify-center gap-2 border border-amber-400 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>SIGN IN</span>
                  <ArrowRight className="w-4 h-4 text-zinc-950 font-black stroke-[2.5]" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Security Info */}
        <div className="pt-6 border-t border-zinc-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span>🔒</span>
            <span className="font-medium">256-Bit SSL Encrypted • Role-Based Access</span>
          </div>
          <p className="font-medium">© 2026 JCB India Limited.</p>
        </div>
      </div>
    </div>
  );
};