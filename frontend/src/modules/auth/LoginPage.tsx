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
    /*
     * ROOT CONTAINER
     * ─────────────────────────────────────────────────────────────────────────
     * The JCB excavator image is set as a full-page background covering the
     * entire viewport (bg-cover, left-anchored). It provides the visual
     * atmosphere — sky on the upper-right, excavator on the lower-left.
     *
     * ON TOP of this we render a true two-column flex layout:
     *   LEFT  column  (flex-1, max 55%)  → HTML branding section
     *   RIGHT column  (fixed 420px card) → Login card (unchanged design)
     *
     * Because the branding is real HTML text — NOT the text baked into the PNG —
     * it can NEVER overflow into the right column regardless of viewport width.
     * The background image's own text is covered by our HTML text on top.
     * ─────────────────────────────────────────────────────────────────────────
     */
    <div
      className="min-h-screen w-full font-sans selection:bg-[#F9B101] selection:text-black overflow-x-hidden flex flex-col"
      style={{
        backgroundImage: "url('/images/jcb-login-hero-wide.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'left center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* ── Top navigation bar ──────────────────────────────────────────── */}
      <header className="relative z-20 w-full px-6 py-4 flex items-center justify-between flex-shrink-0">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-700 hover:text-black bg-white/80 hover:bg-white px-3.5 py-1.5 rounded-lg border border-zinc-200/70 shadow-sm transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>

        <span className="text-[11px] font-black text-zinc-700 uppercase tracking-widest bg-white/70 px-3 py-1 rounded-md border border-zinc-200/60 shadow-sm">
          JCB INDIA CMMS
        </span>
      </header>

      {/* ── Main two-column body ─────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-stretch">

        {/* ================================================================
            LEFT COLUMN — HTML Branding
            ================================================================
            • Takes all remaining space (flex-1) up to a max of 55% on desktop.
            • Branding text is rendered as real DOM elements — it cannot bleed
              into the right column.
            • Has a strict max-width guard so the heading never reaches the card.
            • On mobile (<lg) this stacks above the card; padding is tighter.
        ================================================================ */}
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-14 xl:px-20 py-10 lg:py-16 lg:max-w-[55%] xl:max-w-[58%]">

          {/* JCB Official Logo */}
          <div className="mb-6 lg:mb-8">
            <img
              src="/images/jcb-official-logo.png"
              alt="JCB Logo"
              className="w-36 sm:w-44 lg:w-48 xl:w-52 h-auto object-contain select-none"
              draggable={false}
            />
          </div>

          {/* Main Heading — two explicit lines, never wraps into card zone */}
          <div className="mb-1">
            <h1 className="text-2xl sm:text-3xl lg:text-[2rem] xl:text-[2.4rem] font-extrabold text-[#111827] leading-[1.2] tracking-tight">
              Smart Machine<br />
              Maintenance Management System
            </h1>
          </div>

          {/* JCB Yellow Underline */}
          <div className="w-14 h-[5px] bg-[#F9B101] rounded-full my-4 lg:my-5" />

          {/* Tagline */}
          <p className="text-sm sm:text-base lg:text-[1.05rem] font-semibold text-zinc-700 tracking-tight">
            Keep Machines Running. Always.
          </p>
        </div>

        {/* ================================================================
            RIGHT COLUMN — Login Card
            ================================================================
            • Fixed-width column that holds the card, padded from the right edge.
            • Background is transparent — the sky from the full-page image shows
              through naturally (no grey panel).
            • The card itself is 100% unchanged from the original design.
        ================================================================ */}
        <div className="flex items-center justify-center lg:justify-end px-4 py-8 lg:py-0 lg:pr-14 xl:pr-20 lg:w-auto lg:flex-shrink-0">

          {/* ── White Login Card (design unchanged) ── */}
          <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_15px_45px_rgba(0,0,0,0.12)] border border-[#E5E7EB] p-8 sm:p-10 animate-in fade-in duration-200">

            {/* Card Header */}
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

            {/* Forgot-password Governance Notice */}
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
                      Employee credentials and password resets are managed centrally by JCB Plant
                      Administration. Please contact your Plant System Administrator or Shift
                      In-Charge for access assistance.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Login Form */}
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
                    onChange={(e) => { setIdentifier(e.target.value); if (error) setError(''); }}
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
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
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

              {/* Remember Me + Forgot Password */}
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

              {/* JCB Yellow LOGIN Button */}
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
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="relative z-20 w-full px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-white/75 px-3 py-1 rounded-md border border-zinc-200/60 shadow-2xs">
          <Lock className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-semibold text-zinc-700">256-Bit SSL Encrypted • Role-Based Access</span>
        </div>
        <p className="font-semibold text-zinc-700 bg-white/75 px-3 py-1 rounded-md border border-zinc-200/60 shadow-2xs">
          © 2026 JCB India Limited.
        </p>
      </footer>
    </div>
  );
};
