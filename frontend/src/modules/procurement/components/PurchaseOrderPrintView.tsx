import React from 'react';
import { X, Printer, Building2, Package, ShieldCheck } from 'lucide-react';
import { PurchaseOrderItem } from '../types';

interface PurchaseOrderPrintViewProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrderItem | null;
}

export const PurchaseOrderPrintView: React.FC<PurchaseOrderPrintViewProps> = ({
  isOpen,
  onClose,
  po,
}) => {
  if (!isOpen || !po) return null;

  const handlePrint = () => {
    window.print();
  };

  const qty = Number(po.quantity_required || 0);
  const unitPrice = Number(po.unit_price || 0);
  const partCost = Number(po.total_order_cost || po.total_order_value || qty * unitPrice);
  const freight = Number(po.freight_cost || 0);
  const totalAmount = Number(po.overall_shipment_cost || partCost + freight);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      {/* Container - on print this fills the printed page cleanly */}
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden flex flex-col my-auto max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:w-full print:m-0 print:p-0">
        {/* Top Control Bar (Hidden during print) */}
        <div className="bg-white p-4 flex items-center justify-between border-b border-zinc-200 shrink-0 print:hidden">
          <div className="flex items-center gap-2 text-zinc-950">
            <Printer className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-black uppercase tracking-wider">
              Purchase Order Document Preview
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-sm border border-amber-500 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Purchase Order</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-800 rounded-xl hover:bg-zinc-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Purchase Order Body */}
        <div className="p-8 overflow-y-auto bg-white font-sans text-zinc-900 print:p-0 print:overflow-visible">
          {/* Header */}
          <div className="border-b-2 border-zinc-900 pb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="bg-jcb-yellow text-black font-black text-2xl px-3 py-1 rounded-lg border-2 border-amber-600 inline-block">
                    JCB
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-zinc-950 uppercase">
                      JCB Smart CMMS
                    </h1>
                    <p className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
                      Machine Maintenance Management System
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-zinc-600 space-y-0.5">
                  <p className="font-bold text-zinc-800">
                    {po.plant_name || 'JCB India Ltd - Ballabgarh Works'}
                  </p>
                  <p>Central Spare Parts Procurement &amp; Inventory Stores</p>
                  <p>Plot 23, Mathura Road, Ballabgarh, Haryana - 121004</p>
                  <p className="font-mono text-[11px]">GSTIN: 06AAACJ1234M1Z5</p>
                </div>
              </div>

              <div className="text-right">
                <span className="px-3 py-1 bg-zinc-900 text-jcb-yellow rounded text-xs font-black uppercase tracking-wider inline-block">
                  Official Purchase Order
                </span>
                <div className="mt-2 space-y-1 text-xs">
                  <div>
                    <span className="text-zinc-500 font-semibold">PO Number: </span>
                    <span className="font-mono font-black text-sm text-zinc-950">
                      {po.po_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-semibold">Date Issued: </span>
                    <span className="font-mono font-bold text-zinc-800">
                      {new Date(po.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-semibold">PR Reference: </span>
                    <span className="font-mono font-bold text-zinc-800">{po.pr_number}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-semibold">Order Status: </span>
                    <span className="font-bold uppercase text-zinc-900">
                      {po.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Vendor & Delivery Plant Box */}
          <div className="grid grid-cols-2 gap-6 my-6 text-xs">
            {/* Vendor Details */}
            <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/50 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block mb-1">
                Vendor / Supplier (Consignor)
              </span>
              <p className="font-black text-sm text-zinc-950">{po.supplier_name}</p>
              <p className="text-zinc-600">JCB Certified Procurement Vendor</p>
              <p className="text-zinc-600">Dispatch Location: {po.dispatch_location || 'Pune / Faridabad Depot'}</p>
              <p className="font-mono text-zinc-700">Payment Terms: Net 30 Days</p>
            </div>

            {/* Delivery / Shipping Address */}
            <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/50 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block mb-1">
                Ship To / Delivery Plant (Consignee)
              </span>
              <p className="font-black text-sm text-zinc-950">
                {po.destination_plant_name || po.plant_name || 'JCB Ballabgarh Works'}
              </p>
              <p className="text-zinc-600">
                Shop / Bay: {po.shop_name || 'Main Fabrication & Assembly Bay'}
              </p>
              <p className="text-zinc-600">
                Delivery Target: {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'As Scheduled'}
              </p>
              <p className="text-zinc-700 font-semibold">
                Designated Bin: <span className="font-mono">{po.bin_location || 'STORE-RECEIVING-BAY'}</span>
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-zinc-300 rounded-xl overflow-hidden mb-6 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="bg-zinc-100 border-b border-zinc-300 font-black text-zinc-800 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5 text-center w-12">#</th>
                  <th className="px-4 py-2.5">Part Number &amp; SKU</th>
                  <th className="px-4 py-2.5">Item Description</th>
                  <th className="px-4 py-2.5 text-center">Qty Ordered</th>
                  <th className="px-4 py-2.5 text-center">UOM</th>
                  <th className="px-4 py-2.5 text-right">Unit Price (₹)</th>
                  <th className="px-4 py-2.5 text-right">Total Price (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                <tr>
                  <td className="px-4 py-3 text-center font-mono font-bold">1</td>
                  <td className="px-4 py-3 font-mono">
                    <span className="font-black text-zinc-950">{po.part_number}</span>
                    {po.sku && <div className="text-[10px] text-zinc-500">SKU: {po.sku}</div>}
                  </td>
                  <td className="px-4 py-3 font-bold text-zinc-900">
                    {po.part_name}
                    {po.machine_code && (
                      <div className="text-[10px] font-mono text-zinc-500 font-normal">
                        Machine Target: {po.machine_code}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-black text-sm">
                    {po.quantity_required}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-zinc-700">
                    {po.uom || 'Nos'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                    ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-black text-zinc-950 text-sm">
                    ₹{partCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Commercial & Freight Totals */}
          <div className="flex justify-between items-start gap-6 border-b border-zinc-200 pb-6 mb-6 text-xs">
            <div className="flex-1 space-y-1.5 text-zinc-600">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">
                Logistics &amp; Dispatch Reference
              </span>
              <p>
                Transporter / Carrier: <span className="font-bold text-zinc-900">{po.transporter_name || 'Standard Freight Carrier'}</span>
              </p>
              {po.vehicle_number && (
                <p>
                  Vehicle Registration: <span className="font-mono font-bold text-zinc-900">{po.vehicle_number}</span>
                </p>
              )}
              {po.lr_tracking_number && (
                <p>
                  LR / Docket Ref: <span className="font-mono font-bold text-zinc-900">{po.lr_tracking_number}</span>
                </p>
              )}
              {po.vendor_challan_number && (
                <p>
                  Challan No: <span className="font-mono font-bold text-zinc-900">{po.vendor_challan_number}</span>
                </p>
              )}
            </div>

            <div className="w-72 space-y-2 font-mono">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal (Excl. Tax):</span>
                <span>₹{partCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Freight &amp; Handling:</span>
                <span>₹{freight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-base font-black text-zinc-950 pt-2 border-t-2 border-zinc-900">
                <span>Total PO Value:</span>
                <span>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="text-[10px] text-zinc-500 space-y-1 mb-8">
            <p className="font-black text-zinc-700 uppercase">Terms &amp; Conditions:</p>
            <p>1. Goods received are subject to physical inspection &amp; QC verification at JCB Gate Stores before acceptance.</p>
            <p>2. Please quote Purchase Order ({po.po_number}) and Requisition ({po.pr_number}) on all Challans and Invoices.</p>
            <p>3. Delivery must strictly meet the committed arrival date to avoid standard supply penalty.</p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-zinc-200 text-center text-xs">
            <div>
              <div className="h-12 border-b border-zinc-400 mb-2"></div>
              <p className="font-bold text-zinc-900">{po.requested_by_name || 'Requester'}</p>
              <p className="text-[10px] text-zinc-500 uppercase">Requisitioned By</p>
            </div>
            <div>
              <div className="h-12 border-b border-zinc-400 mb-2"></div>
              <p className="font-bold text-zinc-900">{po.approved_by_name || 'Plant Manager'}</p>
              <p className="text-[10px] text-zinc-500 uppercase">Authorized Approver</p>
            </div>
            <div>
              <div className="h-12 border-b border-zinc-400 mb-2"></div>
              <p className="font-bold text-zinc-900">Store / Receiving Officer</p>
              <p className="text-[10px] text-zinc-500 uppercase">JCB Ballabgarh Works</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
