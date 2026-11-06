import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldCheck, 
  Cpu, 
  Package, 
  Clock, 
  ArrowRight, 
  Wrench, 
  TrendingUp, 
  AlertTriangle,
  ChevronRight,
  Lock,
  Check,
  HardHat,
  Activity,
  Zap,
  CheckCircle2,
  Calendar,
  Building2,
  Layers,
  Sparkles,
  FileText
} from 'lucide-react';

type RoleKey = 'admin' | 'manager' | 'operator' | 'technician';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Dynamic interactive role selection: starts with none highlighted until user clicks
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [activeSiteTab, setActiveSiteTab] = useState<'ballabgarh' | 'pune' | 'jaipur'>('ballabgarh');

  const handleRoleLogin = (email: string) => {
    navigate(`/login?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-zinc-900 font-sans selection:bg-amber-400 selection:text-black">
      {/* =========================================================================
          TOP INDUSTRIAL HEADER
          ========================================================================= */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo & Plant Tag */}
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => navigate('/')}>
            <div className="bg-jcb-yellow text-black font-extrabold text-xl px-2.5 py-1 rounded-md shadow-xs tracking-wider flex items-center justify-center border border-amber-500">
              JCB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-zinc-900">
                  Smart CMMS
                </span>
                <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded tracking-wide uppercase border border-slate-200 hidden sm:inline-block">
                  Enterprise
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium hidden sm:block">
                Plant Engineering & Heavy Asset Reliability Platform
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold text-zinc-600">
            <a href="#equipment" className="hover:text-zinc-950 transition-colors">Equipment & Fleet</a>
            <a href="#platform" className="hover:text-zinc-950 transition-colors">Platform Engine</a>
            <a href="#roles" className="hover:text-zinc-950 transition-colors">4 Operational Roles</a>
            <a href="#disciplines" className="hover:text-zinc-950 transition-colors">Core Disciplines</a>
            <a href="#plants" className="hover:text-zinc-950 transition-colors">Plant Sites</a>
          </nav>

          {/* Portal CTA */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-jcb-yellow hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg shadow-xs transition-all flex items-center gap-2 text-xs uppercase tracking-wider border border-amber-500/50"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 text-black" />
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="bg-jcb-yellow hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg shadow-xs hover:shadow-sm transition-all flex items-center gap-2 text-xs uppercase tracking-wider border border-amber-500/50"
              >
                <Lock className="w-3.5 h-3.5 text-black" />
                <span>Sign In to Portal</span>
                <ArrowRight className="w-3.5 h-3.5 text-black" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          SECTION 1: INDUSTRIAL SPLIT HERO (Clean Typography - NO AWKWARD BOXES)
          ========================================================================= */}
      <section id="equipment" className="relative overflow-hidden bg-white border-b border-slate-200 py-12 lg:py-16">
        {/* Subtle, refined background grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:20px_20px] opacity-60 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Content Column (6 cols) */}
            <div className="lg:col-span-6 space-y-5">
              
              {/* Subtle Tagline Badge */}
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold tracking-wide text-amber-950 uppercase">
                  Welcome to JCB Smart CMMS
                </span>
                <span className="text-[10px] text-amber-700 font-semibold">• Plant Fleet Reliability</span>
              </div>

              {/* Main Headline (Clean typography, natural emphasis, NO WEIRD HIGHLIGHT BOXES) */}
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-zinc-950 tracking-tight leading-[1.15]">
                Heavy Equipment Solutions <br className="hidden sm:inline" />
                <span className="text-zinc-900">
                  for Every Plant Facility
                </span>
              </h1>

              {/* Subtitle with proper line-height and readable font size */}
              <p className="text-sm sm:text-base text-zinc-600 font-normal leading-relaxed max-w-xl">
                Digitalizing heavy machinery operations across JCB India manufacturing facilities. 
                Accelerate breakdown triage under 20 seconds, automate preventive maintenance schedules, manage 160,000 spare parts SKUs, and eliminate unplanned shop floor downtime.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => navigate('/login')}
                  className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-xl shadow-sm transition-all flex items-center gap-2.5 text-xs uppercase tracking-wide group"
                >
                  <span>Discover Portal</span>
                  <div className="w-5 h-5 rounded-full bg-jcb-yellow text-black flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>

                <a
                  href="#roles"
                  className="bg-white hover:bg-slate-50 text-zinc-800 font-semibold px-5 py-3 rounded-xl transition-all flex items-center gap-1.5 text-xs border border-slate-300 shadow-2xs hover:border-slate-400"
                >
                  <span>Explore 4 Roles</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                </a>

                <button
                  onClick={() => handleRoleLogin('manager@jcb.com')}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold px-4 py-3 rounded-xl transition-all flex items-center gap-1.5 text-xs border border-amber-300"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-800" />
                  <span>Demo Triage</span>
                </button>
              </div>

              {/* 4 Feature Badges (Photo 1 "YOUR TEXT HERE" checklist style, neat & small) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-amber-400/20 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-amber-900 font-bold" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-700">QR Asset Scan</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-amber-400/20 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-amber-900 font-bold" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-700">20s Triage</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-amber-400/20 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-amber-900 font-bold" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-700">160k Spares</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-amber-400/20 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-amber-900 font-bold" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-700">ISO 9001 Trail</span>
                </div>
              </div>

            </div>

            {/* Right Visual Card (6 cols) - High-Res Heavy Equipment Visual with Sharp Telemetry */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-br from-amber-400/20 via-jcb-yellow/15 to-slate-100 p-5 sm:p-6 shadow-md">
                
                {/* Header status bar */}
                <div className="flex items-center justify-between mb-3.5">
                  <div className="bg-zinc-950 text-white text-[10px] font-bold px-3 py-1 rounded-md tracking-wider uppercase flex items-center gap-1.5 shadow-2xs">
                    <Activity className="w-3 h-3 text-jcb-yellow animate-pulse" />
                    <span>JCB Heavy Excavator Series</span>
                  </div>
                  <span className="bg-white/90 text-zinc-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-slate-300">
                    Class A Critical Asset
                  </span>
                </div>

                {/* Primary Heavy Machinery Display - High Contrast & Crisp */}
                <div className="relative rounded-xl overflow-hidden shadow-sm border border-slate-300 group bg-zinc-950">
                  <img
                    src="/hero-excavator-sunset.jpg"
                    alt="JCB Heavy Excavator in Earthmoving Operations"
                    className="w-full h-64 sm:h-72 object-cover object-center transform transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                  
                  {/* Bottom overlay badge */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-medium">
                    <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-[11px]">
                      <span className="font-bold text-jcb-yellow">JCB JS205</span> • 140 HP Turbo • 20.5 Tonne
                    </div>
                    <span className="bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase">
                      Operational
                    </span>
                  </div>
                </div>

                {/* Live Telemetry KPI Strip */}
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs mt-3.5">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-zinc-500 text-[11px]">
                      Live Telemetry • Ballabgarh Works (Shop Line 01)
                    </span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      99.8% Uptime
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100">
                    <div>
                      <div className="text-[10px] text-zinc-500 font-medium">Vibration</div>
                      <div className="text-xs font-bold text-zinc-900 font-mono">1.2 mm/s</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 font-medium">Oil Temp</div>
                      <div className="text-xs font-bold text-zinc-900 font-mono">68.4 °C</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 font-medium">Hydraulic Pressure</div>
                      <div className="text-xs font-bold text-emerald-700 font-mono">210 Bar</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          KEY OPERATIONAL METRICS STRIP (Sleek, Clean, Well-Aligned)
          ========================================================================= */}
      <section className="bg-zinc-950 text-white py-6 border-y-2 border-jcb-yellow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
            <div className="pt-2 lg:pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-jcb-yellow font-mono tracking-tight">1,000+</div>
              <div className="text-xs font-bold uppercase tracking-wider text-white mt-0.5">Industrial Assets</div>
              <div className="text-[11px] text-zinc-400 font-normal">Class A, B & C Machines</div>
            </div>

            <div className="pt-2 lg:pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-jcb-yellow font-mono tracking-tight">160,000+</div>
              <div className="text-xs font-bold uppercase tracking-wider text-white mt-0.5">Spare Parts SKUs</div>
              <div className="text-[11px] text-zinc-400 font-normal">Sub-10ms Trigram Search</div>
            </div>

            <div className="pt-2 lg:pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-jcb-yellow font-mono tracking-tight">3 Works</div>
              <div className="text-xs font-bold uppercase tracking-wider text-white mt-0.5">Manufacturing Plants</div>
              <div className="text-[11px] text-zinc-400 font-normal">Ballabgarh, Pune & Jaipur</div>
            </div>

            <div className="pt-2 lg:pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">99.8%</div>
              <div className="text-xs font-bold uppercase tracking-wider text-white mt-0.5">Target Availability</div>
              <div className="text-[11px] text-zinc-400 font-normal">Dual Downtime Tracking</div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: FULL-WIDTH HEAVY EQUIPMENT FLEET BANNER (Photo 1 Mid Card)
          ========================================================================= */}
      <section className="py-10 bg-slate-100 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl overflow-hidden border border-slate-300 bg-zinc-950 shadow-md">
            {/* Background Image of Machinery Shop Floor */}
            <div className="absolute inset-0 opacity-40 mix-blend-luminosity">
              <img
                src="https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=1600&q=80"
                alt="JCB Industrial Heavy Machinery Fleet"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />

            {/* Content Overlay */}
            <div className="relative p-6 sm:p-10 max-w-2xl space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="bg-jcb-yellow text-black font-extrabold text-sm px-2 py-0.5 rounded border border-amber-500 shadow-xs">
                  JCB
                </div>
                <span className="text-jcb-yellow font-bold text-xs uppercase tracking-wider">
                  Heavy Industrial Asset Fleet & Logistics
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight uppercase leading-tight">
                Dependable Power. <br />
                <span className="text-jcb-yellow">Unrivaled Shop Floor</span> Performance.
              </h2>

              <p className="text-zinc-300 text-xs sm:text-sm font-normal leading-relaxed">
                From 1,000-ton hydraulic stamping presses and Mazak CNC machining centers to tracked heavy excavators and automated robotic welding cells, our CMMS guarantees continuous asset reliability across all shifts.
              </p>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => navigate('/login')}
                  className="bg-jcb-yellow hover:bg-amber-400 text-black font-bold px-5 py-2.5 rounded-lg shadow-sm transition-all flex items-center gap-2 text-xs uppercase tracking-wider border border-amber-500"
                >
                  <span>Access Asset Fleet</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: "LIFTING PLANT UPTIME TO NEW HEIGHTS" (Photo 1 Style)
          ========================================================================= */}
      <section id="platform" className="py-14 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Column (7 cols): Checklist with Yellow Square Icons */}
            <div className="lg:col-span-7 space-y-5">
              <span className="text-amber-700 text-xs font-bold tracking-widest uppercase block">
                Platform Capabilities
              </span>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
                Lifting Plant Uptime <br />
                <span className="text-amber-600">to New Heights</span>
              </h2>

              <p className="text-sm sm:text-base text-zinc-600 font-normal leading-relaxed">
                JCB Smart CMMS connects operators, maintenance managers, certified technicians, and plant executives in a seamless closed-loop feedback system. Every ticket, spare part reservation, and inspection sign-off is digitally verified.
              </p>

              {/* 4 Feature Checklist Blocks (Neat, Balanced, Professional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="w-7 h-7 rounded-md bg-jcb-yellow text-black flex items-center justify-center font-bold shrink-0 border border-amber-500 shadow-2xs">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-zinc-900 tracking-wide mb-0.5">
                      Dual Downtime Accounting
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-normal leading-normal">
                      Separates machine stoppage from response delay (operator call to technician arrival on site).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="w-7 h-7 rounded-md bg-jcb-yellow text-black flex items-center justify-center font-bold shrink-0 border border-amber-500 shadow-2xs">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-zinc-900 tracking-wide mb-0.5">
                      160k SKU Stock Ledger
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-normal leading-normal">
                      PostgreSQL GIN trigram index delivers sub-10ms search with segregated physical, reserved, and available stock.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="w-7 h-7 rounded-md bg-jcb-yellow text-black flex items-center justify-center font-bold shrink-0 border border-amber-500 shadow-2xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-zinc-900 tracking-wide mb-0.5">
                      20-Sec Breakdown Ticket
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-normal leading-normal">
                      Mobile operator interface with machine QR code scanning, photo evidence upload, and priority triage.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="w-7 h-7 rounded-md bg-jcb-yellow text-black flex items-center justify-center font-bold shrink-0 border border-amber-500 shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-zinc-900 tracking-wide mb-0.5">
                      Digital Canvas Sign-Off
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-normal leading-normal">
                      HTML5 touch canvas digital signatures, pre-shift safety checklists, and append-only audit trail.
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column (5 cols): Construction Operator & Machinery Card */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-md p-4 space-y-3.5">
                <div className="relative rounded-xl overflow-hidden h-64 sm:h-72">
                  <img
                    src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80"
                    alt="JCB Plant Engineer in High-Vis Safety Gear"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-sm text-jcb-yellow text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                    Plant Engineering Team
                  </div>
                </div>

                {/* Clean quote card */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-zinc-900 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-amber-900">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                      Certified Shop Floor Operator
                    </span>
                    <span className="text-[10px] bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded font-bold uppercase">
                      Ballabgarh Works
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700 font-medium leading-relaxed">
                    "With instant QR scan and sub-10ms parts lookup, our technician arrival delay reduced by 64% across our primary manufacturing line."
                  </p>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    — Rajesh Kumar • Senior Mechanical Engineer (Shift A)
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: 4 OPERATIONAL ROLES (Interactive Selection: HIGHLIGHTS ONLY SELECTED!)
          ========================================================================= */}
      <section id="roles" className="py-14 sm:py-20 bg-zinc-950 text-white border-b-2 border-jcb-yellow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-jcb-yellow text-xs font-bold tracking-widest uppercase mb-1.5 block">
              Role-Based Workspaces
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Select an Operational Role Workspace
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm font-normal leading-relaxed mt-1.5">
              Click any role card below to inspect its capabilities. Only the selected module highlights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* ROLE 1: Plant Administrator */}
            <div 
              onClick={() => setSelectedRole(selectedRole === 'admin' ? null : 'admin')}
              className={`rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between relative ${
                selectedRole === 'admin'
                  ? 'bg-zinc-900 border-2 border-jcb-yellow shadow-xl transform lg:-translate-y-1 ring-1 ring-amber-400'
                  : selectedRole !== null
                  ? 'bg-zinc-900/60 border border-zinc-800 opacity-60 hover:opacity-100'
                  : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700 opacity-100'
              }`}
            >
              {selectedRole === 'admin' && (
                <span className="absolute -top-2.5 right-4 bg-jcb-yellow text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-black shadow-xs">
                  Active Selection
                </span>
              )}

              <div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors ${
                  selectedRole === 'admin'
                    ? 'bg-jcb-yellow text-black border border-amber-400'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>

                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  System Command
                </div>
                <h3 className={`text-base font-bold mb-2 transition-colors ${
                  selectedRole === 'admin' ? 'text-jcb-yellow' : 'text-white'
                }`}>
                  Plant Administrator
                </h3>
                <p className="text-zinc-400 text-xs mb-4 leading-relaxed font-normal">
                  Full master data ledger: plants, machine registry, QR codes, 160k spares catalog, technician enrollment, and audit logs.
                </p>

                <ul className="space-y-1.5 text-xs text-zinc-300 mb-5">
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'admin' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>Machine & QR Code Master</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'admin' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>160k Spares Catalog CRUD</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'admin' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>Full Audit Log & Compliance</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRoleLogin('admin@jcb.com');
                }}
                className={`w-full text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
                  selectedRole === 'admin'
                    ? 'bg-jcb-yellow hover:bg-amber-400 text-black shadow border border-amber-500 font-extrabold'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
              >
                <span>Login as Admin</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* ROLE 2: Maintenance Manager */}
            <div 
              onClick={() => setSelectedRole(selectedRole === 'manager' ? null : 'manager')}
              className={`rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between relative ${
                selectedRole === 'manager'
                  ? 'bg-zinc-900 border-2 border-jcb-yellow shadow-xl transform lg:-translate-y-1 ring-1 ring-amber-400'
                  : selectedRole !== null
                  ? 'bg-zinc-900/60 border border-zinc-800 opacity-60 hover:opacity-100'
                  : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700 opacity-100'
              }`}
            >
              {selectedRole === 'manager' && (
                <span className="absolute -top-2.5 right-4 bg-jcb-yellow text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-black shadow-xs">
                  Active Selection
                </span>
              )}

              <div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors ${
                  selectedRole === 'manager'
                    ? 'bg-jcb-yellow text-black border border-amber-400'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}>
                  <TrendingUp className="w-5 h-5" />
                </div>

                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Supervision & Dispatch
                </div>
                <h3 className={`text-base font-bold mb-2 transition-colors ${
                  selectedRole === 'manager' ? 'text-jcb-yellow' : 'text-white'
                }`}>
                  Maintenance Manager
                </h3>
                <p className="text-zinc-400 text-xs mb-4 leading-relaxed font-normal">
                  Real-time shop floor triage, breakdown ticket verification, technician assignment, PR approval, and returnable gate passes (RDC).
                </p>

                <ul className="space-y-1.5 text-xs text-zinc-300 mb-5">
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'manager' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>Shop Floor Breakdown Triage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'manager' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>Technician Dispatch & SLA</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'manager' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>PR & Gate Pass Approval</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRoleLogin('manager@jcb.com');
                }}
                className={`w-full text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
                  selectedRole === 'manager'
                    ? 'bg-jcb-yellow hover:bg-amber-400 text-black shadow border border-amber-500 font-extrabold'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
              >
                <span>Login as Manager</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* ROLE 3: Machine Operator */}
            <div 
              onClick={() => setSelectedRole(selectedRole === 'operator' ? null : 'operator')}
              className={`rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between relative ${
                selectedRole === 'operator'
                  ? 'bg-zinc-900 border-2 border-jcb-yellow shadow-xl transform lg:-translate-y-1 ring-1 ring-amber-400'
                  : selectedRole !== null
                  ? 'bg-zinc-900/60 border border-zinc-800 opacity-60 hover:opacity-100'
                  : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700 opacity-100'
              }`}
            >
              {selectedRole === 'operator' && (
                <span className="absolute -top-2.5 right-4 bg-jcb-yellow text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-black shadow-xs">
                  Active Selection
                </span>
              )}

              <div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors ${
                  selectedRole === 'operator'
                    ? 'bg-jcb-yellow text-black border border-amber-400'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}>
                  <HardHat className="w-5 h-5" />
                </div>

                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Shop Floor Execution
                </div>
                <h3 className={`text-base font-bold mb-2 transition-colors ${
                  selectedRole === 'operator' ? 'text-jcb-yellow' : 'text-white'
                }`}>
                  Machine Operator
                </h3>
                <p className="text-zinc-400 text-xs mb-4 leading-relaxed font-normal">
                  Rapid breakdown reporting under 20 seconds, machine QR asset lookup, inspection photo upload, and pre-shift checklist digital sign-off.
                </p>

                <ul className="space-y-1.5 text-xs text-zinc-300 mb-5">
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'operator' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>20-Sec Breakdown Ticket (CMP)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'operator' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>Machine QR Asset Scan</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'operator' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>Pre-Shift Safety Checklists</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRoleLogin('operator@jcb.com');
                }}
                className={`w-full text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
                  selectedRole === 'operator'
                    ? 'bg-jcb-yellow hover:bg-amber-400 text-black shadow border border-amber-500 font-extrabold'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
              >
                <span>Login as Operator</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* ROLE 4: Field Technician */}
            <div 
              onClick={() => setSelectedRole(selectedRole === 'technician' ? null : 'technician')}
              className={`rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between relative ${
                selectedRole === 'technician'
                  ? 'bg-zinc-900 border-2 border-jcb-yellow shadow-xl transform lg:-translate-y-1 ring-1 ring-amber-400'
                  : selectedRole !== null
                  ? 'bg-zinc-900/60 border border-zinc-800 opacity-60 hover:opacity-100'
                  : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700 opacity-100'
              }`}
            >
              {selectedRole === 'technician' && (
                <span className="absolute -top-2.5 right-4 bg-jcb-yellow text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-black shadow-xs">
                  Active Selection
                </span>
              )}

              <div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors ${
                  selectedRole === 'technician'
                    ? 'bg-jcb-yellow text-black border border-amber-400'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}>
                  <Wrench className="w-5 h-5" />
                </div>

                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Maintenance Workbench
                </div>
                <h3 className={`text-base font-bold mb-2 transition-colors ${
                  selectedRole === 'technician' ? 'text-jcb-yellow' : 'text-white'
                }`}>
                  Field Technician
                </h3>
                <p className="text-zinc-400 text-xs mb-4 leading-relaxed font-normal">
                  Dispatched work orders workbench, milestone tracking, spare parts reservation, labor log recording, and root cause analysis.
                </p>

                <ul className="space-y-1.5 text-xs text-zinc-300 mb-5">
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'technician' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>Assigned Work Orders (WO)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'technician' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>Spare Parts Reservation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 shrink-0 ${selectedRole === 'technician' ? 'text-jcb-yellow' : 'text-zinc-500'}`} />
                    <span>Root Cause & Labor Log</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRoleLogin('tech1@jcb.com');
                }}
                className={`w-full text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
                  selectedRole === 'technician'
                    ? 'bg-jcb-yellow hover:bg-amber-400 text-black shadow border border-amber-500 font-extrabold'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
              >
                <span>Login as Technician</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: CORE INDUSTRIAL DISCIPLINES (Real Heavy Machinery, Zero Broken Images)
          ========================================================================= */}
      <section id="disciplines" className="py-14 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-amber-700 text-xs font-bold tracking-widest uppercase mb-1.5 block">
              What We Maintain
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight leading-tight">
              Core Industrial Disciplines
            </h2>
            <p className="text-zinc-600 text-xs sm:text-sm font-normal leading-relaxed mt-1.5">
              Comprehensive maintenance engineering across heavy earthmoving equipment, automated press shops, and precision assembly lines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Discipline 1: Heavy Earthmoving Machinery */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs hover:shadow-md transition-all">
              <div className="h-48 relative overflow-hidden bg-zinc-900">
                <img
                  src="/hero-excavator.png"
                  alt="Heavy Earthmoving & Tracked Excavators"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-sm text-jcb-yellow text-[10px] font-bold px-2.5 py-0.5 rounded uppercase">
                  Discipline 01
                </div>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="text-base font-bold text-zinc-950">
                  Heavy Earthmoving & Excavation
                </h3>
                <p className="text-zinc-600 text-xs font-normal leading-relaxed">
                  Precision maintenance for backhoe loaders, tracked excavators, wheeled loaders, and chassis structural welding booms operating in demanding site conditions.
                </p>
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-zinc-500 font-mono">450+ Active Fleet</span>
                  <button onClick={() => navigate('/login')} className="font-bold text-amber-700 hover:text-black flex items-center gap-1">
                    <span>Inspect Assets</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Discipline 2: High-Tonnage Presses & CNC */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs hover:shadow-md transition-all">
              <div className="h-48 relative overflow-hidden bg-zinc-900">
                <img
                  src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80"
                  alt="High-Tonnage Hydraulic Presses and Machining"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-sm text-jcb-yellow text-[10px] font-bold px-2.5 py-0.5 rounded uppercase">
                  Discipline 02
                </div>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="text-base font-bold text-zinc-950">
                  High-Tonnage Presses & CNC Bays
                </h3>
                <p className="text-zinc-600 text-xs font-normal leading-relaxed">
                  Stamping press hydraulic rams, Mazak 12,000 RPM high-precision spindle bearings, tool magazines, and laser cutting lines delivering tight tolerances.
                </p>
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-zinc-500 font-mono">320+ Precision Cells</span>
                  <button onClick={() => navigate('/login')} className="font-bold text-amber-700 hover:text-black flex items-center gap-1">
                    <span>Inspect Assets</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Discipline 3: Robotic Welding & Automation */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs hover:shadow-md transition-all">
              <div className="h-48 relative overflow-hidden bg-zinc-900">
                <img
                  src="https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=800&q=80"
                  alt="Robotic Welding Arms and Automation"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-sm text-jcb-yellow text-[10px] font-bold px-2.5 py-0.5 rounded uppercase">
                  Discipline 03
                </div>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="text-base font-bold text-zinc-950">
                  Robotic Welding & Automation
                </h3>
                <p className="text-zinc-600 text-xs font-normal leading-relaxed">
                  Fanuc 6-axis robotic welding arms, servo drive motors, automated conveyer transfer lines, and surface paint treatment plants running 24/7.
                </p>
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-zinc-500 font-mono">230+ Robotic Stations</span>
                  <button onClick={() => navigate('/login')} className="font-bold text-amber-700 hover:text-black flex items-center gap-1">
                    <span>Inspect Assets</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: MANUFACTURING SITES FOOTPRINT (Zero Drones, Authentic Plants)
          ========================================================================= */}
      <section id="plants" className="py-14 sm:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-amber-700 text-xs font-bold tracking-widest uppercase mb-1.5 block">
              Manufacturing Operations
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight leading-tight">
              JCB India Manufacturing Sites
            </h2>
            <p className="text-zinc-600 text-xs sm:text-sm font-normal leading-relaxed mt-1.5">
              Production facilities housing heavy machinery, stamping presses, and robotic welding lines.
            </p>
          </div>

          {/* Plant Selector Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex p-1 bg-slate-200/80 rounded-xl border border-slate-300">
              <button
                onClick={() => setActiveSiteTab('ballabgarh')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeSiteTab === 'ballabgarh'
                    ? 'bg-zinc-950 text-jcb-yellow shadow-xs'
                    : 'text-zinc-700 hover:text-black'
                }`}
              >
                Ballabgarh Works (PLT-001)
              </button>
              <button
                onClick={() => setActiveSiteTab('pune')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeSiteTab === 'pune'
                    ? 'bg-zinc-950 text-jcb-yellow shadow-xs'
                    : 'text-zinc-700 hover:text-black'
                }`}
              >
                Pune Operations (PLT-002)
              </button>
              <button
                onClick={() => setActiveSiteTab('jaipur')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeSiteTab === 'jaipur'
                    ? 'bg-zinc-950 text-jcb-yellow shadow-xs'
                    : 'text-zinc-700 hover:text-black'
                }`}
              >
                Jaipur Mega Plant (PLT-003)
              </button>
            </div>
          </div>

          {/* Plant Details Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-4xl mx-auto">
            {activeSiteTab === 'ballabgarh' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-zinc-950">Ballabgarh Works</h3>
                    <p className="text-amber-800 text-xs font-bold uppercase tracking-wider mt-0.5">
                      Haryana, India • Flagship Backhoe Loader Facility
                    </p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                    Active Facility
                  </span>
                </div>

                <p className="text-zinc-600 text-xs sm:text-sm font-normal leading-relaxed">
                  World's largest manufacturing plant for Backhoe Loaders. Features heavy stamping lines, 450+ connected machines, CNC machining bays, and automated paint lines.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Active Machines</div>
                    <div className="text-base font-bold text-zinc-900">450+ Units</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Target OEE</div>
                    <div className="text-base font-bold text-emerald-700">92.4%</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Shops & Lines</div>
                    <div className="text-base font-bold text-zinc-900">12 Bays</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Active Techs</div>
                    <div className="text-base font-bold text-zinc-900">24 Assigned</div>
                  </div>
                </div>
              </div>
            )}

            {activeSiteTab === 'pune' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-zinc-950">Pune Heavy Operations</h3>
                    <p className="text-amber-800 text-xs font-bold uppercase tracking-wider mt-0.5">
                      Maharashtra, India • Heavy Excavators & Transmission Hub
                    </p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                    Active Facility
                  </span>
                </div>

                <p className="text-zinc-600 text-xs sm:text-sm font-normal leading-relaxed">
                  Dedicated to heavy tracked excavators and precision transmissions. Equipped with high-precision horizontal boring machines, robotic welding bays, and 320+ monitored assets.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Active Machines</div>
                    <div className="text-base font-bold text-zinc-900">320+ Units</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Target OEE</div>
                    <div className="text-base font-bold text-emerald-700">90.8%</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Shops & Lines</div>
                    <div className="text-base font-bold text-zinc-900">8 Bays</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Active Techs</div>
                    <div className="text-base font-bold text-zinc-900">18 Assigned</div>
                  </div>
                </div>
              </div>
            )}

            {activeSiteTab === 'jaipur' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-zinc-950">Jaipur Mega Plant</h3>
                    <p className="text-amber-800 text-xs font-bold uppercase tracking-wider mt-0.5">
                      Rajasthan, India • Eco-Manufacturing & Telehandlers
                    </p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                    Active Facility
                  </span>
                </div>

                <p className="text-zinc-600 text-xs sm:text-sm font-normal leading-relaxed">
                  Eco-friendly manufacturing facility producing next-generation Loadall telescopic handlers, skid steers, and access platforms with 280+ sensor-equipped machines.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Active Machines</div>
                    <div className="text-base font-bold text-zinc-900">280+ Units</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Target OEE</div>
                    <div className="text-base font-bold text-emerald-700">94.1%</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Shops & Lines</div>
                    <div className="text-base font-bold text-zinc-900">7 Bays</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-zinc-500 font-sans">Active Techs</div>
                    <div className="text-base font-bold text-zinc-900">14 Assigned</div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* =========================================================================
          PROFESSIONAL ENTERPRISE FOOTER
          ========================================================================= */}
      <footer className="bg-zinc-950 py-10 text-zinc-400 text-xs border-t-2 border-jcb-yellow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-5 pb-6 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="bg-jcb-yellow text-black font-extrabold text-lg px-2.5 py-0.5 rounded shadow-xs tracking-wider border border-amber-500">
                JCB
              </div>
              <div>
                <p className="text-white font-bold text-sm tracking-wide">JCB INDIA LIMITED</p>
                <p className="text-zinc-400 text-xs font-normal">Smart Machine Maintenance Management System (CMMS)</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="bg-jcb-yellow hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg shadow-xs transition-colors text-xs tracking-wider uppercase border border-amber-500/50"
              >
                Sign In to Portal
              </button>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-zinc-400 font-normal">
            <p>© 2026 JCB India Limited. All Rights Reserved. Plant Engineering & Asset Reliability Platform.</p>
            <p className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span>Ballabgarh • Pune • Jaipur | ISO 9001:2015 & ISO 14001:2015 Compliant</span>
            </p>
          </div>

        </div>
      </footer>
    </div>
  );
};