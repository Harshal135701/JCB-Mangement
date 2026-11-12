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
    <div
      className="min-h-screen w-full flex flex-col font-sans selection:bg-[#F9B101] selection:text-black overflow-x-hidden"
      style={{
        /*
         * Full-page background — the wide JCB artwork.
         * background-position: left center  → anchors the image's LEFT edge to
         * the viewport's left edge, pushing the centred title+logo LEFTWARD.
         * The right portion of the image (open sky) stays on the right side of
         * the viewport — exactly where the login card sits, with no overlap.
         */
        backgroundImage: "url('/images/jcb-login-hero-wide.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'left center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll',
      }}
    >
      {/* ── Top bar ── */}
      <header className="relative z-10 w-full px-5 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-700 hover:text-black bg-white/80 hover:bg-white px-3 py-1.5 rounded-lg border border-zinc-200/70 shadow-sm transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>

        <span className="text-[11px] font-black text-zinc-700 uppercase tracking-widest bg-white/70 px-3 py-1 rounded-md border border-zinc-200/60 shadow-sm">
          JCB INDIA CMMS
        </span>
      </header>

      {/* ── Main — card pushed hard to the right into the clear-sky zone ── */}
      <main className="relative z-10 flex-1 flex items-center justify-end pr-6 sm:pr-10 lg:pr-14 xl:pr-20 py-6">

        {/* White login card — sits in the right open-sky area of the image */}
        <div className="w-full max-w-[390px] bg-white/95 backdrop-blur-[1px] rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.14)] border border-white/80 p-7 sm:p-9">

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-[#111827] tracking-tight">
              Welcome
            </h2>
            <p className="text-xs text-zinc-500 font-medium mt-1">
              Sign in to continue
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          {/* Forgot-password governance notice */}
          {showForgotNotice && (
            <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs relative animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => setShowForgotNotice(false)}
                className="absolute top-2.5 right-2.5 text-zinc-400 hover:text-zinc-700 transition cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-start gap-2 pr-4">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-900">Centralized Access Governance</p>
                  <p className="text-zinc-700 text-[11px] leading-relaxed">
                    Credentials are managed by JCB Plant Administration. Contact your System Administrator for access assistance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Employee ID */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                Employee ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); if (error) setError(''); }}
                  placeholder="Employee ID or email"
                  autoComplete="username"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#D1D5DB] rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2.5 bg-white border border-[#D1D5DB] rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none cursor-pointer p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me + Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-600 font-medium hover:text-zinc-900 transition">
                <input
                  type="checkbox"
                  disabled={loading}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#D1D5DB] cursor-pointer accent-[#F9B101]"
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
              className="w-full bg-[#F9B101] hover:bg-[#E5A401] active:scale-[0.99] text-black font-black py-3 rounded-xl transition-all duration-150 text-sm uppercase tracking-wider shadow-md hover:shadow-lg disabled:opacity-50 mt-1 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>LOGIN</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 w-full px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 bg-white/70 px-3 py-1 rounded-md border border-zinc-200/50">
          <Lock className="w-3 h-3 text-zinc-500" />
          <span className="font-semibold text-zinc-700">256-Bit SSL Encrypted • Role-Based Access</span>
        </div>
        <p className="font-semibold text-zinc-700 bg-white/70 px-3 py-1 rounded-md border border-zinc-200/50">
          © 2026 JCB India Limited
        </p>
      </footer>
    </div>
  );
};
