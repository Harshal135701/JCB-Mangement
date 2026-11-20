import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import {
  Lock,
  User,
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Building,
  Layers,
  Phone,
  Mail,
  Wrench,
  Briefcase,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Cpu,
  Sparkles,
} from 'lucide-react';

interface PlantOption {
  id: string;
  plant_code: string;
  plant_name: string;
  city: string;
  state: string;
}

interface ShopOption {
  id: string;
  plant_id: string;
  shop_code: string;
  shop_name: string;
}

const PREDEFINED_DEPARTMENTS = [
  'Mechanical Maintenance',
  'Electrical & Automation',
  'Hydraulics Maintenance',
  'Robotics Maintenance',
  'Preventive Maintenance',
] as const;

const PREDEFINED_SHIFTS = [
  { value: 'Shift A', label: 'Shift A (06:00 - 14:30) - Default' },
  { value: 'Shift B', label: 'Shift B (14:30 - 23:00)' },
  { value: 'Shift C', label: 'Shift C (23:00 - 06:00)' },
  { value: 'General Shift', label: 'General Shift (09:00 - 17:30)' },
] as const;

const AVAILABLE_SKILLS = [
  'Mechanical',
  'Electrical',
  'Hydraulic',
  'PLC',
  'Robotics',
  'Welding',
  'Pneumatics',
  'Instrumentation',
] as const;

export const TechnicianSignUpPage: React.FC = () => {
  const navigate = useNavigate();

  // Personal Information
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Work Information
  const [plantId, setPlantId] = useState('');
  const [shopId, setShopId] = useState('');
  const [department, setDepartment] = useState<string>('Mechanical Maintenance');
  const [designation, setDesignation] = useState('Maintenance Specialist');
  const [shift, setShift] = useState('Shift A');

  // Technical Skills (multi-select)
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['Mechanical']);

  // Account Security
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [loadingShops, setLoadingShops] = useState(false);
  const [error, setError] = useState('');
  const [submittedUser, setSubmittedUser] = useState<any | null>(null);

  // Facility Options
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);

  // Load plants and initial shops on mount
  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        setLoadingOrg(true);
        const res = await apiClient.get('/auth/registration-options');
        if (res.data.success && res.data.data) {
          const plantsList: PlantOption[] = res.data.data.plants || [];
          setPlants(plantsList);

          const allShops: ShopOption[] = res.data.data.shops || [];

          if (plantsList.length > 0) {
            const initialPlant =
              plantsList.find((p) => allShops.some((s) => s.plant_id === p.id)) ||
              plantsList[0];
            setPlantId(initialPlant.id);

            const plantShops = allShops.filter(
              (s: ShopOption) => s.plant_id === initialPlant.id
            );
            setShops(plantShops);
            if (plantShops.length > 0) {
              setShopId(plantShops[0].id);
            } else {
              setShopId('');
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load registration options from server:', err);
      } finally {
        setLoadingOrg(false);
      }
    };

    fetchOrgData();
  }, []);

  // Fetch shops when plant changes
  const handlePlantChange = async (newPlantId: string) => {
    setPlantId(newPlantId);
    setShopId('');
    if (!newPlantId) {
      setShops([]);
      return;
    }
    try {
      setLoadingShops(true);
      const res = await apiClient.get(`/auth/plants/${newPlantId}/shops`);
      if (res.data.success && Array.isArray(res.data.data)) {
        const newShops = res.data.data;
        setShops(newShops);
        if (newShops.length > 0) {
          setShopId(newShops[0].id);
        } else {
          setShopId('');
        }
      }
    } catch (err) {
      console.warn('Failed to fetch shops for plant:', err);
      setShops([]);
      setShopId('');
    } finally {
      setLoadingShops(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill)
        ? prev.filter((s) => s !== skill)
        : [...prev, skill]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError('');

    // Validations
    const cleanCode = employeeCode.trim().toUpperCase();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanDept = department.trim();
    const cleanDesig = designation.trim();

    if (!cleanCode) {
      setError('Employee ID is required.');
      return;
    }
    if (!cleanName) {
      setError('Full Name is required.');
      return;
    }
    if (!cleanEmail) {
      setError('Official Email address is required.');
      return;
    }
    if (!cleanPhone) {
      setError('Phone number is required for dispatch communication.');
      return;
    }
    if (cleanPhone.length < 7 || cleanPhone.length > 50) {
      setError('Please provide a valid contact phone number (7-50 characters).');
      return;
    }
    if (!plantId) {
      setError('Please select your Plant facility.');
      return;
    }
    if (!shopId) {
      setError('Shop selection is compulsory for Technician registration.');
      return;
    }
    if (!cleanDept) {
      setError('Please select your Maintenance Department.');
      return;
    }
    if (!cleanDesig) {
      setError('Designation is required.');
      return;
    }
    if (selectedSkills.length === 0) {
      setError('Please select at least one technical competency skill.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        employee_code: cleanCode,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        plant_id: plantId,
        shop_id: shopId,
        department: cleanDept,
        designation: cleanDesig,
        shift: shift || 'Shift A',
        skills: selectedSkills,
        password,
      };

      const res = await apiClient.post('/auth/register-technician', payload);

      if (res.data.success) {
        const pickedPlant = plants.find((p) => p.id === plantId);
        const pickedShop = shops.find((s) => s.id === shopId);
        setSubmittedUser({
          ...res.data.data,
          plantName: pickedPlant ? `${pickedPlant.plant_name} (${pickedPlant.plant_code})` : 'Assigned Plant',
          shopName: pickedShop ? `${pickedShop.shop_name} (${pickedShop.shop_code})` : 'Assigned Shop',
          skillsList: selectedSkills,
        });
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Registration request failed. Please check your information and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full relative flex flex-col font-sans selection:bg-[#F9B101] selection:text-black overflow-x-hidden"
      style={{ backgroundColor: '#ccdae6' }}
    >
      {/* ── Background Hero Image (identical to LoginPage & OperatorSignUpPage) ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none select-none"
        style={{
          backgroundImage: "url('/images/jcb-login-hero-wide.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'left 55%',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* ── Grey Contrast Overlay ────────────────────────────────────────── */}
      <div
        className="absolute inset-0 z-1 pointer-events-none select-none"
        style={{
          backgroundColor: 'rgba(80, 80, 80, 0.25)',
        }}
      />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="relative z-10 w-full px-5 py-4 sm:px-8 sm:py-5 flex items-center justify-between flex-shrink-0">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-700 hover:text-black bg-white/80 hover:bg-white px-3.5 py-1.5 rounded-lg border border-zinc-200/70 shadow-sm transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Login
        </Link>

        <div className="flex items-center gap-2.5 bg-white/80 backdrop-blur-sm px-3.5 py-1.5 rounded-lg border border-zinc-200/70 shadow-sm">
          <div className="bg-[#F9B101] text-black font-black text-xs px-2 py-0.5 rounded shadow">
            JCB
          </div>
          <span className="text-xs font-extrabold text-zinc-900 tracking-wide">
            TECHNICIAN ONBOARDING
          </span>
        </div>
      </header>

      {/* ── Main Container ───────────────────────────────────────────────── */}
      <main className="relative z-10 w-full flex-1 flex items-center justify-center lg:justify-end px-4 py-6 sm:px-8 lg:pr-12 xl:pr-20">
        {submittedUser ? (
          /* ── SUCCESS BANNER CARD ───────────────────────────────────────── */
          <div className="w-full max-w-[560px] bg-white rounded-2xl shadow-[0_15px_45px_rgba(0,0,0,0.12)] border border-[#E5E7EB] p-8 sm:p-10 animate-in fade-in duration-200 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-300 shadow-sm">
              <Wrench className="w-8 h-8 text-amber-700" />
            </div>

            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Registration Submitted • Pending Approval
            </div>

            <h2 className="text-2xl font-black text-zinc-950 tracking-tight">
              Technician Registration Submitted Successfully!
            </h2>

            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              Your registration request has been submitted successfully. Your Plant Manager will review your details. You will be able to log in once your account is approved.
            </p>

            {/* Technician Details Summary Box */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 my-6 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Technician Name</span>
                <span className="font-bold text-zinc-900">{submittedUser.full_name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Employee ID</span>
                <span className="font-mono font-black text-zinc-900">{submittedUser.employee_code}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Plant Facility</span>
                <span className="font-semibold text-zinc-800">{submittedUser.plantName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Shop Floor</span>
                <span className="font-semibold text-zinc-800">{submittedUser.shopName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Department</span>
                <span className="font-bold text-zinc-900">{submittedUser.department}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Designation</span>
                <span className="font-semibold text-zinc-800">{submittedUser.designation}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Shift Assignment</span>
                <span className="font-semibold text-zinc-800">{submittedUser.shift || 'Shift A'}</span>
              </div>
              <div>
                <span className="text-zinc-500 font-semibold block mb-1.5">Technical Competencies</span>
                <div className="flex flex-wrap gap-1.5">
                  {(submittedUser.skillsList || submittedUser.skills_json || []).map((sk: string) => (
                    <span
                      key={sk}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#F9B101]/20 text-zinc-900 border border-[#F9B101]/50"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 text-left flex items-start gap-2.5 mb-6 text-xs text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Next Step:</strong> Your Plant Manager will verify your technical qualifications and factory credentials. You will receive notification once authorized, after which you can log in to access the Technician Dispatch Queue.
              </div>
            </div>

            <Link
              to="/login"
              className="w-full inline-flex items-center justify-center gap-2 bg-[#F9B101] hover:bg-[#E5A401] active:scale-[0.99] text-black font-black py-3 rounded-xl transition text-sm uppercase tracking-wider shadow border border-amber-500/40"
            >
              <span>Return to Login</span>
              <ArrowRight className="w-4 h-4 text-black stroke-[2.5]" />
            </Link>
          </div>
        ) : (
          /* ── REGISTRATION FORM CARD ────────────────────────────────────── */
          <div className="w-full max-w-[660px] bg-white rounded-2xl shadow-[0_15px_45px_rgba(0,0,0,0.12)] border border-[#E5E7EB] p-6 sm:p-8 animate-in fade-in duration-200">
            {/* Card Header */}
            <div className="mb-5">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="bg-[#F9B101] text-black font-black text-[11px] px-2 py-0.5 rounded shadow">
                  JCB FACTORY
                </span>
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  ROLE: TECHNICIAN (FIXED)
                </span>
              </div>
              <h2 className="text-2xl font-black text-[#111827] tracking-tight">
                Technician Sign-Up
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-1">
                Enter your factory and technical details to register for Smart CMMS access. Manager approval is required before first sign-in.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5 shadow-2xs animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Sign-Up Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ── SECTION A: PERSONAL INFORMATION ───────────────────────── */}
              <div className="border-b border-zinc-200 pb-3">
                <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  <span>A. Personal Information</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Employee ID */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Employee ID *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        disabled={loading}
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                        placeholder="e.g. JCB-TCH-2041"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-mono font-bold text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        disabled={loading}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Deepak Bhosale"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-semibold text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Corporate Email */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Official Email *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        required
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="technician@jcb.com"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        required
                        disabled={loading}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SECTION B: WORK INFORMATION ───────────────────────────── */}
              <div className="border-b border-zinc-200 pb-3">
                <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                  <span>B. Work Information</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Plant Facility */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Plant Facility *
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        required
                        disabled={loading || loadingOrg}
                        value={plantId}
                        onChange={(e) => handlePlantChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition shadow-2xs"
                      >
                        {plants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.plant_name} ({p.plant_code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Shop Floor (Compulsory) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                        Shop Floor *
                      </label>
                      <span className="text-[10px] text-amber-800 font-bold">Compulsory</span>
                    </div>
                    <div className="relative">
                      <Layers className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        required
                        disabled={loading || loadingOrg || loadingShops || shops.length === 0}
                        value={shopId}
                        onChange={(e) => setShopId(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition shadow-2xs"
                      >
                        {loadingShops ? (
                          <option value="">Loading shop floors...</option>
                        ) : shops.length === 0 ? (
                          <option value="">No shops found for selected plant</option>
                        ) : (
                          shops.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.shop_name} ({s.shop_code})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Department *
                    </label>
                    <div className="relative">
                      <Wrench className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        required
                        disabled={loading}
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#F9B101] transition shadow-2xs"
                      >
                        {PREDEFINED_DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Designation */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Designation *
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        disabled={loading}
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        placeholder="e.g. Lead Mechanical Specialist"
                        maxLength={100}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] transition shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Shift */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Shift Assignment *
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        required
                        disabled={loading}
                        value={shift}
                        onChange={(e) => setShift(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#F9B101] transition shadow-2xs"
                      >
                        {PREDEFINED_SHIFTS.map((sh) => (
                          <option key={sh.value} value={sh.value}>
                            {sh.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Role (Fixed) */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      System Role
                    </label>
                    <div className="w-full px-3 py-2 bg-zinc-100 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-600 flex items-center justify-between cursor-not-allowed">
                      <span>Technician (Maintenance Operations)</span>
                      <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black">
                        FIXED
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SECTION C: TECHNICAL SKILLS ───────────────────────────── */}
              <div className="border-b border-zinc-200 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>C. Technical Skills & Specializations *</span>
                  </h3>
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                    {selectedSkills.length} selected (min 1 required)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mb-2.5">
                  Select your core technical competencies. The breakdown dispatch engine automatically matches these skills to factory emergency calls.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AVAILABLE_SKILLS.map((skill) => {
                    const isSelected = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        disabled={loading}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer border ${
                          isSelected
                            ? 'bg-[#F9B101] text-black border-amber-500 shadow-sm'
                            : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100 border-zinc-300'
                        }`}
                      >
                        <span>{skill}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-black shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── SECTION D: ACCOUNT SECURITY ───────────────────────────── */}
              <div>
                <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>D. Account Security</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Password */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        disabled={loading}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full pl-9 pr-9 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-[#F9B101] transition shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        disabled={loading}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full pl-9 pr-9 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-[#F9B101] transition shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || loadingOrg}
                className="w-full bg-[#F9B101] hover:bg-[#E5A401] active:scale-[0.99] text-[#000000] font-black py-3 rounded-xl transition text-xs uppercase tracking-wider shadow-md hover:shadow-lg disabled:opacity-50 mt-4 flex items-center justify-center gap-2 border border-amber-500/40 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Submitting Registration...</span>
                  </>
                ) : (
                  <>
                    <span>SUBMIT TECHNICIAN REGISTRATION</span>
                    <ArrowRight className="w-4 h-4 text-black font-black stroke-[2.5]" />
                  </>
                )}
              </button>

              {/* Back to Login prompt */}
              <div className="text-center pt-2">
                <span className="text-xs text-zinc-500">Already registered? </span>
                <Link
                  to="/login"
                  className="text-xs font-bold text-amber-700 hover:text-amber-900 underline underline-offset-2 transition"
                >
                  Sign in here
                </Link>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10 w-full px-5 py-3 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-white/75 px-3 py-1 rounded-md border border-zinc-200/60 shadow-2xs">
          <Lock className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-semibold text-zinc-700">256-Bit SSL Encrypted • Manager Authorization Required</span>
        </div>
        <p className="font-semibold text-zinc-700 bg-white/75 px-3 py-1 rounded-md border border-zinc-200/60 shadow-2xs">
          © 2026 JCB India Limited.
        </p>
      </footer>
    </div>
  );
};
