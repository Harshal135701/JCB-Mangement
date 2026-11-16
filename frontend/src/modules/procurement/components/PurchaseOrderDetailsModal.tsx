import React from 'react';
import {
  X,
  FileText,
  Printer,
  Building,
  Package,
  Truck,
  DollarSign,
  Calendar,
  CheckCircle2,
  Boxes,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  User,
  ExternalLink,
} from 'lucide-react';
import { PurchaseOrderItem } from '../types';

interface PurchaseOrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrderItem | null;
  onPrint: (po: PurchaseOrderItem) => void;
  onOpenGRN?: (po: PurchaseOrderItem) => void;
  canReceiveGRN?: boolean;
}

export const PurchaseOrderDetailsModal: React.FC<PurchaseOrderDetailsModalProps> = ({
  isOpen,
  onClose,
  po,
  onPrint,
  onOpenGRN,
  canReceiveGRN,
}) => {
  if (!isOpen || !po) return null;

  const qty = Number(po.quantity_required || 0);
  const received = Number(po.received_quantity || 0);
  const remaining = Math.max(0, qty - received);
  const percentReceived = qty > 0 ? Math.min(100, Math.round((received / qty) * 100)) : 0;

  const unitPrice = Number(po.unit_price || 0);
  const partCost = Number(po.total_order_cost || po.total_order_value || qty * unitPrice);
  const freight = Number(po.freight_cost || 0);
  const totalAmount = Number(po.overall_shipment_cost || partCost + freight);

  const canInward =
    canReceiveGRN &&
    ['ordered', 'partially_received', 'po_created'].includes(po.status) &&
    remaining > 0;

  const getStatusColor = (st: string) => {
    switch (st) {
      case 'fully_received':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'partially_received':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'ordered':
      case 'po_created':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'cancelled':
        return 'bg-zinc-200 text-zinc-700 border-zinc-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-jcb-yellow text-black flex items-center justify-center font-black shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">{po.po_number}</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(
                    po.status
                  )}`}
                >
                  {po.status.replace(/_/g, ' ')}
                </span>
                {po.is_overdue && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white animate-pulse">
                    Overdue
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 font-medium">
                Linked PR: <span className="font-mono text-zinc-200">{po.pr_number}</span> | Plant: {po.plant_name || 'JCB Ballabgarh Works'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrint(po)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-lg transition flex items-center gap-1.5 border border-zinc-700 cursor-pointer"
              title="Print Official PO"
            >
              <Printer className="w-3.5 h-3.5 text-jcb-yellow" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Progress / Fulfillment Bar */}
          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-black text-zinc-700 uppercase">Receiving Progress</span>
              <span className="font-mono font-bold text-zinc-900">
                {received} of {qty} Units Received ({percentReceived}%)
              </span>
            </div>
            <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  percentReceived === 100 ? 'bg-emerald-500' : 'bg-jcb-yellow'
                }`}
                style={{ width: `${percentReceived}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-zinc-500 mt-2 font-mono">
              <span>Required: {qty}</span>
              <span>Received: {received}</span>
              <span className={remaining > 0 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                Remaining: {remaining}
              </span>
            </div>
          </div>

          {/* Supplier & Requisition Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Vendor Card */}
            <div className="p-4 rounded-xl border-2 border-zinc-200 bg-white space-y-2">
              <div className="flex items-center gap-2 text-zinc-500 font-black uppercase tracking-wider text-[10px]">
                <Building className="w-3.5 h-3.5 text-amber-500" />
                <span>Supplier / Consignor</span>
              </div>
              <div className="font-black text-zinc-950 text-sm">{po.supplier_name}</div>
              <div className="text-[11px] text-zinc-600">
                Dispatch Origin: <span className="font-semibold text-zinc-800">{po.dispatch_location || 'Authorized Depot'}</span>
              </div>
              <div className="text-[11px] text-zinc-600">
                Destination: <span className="font-semibold text-zinc-800">{po.destination_plant_name || po.plant_name || 'JCB Ballabgarh Works'}</span>
              </div>
            </div>

            {/* Requisition Card */}
            <div className="p-4 rounded-xl border-2 border-zinc-200 bg-white space-y-2">
              <div className="flex items-center gap-2 text-zinc-500 font-black uppercase tracking-wider text-[10px]">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span>Requisition &amp; Target</span>
              </div>
              <div className="font-mono font-black text-blue-700 text-sm">{po.pr_number}</div>
              <div className="text-[11px] text-zinc-600">
                Requested By: <span className="font-semibold text-zinc-800">{po.requested_by_name || 'Plant Engineer'}</span>
              </div>
              <div className="text-[11px] text-zinc-600">
                Approved By: <span className="font-semibold text-zinc-800">{po.approved_by_name || 'Authorized Lead'}</span>
              </div>
              <div className="text-[11px] text-zinc-600">
                Delivery Target:{' '}
                <span className={`font-semibold ${po.is_overdue ? 'text-red-600 font-bold' : 'text-zinc-800'}`}>
                  {po.expected_delivery_date
                    ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Ordered Spare Part Breakdown */}
          <div className="rounded-xl border-2 border-zinc-200 bg-white overflow-hidden text-xs">
            <div className="bg-zinc-100 px-4 py-2.5 border-b border-zinc-200 flex items-center justify-between">
              <span className="font-black uppercase tracking-wider text-zinc-800">
                Ordered Material / Spare Part
              </span>
              <Package className="w-4 h-4 text-amber-500" />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-black text-sm text-zinc-950">{po.part_name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-bold text-zinc-700">
                      Part #: {po.part_number}
                    </span>
                    {po.sku && (
                      <span className="font-mono text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-bold">
                        SKU: {po.sku}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase font-black block">Unit Price</span>
                  <span className="font-mono font-black text-sm text-zinc-900">
                    ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-100 font-mono text-[11px]">
                <div className="bg-zinc-50 p-2 rounded-lg">
                  <span className="text-zinc-400 block text-[9px] uppercase font-bold">Unit of Measure</span>
                  <span className="font-black text-zinc-800">{po.uom || 'Nos'}</span>
                </div>
                <div className="bg-zinc-50 p-2 rounded-lg">
                  <span className="text-zinc-400 block text-[9px] uppercase font-bold">Designated Bin</span>
                  <span className="font-black text-zinc-800">{po.bin_location || 'LINE-BIN-01'}</span>
                </div>
                <div className="bg-zinc-50 p-2 rounded-lg">
                  <span className="text-zinc-400 block text-[9px] uppercase font-bold">Machine Target</span>
                  <span className="font-black text-zinc-800">{po.machine_code || 'General Stock'}</span>
                </div>
                <div className="bg-zinc-50 p-2 rounded-lg">
                  <span className="text-zinc-400 block text-[9px] uppercase font-bold">Shop Target</span>
                  <span className="font-black text-zinc-800">{po.shop_name || 'Assembly Shop'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Logistics & Tracking */}
          <div className="rounded-xl border-2 border-zinc-200 bg-white overflow-hidden text-xs">
            <div className="bg-zinc-100 px-4 py-2.5 border-b border-zinc-200 flex items-center justify-between">
              <span className="font-black uppercase tracking-wider text-zinc-800">
                Logistics &amp; Dispatch Tracking
              </span>
              <Truck className="w-4 h-4 text-purple-600" />
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">
                  Carrier / Transporter
                </span>
                <span className="font-bold text-zinc-900 mt-0.5 block">
                  {po.transporter_name || 'Designated Freight Service'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">
                  Vehicle Number
                </span>
                <span className="font-mono font-bold text-zinc-900 mt-0.5 block">
                  {po.vehicle_number || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">
                  LR / Tracking Number
                </span>
                <span className="font-mono font-bold text-zinc-900 mt-0.5 block">
                  {po.lr_tracking_number || 'N/A'}
                </span>
              </div>
              {po.delivery_remarks && (
                <div className="sm:col-span-3 pt-2 border-t border-zinc-100">
                  <span className="text-[10px] font-black uppercase text-zinc-400 block">
                    Delivery Instructions / Remarks
                  </span>
                  <p className="text-zinc-700 mt-0.5">{po.delivery_remarks}</p>
                </div>
              )}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs font-mono">
            <div>
              <span className="text-zinc-500 font-bold block text-[10px] uppercase">
                PO Commercial Breakdown
              </span>
              <span className="text-zinc-700">
                Material: ₹{partCost.toLocaleString('en-IN')} | Freight: ₹{freight.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="text-right">
              <span className="text-zinc-500 font-bold block text-[10px] uppercase">
                Total Purchase Commitment
              </span>
              <span className="text-lg font-black text-zinc-950">
                ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex items-center justify-between shrink-0">
          <button
            onClick={() => onPrint(po)}
            className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-300 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Official PO</span>
          </button>

          <div className="flex items-center gap-3">
            {canInward && onOpenGRN && (
              <button
                onClick={() => {
                  onClose();
                  onOpenGRN(po);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Boxes className="w-4 h-4" />
                <span>Inward Goods (GRN)</span>
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
