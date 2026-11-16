import React from 'react';
import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  CheckCircle2,
  Truck,
  Package,
  DollarSign,
  TrendingUp,
  Edit2,
  ShieldCheck,
} from 'lucide-react';
import { VendorPerformance, VendorRecord } from '../types';

interface VendorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: VendorPerformance | null;
  onEdit?: (vendor: VendorPerformance) => void;
  canEdit?: boolean;
}

export const VendorDetailsModal: React.FC<VendorDetailsModalProps> = ({
  isOpen,
  onClose,
  vendor,
  onEdit,
  canEdit,
}) => {
  if (!isOpen || !vendor) return null;

  const isActive = vendor.status !== 'inactive';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="bg-white p-5 flex items-center justify-between border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-jcb-yellow text-black flex items-center justify-center font-black shadow-sm border border-amber-500">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-zinc-950">{vendor.vendor_name}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                  }`}
                >
                  {isActive ? 'Active Supplier' : 'Inactive'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                {vendor.vendor_code ? `Code: ${vendor.vendor_code}` : 'JCB Ballabgarh Certified Supplier'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-800 p-1.5 rounded-xl hover:bg-zinc-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Key KPI Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-wider block">
                Total Orders
              </span>
              <span className="text-xl font-black text-zinc-900 mt-1 block">
                {vendor.total_orders || 0}
              </span>
              <span className="text-[10px] text-zinc-500 font-medium">Lifetime PRs/POs</span>
            </div>

            <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-200">
              <span className="text-[10px] text-blue-700 font-black uppercase tracking-wider block">
                Active Orders
              </span>
              <span className="text-xl font-black text-blue-900 mt-1 block">
                {vendor.active_orders || 0}
              </span>
              <span className="text-[10px] text-blue-600 font-medium">In Transit / Inward</span>
            </div>

            <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-wider block">
                Cumulative Spend
              </span>
              <span className="text-xl font-black text-zinc-900 mt-1 block">
                ₹{Number(vendor.total_spend || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-zinc-500 font-medium">Processed Spend</span>
            </div>

            <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-[10px] text-emerald-800 font-black uppercase tracking-wider block">
                SLA Fulfillment
              </span>
              <span className="text-xl font-black text-emerald-900 mt-1 block">
                {vendor.on_time_delivery_rate ?? 100}%
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">On-Time Deliveries</span>
            </div>
          </div>

          {/* Contact & Registration Information */}
          <div className="bg-white rounded-xl border-2 border-zinc-200 overflow-hidden">
            <div className="bg-zinc-100 px-4 py-2.5 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-800">
                Supplier Profile &amp; Contact Details
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">
                  Contact Person
                </span>
                <span className="font-bold text-zinc-900 flex items-center gap-1.5 mt-0.5">
                  {vendor.contact_person || 'Procurement Liaison / Store Lead'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">
                  Contact Phone
                </span>
                <span className="font-mono font-bold text-zinc-900 flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-zinc-400" />
                  {vendor.phone || '+91-129-2244000 (JCB Central Ex.)'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">
                  Email Address
                </span>
                <span className="font-medium text-zinc-900 flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  {vendor.email || `${vendor.vendor_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@supplier.jcb.com`}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">
                  GSTIN / Registration
                </span>
                <span className="font-mono font-bold text-zinc-900 flex items-center gap-1.5 mt-0.5">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  {vendor.gstin || '06AAACJ0123M1Z8'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">
                  Standard Payment Terms
                </span>
                <span className="font-bold text-zinc-900 flex items-center gap-1.5 mt-0.5">
                  <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
                  {vendor.payment_terms || 'Net 30 Days'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">
                  Parts Catalog Presence
                </span>
                <span className="font-bold text-zinc-900 flex items-center gap-1.5 mt-0.5">
                  <Package className="w-3.5 h-3.5 text-amber-500" />
                  {vendor.parts_supplied_count || 1} SKU(s) Supplied
                </span>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-zinc-100">
                <span className="text-[10px] font-black uppercase text-zinc-400 block">
                  Registered Depot / Plant Address
                </span>
                <p className="text-zinc-800 font-medium mt-0.5 flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <span>
                    {vendor.address ||
                      'JCB Approved Industrial Supply Depot, Sector 25, Faridabad / Ballabgarh, Haryana'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-zinc-500 font-medium">
            Status: <span className="font-bold text-zinc-900">{isActive ? 'Active Supplier' : 'Inactive'}</span>
          </div>
          <div className="flex items-center gap-3">
            {canEdit && onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(vendor);
                }}
                className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-300 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Vendor</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
