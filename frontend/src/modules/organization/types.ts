export interface PlantHierarchyNode {
  id: string;
  plant_code: string;
  plant_name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;
  plant_manager?: string | null;
  contact_number?: string | null;
  email?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShopHierarchyNode {
  id: string;
  plant_id: string;
  shop_code: string;
  shop_name: string;
  description?: string | null;
  manager_user_id?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface BayHierarchyNode {
  id: string;
  bay_name: string;
  shop_id: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LineHierarchyNode {
  id: string;
  line_name: string;
  shop_id: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RawHierarchyData {
  plants: PlantHierarchyNode[];
  shops: ShopHierarchyNode[];
  bays?: BayHierarchyNode[];
  lines?: LineHierarchyNode[];
}

export interface OrgMachineInfo {
  id: string;
  machine_code: string;
  name: string;
  plant_id?: string | null;
  shop_id?: string | null;
  status?: string;
  criticality?: string;
  category?: string;
}
