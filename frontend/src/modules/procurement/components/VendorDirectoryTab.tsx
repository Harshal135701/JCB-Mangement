import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Edit2,
  Phone,
  Mail,
  Truck,
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { VendorPerformance } from '../types';
import { procurementService } from '../services/procurementService';
import { VendorModal } from './VendorModal';
import { VendorDetailsModal } from './VendorDetailsModal';

interface VendorDirectoryTabProps {
  canManageVendors: boolean;
  onShowFeedback?: (type: 'success' | 'error', message: string) => void;
}

export const VendorDirectoryTab: React.FC<VendorDirectoryTabProps> = ({
  canManageVendors,
  onShowFeedback,
}) => {
  const [vendors, setVendors] = useState<VendorPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'HIGH_PERFORMER'>('ALL');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVendorForEdit, setSelectedVendorForEdit] = useState<VendorPerformance | null>(null);
  const [selectedVendorForDetails, setSelectedVendorForDetails] = useState<VendorPerformance | null>(null);

  const fetchVendorsList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await procurementService.getVendors(searchQuery);
      setVendors(data);
    } catch (err: any) {
      console.error('Failed to fetch vendors:', err);
      setError(err.response?.data?.message || 'Failed to load vendor directory.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchVendorsList();
  }, [fetchVendorsList]);

  // Client-side filtering
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      // Status filter
      if (statusFilter === 'HIGH_PERFORMER' && (v.on_time_delivery_rate ?? 100) < 90) {
        return false;
      }
      if (statusFilter === 'ACTIVE' && v.total_orders === 0 && v.parts_supplied_count === 0) {
        return false;
      }
      return true;
    });
  }, [vendors, statusFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalVendors = vendors.length;
    const totalOrders = vendors.reduce((sum, v) => sum + Number(v.total_orders || 0), 0);
    const totalActiveOrders = vendors.reduce((sum, v) => sum + Number(v.active_orders || 0), 0);
    const totalSpend = vendors.reduce((sum, v) => sum + Number(v.total_spend || 0), 0);
    const avgSla =
      totalVendors > 0
        ? Math.round(
            vendors.reduce((sum, v) => sum + Number(v.on_time_delivery_rate ?? 100), 0) /
              totalVendors
          )
        : 100;

    return { totalVendors, totalOrders, totalActiveOrders, totalSpend, avgSla };
  }, [vendors]);

  const handleOpenCreate = () => {
    setSelectedVendorForEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vendor: VendorPerformance) => {
    setSelectedVendorForEdit(vendor);
    setIsModalOpen(true);
  };

  const handleSuccess = (msg: string) => {
    fetchVendorsList();
    if (onShowFeedback) {
      onShowFeedback('success', msg);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Approved Vendors</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-zinc-900">{metrics.totalVendors}</div>
          <div className="text-[10px] font-bold text-amber-600 mt-1">Certified Suppliers</div>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Active In-Flight Orders</span>
            <Truck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-zinc-900">{metrics.totalActiveOrders}</div>
          <div className="text-[10px] font-bold text-blue-600 mt-1">Pending Gate Delivery</div>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Total Vendor Spend</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-zinc-900">
            ₹{metrics.totalSpend.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] font-bold text-emerald-600 mt-1">Disbursed Volume</div>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Average On-Time SLA</span>
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-zinc-900">{metrics.avgSla}%</div>
          <div className="text-[10px] font-bold text-purple-600 mt-1">Delivery Reliability</div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
            <input
              type="text"
              placeholder="Search vendor directory by name, code or person..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:border-jcb-yellow cursor-pointer"
          >
            <option value="ALL">All Vendors</option>
            <option value="ACTIVE">Active with Orders</option>
            <option value="HIGH_PERFORMER">&gt;= 90% On-Time</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchVendorsList()}
            className="p-2.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-xl border border-zinc-200 transition cursor-pointer"
            title="Refresh Vendors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canManageVendors && (
            <button
              onClick={handleOpenCreate}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-4 py-2.5 rounded-xl shadow transition flex items-center gap-2 border border-amber-500 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Register Vendor</span>
            </button>
          )}
        </div>
      </div>

      {/* Vendor Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 font-black uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Vendor Name &amp; Code</th>
                <th className="px-5 py-3.5">Contact Details</th>
                <th className="px-5 py-3.5 text-center">Orders Breakdown</th>
                <th className="px-5 py-3.5 text-center">Parts Catalog</th>
                <th className="px-5 py-3.5 text-right">Cumulative Spend</th>
                <th className="px-5 py-3.5 text-center">On-Time SLA</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                      <span>Loading Vendor Directory...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-red-600 font-bold">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-6 h-6 text-red-500" />
                      <span>{error}</span>
                      <button
                        onClick={fetchVendorsList}
                        className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs"
                      >
                        Try Again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 font-bold">
                    No vendors found matching your search.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor, idx) => {
                  const onTimeRate = vendor.on_time_delivery_rate ?? 100;
                  const isHighPerformer = onTimeRate >= 90;

                  return (
                    <tr key={idx} className="hover:bg-zinc-50/80 transition">
                      {/* Vendor Name & Code */}
                      <td className="px-5 py-3.5">
                        <div className="font-black text-zinc-950 text-xs flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>{vendor.vendor_name}</span>
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                          {vendor.vendor_code ? `Code: ${vendor.vendor_code}` : 'Ballabgarh Approved'}
                        </div>
                      </td>

                      {/* Contact Details */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-zinc-800 text-[11px]">
                          {vendor.contact_person || 'Store / Purchase Desk'}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-0.5">
                          {vendor.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-zinc-400" />
                              {vendor.phone}
                            </span>
                          )}
                          {vendor.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-zinc-400" />
                              {vendor.email}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Orders Breakdown */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="inline-flex items-center gap-2 text-xs font-mono">
                          <span className="font-black text-zinc-900" title="Total Orders">
                            {vendor.total_orders || 0}
                          </span>
                          <span className="text-zinc-300">/</span>
                          <span className="font-bold text-blue-600" title="Active Orders In-Flight">
                            {vendor.active_orders || 0} active
                          </span>
                        </div>
                      </td>

                      {/* Parts Catalog */}
                      <td className="px-5 py-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          {vendor.parts_supplied_count || 0} Part(s)
                        </span>
                      </td>

                      {/* Cumulative Spend */}
                      <td className="px-5 py-3.5 text-right font-mono">
                        <div className="font-black text-zinc-900 text-xs">
                          ₹{Number(vendor.total_spend || 0).toLocaleString('en-IN')}
                        </div>
                      </td>

                      {/* On-Time SLA */}
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                            isHighPerformer
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isHighPerformer ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          {onTimeRate}%
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-zinc-100 text-zinc-700 border border-zinc-200">
                          Active
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedVendorForDetails(vendor)}
                            className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-lg transition cursor-pointer"
                            title="View Vendor Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canManageVendors && (
                            <button
                              onClick={() => handleOpenEdit(vendor)}
                              className="p-1.5 text-zinc-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                              title="Edit Vendor"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <VendorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        vendorToEdit={selectedVendorForEdit}
      />

      {/* Details Modal */}
      <VendorDetailsModal
        isOpen={Boolean(selectedVendorForDetails)}
        onClose={() => setSelectedVendorForDetails(null)}
        vendor={selectedVendorForDetails}
        onEdit={(v) => {
          setSelectedVendorForDetails(null);
          handleOpenEdit(v);
        }}
        canEdit={canManageVendors}
      />
    </div>
  );
};
