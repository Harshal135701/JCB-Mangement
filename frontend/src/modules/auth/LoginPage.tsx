import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, getRoleHomeRoute } from '../../context/AuthContext';
import {
  Lock,
  User,
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Info,
  X,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Inputs initialize empty by default — no prefill or hardcoded demo credentials
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
      setError('Please enter your Employee ID or email.');
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
          'Invalid credentials. Please verify your Employee ID and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans selection:bg-[#F9B101] selection:text-black overflow-x-hidden">
      {/* =========================================================================
          1. LEFT PANEL: JCB Excavator Background & Industrial Branding (55% width)
          ========================================================================= */}
      <div className="w-full lg:w-[55%] min-h-[440px] sm:min-h-[520px] lg:min-h-screen relative flex flex-col justify-between overflow-hidden bg-[#E5E9EE]">
        {/* Supplied Extracted JCB Excavator Background Image */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-no-repeat bg-[center_bottom] pointer-events-none select-none transition-transform duration-700"
          style={{
            backgroundImage: "url('/images/jcb-login-background.png')",
          }}
        />

        {/* Subtle Light Grey / White Shade Overlay (reduces intensity slightly, exactly matching reference) */}
        <div className="absolute inset-0 z-1 bg-white/[0.08] backdrop-brightness-[0.98] pointer-events-none" />

        {/* Top Branding Section (Positioned in the upper portion as per reference) */}
        <div className="relative z-10 pt-10 sm:pt-14 lg:pt-16 px-6 sm:px-12 flex flex-col items-center text-center">
          {/* Prominent Official JCB Logo */}
          <div className="transition-transform duration-200 hover:scale-[1.02]">
            <img
              src="/images/jcb-official-logo.png"
              alt="JCB Logo"
              className="w-40 sm:w-48 lg:w-56 h-auto mx-auto object-contain drop-shadow-sm select-none"
            />
          </div>

          {/* Heading */}
          <h1 className="mt-5 sm:mt-6 text-2xl sm:text-3xl lg:text-[32px] font-extrabold text-[#111827] text-center leading-[1.25] tracking-tight max-w-md sm:max-w-lg">
            Smart Machine<br />
            Maintenance Management System
          </h1>

          {/* Small JCB Yellow Horizontal Underline */}
          <div className="w-14 h-1.5 bg-[#F9B101] rounded-full mx-auto my-3.5 shadow-2xs" />

          {/* Tagline */}
          <p className="text-sm sm:text-base font-semibold text-zinc-700 text-center tracking-tight">
            Keep Machines Running. Always.
          </p>
        </div>

        {/* Bottom Spacer to ensure full visibility of the JCB Excavator asset */}
        <div className="relative z-10 h-32 sm:h-44 lg:h-56 pointer-events-none" />
      </div>

      {/* =========================================================================
          2. RIGHT PANEL: Clean White Login Card on Subtle Light Grey (45% width)
          ========================================================================= */}
      <div className="w-full lg:w-[45%] min-h-screen bg-[#F3F4F6] flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 z-10">
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Back to Home</span>
          </Link>

          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
            JCB INDIA CMMS
          </span>
        </div>

        {/* Clean Centered White Login Card */}
        <div className="w-full max-w-[420px] mx-auto my-auto bg-white rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.06)] border border-[#E5E7EB] p-8 sm:p-10">
          {/* Card Header: Welcome & Sign in to continue */}
          <div className="mb-6">
            <h2 className="text-3xl font-extrabold text-[#111827] tracking-tight">
              Welcome
            </h2>
            <p className="text-sm text-zinc-500 font-medium mt-1">
              Sign in to continue
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5 shadow-2xs animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          {/* Centralized Governance Notice */}
          {showForgotNotice && (
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl text-xs relative shadow-2xs animate-in fade-in duration-150">
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

          {/* Direct Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Employee ID */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
                Employee ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your employee ID or email"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-[#D1D5DB] rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition font-medium shadow-2xs disabled:opacity-60"
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
                  className="w-full pl-10 pr-11 py-3 bg-white border border-[#D1D5DB] rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition font-medium shadow-2xs disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none cursor-pointer p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Row: Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-600 font-medium hover:text-zinc-900 transition">
                <input
                  type="checkbox"
                  disabled={loading}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#D1D5DB] text-[#F9B101] focus:ring-[#F9B101] cursor-pointer accent-[#F9B101]"
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

            {/* Full-Width JCB Yellow Login Button with Arrow */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F9B101] hover:bg-[#E5A401] active:scale-[0.99] text-[#000000] font-black py-3.5 rounded-xl transition-all duration-150 text-sm uppercase tracking-wider shadow-md hover:shadow-lg disabled:opacity-50 mt-3 flex items-center justify-center gap-2 border border-amber-500/40 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>LOGIN</span>
                  <ArrowRight className="w-4 h-4 text-black font-black stroke-[2.5]" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Security Info */}
        <div className="pt-6 border-t border-zinc-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-medium">256-Bit SSL Encrypted • Role-Based Access</span>
          </div>
          <p className="font-medium">© 2026 JCB India Limited.</p>
        </div>
      </div>
    </div>
  );
};
