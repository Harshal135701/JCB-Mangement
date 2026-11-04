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
  FileCheck,
  ChevronRight,
  Lock,
  Layers,
  Check
} from 'lucide-react';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleRoleLogin = (email: string) => {
    navigate(`/login?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-amber-400 selection:text-black">
      {/* Top Header - Classic, Sleek Enterprise Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-zinc-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* JCB Brand Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="bg-jcb-yellow text-black font-extrabold text-2xl px-3.5 py-1 rounded shadow-sm tracking-widest flex items-center justify-center border border-amber-500">
              JCB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-zinc-950">SMART CMMS</span>
                <span className="hidden sm:inline-block bg-zinc-100 text-zinc-700 text-[10px] font-semibold px-2 py-0.5 rounded tracking-wider uppercase border border-zinc-200">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium hidden sm:block">
                JCB India Ltd. • Ballabgarh • Pune • Jaipur
              </p>
            </div>
          </div>

          {/* Navigation Links & Action */}
          <div className="flex items-center gap-5 sm:gap-8">
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-zinc-600">
              <a href="#plants" className="hover:text-zinc-950 transition-colors">Manufacturing Plants</a>
              <a href="#roles" className="hover:text-zinc-950 transition-colors">4 Operational Roles</a>
              <a href="#features" className="hover:text-zinc-950 transition-colors">Platform Capabilities</a>
            </nav>

            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-jcb-yellow hover:bg-amber-400 text-black font-bold px-5 py-2.5 rounded-lg shadow-sm transition-all flex items-center gap-2 text-xs uppercase tracking-wider border border-amber-500/40"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="bg-jcb-yellow hover:bg-amber-400 text-black font-bold px-5 py-2.5 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 text-xs uppercase tracking-wider border border-amber-500/40"
              >
                <Lock className="w-3.5 h-3.5 text-zinc-900" />
                <span>Sign In to Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section - Clean, Classic, Sophisticated Industrial Aesthetic */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 bg-white border-b border-zinc-200">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Subtle Plant Engineering Badge */}
            <div className="inline-flex items-center gap-2 bg-amber-50/80 border border-amber-200 px-3.5 py-1.5 rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-amber-950 tracking-wide uppercase">
                Plant Maintenance & Asset Reliability Platform
              </span>
            </div>

            {/* Main Headline - Balanced, Classic, High-End */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-950 leading-tight sm:leading-[1.18] mb-6">
              Intelligent Machine Maintenance & <br className="hidden sm:inline" />
              <span className="relative inline-block text-zinc-900">
                Asset Performance Platform
                <span className="absolute bottom-1.5 left-0 w-full h-3 bg-jcb-yellow/35 -z-10 rounded"></span>
              </span>
            </h1>

            {/* Subtitle - Professional, Clear, Direct */}
            <p className="text-base sm:text-lg text-zinc-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
              Digitalizing maintenance operations across JCB India manufacturing facilities. 
              Accelerate breakdown triage, automate preventive schedules, track real-time spare parts inventory, and eliminate unplanned shop floor downtime.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto bg-jcb-yellow hover:bg-amber-400 text-black text-sm font-bold px-7 py-3.5 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2.5 border border-amber-500/40 uppercase tracking-wide"
              >
                <span>Access CMMS Portal</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </button>
              <a
                href="#roles"
                className="w-full sm:w-auto bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 text-sm font-semibold px-6 py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-2xs hover:border-zinc-400"
              >
                <span>Explore Role Workspaces</span>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </a>
            </div>

            {/* Key Operational Metrics Strip - Clean, Spacious, Well-Padded */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5 sm:p-7 bg-white rounded-xl border border-zinc-200 shadow-sm text-left">
              <div className="p-3 border-r border-zinc-100 last:border-none">
                <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">1,000+</div>
                <div className="text-xs font-bold text-zinc-800 mt-1 uppercase tracking-wide">Industrial Assets</div>
                <div className="text-xs text-zinc-500 mt-0.5">Criticality Class A / B / C</div>
              </div>
              <div className="p-3 border-r border-zinc-100 last:border-none">
                <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">160,000+</div>
                <div className="text-xs font-bold text-zinc-800 mt-1 uppercase tracking-wide">Spare Parts SKUs</div>
                <div className="text-xs text-zinc-500 mt-0.5">Sub-10ms GIN Trigram Search</div>
              </div>
              <div className="p-3 border-r border-zinc-100 last:border-none">
                <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">3 Works</div>
                <div className="text-xs font-bold text-zinc-800 mt-1 uppercase tracking-wide">Manufacturing Plants</div>
                <div className="text-xs text-zinc-500 mt-0.5">Ballabgarh, Pune, Jaipur</div>
              </div>
              <div className="p-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight">99.8%</div>
                <div className="text-xs font-bold text-emerald-800 mt-1 uppercase tracking-wide">Target Availability</div>
                <div className="text-xs text-zinc-500 mt-0.5">Dual Downtime Tracking</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Login Roles Architecture Showcase */}
      <section id="roles" className="py-16 sm:py-20 bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-amber-800 text-xs font-bold tracking-widest uppercase mb-2 block">
              ROLE-BASED WORKSPACES
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight mb-3">
              Designed for Every Shop Floor Stakeholder
            </h2>
            <p className="text-zinc-600 text-sm sm:text-base leading-relaxed">
              Tailored interfaces built for fast decision-making, strict safety compliance, and zero production interruptions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Role 1: Admin */}
            <div className="bg-white border border-zinc-200 hover:border-zinc-400 rounded-xl p-6 transition-all hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200 flex items-center justify-center mb-5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1">System Control</div>
                <h3 className="text-lg font-bold text-zinc-950 mb-2">Plant Administrator</h3>
                <p className="text-zinc-600 text-xs mb-5 leading-relaxed font-normal">
                  Full master data management: plants, machine registry, QR codes, 160,000 spares catalog, technician enrollment, and immutable audit logs.
                </p>
                <ul className="space-y-2 text-xs text-zinc-700 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Machine & QR Code Master</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Personnel & Tech Enrollment</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Full CRUD & Audit Trail</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('admin@jcb.com')}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                <span>Login as Admin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role 2: Manager */}
            <div className="bg-amber-50/20 border-2 border-amber-400 rounded-xl p-6 shadow-sm relative flex flex-col justify-between">
              <span className="absolute -top-3 right-5 bg-jcb-yellow text-zinc-950 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs border border-amber-400">
                Core Operations
              </span>
              <div>
                <div className="w-11 h-11 rounded-lg bg-jcb-yellow text-zinc-950 flex items-center justify-center mb-5 shadow-xs border border-amber-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-amber-800 uppercase tracking-widest mb-1">Supervision</div>
                <h3 className="text-lg font-bold text-zinc-950 mb-2">Maintenance Manager</h3>
                <p className="text-zinc-600 text-xs mb-5 leading-relaxed font-normal">
                  Real-time shop floor triage, breakdown ticket verification, technician dispatching, PR approval, and Returnable Gate Passes (RDC).
                </p>
                <ul className="space-y-2 text-xs text-zinc-800 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Shop Floor Breakdown Triage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Technician Dispatch & SLA</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>PR & Gate Pass Approval</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('manager@jcb.com')}
                className="w-full bg-jcb-yellow hover:bg-amber-400 text-black text-xs font-bold py-2.5 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 border border-amber-500/50 uppercase tracking-wide"
              >
                <span>Login as Manager</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role 3: Operator */}
            <div className="bg-white border border-zinc-200 hover:border-zinc-400 rounded-xl p-6 transition-all hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200 flex items-center justify-center mb-5">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Shop Floor</div>
                <h3 className="text-lg font-bold text-zinc-950 mb-2">Machine Operator</h3>
                <p className="text-zinc-600 text-xs mb-5 leading-relaxed font-normal">
                  Rapid breakdown reporting under 20 seconds, machine QR asset lookup, inspection photo upload, and pre-shift checklist completion.
                </p>
                <ul className="space-y-2 text-xs text-zinc-700 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>20-Sec Breakdown Ticket (CMP)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Machine QR Asset Scan</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Pre-Shift Safety Checklists</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('operator@jcb.com')}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                <span>Login as Operator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role 4: Technician */}
            <div className="bg-white border border-zinc-200 hover:border-zinc-400 rounded-xl p-6 transition-all hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200 flex items-center justify-center mb-5">
                  <Wrench className="w-5 h-5 text-zinc-800" />
                </div>
                <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Execution</div>
                <h3 className="text-lg font-bold text-zinc-950 mb-2">Field Technician</h3>
                <p className="text-zinc-600 text-xs mb-5 leading-relaxed font-normal">
                  Receives dispatched work orders, records diagnosis and root cause, reserves spare parts, logs labor hours, and closes maintenance jobs.
                </p>
                <ul className="space-y-2 text-xs text-zinc-700 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Dispatched Work Orders (WO)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Spare Parts Reservation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Root Cause & Labor Log</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('technician@jcb.com')}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                <span>Login as Technician</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Capabilities & Technical Features */}
      <section id="features" className="py-16 sm:py-20 bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-amber-800 text-xs font-bold tracking-widest uppercase mb-2 block">
              PLATFORM CAPABILITIES
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight mb-3">
              Engineered for JCB Heavy Manufacturing Standards
            </h2>
            <p className="text-zinc-600 text-sm sm:text-base leading-relaxed">
              Industrial reliability features designed to maximize Overall Equipment Effectiveness (OEE) and eliminate bottlenecks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 transition-all shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-900 flex items-center justify-center mb-4 border border-amber-200">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-zinc-950 mb-2">Dual Downtime Accounting</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-normal">
                Separates total machine stoppage time from maintenance response delay (operator call to technician arrival on site), giving management precise operational visibility.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 transition-all shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-900 flex items-center justify-center mb-4 border border-amber-200">
                <Package className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-zinc-950 mb-2">160k Spares Stock Ledger</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-normal">
                PostgreSQL GIN trigram index delivers sub-10ms search across 160,000 SKUs. Segregated stock arithmetic: Available = Physical - Reserved - Quarantined.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 transition-all shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-900 flex items-center justify-center mb-4 border border-amber-200">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-zinc-950 mb-2">Returnable Gate Pass (RDC)</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-normal">
                Digital gate-pass management for external motor rewinding, hydraulic overhaul, or calibration. Tracks expected return dates with automated overdue escalation.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 transition-all shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-900 flex items-center justify-center mb-4 border border-amber-200">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-zinc-950 mb-2">1,000+ Machines Master</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-normal">
                Hierarchical plant/shop/bay mapping with Class A, B, and C criticality ranking. Instant QR code generation for tamper-proof mobile asset scanning.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 transition-all shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-900 flex items-center justify-center mb-4 border border-amber-200">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-zinc-950 mb-2">MTBF, MTTR & Pareto Analytics</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-normal">
                Automated calculation of Mean Time Between Failures (MTBF) and Mean Time to Repair (MTTR), 80/20 downtime Pareto distributions, and recurring defect heatmaps.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 transition-all shadow-2xs">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-900 flex items-center justify-center mb-4 border border-amber-200">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-zinc-950 mb-2">Immutable Audit Ledger</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-normal">
                Append-only event log recording every state transition, stock movement, technician sign-off, and manager verification for ISO 9001 and ISO 14001 compliance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* JCB Manufacturing Sites */}
      <section id="plants" className="py-16 sm:py-20 bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-amber-800 text-xs font-bold tracking-widest uppercase mb-2 block">
              MANUFACTURING SITES
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight mb-3">
              JCB India Production Operations
            </h2>
            <p className="text-zinc-600 text-sm sm:text-base leading-relaxed">
              Connecting machining bays, heavy press lines, robotic welding stations, and assembly shops.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-amber-100 text-amber-900 font-bold text-xs px-2.5 py-0.5 rounded border border-amber-200">PLANT 01</span>
                <span className="text-xs text-zinc-500 font-mono font-semibold">PLT-001</span>
              </div>
              <h3 className="text-lg font-bold text-zinc-950 mb-1">Ballabgarh Works</h3>
              <p className="text-xs text-amber-800 mb-3 font-semibold">Haryana, India</p>
              <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                Flagship plant for JCB Backhoe Loaders. Houses heavy mechanical presses, CNC machining bays, hydraulic assembly, and robotic welding cells.
              </p>
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-600">
                <span>Active Assets: <strong className="text-zinc-900 font-semibold">450+ Machines</strong></span>
                <span className="text-emerald-700 flex items-center gap-1 font-bold">● Active</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-amber-100 text-amber-900 font-bold text-xs px-2.5 py-0.5 rounded border border-amber-200">PLANT 02</span>
                <span className="text-xs text-zinc-500 font-mono font-semibold">PLT-002</span>
              </div>
              <h3 className="text-lg font-bold text-zinc-950 mb-1">Pune Operations</h3>
              <p className="text-xs text-amber-800 mb-3 font-semibold">Maharashtra, India</p>
              <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                Specialized in heavy tracked excavators, wheeled loaders, and precision transmission tooling. Features horizontal machining centers and laser cutting bays.
              </p>
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-600">
                <span>Active Assets: <strong className="text-zinc-900 font-semibold">320+ Machines</strong></span>
                <span className="text-emerald-700 flex items-center gap-1 font-bold">● Active</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-amber-100 text-amber-900 font-bold text-xs px-2.5 py-0.5 rounded border border-amber-200">PLANT 03</span>
                <span className="text-xs text-zinc-500 font-mono font-semibold">PLT-003</span>
              </div>
              <h3 className="text-lg font-bold text-zinc-950 mb-1">Jaipur Mega Facility</h3>
              <p className="text-xs text-amber-800 mb-3 font-semibold">Rajasthan, India</p>
              <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                Eco-manufacturing facility producing next-generation Loadall telescopic handlers and access equipment with automated surface treatment plants.
              </p>
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-600">
                <span>Active Assets: <strong className="text-zinc-900 font-semibold">280+ Machines</strong></span>
                <span className="text-emerald-700 flex items-center gap-1 font-bold">● Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industrial Footer - Clean, Professional Enterprise Footer */}
      <footer className="bg-zinc-900 py-10 text-zinc-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="bg-jcb-yellow text-black font-extrabold text-xl px-2.5 py-1 rounded shadow-xs tracking-widest border border-amber-500">
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
                className="bg-jcb-yellow hover:bg-amber-400 text-black font-bold px-5 py-2 rounded-lg shadow-xs transition-colors text-xs tracking-wider uppercase border border-amber-500/40"
              >
                Sign In to Portal
              </button>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-zinc-400 font-normal">
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