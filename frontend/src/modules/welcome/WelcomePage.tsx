import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldCheck, 
  Cpu, 
  Package, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Wrench, 
  Factory, 
  TrendingUp, 
  AlertTriangle,
  QrCode,
  FileCheck,
  ChevronRight,
  Sparkles,
  Lock
} from 'lucide-react';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleRoleLogin = (email: string) => {
    navigate(`/login?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-jcb-yellow selection:text-black">
      {/* Top Industrial Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* JCB Brand Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="bg-jcb-yellow text-black font-black text-3xl px-3.5 py-1 rounded shadow-lg tracking-widest flex items-center justify-center border-2 border-jcb-yellowDark">
              JCB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-wider text-white">SMART CMMS</span>
                <span className="hidden sm:inline-block bg-zinc-800 text-jcb-yellow text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase border border-zinc-700">
                  ENTERPRISE 2.0
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium hidden sm:block">
                JCB India Ltd. • Ballabgarh • Pune • Jaipur
              </p>
            </div>
          </div>

          {/* Navigation Links & Action */}
          <div className="flex items-center gap-4 sm:gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-zinc-300">
              <a href="#plants" className="hover:text-jcb-yellow transition-colors">Plants</a>
              <a href="#roles" className="hover:text-jcb-yellow transition-colors">4 Core Roles</a>
              <a href="#features" className="hover:text-jcb-yellow transition-colors">Architecture</a>
            </nav>

            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-extrabold px-5 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-2 text-sm tracking-wide"
              >
                <span>OPEN DASHBOARD</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2.5 rounded-lg shadow-lg hover:shadow-jcb-yellow/20 transition-all flex items-center gap-2 text-sm tracking-wide transform hover:-translate-y-0.5"
              >
                <Lock className="w-4 h-4 text-black" />
                <span>SIGN IN / LOGIN</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-zinc-800/80 bg-radial-gradient">
        {/* Subtle Industrial Grid Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f15_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f15_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-700/80 px-4 py-1.5 rounded-full mb-8 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-zinc-300 tracking-wider uppercase">
                Zero Paper Slips • 100% Measurable Digital Maintenance
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-none mb-6">
              HEAVY-DUTY MACHINE <br />
              <span className="text-jcb-yellow drop-shadow-[0_2px_15px_rgba(249,177,1,0.25)]">
                MAINTENANCE & ASSET
              </span>{' '}
              PERFORMANCE
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-xl text-zinc-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
              Built for JCB India’s heavy manufacturing operations. Unified control for <strong className="text-white font-semibold">1,000+ industrial machines</strong>, <strong className="text-white font-semibold">160,000 spare parts</strong>, live breakdown triage, dual downtime clocks, and multi-plant asset reliability.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-base font-black px-8 py-4 rounded-xl shadow-xl hover:shadow-jcb-yellow/30 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1"
              >
                <span>ENTER CMMS PLATFORM</span>
                <ArrowRight className="w-5 h-5 text-black" />
              </button>
              <a
                href="#roles"
                className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <span>EXPLORE 4 CORE ROLES</span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </a>
            </div>

            {/* Enterprise Quick Metrics Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-2xl backdrop-blur-sm">
              <div className="p-3 text-center border-r border-zinc-800/80 last:border-none">
                <div className="text-3xl sm:text-4xl font-black text-jcb-yellow mb-1 tracking-tight">1,000+</div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Heavy Machines</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Criticality Class A / B / C</div>
              </div>
              <div className="p-3 text-center border-r border-zinc-800/80 last:border-none">
                <div className="text-3xl sm:text-4xl font-black text-white mb-1 tracking-tight">160,000</div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Spare Parts SKUs</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Sub-10ms Trigram Search</div>
              </div>
              <div className="p-3 text-center border-r border-zinc-800/80 last:border-none">
                <div className="text-3xl sm:text-4xl font-black text-jcb-yellow mb-1 tracking-tight">3 Plants</div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Manufacturing Hubs</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Ballabgarh, Pune, Jaipur</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 mb-1 tracking-tight">99.8%</div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Target Uptime</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Dual Downtime Tracking</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Login Roles Architecture Showcase */}
      <section id="roles" className="py-20 bg-zinc-950 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-jcb-yellow text-xs font-black tracking-widest uppercase mb-2 block">
              ROLE-BASED GOVERNANCE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              4 Specialized Role Portals
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">
              A unified application with dedicated role workspaces. Store & Procurement run as functional work queues without bloating access hierarchies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Role 1: Admin */}
            <div className="bg-zinc-900 border border-zinc-800 hover:border-jcb-yellow/50 rounded-2xl p-6 transition-all group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-jcb-yellow border border-amber-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-jcb-yellow uppercase tracking-widest mb-1">Role 1</div>
                <h3 className="text-xl font-bold text-white mb-2">Enterprise Admin</h3>
                <p className="text-zinc-400 text-xs mb-5 leading-relaxed">
                  Total governance across plants, shops, bays, 1,000+ machine masters, QR codes, 160k parts master, user privileges, SLA policies, and full audit logs.
                </p>
                <ul className="space-y-2 text-xs text-zinc-300 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-jcb-yellow shrink-0" />
                    <span>Master Machine & QR Setup</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-jcb-yellow shrink-0" />
                    <span>Multi-Plant Hierarchy</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-jcb-yellow shrink-0" />
                    <span>Full Security & Audit Trail</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('admin@jcb.com')}
                className="w-full bg-zinc-800 hover:bg-jcb-yellow hover:text-black text-white text-xs font-extrabold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>Login as Admin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role 2: Manager */}
            <div className="bg-zinc-900 border-2 border-jcb-yellow rounded-2xl p-6 shadow-xl relative flex flex-col justify-between">
              <span className="absolute -top-3 right-6 bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                CORE OPERATIONS
              </span>
              <div>
                <div className="w-12 h-12 rounded-xl bg-jcb-yellow text-black flex items-center justify-center mb-5 shadow-md">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-jcb-yellow uppercase tracking-widest mb-1">Role 2</div>
                <h3 className="text-xl font-bold text-white mb-2">Maintenance Manager</h3>
                <p className="text-zinc-400 text-xs mb-5 leading-relaxed">
                  Controls breakdown triage, converts complaints to work orders, assigns technicians, approves spare parts requisitions, verifies RDC challans, and monitors downtime.
                </p>
                <ul className="space-y-2 text-xs text-zinc-300 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-jcb-yellow shrink-0" />
                    <span>Live Shopfloor Triage Board</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-jcb-yellow shrink-0" />
                    <span>PR & RDC Approvals</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-jcb-yellow shrink-0" />
                    <span>Technician Dispatch & SLA</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('manager@jcb.com')}
                className="w-full bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black py-2.5 rounded-lg shadow transition-colors flex items-center justify-center gap-2"
              >
                <span>Login as Manager</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role 3: Operator */}
            <div className="bg-zinc-900 border border-zinc-800 hover:border-jcb-yellow/50 rounded-2xl p-6 transition-all group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Role 3</div>
                <h3 className="text-xl font-bold text-white mb-2">Machine Operator</h3>
                <p className="text-zinc-400 text-xs mb-5 leading-relaxed">
                  Mobile-first interface to report breakdowns in 20 seconds, upload breakdown photos, scan machine QR codes, and execute daily pre-shift inspections.
                </p>
                <ul className="space-y-2 text-xs text-zinc-300 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>20-Sec Complaint Log (CMP)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>QR Code Machine Scan</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Pre-Shift Checklist</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('operator@jcb.com')}
                className="w-full bg-zinc-800 hover:bg-jcb-yellow hover:text-black text-white text-xs font-extrabold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>Login as Operator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role 4: Technician */}
            <div className="bg-zinc-900 border border-zinc-800 hover:border-jcb-yellow/50 rounded-2xl p-6 transition-all group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Wrench className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Role 4</div>
                <h3 className="text-xl font-bold text-white mb-2">Field Technician</h3>
                <p className="text-zinc-400 text-xs mb-5 leading-relaxed">
                  Executes assigned work orders, records diagnosis and root causes, reserves and consumes spare parts, logs labor hours, and uploads completion proof.
                </p>
                <ul className="space-y-2 text-xs text-zinc-300 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Active Work Orders (WO)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Instant Spare Part Reservation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Root Cause & Labor Log</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('technician@jcb.com')}
                className="w-full bg-zinc-800 hover:bg-jcb-yellow hover:text-black text-white text-xs font-extrabold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>Login as Technician</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Capabilities & Features */}
      <section id="features" className="py-20 bg-black border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-jcb-yellow text-xs font-black tracking-widest uppercase mb-2 block">
              ENTERPRISE CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              Engineered for Heavy Manufacturing
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">
              Built ground-up to handle the scale, velocity, and rugged operational demands of JCB plants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-lg bg-jcb-yellow/10 text-jcb-yellow flex items-center justify-center mb-6">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">Dual Downtime Tracking</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Separates total machine downtime (breakdown occurrence to final verification) from maintenance response delay (operator call to technician arrival at machine).
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-lg bg-jcb-yellow/10 text-jcb-yellow flex items-center justify-center mb-6">
                <Package className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">160k Spares Stock Ledger</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                PostgreSQL GIN trigram index enables sub-10ms fuzzy searching across 160,000 SKUs. Segregated stock math: Available = Physical - Reserved - Quarantined.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-lg bg-jcb-yellow/10 text-jcb-yellow flex items-center justify-center mb-6">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">Returnable Challan (RDC)</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Automated gate passes for parts sent offsite for motor rewinding, hydraulic overhaul, or calibration. Tracks expected return dates with overdue alerts.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-lg bg-jcb-yellow/10 text-jcb-yellow flex items-center justify-center mb-6">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">1,000+ Machines Master</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Hierarchical plant/shop/bay mapping with Class A, B, and C criticality ranking. Instant QR code generation for tamper-proof mobile asset scanning.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-lg bg-jcb-yellow/10 text-jcb-yellow flex items-center justify-center mb-6">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">MTBF / MTTR & Pareto Analytics</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Automated computation of Mean Time Between Failures (MTBF) and Mean Time to Repair (MTTR), 80/20 downtime Pareto charts, and root-cause frequency.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-lg bg-jcb-yellow/10 text-jcb-yellow flex items-center justify-center mb-6">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">Tamper-Proof Audit Trail</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Append-only event log recording every state transition, part transaction, timestamp, technician action, and manager sign-off for ISO audit compliance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* JCB Manufacturing Plants Section */}
      <section id="plants" className="py-20 bg-zinc-950 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-jcb-yellow text-xs font-black tracking-widest uppercase mb-2 block">
              MULTI-PLANT COVERAGE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              JCB India Manufacturing Sites
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">
              Centralized platform connecting heavy machine shops, welding lines, and assembly bays across state borders.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-jcb-yellow text-black font-black text-xs px-2.5 py-1 rounded">PLANT 01</span>
                <span className="text-xs text-zinc-500 font-mono">PLT-001</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Ballabgarh Works</h3>
              <p className="text-xs text-jcb-yellow mb-3 font-semibold">Haryana, India</p>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                World's largest manufacturing plant for Backhoe Loaders. Houses heavy press shops, hydraulic component machining bays, robotic welding, and test tracks.
              </p>
              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 font-medium">
                <span>Active Assets: <strong className="text-white">450+ Units</strong></span>
                <span className="text-emerald-400 flex items-center gap-1 font-bold">● Operational</span>
              </div>
            </div>

            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-jcb-yellow text-black font-black text-xs px-2.5 py-1 rounded">PLANT 02</span>
                <span className="text-xs text-zinc-500 font-mono">PLT-002</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Pune Operations</h3>
              <p className="text-xs text-jcb-yellow mb-3 font-semibold">Maharashtra, India</p>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Specialized in heavy tracked excavators, wheeled loaders, and advanced precision components. Heavy CNC vertical machining centers and hydraulic lines.
              </p>
              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 font-medium">
                <span>Active Assets: <strong className="text-white">320+ Units</strong></span>
                <span className="text-emerald-400 flex items-center gap-1 font-bold">● Operational</span>
              </div>
            </div>

            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-jcb-yellow text-black font-black text-xs px-2.5 py-1 rounded">PLANT 03</span>
                <span className="text-xs text-zinc-500 font-mono">PLT-003</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Jaipur Mega Facility</h3>
              <p className="text-xs text-jcb-yellow mb-3 font-semibold">Rajasthan, India</p>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Ultra-modern eco-manufacturing plant with automated robotic welding lines, powder coating booths, and high-speed telescopic handler fabrication.
              </p>
              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 font-medium">
                <span>Active Assets: <strong className="text-white">280+ Units</strong></span>
                <span className="text-emerald-400 flex items-center gap-1 font-bold">● Operational</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industrial Footer */}
      <footer className="bg-black py-12 border-t border-zinc-800 text-zinc-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="bg-jcb-yellow text-black font-black text-2xl px-3 py-1 rounded shadow tracking-widest">
                JCB
              </div>
              <div>
                <p className="text-white font-bold text-sm tracking-wide">JCB INDIA LIMITED</p>
                <p className="text-zinc-500 text-xs">Smart Machine Maintenance Management System (CMMS)</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate('/login')}
                className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-extrabold px-6 py-2.5 rounded-lg shadow transition-colors text-xs tracking-wider uppercase"
              >
                Access Portal Login
              </button>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500">
            <p>© 2026 JCB India Limited. All Rights Reserved. Enterprise Asset & Maintenance Platform.</p>
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
