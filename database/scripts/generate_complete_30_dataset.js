const fs = require('fs');
const path = require('path');

const passHash = '$2a$10$5C1rOX7ZPCq5e3RjDFPxiOzRF6AIpkZIS0IuZqrF0LnqYwIJOCRgC'; // password123

let sql = `-- =====================================================================
-- JCB SMART CMMS: COMPREHENSIVE 30 MAHARASHTRIAN DATASET FOR ALL TABLES
-- Fully Populates EVERY Field in Every Table with Exact Schema Enums:
-- 1. Plants (Pune Talegaon Industrial Hub)
-- 2. Shops (5 Specialized Precision Manufacturing Bays)
-- 3. 30 Users (2 Admins, 4 Managers, 4 Store Managers, 10 Technicians, 10 Operators)
-- 4. 30 Machines (All 19+ Fields Fully Populated with Genuine OEM Specs)
-- 5. 30 Spare Parts (All 13 Fields: SKUs, Bin Locations, Stocks, Unit Costs)
-- 6. 30 Maharashtra MIDC Industrial Vendors (Chakan, Bhosari, Pimpri, Talegaon)
-- 7. 30 Breakdown Complaints / Maintenance Requests (Status: new, pending_review, work_order_created)
-- 8. 30 Work Orders (Status: completed, verified_closed, in_progress, assigned, waiting_for_parts, under_diagnosis)
-- 9. 30 Operator Pre-Shift Machine Inspection Records (Temp, Vibration, Pressure Sensor Readings)
-- 10. 30 PM Plans (Checklists, Thresholds, Frequencies, Next Due Dates)
-- 11. 30 Inventory & Spare Parts Transactions (STOCK_IN, ISSUE, RESERVATION)
-- 12. 30 Operator-Machine Active Shift Assignments & Sign-Ins
-- =====================================================================

DO $$
BEGIN

-- 1. Plants (JCB Pune Heavy Manufacturing Works)
INSERT INTO plants (id, plant_code, plant_name, address, state, city, pin_code, plant_manager, contact_number, email)
VALUES ('b0000000-0000-0000-0000-000000000002', 'PLANT-PUNE', 'JCB Pune Heavy Manufacturing Works', 'Plot A-1, Talegaon Industrial Area, Chakan-Talegaon Road', 'Maharashtra', 'Pune', '410507', 'Sachin D. Patil', '+91-211-4668000', 'sachin.patil@jcb.com')
ON CONFLICT (plant_code) DO UPDATE SET plant_name = EXCLUDED.plant_name;

-- 2. Pune Specialized Production Shops
`;

const shops = [
  { id: 'c0000000-0000-0000-0000-000000000011', code: 'PUN-SHP-HMC', name: 'Pune HMC & VMC Heavy Machining Shop', desc: 'Precision CNC machining for 3DX backhoe loader chassis, axles, and transmission housings' },
  { id: 'c0000000-0000-0000-0000-000000000012', code: 'PUN-SHP-ROB', name: 'Pune Robotic Welding & Arm Fabrication Shop', desc: 'Automated Fanuc 6-axis robotic welding cells for structural booms and excavator dippers' },
  { id: 'c0000000-0000-0000-0000-000000000013', code: 'PUN-SHP-PRS', name: 'Pune 1000T Hydraulic Stamping & Press Shop', desc: 'Heavy forming and blanking presses for excavator cabins, bonnets, and ROPS/FOPS canopies' },
  { id: 'c0000000-0000-0000-0000-000000000014', code: 'PUN-SHP-PNT', name: 'Pune Automated Electrostatic Powder Coating Line', desc: 'Automated 12-stage chemical pre-treatment and JCB Classic Yellow powder coating plant' },
  { id: 'c0000000-0000-0000-0000-000000000015', code: 'PUN-SHP-ASM', name: 'Pune Heavy Excavator & Backhoe Final Assembly', desc: 'Continuous moving takt-time assembly line, fluid filling, and hydraulic testing rigs' }
];

sql += `INSERT INTO shops (id, plant_id, shop_code, shop_name, description) VALUES
${shops.map(s => `  ('${s.id}', 'b0000000-0000-0000-0000-000000000002', '${s.code}', '${s.name}', '${s.desc}')`).join(',\n')}
ON CONFLICT (shop_code) DO NOTHING;

-- 3. 30 Maharashtrian Industrial Personnel (All 5 Roles)
`;

const users = [
  // 2 Admins
  { code: 'EMP-MAH-001', name: 'Sachin D. Patil', email: 'sachin.patil@jcb.com', phone: '+91-9822011001', role: 'admin', dept: 'Plant Systems & Governance', desig: 'Enterprise VP & Plant Head', shift: 'General', skills: '["Enterprise Governance", "Plant Operations", "Reliability Engineering"]' },
  { code: 'EMP-MAH-002', name: 'Aniket R. Deshmukh', email: 'aniket.deshmukh@jcb.com', phone: '+91-9822011002', role: 'admin', dept: 'IT & Digital Operations', desig: 'Principal Systems Architect', shift: 'General', skills: '["Cloud Infrastructure", "Industrial IoT", "Database Architecture"]' },
  // 4 Managers
  { code: 'EMP-MAH-003', name: 'Rohan S. Kulkarni', email: 'rohan.kulkarni@jcb.com', phone: '+91-9822011003', role: 'manager', dept: 'Mechanical Maintenance', desig: 'Plant Maintenance Manager', shift: 'General', skills: '["Mechanical Maintenance", "Total Productive Maintenance (TPM)", "Root Cause Analysis"]', shopIdx: 0 },
  { code: 'EMP-MAH-004', name: 'Swapnil M. Shinde', email: 'swapnil.shinde@jcb.com', phone: '+91-9822011004', role: 'manager', dept: 'Electrical & Automation', desig: 'Automation Engineering Lead', shift: 'General', skills: '["Robotics Automation", "PLC Architecture", "SCADA Systems"]', shopIdx: 1 },
  { code: 'EMP-MAH-005', name: 'Amol V. More', email: 'amol.more@jcb.com', phone: '+91-9822011005', role: 'manager', dept: 'Heavy Press & Tooling', desig: 'Tooling & Reliability Manager', shift: 'General', skills: '["Die Maintenance", "Heavy Hydraulics", "Forming Presses"]', shopIdx: 2 },
  { code: 'EMP-MAH-006', name: 'Prashant B. Chavan', email: 'prashant.chavan@jcb.com', phone: '+91-9822011006', role: 'manager', dept: 'Quality & Governance', desig: 'Operations & Reliability In-Charge', shift: 'General', skills: '["ISO 9001", "Six Sigma", "Asset Reliability Governance"]', shopIdx: 4 },
  // 4 Store Managers
  { code: 'EMP-MAH-007', name: 'Mahesh A. Gaikwad', email: 'mahesh.gaikwad@jcb.com', phone: '+91-9822011007', role: 'store_manager', dept: 'Central Stores & Logistics', desig: 'Chief Inventory Controller', shift: 'General', skills: '["Inventory Control", "SAP ERP", "Logistics Optimization", "ABC Analysis"]' },
  { code: 'EMP-MAH-008', name: 'Ganesh N. Jadhav', email: 'ganesh.jadhav@jcb.com', phone: '+91-9822011008', role: 'store_manager', dept: 'Spare Parts Warehouse', desig: 'Senior Materials Manager', shift: 'General', skills: '["Material Inwarding", "Bin Location Auditing", "Vendor Logistics"]' },
  { code: 'EMP-MAH-009', name: 'Santosh K. Bhosale', email: 'santosh.bhosale@jcb.com', phone: '+91-9822011009', role: 'store_manager', dept: 'Tool Crib & Consumables', desig: 'Tool Crib Supervisor', shift: 'General', skills: '["Tool Calibration", "Consumable Issuance", "RDC Scrap Reconciliation"]' },
  { code: 'EMP-MAH-010', name: 'Rahul T. Kadam', email: 'rahul.kadam@jcb.com', phone: '+91-9822011010', role: 'store_manager', dept: 'Inbound Logistics & Receiving', desig: 'Receiving Store Officer', shift: 'General', skills: '["PO Verification", "Goods Receipt Note (GRN)", "Quality Quarantine"]' },
  // 10 Technicians
  { code: 'EMP-MAH-011', name: 'Nitin G. Pawar', email: 'nitin.pawar@jcb.com', phone: '+91-9822011011', role: 'technician', dept: 'Mechanical Maintenance', desig: 'Senior Mechanical Technician', shift: 'Shift A', skills: '["Rexroth Hydraulics", "Precision Bearings", "Pneumatics"]', shopIdx: 0 },
  { code: 'EMP-MAH-012', name: 'Vishal B. Mane', email: 'vishal.mane@jcb.com', phone: '+91-9822011012', role: 'technician', dept: 'Electrical Maintenance', desig: 'PLC & Automation Specialist', shift: 'Shift A', skills: '["Siemens S7-1500", "Fanuc Robots", "Profinet Diagnostics"]', shopIdx: 1 },
  { code: 'EMP-MAH-013', name: 'Sandeep R. Thorat', email: 'sandeep.thorat@jcb.com', phone: '+91-9822011013', role: 'technician', dept: 'Hydraulics & Tooling', desig: 'Lead Hydraulics Tech', shift: 'Shift A', skills: '["Proportional Valves", "Hydraulic Power Packs", "Manifold Blocks"]', shopIdx: 2 },
  { code: 'EMP-MAH-014', name: 'Dattatray P. Khot', email: 'dattatray.khot@jcb.com', phone: '+91-9822011014', role: 'technician', dept: 'Robotic Welding Bay', desig: 'Robotics Field Technician', shift: 'Shift B', skills: '["Fanuc ARC Mate", "Fronius MIG Torches", "Weld Seam Tracking"]', shopIdx: 1 },
  { code: 'EMP-MAH-015', name: 'Mangesh D. Salunkhe', email: 'mangesh.salunkhe@jcb.com', phone: '+91-9822011015', role: 'technician', dept: 'CNC Machining Maintenance', desig: 'Spindle & Tool Changer Tech', shift: 'Shift B', skills: '["Mazak High-Speed Spindles", "THK Ball Screws", "Laser Alignment"]', shopIdx: 0 },
  { code: 'EMP-MAH-016', name: 'Pravin V. Sawant', email: 'pravin.sawant@jcb.com', phone: '+91-9822011016', role: 'technician', dept: 'Press & Stamping Bay', desig: 'Heavy Press Mechanical Tech', shift: 'Shift B', skills: '["1000T Ram Seals", "Cushion Cylinder Maintenance", "Oil Filtration"]', shopIdx: 2 },
  { code: 'EMP-MAH-017', name: 'Ajinkya C. Surve', email: 'ajinkya.surve@jcb.com', phone: '+91-9822011017', role: 'technician', dept: 'Powder Coating & Utilities', desig: 'Plant Utilities Technician', shift: 'Shift C', skills: '["Screw Compressors", "Industrial Chillers", "Burner Heating Systems"]', shopIdx: 3 },
  { code: 'EMP-MAH-018', name: 'Yogesh S. Kamble', email: 'yogesh.kamble@jcb.com', phone: '+91-9822011018', role: 'technician', dept: 'Electrical & Instrumentation', desig: 'Drives & VFD Tech', shift: 'Shift C', skills: '["ABB VFD Drives", "Servo Tunings", "Control Panel Thermal Scans"]', shopIdx: 0 },
  { code: 'EMP-MAH-019', name: 'Akash N. Tambade', email: 'akash.tambade@jcb.com', phone: '+91-9822011019', role: 'technician', dept: 'Preventive Maintenance Group', desig: 'Condition Monitoring Specialist', shift: 'General', skills: '["Fluke Vibration Analysis", "FLIR Thermal Imaging", "Oil Spectrometry"]', shopIdx: 4 },
  { code: 'EMP-MAH-020', name: 'Siddhesh R. Gawade', email: 'siddhesh.gawade@jcb.com', phone: '+91-9822011020', role: 'technician', dept: 'Mechanical Fast Response Team', desig: 'Emergency Breakdown Specialist', shift: 'Shift A', skills: '["Fast Breakdown Triage", "Emergency Alignment", "Pin-Bushing Extraction"]', shopIdx: 1 },
  // 10 Operators
  { code: 'EMP-MAH-021', name: 'Tushar H. Shingade', email: 'tushar.shingade@jcb.com', phone: '+91-9822011021', role: 'operator', dept: 'CNC Machining', desig: 'Senior HMC Machine Operator', shift: 'Shift A', skills: '["Mazak SmoothX CNC", "Part Probing", "Fixture Setup"]', shopIdx: 0 },
  { code: 'EMP-MAH-022', name: 'Onkar S. Navale', email: 'onkar.navale@jcb.com', phone: '+91-9822011022', role: 'operator', dept: 'Robotic Welding', desig: 'Automated Cell Operator', shift: 'Shift A', skills: '["Teach Pendant Navigation", "Fixture Clamping", "Weld Inspection"]', shopIdx: 1 },
  { code: 'EMP-MAH-023', name: 'Vijay K. Lokhande', email: 'vijay.lokhande@jcb.com', phone: '+91-9822011023', role: 'operator', dept: 'Heavy Press Bay', desig: 'Schuler 1000T Press Operator', shift: 'Shift A', skills: '["Die Changeover", "Tonnage Monitoring", "Sheet Alignment"]', shopIdx: 2 },
  { code: 'EMP-MAH-024', name: 'Pradeep B. Wagh', email: 'pradeep.wagh@jcb.com', phone: '+91-9822011024', role: 'operator', dept: 'Laser & Plasma Cutting', desig: 'Trumpf Laser Cutting Operator', shift: 'Shift A', skills: '["Sheet Nesting", "Nozzle Centering", "Fiber Laser Safety"]', shopIdx: 2 },
  { code: 'EMP-MAH-025', name: 'Suraj M. Khilare', email: 'suraj.khilare@jcb.com', phone: '+91-9822011025', role: 'operator', dept: 'Chassis Fabrication', desig: 'Excavator Frame Operator', shift: 'Shift B', skills: '["Heavy Rigging", "Tack Welding", "Dimension Verification"]', shopIdx: 1 },
  { code: 'EMP-MAH-026', name: 'Kiran R. Ghadge', email: 'kiran.ghadge@jcb.com', phone: '+91-9822011026', role: 'operator', dept: 'Powder Coating Bay', desig: 'Electrostatic Line Operator', shift: 'Shift B', skills: '["Powder Flow Metering", "Bake Oven Profiles", "DFT Thickness Gauge"]', shopIdx: 3 },
  { code: 'EMP-MAH-027', name: 'Deepak N. Choudhary', email: 'deepak.choudhary@jcb.com', phone: '+91-9822011027', role: 'operator', dept: 'Transmission Assembly', desig: 'Gearbox Line Operator', shift: 'Shift B', skills: '["Torque Angle Guns", "Backlash Measurement", "Cleanroom Assembly"]', shopIdx: 0 },
  { code: 'EMP-MAH-028', name: 'Chetan P. Kore', email: 'chetan.kore@jcb.com', phone: '+91-9822011028', role: 'operator', dept: 'Boom Assembly', desig: 'Boom & Dipper Fitter Operator', shift: 'Shift C', skills: '["Hydraulic Cylinder Mounting", "Hose Routing", "Pin Torquing"]', shopIdx: 4 },
  { code: 'EMP-MAH-029', name: 'Nilesh A. Dhale', email: 'nilesh.dhale@jcb.com', phone: '+91-9822011029', role: 'operator', dept: 'Cabin & Trim Fitment', desig: 'ROPS/FOPS Cabin Line Operator', shift: 'Shift C', skills: '["Harness Routing", "Glass Glazing", "Console Ergonomics Testing"]', shopIdx: 4 },
  { code: 'EMP-MAH-030', name: 'Harsh V. Zagade', email: 'harsh.zagade@jcb.com', phone: '+91-9822011030', role: 'operator', dept: 'Final Inspection & Road Track', desig: 'Machine Test Track Operator', shift: 'General', skills: '["Hydraulic Stall Testing", "Brake Dynamometer", "Pre-Delivery Checklist"]', shopIdx: 4 }
];

const userIds = users.map((u, i) => {
  const hex = (i + 1).toString(16).padStart(12, '0');
  return 'f0000000-0000-0000-0000-' + hex;
});

sql += `INSERT INTO users (id, employee_code, full_name, email, phone, role, plant_id, shop_id, department, designation, shift, skills_json, password_hash, is_active, approval_status) VALUES
${users.map((u, i) => {
  const uid = userIds[i];
  const shopRef = u.shopIdx !== undefined ? `'${shops[u.shopIdx].id}'` : 'NULL';
  return `  ('${uid}', '${u.code}', '${u.name}', '${u.email}', '${u.phone}', '${u.role}', 'b0000000-0000-0000-0000-000000000002', ${shopRef}, '${u.dept}', '${u.desig}', '${u.shift}', '${u.skills}'::jsonb, '${passHash}', TRUE, 'approved')`;
}).join(',\n')}
ON CONFLICT (email) DO UPDATE SET 
  full_name = EXCLUDED.full_name,
  is_active = TRUE,
  approval_status = 'approved',
  password_hash = EXCLUDED.password_hash;

-- 4. 30 Industrial Machines (ALL 19+ Fields Fully Populated with Genuine OEM Specs)
`;

const machineDetails = [
  { code: 'PUN-HMC-001', name: 'Mazak Horizontal Machining Center HCN-6800 NEO #1', cat: 'HMC', mfr: 'Yamazaki Mazak Corp', model: 'HCN-6800 NEO', serial: 'MZK-PUN-2026-001', bay: 'Bay 1 / Line CNC-1', crit: 'class_a', status: 'running', hours: 4850.50, freq: 30, desc: 'High-speed twin-pallet 4-axis HMC machining JCB 3DX transmission housings.' },
  { code: 'PUN-HMC-002', name: 'Mazak Horizontal Machining Center HCN-6800 NEO #2', cat: 'HMC', mfr: 'Yamazaki Mazak Corp', model: 'HCN-6800 NEO', serial: 'MZK-PUN-2026-002', bay: 'Bay 1 / Line CNC-2', crit: 'class_a', status: 'running', hours: 5120.25, freq: 30, desc: 'Twin pallet HMC for heavy steel axle carrier precision boring.' },
  { code: 'PUN-VMC-001', name: 'Makino Vertical Machining Center V99 Heavy Milling', cat: 'VMC', mfr: 'Makino Milling Machine Co', model: 'V99-5AX', serial: 'MAK-PUN-2026-003', bay: 'Bay 1 / Line VMC-1', crit: 'class_b', status: 'running', hours: 3200.00, freq: 45, desc: 'Heavy 50-taper vertical milling center for kingpin and steering knuckle brackets.' },
  { code: 'PUN-VMC-002', name: 'Doosan DNM 6700 High Productivity VMC', cat: 'VMC', mfr: 'DN Solutions (Doosan)', model: 'DNM 6700', serial: 'DOO-PUN-2026-004', bay: 'Bay 1 / Line VMC-2', crit: 'class_b', status: 'under_maintenance', hours: 6410.75, freq: 30, desc: 'Precision vertical milling center for hydraulic valve manifold blocks.' },
  { code: 'PUN-CNC-001', name: 'Okuma Multus U4000 Intelligent CNC Turning Center', cat: 'CNC Lathe', mfr: 'Okuma Corporation', model: 'Multus U4000', serial: 'OKU-PUN-2026-005', bay: 'Bay 1 / Line LAT-1', crit: 'class_a', status: 'running', hours: 2890.10, freq: 30, desc: 'Multi-tasking turn-mill center for excavator track drive shafts and pins.' },
  { code: 'PUN-ROB-001', name: 'Fanuc ARC Mate 120iD 6-Axis Boom Welding Robot #1', cat: 'Robotic Welder', mfr: 'Fanuc Robotics Japan', model: 'ARC Mate 120iD/35', serial: 'FNC-PUN-2026-006', bay: 'Bay 2 / Cell ROB-1', crit: 'class_a', status: 'running', hours: 7850.30, freq: 15, desc: 'Automated tandem welding robot with Fronius power source for backhoe boom fabrication.' },
  { code: 'PUN-ROB-002', name: 'Fanuc ARC Mate 120iD 6-Axis Dipper Welding Robot #2', cat: 'Robotic Welder', mfr: 'Fanuc Robotics Japan', model: 'ARC Mate 120iD/35', serial: 'FNC-PUN-2026-007', bay: 'Bay 2 / Cell ROB-2', crit: 'class_a', status: 'breakdown', hours: 7420.00, freq: 15, desc: 'Structural welding cell for heavy dipper and bucket pivot brackets.' },
  { code: 'PUN-ROB-003', name: 'ABB IRB 6700 Heavy Spot & Seam Welding Robot', cat: 'Robotic Welder', mfr: 'ABB Robotics Sweden', model: 'IRB 6700-200/2.60', serial: 'ABB-PUN-2026-008', bay: 'Bay 2 / Cell ROB-3', crit: 'class_b', status: 'running', hours: 4190.80, freq: 30, desc: 'Chassis main body robotic seam welder for 4-wheel drive loaders.' },
  { code: 'PUN-ROB-004', name: 'KUKA KR 300 R2500 Heavy Frame Welding Cell', cat: 'Robotic Welder', mfr: 'KUKA AG Germany', model: 'KR 300 R2500 ultra', serial: 'KUK-PUN-2026-009', bay: 'Bay 2 / Cell ROB-4', crit: 'class_a', status: 'running', hours: 5670.40, freq: 30, desc: 'Heavy frame structural robotic welding system.' },
  { code: 'PUN-PRS-001', name: 'Schuler 1000T Hydraulic Deep-Draw Forming Press', cat: 'Hydraulic Press', mfr: 'Schuler Group Germany', model: 'HP-1000-ECO', serial: 'SCH-PUN-2026-010', bay: 'Bay 3 / Line PRS-1', crit: 'class_a', status: 'running', hours: 11450.00, freq: 15, desc: '1000-ton hydraulic press deep-drawing cab roof panels and steel engine hoods.' },
  { code: 'PUN-PRS-002', name: 'Komatsu 600T Mechanical Stamping Press', cat: 'Mechanical Press', mfr: 'Komatsu Press Japan', model: 'E2W-600', serial: 'KOM-PUN-2026-011', bay: 'Bay 3 / Line PRS-2', crit: 'class_b', status: 'running', hours: 9840.50, freq: 30, desc: '600-ton straight side mechanical blanking and piercing press.' },
  { code: 'PUN-PRS-003', name: 'Aida 400T Progressive Die Stamping Press', cat: 'Mechanical Press', mfr: 'Aida Engineering', model: 'NC2-4000', serial: 'AID-PUN-2026-012', bay: 'Bay 3 / Line PRS-3', crit: 'class_b', status: 'idle', hours: 4310.20, freq: 30, desc: 'High-speed stamping press for reinforcement brackets and gussets.' },
  { code: 'PUN-LAS-001', name: 'Trumpf TruLaser 5030 Fiber 10kW CNC Laser Cutter', cat: 'Laser Cutter', mfr: 'Trumpf GmbH Germany', model: 'TruLaser 5030 (L76)', serial: 'TRU-PUN-2026-013', bay: 'Bay 3 / Line CUT-1', crit: 'class_a', status: 'running', hours: 3820.60, freq: 15, desc: '10kW fiber laser cutting high-strength Hardox steel plates up to 30mm thick.' },
  { code: 'PUN-LAS-002', name: 'Bystronic ByStar Fiber 12kW Heavy Sheet Laser', cat: 'Laser Cutter', mfr: 'Bystronic Laser Switzerland', model: 'ByStar Fiber 4020', serial: 'BYS-PUN-2026-014', bay: 'Bay 3 / Line CUT-2', crit: 'class_a', status: 'running', hours: 4150.00, freq: 15, desc: 'Large-format fiber laser cutting main loader arms and side panels.' },
  { code: 'PUN-PLM-001', name: 'Messer MultiTherm Heavy CNC Plasma & Oxy-Fuel Cutting Gantry', cat: 'Plasma Cutter', mfr: 'Messer Cutting Systems', model: 'MultiTherm 4000', serial: 'MES-PUN-2026-015', bay: 'Bay 3 / Line CUT-3', crit: 'class_b', status: 'running', hours: 8230.15, freq: 30, desc: 'Heavy dual-gantry plasma and bevel cutting for excavator track frames.' },
  { code: 'PUN-PNT-001', name: 'Gema OptiCenter Automated Powder Coating System', cat: 'Powder Coating', mfr: 'Gema Switzerland GmbH', model: 'OptiCenter OC07', serial: 'GEM-PUN-2026-016', bay: 'Bay 4 / Line PNT-1', crit: 'class_a', status: 'running', hours: 6120.90, freq: 30, desc: 'Automated 24-gun electrostatic powder application booth for JCB Classic Yellow finish.' },
  { code: 'PUN-PNT-002', name: 'Eisenmann 12-Stage Zinc-Phosphating Pretreatment Dip Tunnel', cat: 'Pre-Treatment', mfr: 'Eisenmann SE Germany', model: 'PT-12-TUNNEL', serial: 'EIS-PUN-2026-017', bay: 'Bay 4 / Line PNT-2', crit: 'class_a', status: 'running', hours: 9140.00, freq: 30, desc: 'Continuous conveyor chemical degreasing, zinc phosphate coating, and deionized rinse.' },
  { code: 'PUN-PNT-003', name: 'Dürr EcoDry Oven High-Efficiency Convection Curing Oven', cat: 'Curing Oven', mfr: 'Dürr Systems AG', model: 'EcoDryCure 220C', serial: 'DUR-PUN-2026-018', bay: 'Bay 4 / Line PNT-3', crit: 'class_b', status: 'running', hours: 8750.30, freq: 60, desc: 'Natural gas fired continuous drying and baking oven at 200°C for paint curing.' },
  { code: 'PUN-ASM-001', name: 'JCB Main Chassis Automated In-Line Carrier Conveyor', cat: 'Assembly Conveyor', mfr: 'Dematic Material Handling', model: 'Power & Free PF-100', serial: 'DEM-PUN-2026-019', bay: 'Bay 5 / Line ASM-1', crit: 'class_a', status: 'running', hours: 12500.00, freq: 30, desc: 'Continuous overhead power and free conveyor synchronizing frame assembly through 18 stations.' },
  { code: 'PUN-ASM-002', name: 'Atlas Copco Multi-Spindle Digital Torque Nutrunner Station', cat: 'Torque Station', mfr: 'Atlas Copco Sweden', model: 'Power Focus 6000', serial: 'ATC-PUN-2026-020', bay: 'Bay 5 / Line ASM-2', crit: 'class_b', status: 'running', hours: 3410.40, freq: 15, desc: 'Synchronized multi-spindle DC electric nutrunner torquing axle differential mounting bolts.' },
  { code: 'PUN-HYD-001', name: 'JCB Hydraulic Flushing & Oil Cleanliness Verification Rig', cat: 'Hydraulic Rig', mfr: 'Parker Hannifin USA', model: 'FlushingRig-500L', serial: 'PAR-PUN-2026-021', bay: 'Bay 5 / Line HYD-1', crit: 'class_a', status: 'running', hours: 4950.00, freq: 15, desc: 'High-volume 500 L/min dynamic oil flushing station guaranteeing ISO 4406 16/14/11 cleanliness.' },
  { code: 'PUN-HYD-002', name: 'Rexroth Hydraulic Dynamic Cylinder End-of-Line Test Stand', cat: 'Hydraulic Test Stand', mfr: 'Bosch Rexroth Germany', model: 'CylTest-350Bar', serial: 'REX-PUN-2026-022', bay: 'Bay 5 / Line HYD-2', crit: 'class_a', status: 'running', hours: 4120.80, freq: 30, desc: '350 Bar full pressure cycle proof test and internal seal bypass measurement.' },
  { code: 'PUN-TST-001', name: 'JCB Dynamometer Heavy Powertrain Road Testing Rig', cat: 'Dynamometer', mfr: 'AVL List GmbH Austria', model: 'DynoPower 450kW', serial: 'AVL-PUN-2026-023', bay: 'Bay 5 / Line TST-1', crit: 'class_a', status: 'running', hours: 2890.00, freq: 30, desc: 'Automated 4-wheel dyno testing full drawbar pull, transmission shifting, and hydrostatic drives.' },
  { code: 'PUN-CMM-001', name: 'Carl Zeiss ACCURA High-Precision Bridge Coordinate Measuring Machine', cat: 'CMM Inspection', mfr: 'Carl Zeiss AG Germany', model: 'ACCURA 2000/3000', serial: 'ZEI-PUN-2026-024', bay: 'Quality Lab 1', crit: 'class_a', status: 'running', hours: 1980.20, freq: 90, desc: 'Climate-controlled 3D CMM measuring 1-micron tolerances on engine blocks and transmission housings.' },
  { code: 'PUN-CMP-001', name: 'Atlas Copco GA 160 VSD+ Oil-Injected Rotary Screw Air Compressor #1', cat: 'Air Compressor', mfr: 'Atlas Copco Belgium', model: 'GA 160 VSD+', serial: 'ATC-PUN-2026-025', bay: 'Utility Block A', crit: 'class_a', status: 'running', hours: 14200.50, freq: 30, desc: 'Primary variable speed plant air compressor supplying 8.5 Bar clean dry air to all CNCs and robots.' },
  { code: 'PUN-CMP-002', name: 'Atlas Copco GA 160 VSD+ Oil-Injected Rotary Screw Air Compressor #2', cat: 'Air Compressor', mfr: 'Atlas Copco Belgium', model: 'GA 160 VSD+', serial: 'ATC-PUN-2026-026', bay: 'Utility Block A', crit: 'class_a', status: 'running', hours: 13950.00, freq: 30, desc: 'Redundant standby rotary screw compressor with automatic failover.' },
  { code: 'PUN-CHL-001', name: 'Daikin EWAD-TZ Central Industrial Process Water Chiller 400TR', cat: 'Process Chiller', mfr: 'Daikin Applied Europe', model: 'EWAD400TZ-XR', serial: 'DAI-PUN-2026-027', bay: 'Utility Block B', crit: 'class_a', status: 'running', hours: 11200.00, freq: 60, desc: 'Central cooling water plant supplying 18°C refrigerated water to spindle jackets and robotic weld torches.' },
  { code: 'PUN-BLS-001', name: 'Pangborn Continuous Heavy Structural Steel Shot Blasting Chamber', cat: 'Shot Blaster', mfr: 'Pangborn Group Europe', model: 'Rotoblast R-150', serial: 'PAN-PUN-2026-028', bay: 'Bay 3 / Line BLS-1', crit: 'class_b', status: 'running', hours: 6890.30, freq: 30, desc: '12-wheel continuous turbine shot blasting descaling heavy steel plate fabrications to SA 2.5.' },
  { code: 'PUN-BND-001', name: 'Trumpf TruBend 5320 Heavy 320T CNC Hydraulic Press Brake', cat: 'Press Brake', mfr: 'Trumpf GmbH Germany', model: 'TruBend 5320', serial: 'TRU-PUN-2026-029', bay: 'Bay 3 / Line BND-1', crit: 'class_b', status: 'running', hours: 4780.00, freq: 30, desc: '320-ton 4-meter CNC press brake bending high-strength excavator boom side plates.' },
  { code: 'PUN-ROB-005', name: 'Kawasaki Heavy 7-Axis Gantry Welding Robot System', cat: 'Robotic Welder', mfr: 'Kawasaki Heavy Industries', model: 'BA006L Gantry', serial: 'KAW-PUN-2026-030', bay: 'Bay 2 / Cell ROB-5', crit: 'class_a', status: 'running', hours: 5340.20, freq: 15, desc: 'Overhead gantry mounted 7-axis robotic welder for complete 14-ton excavator undercarriage.' }
];

const machineIds = [];
for (let i = 0; i < 30; i++) {
  const hex = (i + 1).toString(16).padStart(12, '0');
  machineIds.push('20000000-0000-0000-0000-' + hex);
}

sql += `INSERT INTO machines (
  id, shop_id, machine_code, name, category, oem_manufacturer, model_number, serial_number, 
  bay_line_location, criticality, status, operating_hours, maintenance_frequency_days, qr_code_uid, 
  manual_url, electrical_diagram_url, hydraulic_schematic_url, sop_document_url, description
) VALUES
${machineDetails.map((m, i) => {
  const mid = machineIds[i];
  const shop = shops[i % shops.length];
  const code = m.code;
  const manual = `https://manuals.jcb-cmms.internal/docs/${code}/operating_manual_rev3.pdf`;
  const elec = `https://manuals.jcb-cmms.internal/diagrams/${code}/electrical_schematic_v2.pdf`;
  const hyd = `https://manuals.jcb-cmms.internal/schematics/${code}/hydraulic_circuit_rev4.pdf`;
  const sop = `https://manuals.jcb-cmms.internal/sop/${code}/standard_operating_procedure.pdf`;
  return `  ('${mid}', '${shop.id}', '${m.code}', '${m.name}', '${m.cat}', '${m.mfr}', '${m.model}', '${m.serial}', '${m.bay}', '${m.crit}', '${m.status}', ${m.hours}, ${m.freq}, 'QR-JCB-${m.code}-UID', '${manual}', '${elec}', '${hyd}', '${sop}', '${m.desc}')`;
}).join(',\n')}
ON CONFLICT (machine_code) DO UPDATE SET 
  name = EXCLUDED.name,
  operating_hours = EXCLUDED.operating_hours,
  status = EXCLUDED.status;

-- 5. 30 Heavy Industrial Spare Parts (All 13 Fields: SKUs, Bin Locations, Stocks, Costs)
`;

const partDefs = [
  { pno: 'PUN-PRT-001', oem: 'REX-4WRKE-25-V1', name: 'Bosch Rexroth 4WRKE-25 Proportional Directional Valve', cat: 'Hydraulics', sub: 'Proportional Valves', zone: 'Store Bay A', bin: 'BIN-A-01-01', stock: 12, res: 2, min: 4, cost: 38500.00 },
  { pno: 'PUN-PRT-002', oem: 'SKF-7014-CE-P4A', name: 'SKF Super-Precision Angular Contact Ceramic Spindle Bearing 7014', cat: 'Bearings', sub: 'Spindle Bearings', zone: 'Store Bay B', bin: 'BIN-B-02-05', stock: 8, res: 1, min: 2, cost: 76500.00 },
  { pno: 'PUN-PRT-003', oem: 'FAN-A06B-6114-H205', name: 'Fanuc Alpha i-Series Servo Amplifier Drive Module', cat: 'Electrical', sub: 'Servo Drives', zone: 'Store Bay C', bin: 'BIN-C-01-10', stock: 5, res: 0, min: 2, cost: 142000.00 },
  { pno: 'PUN-PRT-004', oem: 'PAR-P14P-100-R01', name: 'Parker Denison Gold Cup P14P Axial Piston Variable Pump', cat: 'Hydraulics', sub: 'Hydraulic Pumps', zone: 'Store Bay A', bin: 'BIN-A-03-02', stock: 4, res: 1, min: 1, cost: 185000.00 },
  { pno: 'PUN-PRT-005', oem: 'HAL-PU-120MM-HP', name: 'Hallite Polyurethane 120mm Heavy Ram Piston Seal Kit', cat: 'Seals', sub: 'Cylinder Seal Kits', zone: 'Store Bay D', bin: 'BIN-D-01-08', stock: 24, res: 4, min: 8, cost: 8900.00 },
  { pno: 'PUN-PRT-006', oem: 'FES-ISO-24V-5599', name: 'Festo ISO 5599-1 Size 2 Pneumatic 5/2 Solenoid Valve 24VDC', cat: 'Pneumatics', sub: 'Solenoid Valves', zone: 'Store Bay E', bin: 'BIN-E-02-04', stock: 35, res: 2, min: 10, cost: 6200.00 },
  { pno: 'PUN-PRT-007', oem: 'SIE-6ES7-515F-2AM01', name: 'Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F-2 PN Module', cat: 'Electrical', sub: 'PLC Automation', zone: 'Store Bay C', bin: 'BIN-C-02-01', stock: 6, res: 0, min: 2, cost: 198000.00 },
  { pno: 'PUN-PRT-008', oem: 'THK-BS-4015-G0', name: 'THK Ground Precision High-Lead Ball Screw 40mm x 1500mm', cat: 'Mechanical', sub: 'Ball Screws', zone: 'Store Bay B', bin: 'BIN-B-04-12', stock: 6, res: 1, min: 2, cost: 68400.00 },
  { pno: 'PUN-PRT-009', oem: 'DON-P164378-SYN', name: 'Donaldson 10-Micron High-Efficiency Synthetic Hydraulic Return Filter', cat: 'Filtration', sub: 'Oil Filters', zone: 'Store Bay A', bin: 'BIN-A-05-18', stock: 48, res: 6, min: 15, cost: 4200.00 },
  { pno: 'PUN-PRT-010', oem: 'FRO-ROB-440W-MIG', name: 'Fronius Robacta Drive Water-Cooled Automated Robotic MIG Torch', cat: 'Welding', sub: 'MIG Torches', zone: 'Store Bay F', bin: 'BIN-F-01-03', stock: 8, res: 2, min: 3, cost: 58500.00 },
  { pno: 'PUN-PRT-011', oem: 'SCH-VFD-ATV930-45K', name: 'Schneider Electric Altivar Process ATV930 45kW Variable Speed Drive', cat: 'Electrical', sub: 'VFD Drives', zone: 'Store Bay C', bin: 'BIN-C-03-08', stock: 4, res: 0, min: 1, cost: 112000.00 },
  { pno: 'PUN-PRT-012', oem: 'TRU-NOZ-20-EVS', name: 'Trumpf Original 2.0mm High-Performance Laser Cutting Nozzle', cat: 'Laser Consumables', sub: 'Cutting Nozzles', zone: 'Store Bay E', bin: 'BIN-E-01-14', stock: 85, res: 10, min: 25, cost: 2400.00 },
  { pno: 'PUN-PRT-013', oem: 'HYD-0330D010BN4HC', name: 'HYDAC Betamicron 0330 D 010 BN4HC High Pressure Pressure Line Filter', cat: 'Filtration', sub: 'Oil Filters', zone: 'Store Bay A', bin: 'BIN-A-05-22', stock: 32, res: 4, min: 10, cost: 5600.00 },
  { pno: 'PUN-PRT-014', oem: 'IFM-O5D100-LASER', name: 'IFM Electronic Laser Distance & Time-of-Flight Sensor O5D100', cat: 'Sensors', sub: 'Laser Sensors', zone: 'Store Bay C', bin: 'BIN-C-04-06', stock: 18, res: 1, min: 5, cost: 14800.00 },
  { pno: 'PUN-PRT-015', oem: 'GEM-OPTI-GUN-GA03', name: 'Gema OptiGun GA03 Automatic Powder Coating Spray Gun Head', cat: 'Coating Consumables', sub: 'Spray Guns', zone: 'Store Bay F', bin: 'BIN-F-02-11', stock: 10, res: 2, min: 3, cost: 32000.00 },
  { pno: 'PUN-PRT-016', oem: 'NSK-25TAC62-BS', name: 'NSK High-Load Ball Screw Support Bearing 25TAC62BSU', cat: 'Bearings', sub: 'Ball Screw Bearings', zone: 'Store Bay B', bin: 'BIN-B-02-09', stock: 16, res: 2, min: 4, cost: 18900.00 },
  { pno: 'PUN-PRT-017', oem: 'DAN-PVG32-PROP', name: 'Danfoss PVG 32 Proportional Load-Sensing Control Valve Group', cat: 'Hydraulics', sub: 'Proportional Valves', zone: 'Store Bay A', bin: 'BIN-A-02-14', stock: 5, res: 1, min: 2, cost: 94000.00 },
  { pno: 'PUN-PRT-018', oem: 'SMC-MGPM50-100', name: 'SMC Heavy Compact Guide Cylinder MGPM50-100 with Slide Bearings', cat: 'Pneumatics', sub: 'Pneumatic Actuators', zone: 'Store Bay E', bin: 'BIN-E-03-05', stock: 20, res: 2, min: 5, cost: 11400.00 },
  { pno: 'PUN-PRT-019', oem: 'PIL-PNOZ-S4-REL', name: 'Pilz PNOZ s4 Compact Emergency Stop & Safety Gate Relay 24VDC', cat: 'Safety Controls', sub: 'Safety Relays', zone: 'Store Bay C', bin: 'BIN-C-01-04', stock: 22, res: 0, min: 6, cost: 9800.00 },
  { pno: 'PUN-PRT-020', oem: 'HAR-400-STEEL-PIN', name: 'JCB Heavy Hardened 80mm Pivot Pin for Excavator Boom Mounting', cat: 'Structural Hardware', sub: 'Pivot Pins', zone: 'Store Bay D', bin: 'BIN-D-03-01', stock: 40, res: 5, min: 12, cost: 15400.00 },
  { pno: 'PUN-PRT-021', oem: 'ABB-MOTOR-15KW-IE4', name: 'ABB 15kW IE4 Super Premium Efficiency 4-Pole Induction Motor', cat: 'Motors', sub: 'Electric Motors', zone: 'Store Bay B', bin: 'BIN-B-05-02', stock: 4, res: 0, min: 1, cost: 68000.00 },
  { pno: 'PUN-PRT-022', oem: 'FLU-789-CALIB', name: 'Fluke 789 ProcessMeter Precision Loop Calibrator & Multimeter', cat: 'Tooling & Calibration', sub: 'Calibration Instruments', zone: 'Tool Crib 1', bin: 'TC-01-A', stock: 3, res: 0, min: 1, cost: 89000.00 },
  { pno: 'PUN-PRT-023', oem: 'KUK-ROB-CABLE-15M', name: 'KUKA Robot Arm Dresspack Integrated Power & Signal Cable 15m', cat: 'Robotics', sub: 'Dresspacks', zone: 'Store Bay F', bin: 'BIN-F-03-08', stock: 6, res: 1, min: 2, cost: 42000.00 },
  { pno: 'PUN-PRT-024', oem: 'WAG-EP-PRIMER-200L', name: 'JCB High-Build Epoxy Anti-Corrosive Primer Resin Drum (200L)', cat: 'Paints & Chemicals', sub: 'Industrial Paints', zone: 'Chemical Store', bin: 'CHM-01-DRUM', stock: 15, res: 3, min: 5, cost: 52000.00 },
  { pno: 'PUN-PRT-025', oem: 'ATC-SOCKET-17MM', name: 'Atlas Copco Heavy Impact Torx Socket E17 1/2 Inch Drive', cat: 'Tooling & Bits', sub: 'Nutrunner Sockets', zone: 'Tool Crib 2', bin: 'TC-02-B', stock: 50, res: 5, min: 15, cost: 1850.00 },
  { pno: 'PUN-PRT-026', oem: 'BAL-BTL-TRANS-400', name: 'Balluff Micropulse Magnetostrictive Linear Position Transducer 400mm', cat: 'Sensors', sub: 'Linear Transducers', zone: 'Store Bay C', bin: 'BIN-C-05-02', stock: 8, res: 0, min: 2, cost: 36000.00 },
  { pno: 'PUN-PRT-027', oem: 'MAK-PULL-STUD-BT50', name: 'Makino Precision BT50 Spindle Retention Pull Stud with Through Coolant', cat: 'Tooling & Toolholders', sub: 'Pull Studs', zone: 'Store Bay B', bin: 'BIN-B-01-18', stock: 65, res: 10, min: 20, cost: 3200.00 },
  { pno: 'PUN-PRT-028', oem: 'EAT-VICKERS-25V21', name: 'Eaton Vickers 25V Fixed Displacement Industrial Vane Pump', cat: 'Hydraulics', sub: 'Hydraulic Pumps', zone: 'Store Bay A', bin: 'BIN-A-04-10', stock: 6, res: 1, min: 2, cost: 48000.00 },
  { pno: 'PUN-PRT-029', oem: 'HON-LIMIT-LSZ16', name: 'Honeywell Heavy-Duty Enclosed Industrial Limit Switch LSZ16A', cat: 'Electrical', sub: 'Limit Switches', zone: 'Store Bay C', bin: 'BIN-C-04-12', stock: 28, res: 2, min: 8, cost: 4500.00 },
  { pno: 'PUN-PRT-030', oem: 'SKF-LUBRILOG-LGMT', name: 'SKF Industrial Extreme Pressure Multi-Purpose Bearing Grease Drum (50kg)', cat: 'Lubricants', sub: 'Greases', zone: 'Chemical Store', bin: 'CHM-02-DRUM', stock: 18, res: 2, min: 5, cost: 28400.00 }
];

sql += `INSERT INTO spare_parts (
  part_number, oem_part_number, name, description, category, subcategory, 
  warehouse_zone, bin_location, current_physical_stock, reserved_stock, quarantined_stock, 
  min_reorder_level, unit_cost
) VALUES
${partDefs.map(p => `  ('${p.pno}', '${p.oem}', '${p.name}', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', '${p.cat}', '${p.sub}', '${p.zone}', '${p.bin}', ${p.stock}, ${p.res}, 0, ${p.min}, ${p.cost})`).join(',\n')}
ON CONFLICT (part_number) DO UPDATE SET 
  name = EXCLUDED.name,
  current_physical_stock = EXCLUDED.current_physical_stock,
  unit_cost = EXCLUDED.unit_cost;

-- 6. 30 Industrial Vendors Across Maharashtra MIDC Belts (Chakan, Bhosari, Pimpri, Talegaon)
`;

const vendorNames = [
  { code: 'VND-MH-001', name: 'Bharat Forge Limited Heavy Machining Division', contact: 'Pradeep Deshpande', email: 'p.deshpande@bharatforge.com', phone: '+91-20-67042000', addr: 'Mundhwa, Pune, Maharashtra 411036', gstin: '27AAACB0123A1Z1' },
  { code: 'VND-MH-002', name: 'Kirloskar Oil Engines Limited Industrial Spares', contact: 'Gajanan Kulkarni', email: 'g.kulkarni@kirloskar.com', phone: '+91-20-25810341', addr: 'Khadki, Pune, Maharashtra 411003', gstin: '27AAACK4567B1Z2' },
  { code: 'VND-MH-003', name: 'Tata AutoComp Systems Limited Composites Division', contact: 'Makarand Joshi', email: 'm.joshi@tatacomponents.com', phone: '+91-20-66085000', addr: 'Tathawade, Pune, Maharashtra 411033', gstin: '27AAACT8901C1Z3' },
  { code: 'VND-MH-004', name: 'Renuka Hydraulics & Pneumatics Pvt Ltd', contact: 'Vitthalrao Shinde', email: 'sales@renukahydraulics.com', phone: '+91-20-27123456', addr: 'MIDC Bhosari, Pune, Maharashtra 411026', gstin: '27AABCR1234D1Z4' },
  { code: 'VND-MH-005', name: 'Sahyadri Precision Tools & Fixtures', contact: 'Bapurao Patil', email: 'b.patil@sahyadritools.co.in', phone: '+91-2135-667788', addr: 'Phase 2, Chakan MIDC, Pune, Maharashtra 410501', gstin: '27AABCS5678E1Z5' },
  { code: 'VND-MH-006', name: 'Talegaon Industrial Fasteners & Hardware Hub', contact: 'Sanjay Jagtap', email: 'sanjay@talegaonfasteners.com', phone: '+91-2114-223344', addr: 'Talegaon Dabhade, Pune, Maharashtra 410506', gstin: '27AABCT9012F1Z6' },
  { code: 'VND-MH-007', name: 'Shree Ganesh Engineering CNC Jobworks', contact: 'Dnyaneshwar More', email: 'd.more@ganeshengineering.in', phone: '+91-20-27456789', addr: 'Sector 10, PCMC Bhosari, Maharashtra 411026', gstin: '27AABCG3456G1Z7' },
  { code: 'VND-MH-008', name: 'MahaSeals Industrial O-Rings & Gaskets Ltd', contact: 'Ravindra Gokhale', email: 'r.gokhale@mahaseals.com', phone: '+91-20-26871234', addr: 'Hadapsar Industrial Estate, Pune, Maharashtra 411013', gstin: '27AABCM7890H1Z8' },
  { code: 'VND-MH-009', name: 'Maratha Automation & Robotics Field Services', contact: 'Tanaji Bhosale', email: 'tanaji@marathaautomation.com', phone: '+91-2135-256789', addr: 'Chakan Industrial Area Phase 1, Maharashtra 410501', gstin: '27AABCM2345I1Z9' },
  { code: 'VND-MH-010', name: 'Pune Laser Cut & Metal Forming Solutions', contact: 'Anandrao Mohite', email: 'anand@punelasercut.com', phone: '+91-20-66334455', addr: 'Markal MIDC, Alandi-Chakan Road, Maharashtra 412105', gstin: '27AABCP6789J1Z0' },
  { code: 'VND-MH-011', name: 'Kalyani Steels Special Alloys Division', contact: 'Suhas Kulkarni', email: 's.kulkarni@kalyanisteels.com', phone: '+91-20-66215000', addr: 'Mundhwa, Pune, Maharashtra 411036', gstin: '27AAACK1122K1Z1' },
  { code: 'VND-MH-012', name: 'Garware Hi-Tech Industrial Films & Coatings', contact: 'Hemant Garware', email: 'sales@garwarehitech.com', phone: '+91-240-2556789', addr: 'Waluj MIDC, Chhatrapati Sambhajinagar, Maharashtra 431136', gstin: '27AAACG3344L1Z2' },
  { code: 'VND-MH-013', name: 'Pimpri Electrical & VFD Controls Corporation', contact: 'Kailas Sonawane', email: 'kailas@pimprielectrical.com', phone: '+91-20-27421122', addr: 'MIDC Pimpri, Pune, Maharashtra 411018', gstin: '27AABCP5566M1Z3' },
  { code: 'VND-MH-014', name: 'Chakan Hydraulics Precision Hoses & Flanges', contact: 'Milind Suryavanshi', email: 'milind@chakanhydraulics.in', phone: '+91-2135-661122', addr: 'Phase 3 Chakan MIDC, Kuruli, Maharashtra 410501', gstin: '27AABC2233N1Z4' },
  { code: 'VND-MH-015', name: 'Deccan Bearings & Power Transmission Co', contact: 'Rameshwar Thorat', email: 'deccan.bearings@gmail.com', phone: '+91-20-24451234', addr: 'Budhwar Peth / Timber Market, Pune, Maharashtra 411002', gstin: '27AABCD4455O1Z5' },
  { code: 'VND-MH-016', name: 'Kolhapur Heavy Foundry & Steel Castings', contact: 'Balasaheb Shinde', email: 'b.shinde@kolhapurfoundry.com', phone: '+91-231-2678901', addr: 'Shiroli MIDC, Kolhapur, Maharashtra 416122', gstin: '27AABCK6677P1Z6' },
  { code: 'VND-MH-017', name: 'Nashik Industrial Sensors & Instrumentations', contact: 'Avinash Wagh', email: 'avinash@nashiksensors.com', phone: '+91-253-2381234', addr: 'Ambad MIDC, Nashik, Maharashtra 422010', gstin: '27AABCN8899Q1Z7' },
  { code: 'VND-MH-018', name: 'Thane Safety Relays & Light Curtain Systems', contact: 'Satish Kamat', email: 'satish@thanesafety.co.in', phone: '+91-22-25821234', addr: 'Wagle Industrial Estate, Thane, Maharashtra 400604', gstin: '27AABCT0011R1Z8' },
  { code: 'VND-MH-019', name: 'Aurangabad Industrial Gas & Weld Rods Hub', contact: 'Eknath Jadhav', email: 'eknath@aurangabadgas.com', phone: '+91-240-2334455', addr: 'Chikalthana MIDC, Chhatrapati Sambhajinagar, Maharashtra 431006', gstin: '27AABCA2233S1Z9' },
  { code: 'VND-MH-020', name: 'PCMC Pneumatics & Vacuum Automation Works', contact: 'Pandurang Ghadge', email: 'pandurang@pcmcpneumatics.com', phone: '+91-20-27114455', addr: 'Kasarwadi, PCMC, Pune, Maharashtra 411034', gstin: '27AABCP4455T1Z0' },
  { code: 'VND-MH-021', name: 'Satara Special Alloy Gears & Transmissions', contact: 'Jaywantrao Mane', email: 'j.mane@sataragears.in', phone: '+91-2162-245678', addr: 'Old MIDC, Satara, Maharashtra 415004', gstin: '27AABCS6677U1Z1' },
  { code: 'VND-MH-022', name: 'Sangli Precision Ball Screws & Linear Guides', contact: 'Sampatrao Kadam', email: 'sampat@sangliballscrews.com', phone: '+91-233-2641234', addr: 'Kupwad MIDC, Sangli, Maharashtra 416436', gstin: '27AABCS8899V1Z2' },
  { code: 'VND-MH-023', name: 'Solapur Heavy Die Steel & Forging Blanks', contact: 'Subhash Birajdar', email: 'subhash@solapurforging.com', phone: '+91-217-2351234', addr: 'Chincholi MIDC, Solapur, Maharashtra 413255', gstin: '27AABCS0011W1Z3' },
  { code: 'VND-MH-024', name: 'Nagpur Industrial Coolants & Spindle Lubricants', contact: 'Shrikant Fadnavis', email: 'shrikant@nagpurcoolants.com', phone: '+91-712-2561234', addr: 'Butibori Industrial Area, Nagpur, Maharashtra 441108', gstin: '27AABCN2233X1Z4' },
  { code: 'VND-MH-025', name: 'Baramati Agro & Heavy Engineering Hydraulics', contact: 'Abhijit Pawar', email: 'abhijit@baramatihydraulics.in', phone: '+91-2112-243567', addr: 'Baramati MIDC, Pune District, Maharashtra 413133', gstin: '27AABCB4455Y1Z5' },
  { code: 'VND-MH-026', name: 'Ranjangaon Auto Sheet Metal Press Parts Ltd', contact: 'Digambar Salunke', email: 'digambar@ranjangaonpress.com', phone: '+91-2138-662233', addr: 'Ranjangaon MIDC, Shirur, Pune, Maharashtra 412209', gstin: '27AABCR6677Z1Z6' },
  { code: 'VND-MH-027', name: 'Navi Mumbai Heavy Cable & Harness Assemblies', contact: 'Mahendra Thakur', email: 'mahendra@navimumbaicables.com', phone: '+91-22-27781234', addr: 'TTC Industrial Area, Pawane, Navi Mumbai, Maharashtra 400705', gstin: '27AABCN8899A1Z7' },
  { code: 'VND-MH-028', name: 'Jalgaon Industrial Powder Paints & Resins Co', contact: 'Chandrakant Patil', email: 'c.patil@jalgaonpaints.com', phone: '+91-257-2211234', addr: 'Jalgaon MIDC, Jalgaon, Maharashtra 425003', gstin: '27AABCJ0011B1Z8' },
  { code: 'VND-MH-029', name: 'Ahmednagar Heavy Axle & Pin Machining Works', contact: 'Gorakhnath Tanpure', email: 'gorakh@ahmednagarmachining.in', phone: '+91-241-2778901', addr: 'MIDC Nagapur, Ahmednagar, Maharashtra 414111', gstin: '27AABCA2233C1Z9' },
  { code: 'VND-MH-030', name: 'Wai Mechanical Springs & Heavy Suspension Links', contact: 'Shridhar Pisal', email: 'shridhar@waisprings.com', phone: '+91-2167-222333', addr: 'Wai Industrial Estate, Satara, Maharashtra 412803', gstin: '27AABCW4455D1Z0' }
];

const vendorIds = [];
for (let i = 0; i < 30; i++) {
  const hex = (i + 1).toString(16).padStart(12, '0');
  vendorIds.push('50000000-0000-0000-0000-' + hex);
}

sql += `INSERT INTO vendors (id, vendor_code, name, contact_person, email, phone, address, gstin, status, plant_id) VALUES
${vendorNames.map((v, i) => `  ('${vendorIds[i]}', '${v.code}', '${v.name}', '${v.contact}', '${v.email}', '${v.phone}', '${v.addr}', '${v.gstin}', 'active', 'b0000000-0000-0000-0000-000000000002')`).join(',\n')}
ON CONFLICT (vendor_code) DO NOTHING;

-- 7. 30 Breakdown Complaints (Using Valid complaint_status Enum: new, pending_review, work_order_created)
`;

const complaints = [];
const compCats = ['Hydraulic', 'Mechanical', 'Electrical', 'Pneumatics', 'Automation', 'Cooling System'];
const compPriorities = ['critical', 'high', 'medium', 'low'];
const compTitles = [
  'Main hydraulic relief valve chattering under full excavation pressure',
  'Mazak HCN-6800 spindle bearing vibration alarm exceeding 4.8 mm/s threshold',
  'Fanuc robot joint 3 servo collision emergency stop during boom welding',
  'Schuler 1000T hydraulic press ram seal oil leak pooling on floor',
  'Trumpf laser cutting optical head focus lens thermal distortion alarm',
  'Siemens S7-1500 PLC Profinet bus communication drop on Bay 1 line',
  'Pneumatic die clamp cylinder pressure decay during forming stroke',
  'Daikin chiller compressor refrigerant trip causing spindle temperature 42°C',
  'Gema electrostatic powder spray gun nozzle clogging and uneven thickness',
  'Automatic tool changer (ATC) arm stuck mid-rotation holding 50-taper milling cutter',
  'Hydraulic return filter differential pressure bypass indicator red flag',
  'Rexroth proportional directional valve spool jammed due to fine silt',
  'Kawasaki 7-axis gantry welding torch water-cooling loop flow sensor failure',
  'Air compressor GA 160 variable speed drive inverter overcurrent trip',
  'Atlas Copco DC nutrunner torque angle sensor out of calibration ±15Nm',
  'Bystronic fiber laser auto-nozzle cleaning station air cylinder stuck',
  'Powder coating dry-off oven exhaust blower bearing noise and vibration',
  'Mazak X-axis linear glass scale optical encoder error E-204',
  'Hydraulic cylinder rod chromed surface score marks and oil leakage',
  'Pre-treatment chemical dip tank 4 immersion heating element burnt',
  'Shot blasting turbine wheel blade wear leading to uneven surface finish',
  'Chassis assembly power and free conveyor carrier dog chain slippage',
  'High-pressure test rig pressure transducer erratic 4-20mA signal drift',
  'Pilz safety light curtain optical emitter beam misalignment after part load',
  'CNC lathe turret index motor thermal overload switch trip after boring',
  'Pneumatic FRL unit air regulator diaphragm ruptured in Press Bay',
  'Fanuc robot arm teach pendant deadman switch intermittent contact',
  'Hydraulic power pack immersion cooler oil temperature high alarm 65°C',
  'Carl Zeiss CMM air bearing pressure drop interlock locking granite bridge',
  'Tracked machine dyno test track rolling drum hydraulic retarder overheating'
];

for (let i = 1; i <= 30; i++) {
  const hex = i.toString(16).padStart(12, '0');
  const cid = '30000000-0000-0000-0000-' + hex;
  const cnum = `CMP-2026-${String(100 + i).padStart(5, '0')}`;
  const mc = machineDetails[i - 1];
  const mid = machineIds[i - 1];
  const oprIdx = 20 + ((i - 1) % 10);
  const opr = users[oprIdx];
  const oprId = userIds[oprIdx];
  const cat = compCats[(i - 1) % compCats.length];
  const priority = compPriorities[(i - 1) % compPriorities.length];
  const title = compTitles[i - 1];
  const daysAgo = (30 - i) % 14;
  // Valid enum values: 'work_order_created', 'pending_review', 'new'
  const status = i <= 20 ? 'work_order_created' : i <= 26 ? 'pending_review' : 'new';

  complaints.push({
    id: cid,
    number: cnum,
    machine_id: mid,
    reported_by_id: oprId,
    category: cat,
    priority,
    status,
    title,
    desc: `During operational shift inspection by ${opr.name} (${opr.desig}), anomaly detected on asset ${mc.code} (${mc.name}): ${title}. Machine stopped immediately as per JCB safety guidelines.`,
    breakdown_time: `NOW() - INTERVAL '${daysAgo} days 4 hours'`,
    reported_at: `NOW() - INTERVAL '${daysAgo} days 3 hours 45 minutes'`,
    meter: (parseFloat(mc.hours) - (daysAgo * 8.5)).toFixed(2),
    temp: (38.5 + (i % 28)).toFixed(2),
    pressure: (52.0 + (i % 20)).toFixed(2),
    remarks: `Acknowledged by Plant Maintenance Supervisor. Priority set to ${priority}. Technician assignment dispatched.`
  });
}

sql += `INSERT INTO maintenance_requests (
  id, complaint_number, machine_id, reported_by_id, shift, issue_category, 
  priority, status, breakdown_occurred_at, reported_at, hour_meter_reading, 
  temperature, pressure, problem_title, description, manager_remarks
) VALUES
${complaints.map(c => `  ('${c.id}', '${c.number}', '${c.machine_id}', '${c.reported_by_id}', 'Shift A', '${c.category}', '${c.priority}', '${c.status}', ${c.breakdown_time}, ${c.reported_at}, ${c.meter}, ${c.temp}, ${c.pressure}, '${c.title}', '${c.desc}', '${c.remarks}')`).join(',\n')}
ON CONFLICT (complaint_number) DO NOTHING;

-- 8. 30 Real Work Orders (Using Valid work_order_status Enum)
`;

const workOrders = [];
// Valid work_order_status enum values:
const woStatuses = ['completed', 'verified_closed', 'in_progress', 'assigned', 'waiting_for_parts', 'under_diagnosis'];

for (let i = 1; i <= 30; i++) {
  const hex = i.toString(16).padStart(12, '0');
  const woid = '40000000-0000-0000-0000-' + hex;
  const wonum = `WO-2026-${String(200 + i).padStart(5, '0')}`;
  const comp = complaints[i - 1];
  const mc = machineDetails[i - 1];
  const mid = machineIds[i - 1];
  const techIdx = 10 + ((i - 1) % 10);
  const tech = users[techIdx];
  const techId = userIds[techIdx];
  const mgrIdx = 2 + ((i - 1) % 4);
  const mgr = users[mgrIdx];
  const mgrId = userIds[mgrIdx];
  const st = woStatuses[(i - 1) % woStatuses.length];
  const isMajor = i % 4 === 0;
  const daysAgo = (30 - i) % 14;

  const instructions = `Assigned Lead Technician ${tech.name} (${tech.desig}) to perform comprehensive root-cause analysis and repair on asset ${mc.name}. Supervisor: ${mgr.name}. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.`;

  workOrders.push({
    id: woid,
    wo_number: wonum,
    complaint_id: comp.id,
    machine_id: mid,
    tech_id: techId,
    mgr_id: mgrId,
    priority: comp.priority,
    status: st,
    classification: isMajor ? 'major_breakdown' : 'minor_breakdown',
    is_major: isMajor,
    instructions,
    breakdown_time: comp.breakdown_time,
    reported_time: comp.reported_at,
    ack_time: `NOW() - INTERVAL '${daysAgo} days 3 hours 20 minutes'`,
    assigned_time: `NOW() - INTERVAL '${daysAgo} days 3 hours'`,
    travel_time: `NOW() - INTERVAL '${daysAgo} days 2 hours 45 minutes'`,
    arrival_time: `NOW() - INTERVAL '${daysAgo} days 2 hours 30 minutes'`,
    completed_time: st === 'completed' || st === 'verified_closed' ? `NOW() - INTERVAL '${daysAgo} days 30 minutes'` : 'NULL'
  });
}

sql += `INSERT INTO work_orders (
  id, wo_number, complaint_id, machine_id, assigned_technician_id, assigned_manager_id, 
  priority, status, classification, is_major_breakdown, work_instructions, 
  breakdown_time, reported_time, manager_ack_time, technician_assigned_time, 
  travel_started_time, arrival_time, repair_completed_time
) VALUES
${workOrders.map(w => `  ('${w.id}', '${w.wo_number}', '${w.complaint_id}', '${w.machine_id}', '${w.tech_id}', '${w.mgr_id}', '${w.priority}', '${w.status}', '${w.classification}', ${w.is_major}, '${w.instructions}', ${w.breakdown_time}, ${w.reported_time}, ${w.ack_time}, ${w.assigned_time}, ${w.travel_time}, ${w.arrival_time}, ${w.completed_time})`).join(',\n')}
ON CONFLICT (wo_number) DO NOTHING;

-- 9. 30 Operator Pre-Shift Machine Inspections (Sensor Readings)
`;

const inspections = [];
for (let i = 1; i <= 30; i++) {
  const hex = i.toString(16).padStart(12, '0');
  const iid = '70000000-0000-0000-0000-' + hex;
  const mid = machineIds[i - 1];
  const oprIdx = 20 + ((i - 1) % 10);
  const opr = users[oprIdx];
  const oprId = userIds[oprIdx];
  const daysAgo = (30 - i) % 10;
  const temp = (22.5 + (i * 0.8)).toFixed(2);
  const press = (48.0 + (i * 0.5)).toFixed(2);
  const vib = (1.2 + (i * 0.08)).toFixed(2);
  const st = i === 7 ? 'flagged' : i === 15 ? 'fail' : 'pass';

  const responses = JSON.stringify([
    { item_id: 'chk-1', label: 'Hydraulic System Pressure within 45 - 55 Bar', status: 'pass', value: press },
    { item_id: 'chk-2', label: 'Spindle Chiller Unit Operating Temperature (18C - 24C)', status: 'pass', value: temp },
    { item_id: 'chk-3', label: 'Visual Check: No hydraulic fluid pooling or line leaks', status: st === 'fail' ? 'fail' : 'pass' },
    { item_id: 'chk-4', label: 'Emergency Stop & Safety Enclosure Interlock Operational', status: 'pass' },
    { item_id: 'chk-5', label: 'Automatic Way Lube Lubrication Reservoir Level Nominal', status: 'pass' }
  ]);

  inspections.push({
    id: iid,
    machine_id: mid,
    operator_id: oprId,
    shift: 'Shift A',
    status: st,
    temp,
    press,
    vib,
    responses,
    sig: `https://signatures.jcb-cmms.internal/operators/${opr.code}/sig.png`,
    created_at: `NOW() - INTERVAL '${daysAgo} days 6 hours'`
  });
}

sql += `INSERT INTO inspection_records (
  id, machine_id, operator_id, shift, overall_status, temperature, pressure, vibration, responses_json, operator_signature_url, created_at
) VALUES
${inspections.map(ins => `  ('${ins.id}', '${ins.machine_id}', '${ins.operator_id}', '${ins.shift}', '${ins.status}', ${ins.temp}, ${ins.press}, ${ins.vib}, '${ins.responses}'::jsonb, '${ins.sig}', ${ins.created_at})`).join(',\n')}
ON CONFLICT (id) DO NOTHING;

-- 10. 30 Preventive Maintenance (PM) Plans
`;

const pmPlans = [];
for (let i = 1; i <= 30; i++) {
  const hex = i.toString(16).padStart(12, '0');
  const pmid = '80000000-0000-0000-0000-' + hex;
  const pcode = `PM-PLAN-${String(i).padStart(3, '0')}`;
  const mc = machineDetails[i - 1];
  const mid = machineIds[i - 1];
  const freq = i % 4 === 0 ? 'quarterly' : i % 2 === 0 ? 'monthly' : 'weekly';
  const interval = freq === 'weekly' ? 7 : freq === 'monthly' ? 30 : 90;
  const threshold = (250 + (i * 50)).toFixed(2);
  const daysAhead = 5 + (i % 25);

  const checklist = JSON.stringify([
    { step: 1, task: 'Clean and inspect hydraulic suction strainer and magnetic plug', tool: 'Solvent & Lint-Free Cloth' },
    { step: 2, task: 'Measure spindle runout using dial test indicator (Tolerance < 0.003mm)', tool: 'Mitutoyo 0.001mm DTI' },
    { step: 3, task: 'Torque check anchor bolts and foundation vibration dampeners', tool: 'Torque Wrench 250Nm' },
    { step: 4, task: 'Verify safety interlock switches, emergency stop relays and door switches', tool: 'Multimeter' },
    { step: 5, task: 'Top up central automatic grease lubrication reservoir with EP2 grease', tool: 'Grease Pump' }
  ]);

  pmPlans.push({
    id: pmid,
    plan_code: pcode,
    machine_id: mid,
    title: `PM Plan - ${mc.name} (${freq.toUpperCase()})`,
    freq,
    interval,
    threshold,
    checklist,
    last_date: `'2026-10-15'`,
    next_date: `CURRENT_DATE + INTERVAL '${daysAhead} days'`,
    grace: 3
  });
}

sql += `INSERT INTO pm_plans (
  id, plan_code, machine_id, title, frequency, interval_days, operating_hour_threshold, checklist_template, last_pm_date, next_pm_date, grace_period_days, is_active
) VALUES
${pmPlans.map(p => `  ('${p.id}', '${p.plan_code}', '${p.machine_id}', '${p.title}', '${p.freq}', ${p.interval}, ${p.threshold}, '${p.checklist}'::jsonb, ${p.last_date}, ${p.next_date}, ${p.grace}, TRUE)`).join(',\n')}
ON CONFLICT (plan_code) DO NOTHING;

-- 11. 30 Real Stock & Spare Part Transactions (part_id, transaction_type, quantity, performed_by)
`;

const invTrans = [];
for (let i = 1; i <= 30; i++) {
  const hex = i.toString(16).padStart(12, '0');
  const tid = '60000000-0000-0000-0000-' + hex;
  const sp = partDefs[i - 1];
  const stmIdx = 6 + ((i - 1) % 4);
  const stm = users[stmIdx];
  const stmId = userIds[stmIdx];
  const wo = workOrders[i - 1];
  const qty = 1 + (i % 3);
  const daysAgo = (30 - i) % 10;
  // Valid types: 'STOCK_IN', 'ISSUE', 'RESERVATION'
  const txnType = i % 4 === 0 ? 'STOCK_IN' : 'ISSUE';

  invTrans.push({
    id: tid,
    part_no: sp.pno,
    txn_type: txnType,
    qty,
    performed_by: stmId,
    src: txnType === 'ISSUE' ? sp.bin : 'Supplier Truck Bay 1',
    dst: txnType === 'ISSUE' ? `${wo.wo_number} Bay Location` : sp.bin,
    wo_id: wo.id,
    remarks: `${txnType === 'ISSUE' ? 'Issued spare part to Maintenance Technician for' : 'Received genuine OEM consignment for'} Work Order ${wo.wo_number}. Authorized by Store In-Charge ${stm.name}.`,
    created_at: `NOW() - INTERVAL '${daysAgo} days 2 hours'`
  });
}

sql += `INSERT INTO inventory_transactions (
  id, part_id, transaction_type, quantity, source_location, destination_location, 
  reference_work_order_id, performed_by, remarks, created_at
)
SELECT 
  t.id, 
  sp.id, 
  t.txn_type, 
  t.qty, 
  t.src, 
  t.dst, 
  t.wo_id, 
  t.performed_by, 
  t.remarks, 
  t.created_at
FROM (
  VALUES
${invTrans.map(t => `    ('${t.id}'::uuid, '${t.part_no}', '${t.txn_type}', ${t.qty}, '${t.src}', '${t.dst}', '${t.wo_id}'::uuid, '${t.performed_by}'::uuid, '${t.remarks}', ${t.created_at})`).join(',\n')}
) AS t(id, part_no, txn_type, qty, src, dst, wo_id, performed_by, remarks, created_at)
JOIN spare_parts sp ON sp.part_number = t.part_no
ON CONFLICT (id) DO NOTHING;

-- 12. 30 Active Operator-Machine Shift Assignments & Permanent Sign-Ins
-- First ensure table exists if migration 015 was not yet applied
CREATE TABLE IF NOT EXISTS operator_machine_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  shift VARCHAR(50) DEFAULT 'Shift A',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  signed_in_at TIMESTAMPTZ,
  assignment_type VARCHAR(50) NOT NULL DEFAULT 'temporary',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

`;

const assignments = [];
for (let i = 1; i <= 30; i++) {
  const hex = i.toString(16).padStart(12, '0');
  const asgnId = '90000000-0000-0000-0000-' + hex;
  const oprIdx = 20 + ((i - 1) % 10);
  const oprId = userIds[oprIdx];
  const mid = machineIds[i - 1];
  const shop = shops[(i - 1) % shops.length];
  const mgrIdx = 2 + ((i - 1) % 4);
  const mgrId = userIds[mgrIdx];
  const daysAgo = (30 - i) % 7;

  assignments.push({
    id: asgnId,
    operator_id: oprId,
    machine_id: mid,
    shop_id: shop.id,
    plant_id: 'b0000000-0000-0000-0000-000000000002',
    shift: 'Shift A',
    status: i <= 10 ? 'approved' : 'released',
    approved_by: mgrId,
    approved_at: `NOW() - INTERVAL '${daysAgo} days 7 hours 45 minutes'`,
    signed_in_at: `NOW() - INTERVAL '${daysAgo} days 7 hours 30 minutes'`,
    signed_out_at: i <= 10 ? 'NULL' : `NOW() - INTERVAL '${daysAgo} days'`,
    assignment_type: i <= 10 ? 'permanent' : 'shift',
    notes: `Shift operational sign-in approved by Plant Maintenance Manager ${users[mgrIdx].name}. Machine safe for production.`
  });
}

sql += `INSERT INTO operator_machine_assignments (
  id, operator_id, machine_id, shop_id, plant_id, shift, status, approved_by, approved_at, signed_in_at, signed_out_at, assignment_type, notes
) VALUES
${assignments.map(a => `  ('${a.id}', '${a.operator_id}', '${a.machine_id}', '${a.shop_id}', '${a.plant_id}', '${a.shift}', '${a.status}', '${a.approved_by}', ${a.approved_at}, ${a.signed_in_at}, ${a.signed_out_at}, '${a.assignment_type}', '${a.notes}')`).join(',\n')}
ON CONFLICT (id) DO NOTHING;

-- 13. Backfill Current Operator and Assignment References on Machines
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'current_operator_id') THEN
  UPDATE machines m
  SET 
    current_operator_id = a.operator_id,
    assignment_status = 'occupied',
    current_assignment_id = a.id
  FROM operator_machine_assignments a
  WHERE a.machine_id = m.id AND a.status = 'approved';
END IF;

-- 14. Backfill Permanent Machine Assignment on Operators
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'permanent_machine_id') THEN
  UPDATE users u
  SET permanent_machine_id = a.machine_id
  FROM operator_machine_assignments a
  WHERE a.operator_id = u.id AND a.assignment_type = 'permanent';
END IF;

END $$;
`;

const targetPath = path.join(__dirname, '..', 'seeds', '002_maharashtra_enterprise_seed.sql');
fs.writeFileSync(targetPath, sql);
console.log('Successfully updated 002_maharashtra_enterprise_seed.sql:', sql.length, 'bytes');

// Also update COMPLETE_SETUP_ALL_IN_ONE.sql
const masterSetupFile = path.join(__dirname, '..', 'COMPLETE_SETUP_ALL_IN_ONE.sql');
const allMigrationsFile = path.join(__dirname, '..', '000_ALL_MIGRATIONS_COMBINED.sql');
const initialSeedFile = path.join(__dirname, '..', 'seeds', '001_initial_seed.sql');

let masterSql = '-- ====================================================================\n';
masterSql += '-- JCB SMART CMMS: COMPLETE ALL-IN-ONE MASTER SCRIPT\n';
masterSql += '-- (ALL 18 MIGRATIONS + INITIAL SEED + 30 MAHARASHTRIAN FULL DATASET)\n';
masterSql += '-- ====================================================================\n\n';
masterSql += fs.readFileSync(allMigrationsFile, 'utf8');
masterSql += '\n\n-- ====================================================================\n';
masterSql += '-- PART A: CORE INITIAL SEED DATA (5 ROLES + BASIC SHOPS & MACHINES)\n';
masterSql += '-- ====================================================================\n\n';
masterSql += fs.readFileSync(initialSeedFile, 'utf8');
masterSql += '\n\n-- ====================================================================\n';
masterSql += '-- PART B: FULL 30 MAHARASHTRIAN ASSETS, WORK ORDERS & PERSONNEL\n';
masterSql += '-- ====================================================================\n\n';
masterSql += sql;

fs.writeFileSync(masterSetupFile, masterSql);
console.log('Successfully updated COMPLETE_SETUP_ALL_IN_ONE.sql:', masterSql.length, 'bytes');
