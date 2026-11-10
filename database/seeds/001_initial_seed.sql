-- =====================================================================
-- JCB SMART CMMS SEED DATA (ALIGNED WITH ENTERPRISE 5-ROLE ARCHITECTURE)
-- Core Roles: Admin, Manager, Store Manager, Operator, Technician
-- =====================================================================

-- 1. Plants
INSERT INTO plants (id, plant_code, plant_name, address, state, city, pin_code, plant_manager, contact_number, email)
VALUES 
  ('b0000000-0000-0000-0000-000000000001', 'PLANT-BALLABGARH', 'JCB Ballabgarh Works', '23/7 Mathura Road', 'Haryana', 'Ballabgarh', '121004', 'Rajesh Sharma', '+91-129-4299000', 'rajesh.sharma@jcb.com'),
  ('b0000000-0000-0000-0000-000000000002', 'PLANT-PUNE', 'JCB Pune Manufacturing Plant', 'Talegaon Industrial Area', 'Maharashtra', 'Pune', '410507', 'Amit Deshmukh', '+91-211-4668000', 'amit.deshmukh@jcb.com'),
  ('b0000000-0000-0000-0000-000000000003', 'PLANT-JAIPUR', 'JCB Jaipur Works', 'Mahindra World City', 'Rajasthan', 'Jaipur', '302037', 'Vikram Rathore', '+91-141-7100000', 'vikram.rathore@jcb.com')
ON CONFLICT (plant_code) DO NOTHING;

-- 2. Shops
INSERT INTO shops (id, plant_id, shop_code, shop_name, description)
VALUES 
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'SHOP-CNC', 'CNC Machining Shop', '100 precision milling & turning machining centers'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'SHOP-ROB', 'Robotic Welding Shop', '200 automated robotic welding arms'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'SHOP-CUT', 'Cutting & Blanking Shop', '300 laser & hydraulic cutting presses')
ON CONFLICT (shop_code) DO NOTHING;

-- 3. Users (Core Roles including Store Manager)
INSERT INTO users (id, employee_code, full_name, email, phone, role, plant_id, shop_id, department, designation, shift, skills_json, password_hash)
VALUES 
  ('f0000000-0000-0000-0000-000000000001', 'EMP-ADM-001', 'Rajesh Admin', 'admin@jcb.com', '+91-9811000001', 'admin', 'b0000000-0000-0000-0000-000000000001', NULL, 'IT & Systems', 'Enterprise Administrator', 'General', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e'),
  ('f0000000-0000-0000-0000-000000000002', 'EMP-MGR-001', 'Vikas Verma', 'manager@jcb.com', '+91-9811000002', 'manager', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Maintenance', 'Maintenance In-Charge', 'Shift A', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e'),
  ('f0000000-0000-0000-0000-000000000003', 'EMP-TCH-001', 'Sunil Yadav', 'technician@jcb.com', '+91-9811000003', 'technician', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Electrical Maintenance', 'Senior Maintenance Tech', 'Shift A', '["Electrical", "PLC", "Hydraulic"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e'),
  ('f0000000-0000-0000-0000-000000000004', 'EMP-OPR-001', 'Ramesh Chandra', 'operator@jcb.com', '+91-9811000004', 'operator', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Production Operations', 'CNC Machine Operator', 'Shift A', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e'),
  ('f0000000-0000-0000-0000-000000000005', 'EMP-STM-001', 'Ramesh Gupta', 'store@jcb.com', '+91-9811000005', 'store_manager', 'b0000000-0000-0000-0000-000000000001', NULL, 'Central Stores & Inventory', 'Store Manager', 'General', '["Inventory Control", "Material Handling", "Procurement"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e')
ON CONFLICT (employee_code) DO NOTHING;

-- 4. Machines
INSERT INTO machines (
  id, shop_id, machine_code, name, category, oem_manufacturer, model_number, serial_number, 
  bay_line_location, criticality, status, operating_hours, qr_code_uid, description
)
VALUES 
  (
    '10000000-0000-0000-0000-000000000001', 
    'c0000000-0000-0000-0000-000000000001', 
    'CNC-001', 
    'Mazak Horizontal Machining Center 1', 
    'HMC', 
    'Mazak', 
    'HCN-6800 NEO', 
    'MZK-2023-8991', 
    'Bay 1 / Line 4', 
    'class_a', 
    'running', 
    4320.50, 
    'QR-JCB-CNC-001-UID', 
    'Critical bottleneck machining center for heavy JCB backhoe loader transmission casings'
  ),
  (
    '10000000-0000-0000-0000-000000000002', 
    'c0000000-0000-0000-0000-000000000002', 
    'ROB-012', 
    'Fanuc 6-Axis Robotic Welding Station', 
    'Robotic Welder', 
    'Fanuc', 
    'ARC Mate 120iD', 
    'FNC-9912-3341', 
    'Bay 2 / Line ROB-1', 
    'class_a', 
    'running', 
    6140.00, 
    'QR-JCB-ROB-012-UID', 
    'Primary automated welding cell for excavator boom structural fabrication'
  ),
  (
    '10000000-0000-0000-0000-000000000003', 
    'c0000000-0000-0000-0000-000000000003', 
    'CUT-001', 
    'Schuler 1000T Hydraulic Forming Press', 
    'Press', 
    'Schuler', 
    'HP-1000-ECO', 
    'SCH-1000-091', 
    'Cutting Bay 3', 
    'class_b', 
    'running', 
    11200.00, 
    'QR-JCB-CUT-001-UID', 
    'Heavy hydraulic press for cab roof and bonnet deep-draw stamping'
  )
ON CONFLICT (machine_code) DO NOTHING;

-- 5. Spare Parts Catalog (Sample covering 160k structure)
INSERT INTO spare_parts (
  part_number, oem_part_number, name, description, category, subcategory, warehouse_zone, bin_location,
  current_physical_stock, reserved_stock, quarantined_stock, min_reorder_level, unit_cost
)
VALUES 
  ('HYD-10025', 'REX-4WRKE-25', 'Hydraulic Pump Filter Element', 'Bosch Rexroth high-pressure microglass filter element for CNC-001', 'Hydraulic', 'Filters', 'Main Store', 'A-01-05', 18, 3, 0, 10, 4850.00),
  ('BRG-70140', 'SKF-7014-CE', 'High Precision Angular Spindle Bearing', 'Super-precision ceramic hybrid bearing for Mazak 12,000 RPM spindle', 'Bearings', 'Spindles', 'Main Store', 'B-02-12', 8, 1, 0, 2, 76200.00),
  ('MTR-02200', 'FAN-A06B-0235', 'Fanuc AC Servo Motor 3.0kW', 'Joint 2 axis servo motor for robot welding arm', 'Electrical', 'Motors', 'Main Store', 'C-04-01', 4, 0, 0, 1, 142000.00),
  ('SEL-99100', 'PAR-HYD-SEAL', 'Hydraulic Cylinder Seal Kit 120mm', 'Polyurethane seal assembly for 1000T press ram', 'Seals', 'Hydraulic', 'Main Store', 'D-01-08', 25, 0, 0, 5, 8900.00)
ON CONFLICT (part_number) DO NOTHING;

-- 6. Standard Pre-Shift Inspection Templates
INSERT INTO inspection_templates (
  id, machine_category, title, checklist, is_active, created_at, updated_at
)
VALUES 
  (
    '50000000-0000-0000-0000-000000000001',
    'HMC',
    'HMC Daily Pre-Shift Machinery Inspection Checklist',
    '{
      "version": 1,
      "items": [
        { "id": "chk-1", "label": "Hydraulic System Pressure within 45 - 55 Bar", "type": "number", "unit": "Bar", "min": 45, "max": 55, "critical_min": 35, "critical_max": 70, "required": true, "is_critical": true },
        { "id": "chk-2", "label": "Chiller Unit Operating Temperature (18C - 24C)", "type": "number", "unit": "C", "min": 18, "max": 24, "critical_min": 15, "critical_max": 35, "required": true, "is_critical": false },
        { "id": "chk-3", "label": "Visual Check: No hydraulic fluid pooling or line leaks", "type": "boolean", "required": true, "is_critical": false },
        { "id": "chk-4", "label": "Emergency Stop & Safety Enclosure Interlock Operational", "type": "boolean", "required": true, "is_critical": true },
        { "id": "chk-5", "label": "Way Lube Automatic Lubrication Reservoir Full", "type": "boolean", "required": true, "is_critical": false }
      ],
      "sensor_thresholds": {
        "pressure": { "min": 45, "max": 55, "critical_min": 35, "critical_max": 70, "unit": "Bar", "required": true },
        "temperature": { "min": 18, "max": 24, "critical_min": 15, "critical_max": 35, "unit": "C", "required": true },
        "vibration": { "max": 2.5, "critical_max": 4.5, "unit": "mm/s", "required": false }
      }
    }'::jsonb,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    'Robotic Welder',
    'Robotic Welder Pre-Shift Safety & Sensor Inspection',
    '{
      "version": 1,
      "items": [
        { "id": "chk-rob-1", "label": "Safety Light Curtain & Area Interlock Active", "type": "boolean", "required": true, "is_critical": true },
        { "id": "chk-rob-2", "label": "Weld Shielding Gas Line Pressure (5 - 7 Bar)", "type": "number", "unit": "Bar", "min": 5, "max": 7, "critical_min": 4, "critical_max": 8, "required": true, "is_critical": true },
        { "id": "chk-rob-3", "label": "Torch Tip & Wire Feed Visual Inspection", "type": "boolean", "required": true, "is_critical": false },
        { "id": "chk-rob-4", "label": "Coolant Flow Rate & Radiator Temp Nominal", "type": "boolean", "required": true, "is_critical": false }
      ],
      "sensor_thresholds": {
        "pressure": { "min": 5, "max": 7, "critical_min": 4, "critical_max": 8, "unit": "Bar", "required": true },
        "temperature": { "min": 15, "max": 35, "critical_min": 10, "critical_max": 45, "unit": "C", "required": false },
        "vibration": { "max": 1.8, "critical_max": 3.0, "unit": "mm/s", "required": false }
      }
    }'::jsonb,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    'Press',
    'Hydraulic Forming Press Daily Pre-Shift Inspection',
    '{
      "version": 1,
      "items": [
        { "id": "chk-prs-1", "label": "Hydraulic Ram Main Pressure (150 - 220 Bar)", "type": "number", "unit": "Bar", "min": 150, "max": 220, "critical_min": 120, "critical_max": 260, "required": true, "is_critical": true },
        { "id": "chk-prs-2", "label": "Die Clamping Mechanism Locked & Interlocked", "type": "boolean", "required": true, "is_critical": true },
        { "id": "chk-prs-3", "label": "Hydraulic Sump Oil Temperature (25C - 45C)", "type": "number", "unit": "C", "min": 25, "max": 45, "critical_min": 20, "critical_max": 60, "required": true, "is_critical": false },
        { "id": "chk-prs-4", "label": "Emergency Stop Buttons Tested Across 4 Corners", "type": "boolean", "required": true, "is_critical": true }
      ],
      "sensor_thresholds": {
        "pressure": { "min": 150, "max": 220, "critical_min": 120, "critical_max": 260, "unit": "Bar", "required": true },
        "temperature": { "min": 25, "max": 45, "critical_min": 20, "critical_max": 60, "unit": "C", "required": true },
        "vibration": { "max": 3.5, "critical_max": 5.5, "unit": "mm/s", "required": false }
      }
    }'::jsonb,
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;
