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
  Users
} from 'lucide-react';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleRoleLogin = (email: string) => {
    navigate(`/login?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-jcb-yellow selection:text-black">
      {/* Top Header - Crisp White with Yellow & Black Brand */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b-2 border-zinc-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* JCB Brand Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="bg-jcb-yellow text-black font-black text-3xl px-4 py-1 rounded shadow-md tracking-widest flex items-center justify-center border-2 border-jcb-yellowDark">
              JCB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg sm:text-xl tracking-wider text-black">SMART CMMS</span>
                <span className="hidden sm:inline-block bg-amber-50 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase border border-amber-300">
                  ENTERPRISE SYSTEM
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-bold hidden sm:block">
                JCB India Ltd. • Ballabgarh Works • Pune • Jaipur
              </p>
            </div>
          </div>

          {/* Navigation Links & Action */}
          <div className="flex items-center gap-4 sm:gap-6">
            <nav className="hidden md:flex items-center gap-6 text-xs font-black uppercase tracking-wider text-zinc-700">
              <a href="#plants" className="hover:text-amber-600 transition-colors">Plants</a>
              <a href="#roles" className="hover:text-amber-600 transition-colors">4 Operational Roles</a>
              <a href="#features" className="hover:text-amber-600 transition-colors">Technical Architecture</a>
            </nav>

            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 text-xs uppercase tracking-wider border border-amber-500"
              >
                <span>Open Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-xs uppercase tracking-wider border border-amber-500 transform hover:-translate-y-0.5"
              >
                <Lock className="w-4 h-4 text-black" />
                <span>Sign In To Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section - Pure White with Industrial Accents */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-white border-b-2 border-zinc-200">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Plant Engineering Badge */}
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-300 px-4 py-1.5 rounded-full mb-8 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-amber-950 tracking-wider uppercase">
                Plant Maintenance & Asset Reliability System
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-zinc-950 leading-none mb-6">
              HEAVY-DUTY MACHINE <br />
              <span className="relative inline-block mt-2">
                <span className="relative z-10 px-3 py-1 bg-jcb-yellow text-black rounded-lg shadow-sm border border-amber-500">
                  MAINTENANCE & ASSET
                </span>
              </span>{' '}
              PERFORMANCE
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-xl text-zinc-600 max-w-3xl mx-auto mb-10 leading-relaxed font-medium">
              Centralized digital maintenance platform for JCB India’s heavy manufacturing facilities. Replaces manual logbooks with real-time breakdown triage, automated preventive schedules, sub-10ms spare parts search, and dual downtime accounting.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-sm font-black px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 border border-amber-500 uppercase tracking-wider"
              >
                <span>Access CMMS Portal</span>
                <ArrowRight className="w-5 h-5 text-black" />
              </button>
              <a
                href="#roles"
                className="w-full sm:w-auto bg-white hover:bg-zinc-50 text-zinc-900 border-2 border-zinc-900 text-sm font-black px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm uppercase tracking-wider"
              >
                <span>View Operational Roles</span>
                <ChevronRight className="w-4 h-4 text-zinc-700" />
              </a>
            </div>

            {/* Key Operational Metrics Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-xl">
              <div className="p-3 text-center border-r-2 border-zinc-200 last:border-none">
                <div className="text-3xl sm:text-4xl font-black text-black mb-1 tracking-tight">1,000+</div>
                <div className="text-xs font-black text-amber-700 uppercase tracking-wider">Industrial Assets</div>
                <div className="text-[11px] text-zinc-500 font-bold mt-0.5">Criticality Class A / B / C</div>
              </div>
              <div className="p-3 text-center border-r-2 border-zinc-200 last:border-none">
                <div className="text-3xl sm:text-4xl font-black text-black mb-1 tracking-tight">160,000</div>
                <div className="text-xs font-black text-zinc-800 uppercase tracking-wider">Spare Parts SKUs</div>
                <div className="text-[11px] text-zinc-500 font-bold mt-0.5">GIN Trigram Search</div>
              </div>
              <div className="p-3 text-center border-r-2 border-zinc-200 last:border-none">
                <div className="text-3xl sm:text-4xl font-black text-black mb-1 tracking-tight">3 Facilities</div>
                <div className="text-xs font-black text-amber-700 uppercase tracking-wider">Manufacturing Works</div>
                <div className="text-[11px] text-zinc-500 font-bold mt-0.5">Ballabgarh, Pune, Jaipur</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-3xl sm:text-4xl font-black text-emerald-700 mb-1 tracking-tight">99.8%</div>
                <div className="text-xs font-black text-emerald-800 uppercase tracking-wider">Target Availability</div>
                <div className="text-[11px] text-zinc-500 font-bold mt-0.5">Dual Downtime Tracking</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Login Roles Architecture Showcase - Pure White */}
      <section id="roles" className="py-20 bg-white border-b-2 border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-amber-700 text-xs font-black tracking-widest uppercase mb-2 block">
              ACCESS GOVERNANCE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight mb-4">
              Role-Specific Workspaces
            </h2>
            <p className="text-zinc-600 text-sm sm:text-base font-medium">
              Structured responsibilities across maintenance operations. Store management and purchase requests are handled directly as functional queues under Manager and Admin permissions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Role 1: Admin */}
            <div className="bg-white border-2 border-zinc-200 hover:border-zinc-900 rounded-2xl p-6 transition-all hover:shadow-xl group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1">Role 1</div>
                <h3 className="text-xl font-black text-zinc-950 mb-2">Enterprise Admin</h3>
                <p className="text-zinc-600 text-xs mb-5 leading-relaxed font-medium">
                  Full master data control: plant hierarchy, machine asset registration, QR generation, 160,000 spare parts ledger, technician enrollment, and immutable audit logs.
                </p>
                <ul className="space-y-2 text-xs text-zinc-700 mb-6 font-semibold">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Machine Master & QR Generator</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Technician & User Enrollment</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Full CRUD & Audit Trail</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('admin@jcb.com')}
                className="w-full bg-zinc-900 hover:bg-jcb-yellow hover:text-black text-white text-xs font-black py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow uppercase tracking-wider"
              >
                <span>Login as Admin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role 2: Manager */}
            <div className="bg-amber-50/30 border-2 border-jcb-yellow rounded-2xl p-6 shadow-xl relative flex flex-col justify-between">
              <span className="absolute -top-3 right-6 bg-jcb-yellow text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow border border-amber-500">
                DAILY OPERATIONS
              </span>
              <div>
                <div className="w-12 h-12 rounded-xl bg-jcb-yellow text-black flex items-center justify-center mb-5 shadow border border-amber-500">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1">Role 2</div>
                <h3 className="text-xl font-black text-zinc-950 mb-2">Maintenance Manager</h3>
                <p className="text-zinc-600 text-xs mb-5 leading-relaxed font-medium">
                  Operational control of breakdown triage, complaint validation, technician allocation, SLA enforcement, spare parts reservation approval, and returnable gate passes (RDC).
                </p>
                <ul className="space-y-2 text-xs text-zinc-800 mb-6 font-semibold">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Shopfloor Breakdown Triage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>PR & RDC Approvals</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Technician Dispatch & SLA</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('manager@jcb.com')}
                className="w-full bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 border border-amber-500 uppercase tracking-wider"
              >
                <span>Login as Manager</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role 3: Operator */}
            <div className="bg-white border-2 border-zinc-200 hover:border-zinc-900 rounded-2xl p-6 transition-all hover:shadow-xl group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-800 border border-blue-300 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="text-xs font-black text-blue-700 uppercase tracking-widest mb-1">Role 3</div>
                <h3 className="text-xl font-black text-zinc-950 mb-2">Machine Operator</h3>
                <p className="text-zinc-600 text-xs mb-5 leading-relaxed font-medium">
                  Shopfloor interface to report breakdowns within 20 seconds, attach inspection photos, scan machine QR codes, and complete pre-shift safety checklists.
                </p>
                <ul className="space-y-2 text-xs text-zinc-700 mb-6 font-semibold">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>20-Sec Breakdown Ticket (CMP)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>QR Machine Asset Scanning</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Pre-Shift Safety Checklists</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('operator@jcb.com')}
                className="w-full bg-zinc-900 hover:bg-jcb-yellow hover:text-black text-white text-xs font-black py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow uppercase tracking-wider"
              >
                <span>Login as Operator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role 4: Technician */}
            <div className="bg-white border-2 border-zinc-200 hover:border-zinc-900 rounded-2xl p-6 transition-all hover:shadow-xl group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Wrench className="w-6 h-6" />
                </div>
                <div className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-1">Role 4</div>
                <h3 className="text-xl font-black text-zinc-950 mb-2">Field Technician</h3>
                <p className="text-zinc-600 text-xs mb-5 leading-relaxed font-medium">
                  Executes assigned work orders, records diagnosis and root-cause analysis, reserves spare parts from stock ledger, logs labor hours, and uploads completion proof.
                </p>
                <ul className="space-y-2 text-xs text-zinc-700 mb-6 font-semibold">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Digital Work Orders (WO)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Spare Parts Reservation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Root Cause & Labor Hours Log</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleRoleLogin('technician@jcb.com')}
                className="w-full bg-zinc-900 hover:bg-jcb-yellow hover:text-black text-white text-xs font-black py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow uppercase tracking-wider"
              >
                <span>Login as Technician</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Capabilities & Technical Features - Pure White */}
      <section id="features" className="py-20 bg-white border-b-2 border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-amber-700 text-xs font-black tracking-widest uppercase mb-2 block">
              ENGINEERING SPECIFICATIONS
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight mb-4">
              Built for JCB Shopfloor Standards
            </h2>
            <p className="text-zinc-600 text-sm sm:text-base font-medium">
              Robust data architecture designed to eliminate production bottlenecks across heavy machinery bays.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-white border-2 border-zinc-200 hover:border-zinc-400 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-jcb-yellow text-black flex items-center justify-center mb-6 shadow-sm border border-amber-500">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-zinc-950 mb-3">Dual Downtime Tracking</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-medium">
                Separates total machine stoppage time from maintenance response delay (operator call to technician arrival on site), giving management precise operational visibility.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white border-2 border-zinc-200 hover:border-zinc-400 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-jcb-yellow text-black flex items-center justify-center mb-6 shadow-sm border border-amber-500">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-zinc-950 mb-3">160k Spares Stock Ledger</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-medium">
                PostgreSQL GIN trigram index delivers sub-10ms search across 160,000 SKUs. Segregated stock arithmetic: Available = Physical - Reserved - Quarantined.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white border-2 border-zinc-200 hover:border-zinc-400 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-jcb-yellow text-black flex items-center justify-center mb-6 shadow-sm border border-amber-500">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-zinc-950 mb-3">Returnable Delivery Challan (RDC)</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-medium">
                Digital gate-pass management for external motor rewinding, hydraulic overhaul, or calibration. Tracks expected return dates with automated overdue escalation.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white border-2 border-zinc-200 hover:border-zinc-400 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-jcb-yellow text-black flex items-center justify-center mb-6 shadow-sm border border-amber-500">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-zinc-950 mb-3">1,000+ Machines Master</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-medium">
                Hierarchical plant/shop/bay mapping with Class A, B, and C criticality ranking. Instant QR code generation for tamper-proof mobile asset scanning.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white border-2 border-zinc-200 hover:border-zinc-400 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-jcb-yellow text-black flex items-center justify-center mb-6 shadow-sm border border-amber-500">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-zinc-950 mb-3">MTBF, MTTR & Pareto Analytics</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-medium">
                Automated calculation of Mean Time Between Failures (MTBF) and Mean Time to Repair (MTTR), 80/20 downtime Pareto distributions, and recurring defect heatmaps.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white border-2 border-zinc-200 hover:border-zinc-400 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-jcb-yellow text-black flex items-center justify-center mb-6 shadow-sm border border-amber-500">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-zinc-950 mb-3">Immutable Audit Ledger</h3>
              <p className="text-zinc-600 text-xs leading-relaxed font-medium">
                Append-only event log recording every state transition, stock movement, technician sign-off, and manager verification for ISO 9001 and ISO 14001 compliance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* JCB Manufacturing Sites - Pure White */}
      <section id="plants" className="py-20 bg-white border-b-2 border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-amber-700 text-xs font-black tracking-widest uppercase mb-2 block">
              MANUFACTURING SITES
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight mb-4">
              JCB India Production Hubs
            </h2>
            <p className="text-zinc-600 text-sm sm:text-base font-medium">
              Connecting machining bays, heavy press lines, robotic welding stations, and assembly shops across states.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-jcb-yellow text-black font-black text-xs px-2.5 py-1 rounded shadow-sm border border-amber-500">PLANT 01</span>
                <span className="text-xs text-zinc-500 font-mono font-bold">PLT-001</span>
              </div>
              <h3 className="text-xl font-black text-zinc-950 mb-1">Ballabgarh Works</h3>
              <p className="text-xs text-amber-700 mb-3 font-bold">Haryana, India</p>
              <p className="text-xs text-zinc-600 leading-relaxed mb-4 font-medium">
                Flagship plant for JCB Backhoe Loaders. Houses heavy mechanical presses, CNC machining bays, hydraulic assembly, and robotic welding cells.
              </p>
              <div className="pt-4 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-600 font-medium">
                <span>Active Assets: <strong className="text-black font-bold">450+ Machines</strong></span>
                <span className="text-emerald-700 flex items-center gap-1 font-black">● Live</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-jcb-yellow text-black font-black text-xs px-2.5 py-1 rounded shadow-sm border border-amber-500">PLANT 02</span>
                <span className="text-xs text-zinc-500 font-mono font-bold">PLT-002</span>
              </div>
              <h3 className="text-xl font-black text-zinc-950 mb-1">Pune Operations</h3>
              <p className="text-xs text-amber-700 mb-3 font-bold">Maharashtra, India</p>
              <p className="text-xs text-zinc-600 leading-relaxed mb-4 font-medium">
                Specialized in heavy tracked excavators, wheeled loaders, and precision transmission tooling. Features horizontal machining centers and laser cutting bays.
              </p>
              <div className="pt-4 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-600 font-medium">
                <span>Active Assets: <strong className="text-black font-bold">320+ Machines</strong></span>
                <span className="text-emerald-700 flex items-center gap-1 font-black">● Live</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-jcb-yellow text-black font-black text-xs px-2.5 py-1 rounded shadow-sm border border-amber-500">PLANT 03</span>
                <span className="text-xs text-zinc-500 font-mono font-bold">PLT-003</span>
              </div>
              <h3 className="text-xl font-black text-zinc-950 mb-1">Jaipur Mega Facility</h3>
              <p className="text-xs text-amber-700 mb-3 font-bold">Rajasthan, India</p>
              <p className="text-xs text-zinc-600 leading-relaxed mb-4 font-medium">
                Eco-manufacturing facility producing next-generation Loadall telescopic handlers and access equipment with automated surface treatment plants.
              </p>
              <div className="pt-4 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-600 font-medium">
                <span>Active Assets: <strong className="text-black font-bold">280+ Machines</strong></span>
                <span className="text-emerald-700 flex items-center gap-1 font-black">● Live</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industrial Footer - Crisp Solid JCB Theme */}
      <footer className="bg-zinc-950 py-12 border-t border-zinc-900 text-zinc-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="bg-jcb-yellow text-black font-black text-2xl px-3 py-1 rounded shadow tracking-widest border border-jcb-yellowDark">
                JCB
              </div>
              <div>
                <p className="text-white font-black text-sm tracking-wide">JCB INDIA LIMITED</p>
                <p className="text-zinc-400 text-xs font-medium">Smart Machine Maintenance Management System (CMMS)</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate('/login')}
                className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2.5 rounded-xl shadow transition-colors text-xs tracking-wider uppercase border border-amber-500"
              >
                Access Portal Login
              </button>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500 font-medium">
            <p>© 2026 JCB India Limited. All Rights Reserved. Plant Engineering & Asset Reliability Platform.</p>
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>Ballabgarh • Pune • Jaipur | ISO 9001:2015 & ISO 14001:2015 Compliant</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
