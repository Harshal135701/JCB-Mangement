import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  Eye,
  Printer,
  Calendar,
  Truck,
  Boxes,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { PurchaseOrderItem, PurchaseOrderPagination } from '../types';
import { procurementService } from '../services/procurementService';
import { PurchaseOrderDetailsModal } from './PurchaseOrderDetailsModal';
import { PurchaseOrderPrintView } from './PurchaseOrderPrintView';

interface PurchaseOrdersTabProps {
  canReceiveGRN: boolean;
  onOpenGRN: (po: PurchaseOrderItem) => void;
  onShowFeedback?: (type: 'success' | 'error', message: string) => void;
}

export const PurchaseOrdersTab: React.FC<PurchaseOrdersTabProps> = ({
  canReceiveGRN,
  onOpenGRN,
  onShowFeedback,
}) => {
  const [orders, setOrders] = useState<PurchaseOrderItem[]>([]);
  const [pagination, setPagination] = useState<PurchaseOrderPagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);

  // Selected for modals
  const [selectedPOForDetails, setSelectedPOForDetails] = useState<PurchaseOrderItem | null>(null);
  const [selectedPOForPrint, setSelectedPOForPrint] = useState<PurchaseOrderItem | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await procurementService.getPurchaseOrders({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        is_overdue: isOverdueOnly ? true : undefined,
        search: searchQuery.trim() || undefined,
      });
      setOrders(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      console.error('Failed to fetch purchase orders:', err);
      setError(err.response?.data?.message || 'Failed to load purchase orders.');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, isOverdueOnly, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  // Metrics
  const metrics = useMemo(() => {
    const totalCount = pagination.total;
    const activeCount = orders.filter((o) =>
      ['ordered', 'partially_received', 'po_created'].includes(o.status)
    ).length;
    const fullyReceivedCount = orders.filter((o) => o.status === 'fully_received').length;
    const overdueCount = orders.filter((o) => o.is_overdue).length;
    const totalOrderValue = orders.reduce((sum, o) => {
      const val = Number(o.overall_shipment_cost || o.total_order_cost || o.total_order_value || 0);
      return sum + val;
    }, 0);

    return { totalCount, activeCount, fullyReceivedCount, overdueCount, totalOrderValue };
  }, [orders, pagination.total]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'fully_received':
        return {
          label: 'Fully Received',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      case 'partially_received':
        return {
          label: 'Partially Received',
          color: 'bg-amber-100 text-amber-900 border-amber-300',
        };
      case 'ordered':
      case 'po_created':
        return {
          label: 'Issued / In Transit',
          color: 'bg-blue-100 text-blue-900 border-blue-300',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          color: 'bg-zinc-200 text-zinc-700 border-zinc-300',
        };
      case 'rejected':
        return {
          label: 'Rejected',
          color: 'bg-red-100 text-red-800 border-red-300',
        };
      default:
        return {
          label: status.replace(/_/g, ' '),
          color: 'bg-zinc-100 text-zinc-800 border-zinc-200',
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Purchase Orders</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-zinc-900">{metrics.totalCount}</div>
          <div className="text-[10px] font-bold text-blue-600 mt-1">Total Issued POs</div>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">In-Flight / Transit</span>
            <Truck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700">{metrics.activeCount}</div>
          <div className="text-[10px] font-bold text-amber-600 mt-1">Pending Gate Inward</div>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Fully Received</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{metrics.fullyReceivedCount}</div>
          <div className="text-[10px] font-bold text-emerald-600 mt-1">Reconciled to Stock</div>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Overdue Alerts</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-600">{metrics.overdueCount}</div>
          <div className="text-[10px] font-bold text-red-600 mt-1">Past Target Date</div>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Committed Volume</span>
            <TrendingUp className="w-4 h-4 text-zinc-900" />
          </div>
          <div className="text-2xl font-black text-zinc-900">
            ₹{metrics.totalOrderValue.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] font-bold text-zinc-500 mt-1">Current Page Spend</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
            <input
              type="text"
              placeholder="Search PO #, PR #, Part SKU, Supplier..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:border-jcb-yellow cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ordered">Issued / In Transit</option>
            <option value="partially_received">Partially Received</option>
            <option value="fully_received">Fully Received</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            onClick={() => {
              setIsOverdueOnly(!isOverdueOnly);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition shrink-0 cursor-pointer ${
              isOverdueOnly
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            Overdue Only
          </button>
        </div>

        <button
          onClick={() => fetchOrders()}
          className="p-2.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-xl border border-zinc-200 transition cursor-pointer shrink-0 self-end sm:self-auto"
          title="Refresh Purchase Orders"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Purchase Orders Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 font-black uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">PO &amp; Delivery Target</th>
                <th className="px-5 py-3.5">Supplier &amp; Route</th>
                <th className="px-5 py-3.5">Spare Part &amp; SKU</th>
                <th className="px-5 py-3.5">Quantities &amp; Fulfillment</th>
                <th className="px-5 py-3.5">Logistics &amp; Tracking</th>
                <th className="px-5 py-3.5 text-right">Commercials</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                      <span>Loading Purchase Order Register...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-red-600 font-bold">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                      <span>{error}</span>
                      <button
                        onClick={fetchOrders}
                        className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs"
                      >
                        Try Again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-bold">
                    No purchase orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((po) => {
                  const badge = getStatusBadge(po.status);
                  const received = Number(po.received_quantity || 0);
                  const required = Number(po.quantity_required || 0);
                  const remaining = Math.max(0, required - received);
                  const percent = required > 0 ? Math.min(100, Math.round((received / required) * 100)) : 0;
                  const partCost = Number(
                    po.total_order_cost || po.total_order_value || Number(po.unit_price || 0) * required
                  );
                  const freightCost = Number(po.freight_cost || 0);
                  const overallCost = Number(po.overall_shipment_cost || partCost + freightCost);

                  const canInward =
                    canReceiveGRN &&
                    ['ordered', 'partially_received', 'po_created'].includes(po.status) &&
                    remaining > 0;

                  return (
                    <tr key={po.id} className="hover:bg-zinc-50/80 transition">
                      {/* PO & Delivery Target */}
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-xs font-black text-blue-700 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>{po.po_number}</span>
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400 mt-0.5">
                          Linked PR: <span className="font-bold text-zinc-600">{po.pr_number}</span>
                        </div>
                        {po.expected_delivery_date ? (
                          <div className="mt-1">
                            <span className="text-[11px] font-semibold text-zinc-800 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span>
                                {new Date(po.expected_delivery_date).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            </span>
                            {po.is_overdue && (
                              <span className="bg-red-100 text-red-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase mt-0.5 inline-block">
                                Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-400 block mt-1">Delivery TBD</span>
                        )}
                      </td>

                      {/* Supplier & Route */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-zinc-950 text-xs">{po.supplier_name || 'N/A'}</div>
                        <div className="text-[10px] text-zinc-500 font-medium mt-0.5 flex items-center gap-1">
                          <span>{po.dispatch_location || 'Pune Hub'}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-zinc-400" />
                          <span>{po.destination_plant_name || po.plant_name || 'Ballabgarh Works'}</span>
                        </div>
                      </td>

                      {/* Spare Part & SKU */}
                      <td className="px-5 py-3.5">
                        <div className="font-black text-zinc-900">{po.part_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[11px] font-bold text-zinc-600">
                            {po.part_number}
                          </span>
                          {po.sku && (
                            <span className="font-mono text-[9px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                              SKU: {po.sku}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Quantities & Progress */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1 font-mono text-[11px]">
                          <div className="flex justify-between items-center text-[10px]">
                            <span>
                              Req: <strong className="text-zinc-900">{required}</strong>
                            </span>
                            <span className="text-emerald-700 font-bold">
                              Recv: {received}
                            </span>
                            <span className="text-amber-700 font-bold">
                              Rem: {remaining}
                            </span>
                          </div>
                          <div className="w-28 bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                percent === 100 ? 'bg-emerald-500' : 'bg-jcb-yellow'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${badge.color} inline-block mt-1`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Logistics & Tracking */}
                      <td className="px-5 py-3.5">
                        <div className="text-[11px] font-bold text-zinc-900">
                          {po.transporter_name || 'Standard Freight'}
                        </div>
                        {po.vehicle_number && (
                          <div className="font-mono text-[10px] text-zinc-600">
                            Veh: {po.vehicle_number}
                          </div>
                        )}
                        {po.lr_tracking_number && (
                          <div className="font-mono text-[10px] text-zinc-500">
                            LR: {po.lr_tracking_number}
                          </div>
                        )}
                      </td>

                      {/* Commercials */}
                      <td className="px-5 py-3.5 font-mono text-right">
                        <div className="font-bold text-zinc-900 text-xs">
                          ₹{Number(po.unit_price || 0).toLocaleString('en-IN')}{' '}
                          <span className="text-[10px] text-zinc-500 font-normal">/ unit</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Order: ₹{partCost.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] font-black text-zinc-950 pt-0.5 border-t border-zinc-200 mt-0.5">
                          Total: ₹{overallCost.toLocaleString('en-IN')}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canInward && (
                            <button
                              onClick={() => onOpenGRN(po)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-2xs transition uppercase flex items-center gap-1 cursor-pointer"
                              title="Inward Goods Receipt Note (GRN)"
                            >
                              <Boxes className="w-3.5 h-3.5" />
                              <span>GRN</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedPOForDetails(po)}
                            className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-lg transition cursor-pointer"
                            title="Inspect Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedPOForPrint(po)}
                            className="p-1.5 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Print Purchase Order"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-600">
            <span className="font-semibold">
              Page <span className="font-black text-zinc-900">{pagination.page}</span> of{' '}
              {pagination.totalPages} ({pagination.total} Orders)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="p-1.5 rounded-lg border border-zinc-300 disabled:opacity-40 hover:bg-white transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="p-1.5 rounded-lg border border-zinc-300 disabled:opacity-40 hover:bg-white transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <PurchaseOrderDetailsModal
        isOpen={Boolean(selectedPOForDetails)}
        onClose={() => setSelectedPOForDetails(null)}
        po={selectedPOForDetails}
        onPrint={(po) => {
          setSelectedPOForPrint(po);
        }}
        onOpenGRN={(po) => {
          onOpenGRN(po);
        }}
        canReceiveGRN={canReceiveGRN}
      />

      {/* Print View Modal */}
      <PurchaseOrderPrintView
        isOpen={Boolean(selectedPOForPrint)}
        onClose={() => setSelectedPOForPrint(null)}
        po={selectedPOForPrint}
      />
    </div>
  );
};
