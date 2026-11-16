import React, { useState, useEffect } from 'react';
import { X, Building2, Save, AlertCircle, ShieldCheck } from 'lucide-react';
import { CreateVendorInput, UpdateVendorInput, VendorPerformance, VendorRecord } from '../types';
import { procurementService } from '../services/procurementService';

interface VendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  vendorToEdit?: VendorPerformance | VendorRecord | null;
}

export const VendorModal: React.FC<VendorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vendorToEdit,
}) => {
  const isEdit = Boolean(vendorToEdit && (vendorToEdit as any).id);

  const [formData, setFormData] = useState({
    vendor_code: '',
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    gstin: '',
    payment_terms: 'Net 30',
    status: 'active' as 'active' | 'inactive',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vendorToEdit) {
      setFormData({
        vendor_code: (vendorToEdit as any).vendor_code || '',
        name: (vendorToEdit as any).name || (vendorToEdit as any).vendor_name || '',
        contact_person: (vendorToEdit as any).contact_person || '',
        email: (vendorToEdit as any).email || '',
        phone: (vendorToEdit as any).phone || '',
        address: (vendorToEdit as any).address || '',
        gstin: (vendorToEdit as any).gstin || '',
        payment_terms: (vendorToEdit as any).payment_terms || 'Net 30',
        status: (vendorToEdit as any).status === 'inactive' ? 'inactive' : 'active',
      });
    } else {
      setFormData({
        vendor_code: `VEND-${Math.floor(1000 + Math.random() * 9000)}`,
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        gstin: '',
        payment_terms: 'Net 30',
        status: 'active',
      });
    }
    setError(null);
  }, [vendorToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Vendor Name is required.');
      return;
    }

    if (!isEdit && !formData.vendor_code.trim()) {
      setError('Vendor Code is required.');
      return;
    }

    try {
      setLoading(true);
      if (isEdit && (vendorToEdit as any)?.id) {
        const updatePayload: UpdateVendorInput = {
          name: formData.name.trim(),
          contact_person: formData.contact_person.trim() || undefined,
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          address: formData.address.trim() || undefined,
          gstin: formData.gstin.trim() || undefined,
          payment_terms: formData.payment_terms.trim() || undefined,
          status: formData.status,
        };
        const res = await procurementService.updateVendor((vendorToEdit as any).id, updatePayload);
        onSuccess(res.message || `Vendor ${formData.name} updated successfully.`);
      } else {
        const createPayload: CreateVendorInput = {
          vendor_code: formData.vendor_code.trim().toUpperCase(),
          name: formData.name.trim(),
          contact_person: formData.contact_person.trim() || undefined,
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          address: formData.address.trim() || undefined,
          gstin: formData.gstin.trim() || undefined,
          payment_terms: formData.payment_terms.trim() || 'Net 30',
        };
        const res = await procurementService.createVendor(createPayload);
        onSuccess(res.message || `Vendor ${formData.name} registered successfully.`);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving vendor:', err);
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to save vendor details. Please verify your inputs.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="bg-white p-5 flex items-center justify-between border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-jcb-yellow text-black flex items-center justify-center font-black shadow-sm border border-amber-500">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-950">
                {isEdit ? 'EDIT VENDOR / SUPPLIER' : 'REGISTER NEW VENDOR / SUPPLIER'}
              </h3>
              <p className="text-[11px] text-zinc-500 font-medium">
                JCB Certified Vendor Master &amp; Procurement Registry
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700 font-bold">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Vendor Code */}
            <div>
              <label className="block text-[11px] font-black uppercase text-zinc-700 mb-1">
                Vendor Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={isEdit}
                value={formData.vendor_code}
                onChange={(e) => setFormData({ ...formData, vendor_code: e.target.value })}
                placeholder="e.g. VEND-001"
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow disabled:bg-zinc-100 disabled:text-zinc-500 uppercase"
                required
              />
            </div>

            {/* Vendor Name */}
            <div>
              <label className="block text-[11px] font-black uppercase text-zinc-700 mb-1">
                Vendor / Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. JCB Genuine Parts India Ltd"
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                required
              />
            </div>

            {/* Contact Person */}
            <div>
              <label className="block text-[11px] font-black uppercase text-zinc-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="e.g. Anil Kumar Sharma"
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[11px] font-black uppercase text-zinc-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-black uppercase text-zinc-700 mb-1">
                Official Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. supplies@jcbparts.in"
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>

            {/* GSTIN */}
            <div>
              <label className="block text-[11px] font-black uppercase text-zinc-700 mb-1">
                GSTIN / Tax Registration
              </label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="e.g. 07AAAAA0000A1Z5"
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow uppercase"
              />
            </div>

            {/* Payment Terms */}
            <div>
              <label className="block text-[11px] font-black uppercase text-zinc-700 mb-1">
                Payment Terms
              </label>
              <select
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow cursor-pointer"
              >
                <option value="Net 15">Net 15 Days</option>
                <option value="Net 30">Net 30 Days</option>
                <option value="Net 45">Net 45 Days</option>
                <option value="Net 60">Net 60 Days</option>
                <option value="Immediate">Immediate / Advance</option>
                <option value="Against Delivery">Against Delivery / COD</option>
              </select>
            </div>

            {/* Status (If editing) */}
            {isEdit && (
              <div>
                <label className="block text-[11px] font-black uppercase text-zinc-700 mb-1">
                  Vendor Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })
                  }
                  className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow cursor-pointer"
                >
                  <option value="active">Active / Approved</option>
                  <option value="inactive">Inactive / Blacklisted</option>
                </select>
              </div>
            )}
          </div>

          {/* Full Address */}
          <div>
            <label className="block text-[11px] font-black uppercase text-zinc-700 mb-1">
              Registered Address &amp; Depot
            </label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. Plot No. 44, Sector 25, Industrial Area, Ballabgarh, Haryana - 121004"
              className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition border border-zinc-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-black bg-jcb-yellow hover:bg-jcb-yellowDark text-black shadow-sm transition flex items-center gap-2 border border-amber-500 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : isEdit ? 'Update Vendor' : 'Register Vendor'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
