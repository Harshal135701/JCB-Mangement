import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth, getRoleHomeRoute } from '../../context/AuthContext';
import { Lock, User, AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, Activity } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [identifier, setIdentifier] = useState('manager@jcb.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
      setError('Please enter your Employee ID or Email address.');
      return;
    }

    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    try {
      setLoading(true);
      const loggedInUser = await login(cleanIdentifier, password);
      const targetRoute = getRoleHomeRoute(loggedInUser.role);
      navigate(targetRoute, { replace: true });
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Authentication failed. Please verify your Employee ID and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 sm:p-6 lg:p-12 font-sans selection:bg-amber-400 selection:text-black">
      {/* =========================================================================
          FULL PAGE BACKGROUND IMAGE & INDUSTRIAL GRADIENT OVERLAY
          (Instead of floating image card, image fills background so page is put together)
          ========================================================================= */}
      <div className="absolute inset-0 z-0">
        <img
          src="/hero-excavator-sunset.jpg"
          alt="JCB Heavy Excavator Background"
          className="w-full h-full object-cover object-center filter brightness-[0.6] contrast-[1.15]"
        />
        {/* Cinematic dark gradients for legibility & focus */}
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/80 to-zinc-950/65" />
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[0.5px]" />
      </div>

      {/* =========================================================================
          JCB INDUSTRIAL CORNER ACCENTS (Top-Left & Bottom-Right Yellow Triangles)
          ========================================================================= */}
      <div 
        className="absolute -top-12 -left-12 w-48 h-48 bg-jcb-yellow rotate-12 pointer-events-none z-10 shadow-lg"
        style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
      />
      <div 
        className="absolute -bottom-12 -right-12 w-48 h-48 bg-jcb-yellow rotate-12 pointer-events-none z-10 shadow-lg"
        style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
      />
      {/* Secondary subtle black diagonal lines */}
      <div 
        className="absolute top-0 left-0 w-32 h-32 bg-black pointer-events-none z-10"
        style={{ clipPath: 'polygon(0 0, 60% 0, 0 60%)' }}
      />
      <div 
        className="absolute bottom-0 right-0 w-32 h-32 bg-black pointer-events-none z-10"
        style={{ clipPath: 'polygon(100% 40%, 100% 100%, 40% 100%)' }}
      />

      {/* =========================================================================
          MAIN CONTAINER: BRANDING & HEADLINE (LEFT) + CLEAN WHITE FORM (RIGHT)
          ========================================================================= */}
      <div className="max-w-6xl w-full mx-auto relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
        
        {/* LEFT COLUMN: BRANDING & TEXT (Directly over the background image) */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-300 hover:text-jcb-yellow transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Portal Home</span>
          </Link>

          {/* JCB Brand & Subhead */}
          <div className="space-y-5">
            {/* JCB Logo Badge */}
            <div className="inline-block bg-jcb-yellow text-black font-extrabold text-3xl sm:text-4xl px-4 py-1.5 rounded-md shadow-md tracking-widest border-2 border-black">
              JCB
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-md">
              Smart Machine <br />
              <span className="text-white">Maintenance Management System</span>
            </h1>

            {/* Yellow Accent Bar */}
            <div className="w-24 h-2 bg-jcb-yellow rounded-full shadow-sm" />

            <p className="text-base sm:text-lg font-semibold text-zinc-200 tracking-wide drop-shadow-sm max-w-lg">
              Keep Machines Running. Always.
            </p>
          </div>

          {/* Industrial Plant Trust Badges */}
          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-300">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-700/80 backdrop-blur-sm shadow-xs">
              <ShieldCheck className="w-4 h-4 text-jcb-yellow shrink-0" />
              <span className="font-semibold text-white">Heavy Plant Reliability</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-700/80 backdrop-blur-sm shadow-xs">
              <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-white">Ballabgarh • Pune • Jaipur</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CLEAN LOGIN FORM CARD */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 sm:p-10 relative">
            
            {/* Card Header (Welcome - NO "Back", NO Role Switcher Buttons) */}
            <div className="text-center mb-7">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
                Welcome
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1">
                Sign in to continue
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Employee ID / Email */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                  Employee ID
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter Employee ID or Email"
                    className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium transition shadow-2xs"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Password"
                    className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium transition shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-zinc-400 hover:text-zinc-600 focus:outline-none"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300"
                  />
                  <span>Remember Me</span>
                </label>

                <button
                  type="button"
                  onClick={() => alert('Password reset is managed by Plant IT Governance. Please contact system admin at admin@jcb.com.')}
                  className="text-amber-700 hover:text-amber-800 font-semibold transition"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-jcb-yellow hover:bg-amber-400 text-black font-extrabold py-3.5 rounded-xl transition duration-150 text-sm shadow-sm hover:shadow-md disabled:opacity-50 mt-3 flex items-center justify-center gap-2 border border-amber-500 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Login</span>
                    <ArrowRight className="w-4 h-4 text-black" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Credential Helper */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Demo Password: <strong className="text-zinc-600 font-mono">password123</strong></span>
              <span className="font-semibold text-zinc-600">JCB India</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
