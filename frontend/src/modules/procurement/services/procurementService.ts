import apiClient from '../../../api/client';
import {
  VendorRecord,
  VendorPerformance,
  CreateVendorInput,
  UpdateVendorInput,
  PurchaseOrderItem,
  PurchaseOrderFilterParams,
  PurchaseOrderPagination,
} from '../types';

export const procurementService = {
  // --------------------------------------------------------------------------
  // VENDORS
  // --------------------------------------------------------------------------
  async getVendors(search?: string): Promise<VendorPerformance[]> {
    const params = new URLSearchParams();
    if (search && search.trim()) {
      params.append('search', search.trim());
    }
    const res = await apiClient.get<{ success: boolean; data: VendorPerformance[] }>(
      `/procurement/vendors?${params.toString()}`
    );
    return res.data?.data || [];
  },

  async getVendorById(id: string): Promise<VendorRecord> {
    const res = await apiClient.get<{ success: boolean; data: VendorRecord }>(
      `/procurement/vendors/${id}`
    );
    return res.data?.data;
  },

  async createVendor(data: CreateVendorInput): Promise<{ success: boolean; message: string; data: VendorRecord }> {
    const res = await apiClient.post<{ success: boolean; message: string; data: VendorRecord }>(
      '/procurement/vendors',
      data
    );
    return res.data;
  },

  async updateVendor(
    id: string,
    data: UpdateVendorInput
  ): Promise<{ success: boolean; message: string; data: VendorRecord }> {
    const res = await apiClient.put<{ success: boolean; message: string; data: VendorRecord }>(
      `/procurement/vendors/${id}`,
      data
    );
    return res.data;
  },

  // --------------------------------------------------------------------------
  // PURCHASE ORDERS
  // --------------------------------------------------------------------------
  async getPurchaseOrders(params: PurchaseOrderFilterParams): Promise<{
    data: PurchaseOrderItem[];
    pagination: PurchaseOrderPagination;
  }> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.supplier_name) query.append('supplier_name', params.supplier_name);
    if (params.is_overdue) query.append('is_overdue', 'true');
    if (params.search && params.search.trim()) query.append('search', params.search.trim());

    const res = await apiClient.get<{
      success: boolean;
      data: PurchaseOrderItem[];
      pagination: PurchaseOrderPagination;
    }>(`/procurement/po?${query.toString()}`);

    return {
      data: res.data?.data || [],
      pagination: res.data?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 },
    };
  },

  async getPurchaseOrderDetails(id: string): Promise<PurchaseOrderItem> {
    const res = await apiClient.get<{ success: boolean; data: PurchaseOrderItem }>(
      `/procurement/po/${id}`
    );
    return res.data?.data;
  },

  // --------------------------------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------------------------------
  async getProcurementDashboard(): Promise<any> {
    const res = await apiClient.get<{ success: boolean; data: any }>('/procurement/dashboard');
    return res.data?.data;
  },
};
