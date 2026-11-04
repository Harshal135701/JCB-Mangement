import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Cpu, QrCode, FileText, Layers, AlertCircle } from 'lucide-react';

export const MachineMasterPage: React.FC = () => {
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/machines?limit=100');
        if (res.data.success) {
          setMachines(res.data.data);
        }
      } catch (e) {
        console.error('Failed to load machine master:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMachines();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">1,000+ MACHINE ASSET DIRECTORY</h2>
          <p className="text-xs text-slate-500 mt-0.5">Hierarchical multi-shop plant assets with digital QR codes and criticality classes</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Machine Code & UID</th>
                <th className="px-6 py-3.5">Asset Name</th>
                <th className="px-6 py-3.5">OEM / Manufacturer</th>
                <th className="px-6 py-3.5">Shop & Bay Location</th>
                <th className="px-6 py-3.5">Criticality</th>
                <th className="px-6 py-3.5">Run Hours</th>
                <th className="px-6 py-3.5 text-right">Physical QR UID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {machines.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-3.5">
                    <div className="font-extrabold text-sm text-slate-900">{m.machine_code}</div>
                    <div className="text-[10px] text-slate-400">SN: {m.serial_number}</div>
                  </td>
                  <td className="px-6 py-3.5 font-semibold text-slate-800">{m.name}</td>
                  <td className="px-6 py-3.5 text-slate-600">
                    <span className="font-medium text-slate-800">{m.oem_manufacturer}</span>
                    <span className="block text-[11px] text-slate-400">{m.model_number}</span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-slate-700">{m.shop_name}</div>
                    <div className="text-[11px] text-slate-400">{m.bay_line_location || 'Bay 1 / Line 4'}</div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                      m.criticality === 'class_a'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : m.criticality === 'class_b'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {m.criticality?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-bold text-slate-700">
                    {parseFloat(m.operating_hours || 0).toLocaleString()} hrs
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] text-slate-700">
                      <QrCode className="w-3.5 h-3.5 text-slate-500" />
                      {m.qr_code_uid}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

