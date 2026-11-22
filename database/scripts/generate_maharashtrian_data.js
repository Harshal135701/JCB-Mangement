const fs = require('fs');
const path = require('path');

const passHash = '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e'; // password123

let sql = `-- =====================================================================
-- JCB SMART CMMS: 30 MAHARASHTRIAN ENTERPRISE PERSONNEL & OPERATIONAL SEED DATA
-- Target Facility: JCB Pune Heavy Manufacturing Works (Talegaon Dabhade / Chakan Industrial Belt, Maharashtra)
-- Entities: Plants, Shops, 30 Users, 30 Machines, 30 Spare Parts, 30 Complaints, 30 Work Orders, 30 Inspections, 30 Stock Transactions
-- =====================================================================

DO $$
BEGIN

-- 1. Ensure Pune Plant exists
INSERT INTO plants (id, plant_code, plant_name, address, state, city, pin_code, plant_manager, contact_number, email)
VALUES ('b0000000-0000-0000-0000-000000000002', 'PLANT-PUNE', 'JCB Pune Heavy Manufacturing Works', 'Plot A-1, Talegaon Industrial Area, Chakan-Talegaon Road', 'Maharashtra', 'Pune', '410507', 'Sachin D. Patil', '+91-211-4668000', 'sachin.patil@jcb.com')
ON CONFLICT (plant_code) DO UPDATE SET plant_name = EXCLUDED.plant_name;

-- 2. Ensure Pune Shops exist
`;

const shops = [
  { id: 'c0000000-0000-0000-0000-000000000011', code: 'PUN-SHP-HMC', name: 'Pune HMC & VMC Heavy Machining Shop', desc: 'Precision CNC machining for 3DX backhoe loader chassis and transmission housings' },
  { id: 'c0000000-0000-0000-0000-000000000012', code: 'PUN-SHP-ROB', name: 'Pune Robotic Welding & Arm Fabrication Shop', desc: 'Automated Fanuc 6-axis robotic welding cells for structural booms and dippers' },
  { id: 'c0000000-0000-0000-0000-000000000013', code: 'PUN-SHP-PRS', name: 'Pune 1000T Hydraulic Stamping & Press Shop', desc: 'Heavy forming and blanking presses for excavator cabins and ROPS/FOPS canopies' },
  { id: 'c0000000-0000-0000-0000-000000000014', code: 'PUN-SHP-PNT', name: 'Pune Automated Electrostatic Powder Coating Line', desc: 'Automated 12-stage pre-treatment and JCB Classic Yellow powder coating plant' },
  { id: 'c0000000-0000-0000-0000-000000000015', code: 'PUN-SHP-ASM', name: 'Pune Heavy Excavator & Backhoe Final Assembly', desc: 'Continuous moving takt-time assembly line and hydraulic test bays' }
];

sql += `INSERT INTO shops (id, plant_id, shop_code, shop_name, description) VALUES
${shops.map(s => `  ('${s.id}', 'b0000000-0000-0000-0000-000000000002', '${s.code}', '${s.name}', '${s.desc}')`).join(',\n')}
ON CONFLICT (shop_code) DO NOTHING;

-- 3. 30 Maharashtrian Enterprise Users (Core Roles: Admin, Manager, Store Manager, Technician, Operator)
`;

const users = [
  // 2 Admins
  { code: 'EMP-MAH-001', name: 'Sachin D. Patil', email: 'sachin.patil@jcb.com', phone: '+91-9822011001', role: 'admin', dept: 'Plant Systems & Governance', desig: 'Enterprise VP & Plant Head', shift: 'General', skills: '[]' },
  { code: 'EMP-MAH-002', name: 'Aniket R. Deshmukh', email: 'aniket.deshmukh@jcb.com', phone: '+91-9822011002', role: 'admin', dept: 'IT & Digital Operations', desig: 'Principal Systems Architect', shift: 'General', skills: '[]' },
  // 4 Managers
  { code: 'EMP-MAH-003', name: 'Rohan S. Kulkarni', email: 'rohan.kulkarni@jcb.com', phone: '+91-9822011003', role: 'manager', dept: 'Mechanical Maintenance', desig: 'Plant Maintenance Manager', shift: 'General', skills: '[]', shopIdx: 0 },
  { code: 'EMP-MAH-004', name: 'Swapnil M. Shinde', email: 'swapnil.shinde@jcb.com', phone: '+91-9822011004', role: 'manager', dept: 'Electrical & Automation', desig: 'Automation Engineering Lead', shift: 'General', skills: '[]', shopIdx: 1 },
  { code: 'EMP-MAH-005', name: 'Amol V. More', email: 'amol.more@jcb.com', phone: '+91-9822011005', role: 'manager', dept: 'Heavy Press & Tooling', desig: 'Tooling & Reliability Manager', shift: 'General', skills: '[]', shopIdx: 2 },
  { code: 'EMP-MAH-006', name: 'Prashant B. Chavan', email: 'prashant.chavan@jcb.com', phone: '+91-9822011006', role: 'manager', dept: 'Quality & Governance', desig: 'Operations & Reliability In-Charge', shift: 'General', skills: '[]', shopIdx: 4 },
  // 4 Store Managers
  { code: 'EMP-MAH-007', name: 'Mahesh A. Gaikwad', email: 'mahesh.gaikwad@jcb.com', phone: '+91-9822011007', role: 'store_manager', dept: 'Central Stores & Logistics', desig: 'Chief Inventory Controller', shift: 'General', skills: '["Inventory Control", "ERP", "Logistics"]' },
  { code: 'EMP-MAH-008', name: 'Ganesh N. Jadhav', email: 'ganesh.jadhav@jcb.com', phone: '+91-9822011008', role: 'store_manager', dept: 'Spare Parts Warehouse', desig: 'Senior Materials Manager', shift: 'General', skills: '["Material Inwarding", "Bin Management"]' },
  { code: 'EMP-MAH-009', name: 'Santosh K. Bhosale', email: 'santosh.bhosale@jcb.com', phone: '+91-9822011009', role: 'store_manager', dept: 'Tool Crib & Consumables', desig: 'Tool Crib Supervisor', shift: 'General', skills: '["Tool Crib", "RDC Reconciliation"]' },
  { code: 'EMP-MAH-010', name: 'Rahul T. Kadam', email: 'rahul.kadam@jcb.com', phone: '+91-9822011010', role: 'store_manager', dept: 'Inbound Logistics & Receiving', desig: 'Receiving Store Officer', shift: 'General', skills: '["PO Verification", "Goods Receipt (GRN)"]' },
  // 10 Technicians
  { code: 'EMP-MAH-011', name: 'Nitin G. Pawar', email: 'nitin.pawar@jcb.com', phone: '+91-9822011011', role: 'technician', dept: 'Mechanical Maintenance', desig: 'Senior Mechanical Technician', shift: 'Shift A', skills: '["Hydraulics", "Bearings", "Pneumatics"]', shopIdx: 0 },
  { code: 'EMP-MAH-012', name: 'Vishal B. Mane', email: 'vishal.mane@jcb.com', phone: '+91-9822011012', role: 'technician', dept: 'Electrical Maintenance', desig: 'PLC & Automation Specialist', shift: 'Shift A', skills: '["Siemens S7", "Fanuc Robot", "Sensors"]', shopIdx: 1 },
  { code: 'EMP-MAH-013', name: 'Sandeep R. Thorat', email: 'sandeep.thorat@jcb.com', phone: '+91-9822011013', role: 'technician', dept: 'Hydraulics & Tooling', desig: 'Lead Hydraulics Tech', shift: 'Shift A', skills: '["Rexroth Proportional Valves", "Pumps"]', shopIdx: 2 },
  { code: 'EMP-MAH-014', name: 'Dattatray P. Khot', email: 'dattatray.khot@jcb.com', phone: '+91-9822011014', role: 'technician', dept: 'Robotic Welding Bay', desig: 'Robotics Field Technician', shift: 'Shift B', skills: '["Robotic Arms", "Torch Servicing", "MIG"]', shopIdx: 1 },
  { code: 'EMP-MAH-015', name: 'Mangesh D. Salunkhe', email: 'mangesh.salunkhe@jcb.com', phone: '+91-9822011015', role: 'technician', dept: 'CNC Machining Maintenance', desig: 'Spindle & Tool Changer Tech', shift: 'Shift B', skills: '["Mazak Spindles", "Ball Screws"]', shopIdx: 0 },
  { code: 'EMP-MAH-016', name: 'Pravin V. Sawant', email: 'pravin.sawant@jcb.com', phone: '+91-9822011016', role: 'technician', dept: 'Press & Stamping Bay', desig: 'Heavy Press Mechanical Tech', shift: 'Shift B', skills: '["1000T Ram Seals", "Lubrication"]', shopIdx: 2 },
  { code: 'EMP-MAH-017', name: 'Ajinkya C. Surve', email: 'ajinkya.surve@jcb.com', phone: '+91-9822011017', role: 'technician', dept: 'Powder Coating & Utilities', desig: 'Plant Utilities Technician', shift: 'Shift C', skills: '["Compressors", "Chillers", "Boilers"]', shopIdx: 3 },
  { code: 'EMP-MAH-018', name: 'Yogesh S. Kamble', email: 'yogesh.kamble@jcb.com', phone: '+91-9822011018', role: 'technician', dept: 'Electrical & Instrumentation', desig: 'Drives & VFD Tech', shift: 'Shift C', skills: '["ABB Drives", "Schneider VFD", "Wiring"]', shopIdx: 0 },
  { code: 'EMP-MAH-019', name: 'Akash N. Tambade', email: 'akash.tambade@jcb.com', phone: '+91-9822011019', role: 'technician', dept: 'Preventive Maintenance Group', desig: 'Condition Monitoring Specialist', shift: 'General', skills: '["Vibration Analysis", "Thermography"]', shopIdx: 4 },
  { code: 'EMP-MAH-020', name: 'Siddhesh R. Gawade', email: 'siddhesh.gawade@jcb.com', phone: '+91-9822011020', role: 'technician', dept: 'Mechanical Fast Response Team', desig: 'Emergency Breakdown Specialist', shift: 'Shift A', skills: '["Rapid Diagnostics", "Overhauling"]', shopIdx: 1 },
  // 10 Operators
  { code: 'EMP-MAH-021', name: 'Tushar H. Shingade', email: 'tushar.shingade@jcb.com', phone: '+91-9822011021', role: 'operator', dept: 'CNC Machining', desig: 'Senior HMC Machine Operator', shift: 'Shift A', skills: '[]', shopIdx: 0 },
  { code: 'EMP-MAH-022', name: 'Onkar S. Navale', email: 'onkar.navale@jcb.com', phone: '+91-9822011022', role: 'operator', dept: 'Robotic Welding', desig: 'Automated Cell Operator', shift: 'Shift A', skills: '[]', shopIdx: 1 },
  { code: 'EMP-MAH-023', name: 'Vijay K. Lokhande', email: 'vijay.lokhande@jcb.com', phone: '+91-9822011023', role: 'operator', dept: 'Heavy Press Bay', desig: 'Schuler 1000T Press Operator', shift: 'Shift A', skills: '[]', shopIdx: 2 },
  { code: 'EMP-MAH-024', name: 'Pradeep B. Wagh', email: 'pradeep.wagh@jcb.com', phone: '+91-9822011024', role: 'operator', dept: 'Laser & Plasma Cutting', desig: 'Trumpf Laser Cutting Operator', shift: 'Shift A', skills: '[]', shopIdx: 2 },
  { code: 'EMP-MAH-025', name: 'Suraj M. Khilare', email: 'suraj.khilare@jcb.com', phone: '+91-9822011025', role: 'operator', dept: 'Chassis Fabrication', desig: 'Excavator Frame Operator', shift: 'Shift B', skills: '[]', shopIdx: 1 },
  { code: 'EMP-MAH-026', name: 'Kiran R. Ghadge', email: 'kiran.ghadge@jcb.com', phone: '+91-9822011026', role: 'operator', dept: 'Powder Coating Bay', desig: 'Electrostatic Line Operator', shift: 'Shift B', skills: '[]', shopIdx: 3 },
  { code: 'EMP-MAH-027', name: 'Deepak N. Choudhary', email: 'deepak.choudhary@jcb.com', phone: '+91-9822011027', role: 'operator', dept: 'Transmission Assembly', desig: 'Gearbox Line Operator', shift: 'Shift B', skills: '[]', shopIdx: 0 },
  { code: 'EMP-MAH-028', name: 'Chetan P. Kore', email: 'chetan.kore@jcb.com', phone: '+91-9822011028', role: 'operator', dept: 'Boom Assembly', desig: 'Boom & Dipper Fitter Operator', shift: 'Shift C', skills: '[]', shopIdx: 4 },
  { code: 'EMP-MAH-029', name: 'Nilesh A. Dhale', email: 'nilesh.dhale@jcb.com', phone: '+91-9822011029', role: 'operator', dept: 'Cabin & Trim Fitment', desig: 'ROPS/FOPS Cabin Line Operator', shift: 'Shift C', skills: '[]', shopIdx: 4 },
  { code: 'EMP-MAH-030', name: 'Harsh V. Zagade', email: 'harsh.zagade@jcb.com', phone: '+91-9822011030', role: 'operator', dept: 'Final Inspection & Road Track', desig: 'Machine Test Track Operator', shift: 'General', skills: '[]', shopIdx: 4 }
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

-- 4. 30 Industrial Machines at JCB Pune Works
`;

const machineCategories = ['HMC', 'VMC', 'Robotic Welder', 'Press', 'Laser Cutter', 'Coating Booth', 'Assembly Rig'];
const machines = [];
for (let i = 1; i <= 30; i++) {
  const hex = i.toString(16).padStart(12, '0');
  const mid = '20000000-0000-0000-0000-' + hex;
  const shop = shops[(i - 1) % shops.length];
  const cat = machineCategories[(i - 1) % machineCategories.length];
  const code = `PUN-MC-${String(i).padStart(3, '0')}`;
  const crit = i % 3 === 0 ? 'class_a' : i % 2 === 0 ? 'class_b' : 'class_c';
  const status = i === 4 ? 'breakdown' : i === 7 ? 'under_maintenance' : i === 12 ? 'idle' : 'running';
  const hours = (1500 + i * 314.5).toFixed(2);
  machines.push({
    id: mid,
    shop_id: shop.id,
    code,
    name: `JCB Pune ${cat} Unit ${i}`,
    cat,
    mfr: i % 2 === 0 ? 'Mazak Corporation' : 'Fanuc Robotics Japan',
    model: `NEO-${cat.toUpperCase().replace(/\s+/g, '')}-2026`,
    serial: `JCB-MH-${202600 + i}`,
    location: `Bay ${(i % 5) + 1} / Line ${shop.code}`,
    crit,
    status,
    hours,
    qr: `QR-${code}-UID`,
    desc: `High-throughput precision heavy industrial ${cat} operational asset at JCB Pune Talegaon works.`
  });
}

sql += `INSERT INTO machines (id, shop_id, machine_code, name, category, oem_manufacturer, model_number, serial_number, bay_line_location, criticality, status, operating_hours, qr_code_uid, description) VALUES
${machines.map(m => `  ('${m.id}', '${m.shop_id}', '${m.code}', '${m.name}', '${m.cat}', '${m.mfr}', '${m.model}', '${m.serial}', '${m.location}', '${m.crit}', '${m.status}', ${m.hours}, '${m.qr}', '${m.desc}')`).join(',\n')}
ON CONFLICT (machine_code) DO NOTHING;

-- 5. 30 Heavy Industrial Spare Parts in JCB Pune Stores
`;

const spareParts = [];
const partCats = [
  { cat: 'Hydraulics', sub: 'Proportional Valves', name: 'Bosch Rexroth 4WRKE-25 Proportional Valve', oem: 'REX-4WRKE-25', cost: 18400.00 },
  { cat: 'Bearings', sub: 'Spindle Bearings', name: 'SKF High-Speed Ceramic Angular Contact Bearing 7014', oem: 'SKF-7014-CE', cost: 42500.00 },
  { cat: 'Electrical', sub: 'Servo Drives', name: 'Fanuc Alpha i-Series Servo Drive Module', oem: 'FAN-A06B-6114', cost: 89000.00 },
  { cat: 'Hydraulics', sub: 'High Pressure Pumps', name: 'Parker Denison Gold Cup Axial Piston Pump', oem: 'PAR-P14P-100', cost: 65000.00 },
  { cat: 'Seals', sub: 'Cylinder Seal Kits', name: 'Hallite Polyurethane 120mm Heavy Ram Seal Kit', oem: 'HAL-PU-120MM', cost: 7200.00 },
  { cat: 'Pneumatics', sub: 'Solenoid Valves', name: 'Festo ISO 5599 Pneumatic Solenoid Valve 24VDC', oem: 'FES-ISO-24V', cost: 4800.00 },
  { cat: 'Electrical', sub: 'PLC CPU Modules', name: 'Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F', oem: 'SIE-6ES7-515F', cost: 115000.00 },
  { cat: 'Mechanical', sub: 'Ball Screws', name: 'THK Ground Precision Ball Screw 40mm x 1500mm', oem: 'THK-BS-4015', cost: 58000.00 },
  { cat: 'Filtration', sub: 'Oil Filters', name: 'Donaldson 10-Micron Synthetic Hydraulic Return Filter', oem: 'DON-P164378', cost: 3600.00 },
  { cat: 'Welding', sub: 'MIG Torches', name: 'Fronius Robacta Drive MIG/MAG Water-Cooled Robotic Torch', oem: 'FRO-ROB-440W', cost: 48500.00 }
];

for (let i = 1; i <= 30; i++) {
  const p = partCats[(i - 1) % partCats.length];
  const pnum = `PUN-PRT-${String(i).padStart(3, '0')}`;
  const stock = 10 + (i * 3) % 40;
  const reserved = i % 4 === 0 ? 2 : 0;
  const minStock = 5 + (i % 6);
  spareParts.push({
    part_number: pnum,
    oem_part_number: `${p.oem}-M${i}`,
    name: `${p.name} (Series ${i})`,
    desc: `Genuine JCB OEM ${p.name} engineered for high reliability in harsh manufacturing duty cycles.`,
    cat: p.cat,
    subcat: p.sub,
    zone: `Store Bay ${String.fromCharCode(65 + (i % 4))}`,
    bin: `BIN-${String.fromCharCode(65 + (i % 4))}-${String(i).padStart(2, '0')}`,
    stock,
    reserved,
    quarantined: 0,
    min_reorder_level: minStock,
    unit_cost: (p.cost + (i * 150.50)).toFixed(2)
  });
}

sql += `INSERT INTO spare_parts (part_number, oem_part_number, name, description, category, subcategory, warehouse_zone, bin_location, current_physical_stock, reserved_stock, quarantined_stock, min_reorder_level, unit_cost) VALUES
${spareParts.map(sp => `  ('${sp.part_number}', '${sp.oem_part_number}', '${sp.name}', '${sp.desc}', '${sp.cat}', '${sp.subcat}', '${sp.zone}', '${sp.bin}', ${sp.stock}, ${sp.reserved}, ${sp.quarantined}, ${sp.min_reorder_level}, ${sp.unit_cost})`).join(',\n')}
ON CONFLICT (part_number) DO NOTHING;

-- 6. 30 Real Breakdown Complaints (Reported by Maharashtrian Operators)
`;

const complaints = [];
const compCats = ['Hydraulic', 'Mechanical', 'Electrical', 'Pneumatic', 'Automation', 'Coolant'];
const compPriorities = ['critical', 'high', 'medium', 'low'];
const compTitles = [
  'Hydraulic main relief valve chattering under load',
  'Spindle bearing high vibration alarm exceeding ISO limit',
  'Fanuc robot joint 3 servo collision emergency stop',
  '1000T hydraulic forming press ram seal oil leak',
  'Trumpf laser cutting optical head lens contamination',
  'Siemens PLC Profinet communication bus fault on station 4',
  'Pneumatic die clamp cylinder pressure loss during cycle',
  'Chiller refrigerant leak causing spindle overtemperature',
  'Electrostatic powder spray gun nozzle clogging',
  'Automatic tool changer arm stuck mid-rotation during tool 12'
];

for (let i = 1; i <= 30; i++) {
  const hex = i.toString(16).padStart(12, '0');
  const cid = '30000000-0000-0000-0000-' + hex;
  const cnum = `CMP-2026-${String(100 + i).padStart(5, '0')}`;
  const mc = machines[(i - 1) % machines.length];
  // Reported by operators (index 20 to 29 in users array)
  const oprIdx = 20 + ((i - 1) % 10);
  const oprId = userIds[oprIdx];
  const cat = compCats[(i - 1) % compCats.length];
  const priority = compPriorities[(i - 1) % compPriorities.length];
  const title = compTitles[(i - 1) % compTitles.length];
  const daysAgo = (30 - i) % 15;
  const status = i <= 20 ? 'converted_to_wo' : i <= 26 ? 'in_review' : 'new';

  complaints.push({
    id: cid,
    number: cnum,
    machine_id: mc.id,
    reported_by_id: oprId,
    category: cat,
    priority,
    status,
    title,
    desc: `During operational shift inspection by ${users[oprIdx].name}, anomaly detected on machine ${mc.code}: ${title}. Immediate attention required.`,
    breakdown_time: `NOW() - INTERVAL '${daysAgo} days 4 hours'`,
    reported_at: `NOW() - INTERVAL '${daysAgo} days 3 hours 45 minutes'`,
    meter: (parseFloat(mc.hours) - (daysAgo * 8.5)).toFixed(2),
    temp: (42.5 + (i % 25)).toFixed(2),
    pressure: (52.0 + (i % 15)).toFixed(2)
  });
}

sql += `INSERT INTO maintenance_requests (id, complaint_number, machine_id, reported_by_id, shift, issue_category, priority, status, breakdown_occurred_at, reported_at, hour_meter_reading, temperature, pressure, problem_title, description) VALUES
${complaints.map(c => `  ('${c.id}', '${c.number}', '${c.machine_id}', '${c.reported_by_id}', 'Shift A', '${c.category}', '${c.priority}', '${c.status}', ${c.breakdown_time}, ${c.reported_at}, ${c.meter}, ${c.temp}, ${c.pressure}, '${c.title}', '${c.desc}')`).join(',\n')}
ON CONFLICT (complaint_number) DO NOTHING;

-- 7. 30 Work Orders (Assigned to Maharashtrian Lead Technicians & Managers)
`;

const workOrders = [];
const woStatuses = ['completed', 'completed', 'in_progress', 'assigned', 'pending_parts', 'closed'];

for (let i = 1; i <= 30; i++) {
  const hex = i.toString(16).padStart(12, '0');
  const woid = '40000000-0000-0000-0000-' + hex;
  const wonum = `WO-2026-${String(200 + i).padStart(5, '0')}`;
  const comp = complaints[(i - 1) % complaints.length];
  const mc = machines[(i - 1) % machines.length];
  // Technicians: index 10 to 19
  const techIdx = 10 + ((i - 1) % 10);
  const techId = userIds[techIdx];
  // Managers: index 2 to 5
  const mgrIdx = 2 + ((i - 1) % 4);
  const mgrId = userIds[mgrIdx];
  const st = woStatuses[(i - 1) % woStatuses.length];
  const isMajor = i % 5 === 0;
  const daysAgo = (30 - i) % 14;

  workOrders.push({
    id: woid,
    wo_number: wonum,
    complaint_id: comp.id,
    machine_id: mc.id,
    tech_id: techId,
    mgr_id: mgrId,
    priority: comp.priority,
    status: st,
    classification: isMajor ? 'major_breakdown' : 'minor_breakdown',
    is_major_breakdown: isMajor,
    instructions: `Assigned Lead Technician ${users[techIdx].name} to carry out precision diagnostic and repair work on ${mc.name}. Supervisor: ${users[mgrIdx].name}. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.`,
    breakdown_time: comp.breakdown_time,
    reported_time: comp.reported_at,
    ack_time: `NOW() - INTERVAL '${daysAgo} days 3 hours'`,
    assigned_time: `NOW() - INTERVAL '${daysAgo} days 2 hours 30 minutes'`,
    start_time: `NOW() - INTERVAL '${daysAgo} days 2 hours'`,
    completed_time: st === 'completed' || st === 'closed' ? `NOW() - INTERVAL '${daysAgo} days 30 minutes'` : 'NULL'
  });
}

sql += `INSERT INTO work_orders (id, wo_number, complaint_id, machine_id, assigned_technician_id, assigned_manager_id, priority, status, classification, is_major_breakdown, work_instructions, breakdown_time, reported_time, manager_ack_time, technician_assigned_time, travel_started_time, completed_at) VALUES
${workOrders.map(w => `  ('${w.id}', '${w.wo_number}', '${w.complaint_id}', '${w.machine_id}', '${w.tech_id}', '${w.mgr_id}', '${w.priority}', '${w.status}', '${w.classification}', ${w.is_major_breakdown}, '${w.instructions}', ${w.breakdown_time}, ${w.reported_time}, ${w.ack_time}, ${w.assigned_time}, ${w.start_time}, ${w.completed_time})`).join(',\n')}
ON CONFLICT (wo_number) DO NOTHING;

-- 8. 30 Real Stock / Inventory Issuance Transactions (Managed by Maharashtrian Store Managers)
`;

const invTrans = [];
for (let i = 1; i <= 30; i++) {
  const hex = i.toString(16).padStart(12, '0');
  const tid = '60000000-0000-0000-0000-' + hex;
  const sp = spareParts[(i - 1) % spareParts.length];
  // Store Managers: index 6 to 9
  const stmIdx = 6 + ((i - 1) % 4);
  const stmId = userIds[stmIdx];
  const wo = workOrders[(i - 1) % workOrders.length];
  const qty = 1 + (i % 4);
  const daysAgo = (30 - i) % 10;

  invTrans.push({
    id: tid,
    part_id_lookup: sp.part_number,
    txn_type: i % 3 === 0 ? 'receipt' : 'issue',
    qty,
    performed_by: stmId,
    ref: `REF-PUN-${202600 + i}`,
    wo_id: wo.id,
    notes: `Issued spare part ${sp.name} to Maintenance Work Order ${wo.wo_number}. Authorized by Store In-Charge ${users[stmIdx].name}.`,
    created_at: `NOW() - INTERVAL '${daysAgo} days 1 hour'`
  });
}

sql += `INSERT INTO inventory_transactions (id, spare_part_id, transaction_type, quantity, performed_by_id, reference_document, work_order_id, notes, created_at)
SELECT 
  t.id, 
  sp.id, 
  t.txn_type::inventory_transaction_type, 
  t.qty, 
  t.performed_by, 
  t.ref, 
  t.wo_id, 
  t.notes, 
  t.created_at
FROM (
  VALUES
${invTrans.map(t => `    ('${t.id}'::uuid, '${t.part_id_lookup}', '${t.txn_type}', ${t.qty}, '${t.performed_by}'::uuid, '${t.ref}', '${t.wo_id}'::uuid, '${t.notes}', ${t.created_at})`).join(',\n')}
) AS t(id, part_no, txn_type, qty, performed_by, ref, wo_id, notes, created_at)
JOIN spare_parts sp ON sp.part_number = t.part_no
ON CONFLICT (id) DO NOTHING;

END $$;
`;

const outputPath = path.join(__dirname, '..', 'seeds', '002_maharashtra_enterprise_seed.sql');
fs.writeFileSync(outputPath, sql);
console.log('Successfully generated 002_maharashtra_enterprise_seed.sql:', sql.length, 'bytes');
