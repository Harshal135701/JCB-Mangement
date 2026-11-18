import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import { InspectionTemplate } from '../PreShiftInspectionPage';
import { TemplateDetailModal } from './TemplateDetailModal';
import { TemplateEditModal } from './TemplateEditModal';
import { 
  Layers, 
  Eye, 
  RefreshCw, 
  Search, 
  Plus,
  Edit3,
  Power,
  Loader2, 
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface AdminChecklistRulesViewProps {
  isManager?: boolean;
}

export const AdminChecklistRulesView: React.FC<AdminChecklistRulesViewProps> = ({
  isManager: propIsManager,
}) => {
  const { user } = useAuth();
  const canManage = propIsManager !== undefined ? propIsManager : user?.role === 'manager';

  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering & Pagination
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Detail Modal
  const [selectedTemplate, setSelectedTemplate] = useState<InspectionTemplate | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Edit / Create Modal (Manager Only)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InspectionTemplate | null>(null);

  // Status toggle loading tracking
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.append('page', String(pagination.page));
      params.append('limit', String(pagination.limit));
      if (categoryFilter !== 'all') {
        params.append('machine_category', categoryFilter);
      }
      if (statusFilter !== 'all') {
        params.append('is_active', statusFilter === 'active' ? 'true' : 'false');
      }

      const res = await apiClient.get(`/inspections/templates?${params.toString()}`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setTemplates(res.data.data);
        if (res.data.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: res.data.pagination.total,
            totalPages: res.data.pagination.totalPages || 1,
          }));
        }
      } else {
        setTemplates([]);
      }
    } catch (err: any) {
      console.error('Failed to load inspection templates:', err);
      setError(err.response?.data?.message || 'Failed to retrieve configured inspection templates.');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Client-side search within the returned page
  const filteredTemplates = templates.filter((tpl) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      tpl.title.toLowerCase().includes(q) ||
      tpl.machine_category.toLowerCase().includes(q)
    );
  });

  const handleOpenDetail = (template: InspectionTemplate) => {
    setSelectedTemplate(template);
    setIsDetailOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (template: InspectionTemplate) => {
    setEditingTemplate(template);
    setIsEditModalOpen(true);
  };

  const handleToggleStatus = async (template: InspectionTemplate) => {
    const nextStatus = template.is_active === false ? true : false;
    const confirmMsg = nextStatus
      ? `Activate inspection template '${template.title}'? It will immediately become available to machine operators.`
      : `Deactivate inspection template '${template.title}'? Machine operators will not be able to execute it until reactivated.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setTogglingId(template.id);
      const res = await apiClient.patch(`/inspections/templates/${template.id}/status`, {
        is_active: nextStatus,
        expected_version: template.version || 1,
      });

      if (res.data?.success) {
        // Update local template state immediately for responsive UX
        setTemplates((prev) =>
          prev.map((t) => (t.id === template.id ? { ...t, is_active: nextStatus } : t))
        );
      }
    } catch (err: any) {
      console.error('Failed to toggle template status:', err);
      const msg = err.response?.data?.message || 'Failed to update template status.';
      alert(msg);
      fetchTemplates();
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
              Configured Daily AM Checklist Rules & Templates
            </h3>
            <span className="text-[10px] bg-slate-100 text-zinc-600 px-2 py-0.5 rounded font-bold font-mono">
              {pagination.total} Rules Configured
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchTemplates}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-zinc-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh templates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {canManage && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-4 py-1.5 bg-jcb-yellow hover:bg-amber-400 text-zinc-950 font-black rounded-xl text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4 text-zinc-950" />
                <span>+ Create Checklist Rule</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search checklist title or category..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-zinc-400"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-zinc-500 uppercase">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-zinc-800"
            >
              <option value="all">All Categories</option>
              <option value="HMC">HMC</option>
              <option value="VMC">VMC</option>
              <option value="CNC Turning">CNC Turning</option>
              <option value="Welding Robot">Welding Robot</option>
              <option value="Press">Press</option>
              <option value="Laser">Laser</option>
              <option value="Paint Booth">Paint Booth</option>
              <option value="Assembly Line">Assembly Line</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-zinc-500 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-zinc-800"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rules Table / Cards */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin text-jcb-yellow" />
            <span className="text-xs font-bold">Querying checklist rules database...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-xs font-bold text-red-700">{error}</p>
            <button
              type="button"
              onClick={fetchTemplates}
              className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
            >
              Retry
            </button>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Layers className="w-8 h-8 text-zinc-300 mx-auto" />
            <p className="text-xs font-bold text-zinc-600">No checklist rules found matching current criteria.</p>
            {(categoryFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-amber-600 hover:underline"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-black text-zinc-400 uppercase tracking-wider bg-slate-50">
                  <th className="py-3 px-4">Checklist Title</th>
                  <th className="py-3 px-4">Machine Category</th>
                  <th className="py-3 px-4 text-center">Questions</th>
                  <th className="py-3 px-4 text-center">Version</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {filteredTemplates.map((template) => (
                  <tr key={template.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-semibold text-zinc-900">
                      <div className="font-bold text-zinc-950">{template.title}</div>
                      <div className="text-[10px] font-mono text-zinc-400 truncate max-w-[260px]">
                        ID: {template.id}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-mono font-bold text-[11px]">
                        {template.machine_category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-zinc-700 font-mono font-bold text-[11px]">
                        {template.checklist?.length || 0} checks
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono font-bold text-zinc-600">
                        v{template.version || 1}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          template.is_active !== false
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                        }`}
                      >
                        {template.is_active !== false ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-zinc-400" />
                            <span>Inactive</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500 font-mono text-[11px]">
                      {(template as any).updated_at
                        ? new Date((template as any).updated_at).toLocaleDateString()
                        : (template as any).created_at
                        ? new Date((template as any).created_at).toLocaleDateString()
                        : 'Standard'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Details (Available to both Admin and Manager) */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(template)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-zinc-950 hover:text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5"
                          title="View specification"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-500" />
                          <span>View</span>
                        </button>

                        {/* Manager-only Actions: Edit & Status Toggle */}
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(template)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 text-zinc-700"
                              title="Edit checklist questions"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-zinc-500" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              disabled={togglingId === template.id}
                              onClick={() => handleToggleStatus(template)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 disabled:opacity-50 ${
                                template.is_active !== false
                                  ? 'bg-slate-100 hover:bg-red-50 text-zinc-700 hover:text-red-700'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                              }`}
                              title={template.is_active !== false ? 'Deactivate rule' : 'Activate rule'}
                            >
                              {togglingId === template.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Power className="w-3.5 h-3.5" />
                              )}
                              <span>{template.is_active !== false ? 'Deactivate' : 'Activate'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="p-4 flex items-center justify-between text-xs text-zinc-500 border-t border-slate-100 bg-slate-50">
              <span>
                Showing {filteredTemplates.length} of {pagination.total} checklist rules
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                  }
                  className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="font-mono font-bold text-zinc-700">
                  Page {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Read-Only Template Detail Modal */}
      <TemplateDetailModal
        template={selectedTemplate}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTemplate(null);
        }}
      />

      {/* Manager Create / Edit Modal */}
      {canManage && (
        <TemplateEditModal
          template={editingTemplate}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTemplate(null);
          }}
          onSaveSuccess={fetchTemplates}
        />
      )}
    </div>
  );
};
