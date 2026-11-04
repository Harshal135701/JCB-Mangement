import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Search, Package, MapPin, AlertTriangle, Layers } from 'lucide-react';

export const InventoryCatalogPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchParts = async (search = '') => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/inventory/search?query=${encodeURIComponent(search)}&limit=50`);
      if (res.data.success) {
        setParts(res.data.data);
        setTotalCount(res.data.pagination?.total || res.data.data.length);
      }
    } catch (e) {
      console.error('Failed to load parts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts('');
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchParts(query);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">160,000 SKU SPARE PARTS CATALOG</h2>
          <p className="text-xs text-slate-500 mt-0.5">PostgreSQL GIN Trigram indexed search with physical warehouse bin locator</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold">
            Sub-Store & Central Depot
          </span>
        </div>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              fetchParts(e.target.value);
            }}
            placeholder="Search by 7-digit JCB Part No (e.g. 332/Y2415), OEM Part, or Name..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-sm transition"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Parts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Part Details</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Warehouse Bin Location</th>
                <th className="px-6 py-3.5">Physical Stock</th>
                <th className="px-6 py-3.5">Reserved</th>
                <th className="px-6 py-3.5">Available</th>
                <th className="px-6 py-3.5 text-right">Unit Cost (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No spare parts matching your search query.
                  </td>
                </tr>
              ) : (
                parts.map((p) => {
                  const isLow = p.available_stock <= p.min_reorder_level;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-3.5">
                        <div className="font-extrabold text-slate-900">{p.part_number}</div>
                        <div className="font-medium text-slate-700">{p.name}</div>
                        {p.oem_part_number && (
                          <div className="text-[10px] text-slate-400">OEM: {p.oem_part_number}</div>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded text-[10px]">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                          <span>{p.warehouse_zone}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Rack {p.rack_number} • Shelf {p.shelf_number} • Bin {p.bin_number}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-slate-800">
                        {p.current_physical_stock}
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-amber-700">
                        {p.reserved_stock}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`font-black text-sm ${isLow ? 'text-red-600' : 'text-emerald-600'}`}>
                          {p.available_stock}
                        </span>
                        {isLow && (
                          <span className="block text-[10px] font-bold text-red-500 uppercase">
                            Reorder Trigger
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right font-extrabold text-slate-900">
                        ₹{parseFloat(p.unit_cost || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

