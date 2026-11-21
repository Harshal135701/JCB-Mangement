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
  CheckCircle2,
  Building,
  Layers,
  Phone,
  Mail,
  HardHat,
  Briefcase,
  Clock,
  ShieldAlert,
  Cpu,
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

interface MachineOption {
  id: string;
  machine_code: string;
  name: string;
  status: string;
  category?: string;
  criticality?: string;
  bay_line_location?: string | null;
  shop_id: string;
  is_assigned?: boolean;
  is_available?: boolean;
  availability_status?: 'Assigned' | 'Available' | string;
}

// Format readable machine status for display
const formatReadableStatus = (status?: string | null): string => {
  if (!status) return 'Active';
  const s = status.trim().toLowerCase();
  switch (s) {
    case 'running':
    case 'active':
      return 'Active';
    case 'idle':
      return 'Idle';
    case 'under_maintenance':
    case 'maintenance':
      return 'Maintenance';
    case 'breakdown':
      return 'Breakdown';
    case 'inactive':
    case 'decommissioned':
      return 'Inactive';
    case 'awaiting_verification':
      return 'Awaiting Verification';
    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
};

export const OperatorSignUpPage: React.FC = () => {
  const navigate = useNavigate();

  // Form inputs
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plantId, setPlantId] = useState('');
  const [shopId, setShopId] = useState('');
  const [department, setDepartment] = useState('Production');
  const [designation, setDesignation] = useState('Machine Operator');
  const [shift, setShift] = useState('Shift A');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [error, setError] = useState('');
  const [submittedUser, setSubmittedUser] = useState<any | null>(null);

  // Facility Options
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);

  // Machine Options (All active, inactive, breakdown, and maintenance machines)
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [loadingMachines, setLoadingMachines] = useState(false);

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
            // Find first plant that actually has registered shops available, fallback to first plant
            const initialPlant =
              plantsList.find((p) => allShops.some((s) => s.plant_id === p.id)) ||
              plantsList[0];
            setPlantId(initialPlant.id);

            // Filter shops for the selected initial plant
            const plantShops = allShops.filter(
              (s: ShopOption) => s.plant_id === initialPlant.id
            );
            setShops(plantShops);
            if (plantShops.length > 0) {
              const firstShop = plantShops[0];
              setShopId(firstShop.id);
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
    setSelectedMachineId('');
    if (!newPlantId) {
      setShops([]);
      setShopId('');
      setMachines([]);
      return;
    }
    try {
      const res = await apiClient.get(`/auth/plants/${newPlantId}/shops`);
      if (res.data.success && Array.isArray(res.data.data)) {
        const newShops = res.data.data;
        setShops(newShops);
        if (newShops.length > 0) {
          setShopId(newShops[0].id);
        } else {
          setShopId('');
          setMachines([]);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch shops for plant:', err);
      setShops([]);
      setShopId('');
      setMachines([]);
    }
  };

  const handleShopChange = (newShopId: string) => {
    setShopId(newShopId);
    setSelectedMachineId('');
  };

  // Fetch machines for selected shop and plant
  const fetchMachinesForShop = async (targetShopId: string) => {
    if (!targetShopId) {
      setMachines([]);
      setSelectedMachineId('');
      return;
    }
    try {
      setLoadingMachines(true);
      const res = await apiClient.get(`/auth/shops/${targetShopId}/machines`, {
        params: plantId ? { plant_id: plantId } : undefined,
      });
      if (res.data.success && Array.isArray(res.data.data)) {
        setMachines(res.data.data);
      } else {
        setMachines([]);
      }
    } catch (err) {
      console.warn('Failed to fetch machines for shop:', err);
      setMachines([]);
    } finally {
      setLoadingMachines(false);
    }
  };

  // Whenever selected shop or plant changes, reload the machine list
  useEffect(() => {
    if (shopId) {
      fetchMachinesForShop(shopId);
      setSelectedMachineId('');
    } else {
      setMachines([]);
      setSelectedMachineId('');
    }
  }, [shopId, plantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError('');

    // Validations
    const cleanCode = employeeCode.trim().toUpperCase();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanCode) {
      setError('Employee ID is required.');
      return;
    }
    if (!cleanName) {
      setError('Full Name is required.');
      return;
    }
    if (!cleanEmail) {
      setError('Email address is required.');
      return;
    }
    if (!plantId) {
      setError('Please select your Plant facility.');
      return;
    }
    if (!shopId) {
      setError('Please select your Shop Floor.');
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

    // Verify machine is not already assigned
    if (selectedMachineId) {
      const chosen = machines.find((m) => m.id === selectedMachineId);
      if (chosen && (chosen.is_assigned || chosen.is_available === false)) {
        setError(
          `Machine ${chosen.name} (${chosen.machine_code}) is already assigned to another operator. Please select an available machine.`
        );
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        employee_code: cleanCode,
        full_name: cleanName,
        email: cleanEmail,
        phone: phone.trim() || undefined,
        plant_id: plantId,
        shop_id: shopId,
        department: department.trim() || 'Production',
        designation: designation.trim() || 'Machine Operator',
        shift: shift || 'Shift A',
        password,
        requested_machine_id: selectedMachineId || undefined,
      };

      const res = await apiClient.post('/auth/register-operator', payload);

      if (res.data.success) {
        const pickedMachine = machines.find((m) => m.id === selectedMachineId);
        setSubmittedUser({
          ...res.data.data,
          plantName: plants.find((p) => p.id === plantId)?.plant_name,
          shopName: shops.find((s) => s.id === shopId)?.shop_name,
          requestedMachine: pickedMachine
            ? `${pickedMachine.name} (${pickedMachine.machine_code})`
            : 'None specified (General shift pool)',
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
      {/* ── Background Hero Image (identical to LoginPage) ────────────────── */}
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
            OPERATOR ONBOARDING
          </span>
        </div>
      </header>

      {/* ── Main Container ───────────────────────────────────────────────── */}
      <main className="relative z-10 w-full flex-1 flex items-center justify-center lg:justify-end px-4 py-6 sm:px-8 lg:pr-12 xl:pr-20">
        {submittedUser ? (
          /* ── SUCCESS BANNER CARD ───────────────────────────────────────── */
          <div className="w-full max-w-[540px] bg-white rounded-2xl shadow-[0_15px_45px_rgba(0,0,0,0.12)] border border-[#E5E7EB] p-5 sm:p-8 md:p-10 animate-in fade-in duration-200 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-300">
              <HardHat className="w-8 h-8 text-amber-700" />
            </div>

            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Registration Submitted • Pending Approval
            </div>

            <h2 className="text-2xl font-black text-zinc-950 tracking-tight">
              Registration Under Review
            </h2>

            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              Your operator account request has been routed to your Plant Manager for verification and approval.
            </p>

            {/* Operator Details Summary Box */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 my-6 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Operator Name</span>
                <span className="font-bold text-zinc-900">{submittedUser.full_name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Employee ID</span>
                <span className="font-mono font-black text-zinc-900">{submittedUser.employee_code}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Plant Facility</span>
                <span className="font-semibold text-zinc-800">{submittedUser.plantName || 'Assigned Plant'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Shop Floor</span>
                <span className="font-semibold text-zinc-800">{submittedUser.shopName || 'Assigned Shop'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <span className="text-zinc-500 font-semibold">Preferred Machine</span>
                <span className="font-bold text-amber-900">{submittedUser.requestedMachine}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-semibold">Initial Shift</span>
                <span className="font-semibold text-zinc-800">{submittedUser.shift || 'Shift A'}</span>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 text-left flex items-start gap-2.5 mb-6 text-xs text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Next Step:</strong> Your Plant Manager will verify your factory credentials and approve access. You will receive notification once authorized, after which you can log in to start shift inspections and machine tasks.
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
          <div className="w-full max-w-[620px] bg-white rounded-2xl shadow-[0_15px_45px_rgba(0,0,0,0.12)] border border-[#E5E7EB] p-4 sm:p-6 md:p-8 animate-in fade-in duration-200">
            {/* Card Header */}
            <div className="mb-5">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="bg-[#F9B101] text-black font-black text-[11px] px-2 py-0.5 rounded shadow">
                  JCB FACTORY
                </span>
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Role: Operator (Fixed)
                </span>
              </div>
              <h2 className="text-2xl font-black text-[#111827] tracking-tight">
                Operator Sign-Up
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-1">
                Enter your factory details to register for Smart CMMS access. Manager approval is required before first sign-in.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Employee ID */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
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
                      placeholder="e.g. JCB-OPR-4012"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-mono font-bold text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
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
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-semibold text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Corporate Email */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Corporate Email *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      disabled={loading}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="operator@jcb.com"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      disabled={loading}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Plant Facility */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
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

                {/* Shop Floor */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Shop Floor *
                  </label>
                  <div className="relative">
                    <Layers className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      required
                      disabled={loading || loadingOrg || shops.length === 0}
                      value={shopId}
                      onChange={(e) => handleShopChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#F9B101] focus:ring-2 focus:ring-[#F9B101]/20 transition shadow-2xs"
                    >
                      {shops.length === 0 ? (
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

                {/* Preferred Machine Selection */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                      Preferred Machine Request
                    </label>
                    <span className="text-[10px] text-zinc-500 font-medium">
                      Preference only • Manager confirms on approval
                    </span>
                  </div>

                  {/* Clean, compact machine selection interface */}
                  <div className="border border-[#D1D5DB] rounded-xl overflow-hidden bg-white shadow-2xs">
                    {/* General shift pool option */}
                    <div
                      onClick={() => setSelectedMachineId('')}
                      className={`px-3 py-2 border-b border-zinc-100 flex items-center justify-between text-xs cursor-pointer transition ${
                        selectedMachineId === ''
                          ? 'bg-[#F9B101]/10 font-bold text-zinc-900'
                          : 'hover:bg-zinc-50 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="preferredMachineSelection"
                          checked={selectedMachineId === ''}
                          onChange={() => setSelectedMachineId('')}
                          className="w-3.5 h-3.5 accent-[#F9B101] text-[#F9B101] cursor-pointer"
                        />
                        <span>No specific machine (General shift pool)</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-normal">Default</span>
                    </div>

                    {/* Table Header */}
                    <div className="bg-zinc-50 border-b border-zinc-200 px-3 py-1.5 grid grid-cols-12 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      <div className="col-span-6 sm:col-span-7">Machine</div>
                      <div className="col-span-3 sm:col-span-3">Status</div>
                      <div className="col-span-3 sm:col-span-2 text-right">Selection</div>
                    </div>

                    {/* Table Content */}
                    <div className="max-h-48 overflow-y-auto divide-y divide-zinc-100">
                      {loadingMachines ? (
                        <div className="py-6 text-center text-zinc-400 text-xs flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-[#F9B101]" />
                          <span>Loading shop machines...</span>
                        </div>
                      ) : !shopId ? (
                        <div className="py-6 text-center text-zinc-500 text-xs">
                          Please select a shop floor to view machines.
                        </div>
                      ) : machines.length === 0 ? (
                        <div className="py-6 text-center text-zinc-500 text-xs">
                          No machines registered under this shop.
                        </div>
                      ) : (
                        <>
                          {machines.filter((m) => !m.is_assigned && m.is_available !== false).length === 0 && (
                            <div className="p-2.5 bg-amber-50 text-amber-900 text-xs font-semibold text-center border-b border-amber-200">
                              No available machines in this shop.
                            </div>
                          )}
                          {machines.map((m) => {
                            const isAssigned = Boolean(m.is_assigned || m.is_available === false);
                            const isSelectable = !isAssigned;
                            const isSelected = selectedMachineId === m.id;

                            return (
                              <div
                                key={m.id}
                                onClick={() => {
                                  if (isSelectable) {
                                    setSelectedMachineId(m.id);
                                  }
                                }}
                                className={`px-3 py-2 grid grid-cols-12 items-center text-xs transition ${
                                  isAssigned
                                    ? 'opacity-60 bg-zinc-50/70 cursor-not-allowed select-none'
                                    : isSelected
                                    ? 'bg-[#F9B101]/15 font-semibold text-zinc-900 cursor-pointer'
                                    : 'hover:bg-zinc-50 text-zinc-800 cursor-pointer'
                                }`}
                              >
                                {/* Machine Name & Code */}
                                <div className="col-span-6 sm:col-span-7 pr-2 flex items-center gap-1.5 truncate">
                                  <span className="font-bold text-zinc-900 truncate">{m.name}</span>
                                  {m.machine_code && (
                                    <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                                      ({m.machine_code})
                                    </span>
                                  )}
                                </div>

                                {/* Status */}
                                <div className="col-span-3 sm:col-span-3">
                                  {isAssigned ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-zinc-200 text-zinc-700">
                                      Assigned
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Available
                                    </span>
                                  )}
                                </div>

                                {/* Selection */}
                                <div className="col-span-3 sm:col-span-2 text-right">
                                  {isAssigned ? (
                                    <span className="text-[11px] font-semibold text-zinc-400">
                                      Disabled
                                    </span>
                                  ) : (
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                      <span className="text-[11px] font-bold text-emerald-700 hidden sm:inline">
                                        {isSelected ? 'Selected' : 'Select'}
                                      </span>
                                      <input
                                        type="radio"
                                        name="preferredMachineSelection"
                                        checked={isSelected}
                                        disabled={isAssigned}
                                        onChange={() => setSelectedMachineId(m.id)}
                                        className="w-3.5 h-3.5 accent-[#F9B101] text-[#F9B101] cursor-pointer"
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Accessible select element kept in sync */}
                  <select
                    name="requested_machine_id"
                    disabled={loading || loadingOrg || loadingMachines || !shopId}
                    value={selectedMachineId}
                    onChange={(e) => setSelectedMachineId(e.target.value)}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <option value="">-- No specific machine (General shift pool) --</option>
                    {machines.map((m) => {
                      const isAssigned = Boolean(m.is_assigned || m.is_available === false);
                      return (
                        <option key={m.id} value={m.id} disabled={isAssigned}>
                          {m.name} ({m.machine_code}) — {isAssigned ? 'Assigned' : 'Available'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Department
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      disabled={loading}
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-[#F9B101] transition shadow-2xs"
                    >
                      <option value="Fabrication">Fabrication Shop</option>
                      <option value="Machining">Machining & HMC Line</option>
                      <option value="Assembly">Chassis & Final Assembly</option>
                      <option value="Paint Shop">Automated Paint Shop</option>
                      <option value="Welding">Robotic Welding Bay</option>
                      <option value="Production">General Production Floor</option>
                    </select>
                  </div>
                </div>

                {/* Designation */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Designation
                  </label>
                  <div className="relative">
                    <HardHat className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      disabled={loading}
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. CNC Machine Operator"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F9B101] transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Shift (Default: Shift A) */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Shift Assignment *
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      disabled={loading}
                      value={shift}
                      onChange={(e) => setShift(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#F9B101] transition shadow-2xs"
                    >
                      <option value="Shift A">Shift A (06:00 - 14:30) - Default</option>
                      <option value="Shift B">Shift B (14:30 - 23:00)</option>
                      <option value="Shift C">Shift C (23:00 - 06:00)</option>
                      <option value="General Shift">General Shift (09:00 - 17:30)</option>
                    </select>
                  </div>
                </div>

                {/* Role (Fixed: Operator) */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    System Role
                  </label>
                  <div className="w-full px-3 py-2 bg-zinc-100 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-600 flex items-center justify-between cursor-not-allowed">
                    <span>Operator (Factory Operations)</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black">
                      FIXED
                    </span>
                  </div>
                </div>

                {/* Initial Password */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Initial Password *
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
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
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
                    <span>SUBMIT OPERATOR REGISTRATION</span>
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
