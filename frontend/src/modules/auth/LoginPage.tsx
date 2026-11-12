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

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate(getRoleHomeRoute(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="min-h-screen w-full flex font-sans selection:bg-[#F9B101] selection:text-black overflow-hidden">

      {/* ===================================================================
          LEFT PANEL — JCB Excavator Background Image (60% width)
          - Image is object-fit cover, left-anchored so the logo + text
            on the left side of the artwork is always fully visible.
          - Login card lives on the RIGHT panel so nothing overlaps.
          =================================================================== */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden">
        {/* Sharp, unblurred full-panel image */}
        <img
          src="/images/jcb-login-hero-wide.png"
          alt="JCB Smart Machine Maintenance Management System"
          className="absolute inset-0 w-full h-full object-cover object-left-top select-none pointer-events-none"
          draggable={false}
        />

        {/* Subtle bottom gradient — purely aesthetic depth, never blurs the image */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

        {/* Back-to-Home link anchored top-left */}
        <div className="relative z-10 p-6 self-start">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-black/30 hover:bg-black/50 px-3 py-1.5 rounded-lg border border-white/20 backdrop-blur-[2px] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* ===================================================================
          RIGHT PANEL — Clean Login Section (40% width)
          - Completely separate from the image; no overlap possible.
          - Soft off-white background matching JCB's light branding.
          =================================================================== */}
      <div className="w-full lg:w-[40%] flex flex-col min-h-screen bg-[#F3F4F6]">

        {/* Mobile-only: Back link + badge */}
        <div className="lg:hidden flex items-center justify-between px-5 pt-5 pb-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-black transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
          <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">
            JCB INDIA CMMS
          </span>
        </div>

        {/* Mobile-only: compact branding strip (shown when image panel is hidden) */}
        <div
          className="lg:hidden relative h-44 sm:h-56 overflow-hidden"
        >
          <img
            src="/images/jcb-login-hero-wide.png"
            alt="JCB"
            className="absolute inset-0 w-full h-full object-cover object-left-top select-none pointer-events-none"
            draggable={false}
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>

        {/* Scrollable login area — centred vertically */}
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 py-10 overflow-y-auto">

          {/* Desktop badge (top-right of right panel) */}
          <div className="hidden lg:flex justify-end mb-6">
            <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
              JCB INDIA CMMS
            </span>
          </div>

          {/* White Login Card */}
          <div className="w-full max-w-[400px] mx-auto bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-[#E5E7EB] p-8 sm:p-10">

            {/* Header */}
            <div className="mb-7">
              <h2 className="text-3xl font-extrabold text-[#111827] tracking-tight">
                Welcome
              </h2>
              <p className="text-sm text-zinc-500 font-medium mt-1">
                Sign in to continue
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Forgot-password governance notice */}
            {showForgotNotice && (
              <div className="mb-5 p-4 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl text-xs relative animate-in fade-in duration-150">
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
                      Employee credentials and password resets are managed centrally by JCB Plant
                      Administration. Please contact your Plant System Administrator or Shift
                      In-Charge for access assistance.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">

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
                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#D1D5DB] rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition font-medium disabled:opacity-60"
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
                    className="w-full pl-10 pr-11 py-3 bg-white border border-[#D1D5DB] rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition font-medium disabled:opacity-60"
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

              {/* Remember Me + Forgot Password row */}
              <div className="flex items-center justify-between text-xs pt-0.5">
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

              {/* JCB Yellow Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F9B101] hover:bg-[#E5A401] active:scale-[0.99] text-black font-black py-3.5 rounded-xl transition-all duration-150 text-sm uppercase tracking-wider shadow-md hover:shadow-lg disabled:opacity-50 mt-1 flex items-center justify-center gap-2 border border-amber-400/50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>LOGIN</span>
                    <ArrowRight className="w-4 h-4 text-black stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-[11px] text-zinc-400 font-medium">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              <span>256-Bit SSL Encrypted • Role-Based Access</span>
            </div>
            <span className="hidden sm:inline">•</span>
            <span>© 2026 JCB India Limited</span>
          </div>
        </div>
      </div>
    </div>
  );
};
