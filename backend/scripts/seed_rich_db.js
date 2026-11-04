const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

require('dotenv').config();
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[Seeding Error]: DATABASE_URL environment variable is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedRichDatabase() {
  const client = await pool.connect();
  try {
    console.log('--- STARTING COMPREHENSIVE JCB REAL-TIME DB SEEDING ---');
    await client.query('BEGIN');

    // 1. Plants
    console.log('Seeding Plants...');
    const plantBallabgarh = await client.query(`
      INSERT INTO plants (plant_code, plant_name, address, state, city, pin_code)
      VALUES ('PLT-001', 'JCB Ballabgarh Works', 'Mathura Road, Ballabgarh', 'Haryana', 'Faridabad', '121004')
      ON CONFLICT (plant_code) DO UPDATE SET plant_name = EXCLUDED.plant_name
      RETURNING id;
    `);
    const plantPune = await client.query(`
      INSERT INTO plants (plant_code, plant_name, address, state, city, pin_code)
      VALUES ('PLT-002', 'JCB Pune Operations', 'Talegaon Industrial Area', 'Maharashtra', 'Pune', '410507')
      ON CONFLICT (plant_code) DO UPDATE SET plant_name = EXCLUDED.plant_name
      RETURNING id;
    `);
    const plantJaipur = await client.query(`
      INSERT INTO plants (plant_code, plant_name, address, state, city, pin_code)
      VALUES ('PLT-003', 'JCB Jaipur Mega Facility', 'Mahindra World City, SEZ', 'Rajasthan', 'Jaipur', '302042')
      ON CONFLICT (plant_code) DO UPDATE SET plant_name = EXCLUDED.plant_name
      RETURNING id;
    `);

    const p1Id = plantBallabgarh.rows[0].id;
    const p2Id = plantPune.rows[0].id;
    const p3Id = plantJaipur.rows[0].id;

    // 2. Shops
    console.log('Seeding Production Shops...');
    const shopsData = [
      { code: 'SHP-CNC-01', name: 'CNC Heavy Machining Shop', plant: p1Id, desc: 'High-precision 4-axis & 5-axis HMC and VMC machining of transmission casings.' },
      { code: 'SHP-ROB-01', name: 'Robotic Welding & Fabrication Bay', plant: p1Id, desc: 'Automated 6-axis robotic cells welding heavy booms and chassis.' },
      { code: 'SHP-PRS-01', name: 'Heavy Forming & Press Shop', plant: p1Id, desc: '1000T and 600T hydraulic and mechanical presses for heavy sheet blanking.' },
      { code: 'SHP-PNT-01', name: 'Electrostatic Powder Coating Shop', plant: p1Id, desc: 'Automated conveyor surface treatment and JCB Classic Yellow paint booths.' },
      { code: 'SHP-ASM-01', name: 'Final Assembly & Test Track', plant: p1Id, desc: 'Continuous conveyor assembly line for Backhoe Loaders and final road testing.' },
      { code: 'SHP-PUN-01', name: 'Excavator Heavy Assembly Bay', plant: p2Id, desc: 'Tracked excavator boom mounting and high-pressure hydraulic testing.' },
      { code: 'SHP-JAI-01', name: 'Telescopic Handler Automation Cell', plant: p3Id, desc: 'Eco-manufacturing line for JCB Loadall telescopic handlers.' },
    ];

    const shopMap = {};
    for (const s of shopsData) {
      const res = await client.query(`
        INSERT INTO shops (plant_id, shop_code, shop_name, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (shop_code) DO UPDATE SET shop_name = EXCLUDED.shop_name, description = EXCLUDED.description
        RETURNING id, shop_code;
      `, [s.plant, s.code, s.name, s.desc]);
      shopMap[s.code] = res.rows[0].id;
    }

    // 3. Users (Password: password123)
    console.log('Seeding Enterprise Personnel (Admin, Manager, Tech, Operator)...');
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash('password123', salt);

    const usersData = [
      { code: 'EMP-ADM-001', name: 'Rajesh Sharma', email: 'admin@jcb.com', role: 'admin', dept: 'Plant Systems & Governance', title: 'Enterprise Administrator', shift: 'General' },
      { code: 'EMP-MGR-001', name: 'Vikas Verma', email: 'manager@jcb.com', role: 'manager', dept: 'Mechanical Maintenance', title: 'Plant Maintenance In-Charge', shift: 'Shift A' },
      { code: 'EMP-TCH-001', name: 'Sunil Yadav', email: 'technician@jcb.com', role: 'technician', dept: 'Mechanical Maintenance', title: 'Lead Mechanical Technician', shift: 'Shift A' },
      { code: 'EMP-TCH-002', name: 'Anil Kumar', email: 'anil.tech@jcb.com', role: 'technician', dept: 'Electrical & PLC Automation', title: 'Automation Engineer', shift: 'Shift A' },
      { code: 'EMP-TCH-003', name: 'Suresh Patil', email: 'suresh.hydraulic@jcb.com', role: 'technician', dept: 'Hydraulics & Tooling', title: 'Hydraulic Systems Specialist', shift: 'Shift B' },
      { code: 'EMP-TCH-004', name: 'Vikram Singh', email: 'vikram.welding@jcb.com', role: 'technician', dept: 'Robotic Welding Maintenance', title: 'Robotics Field Technician', shift: 'Shift B' },
      { code: 'EMP-OPR-001', name: 'Ramesh Chandra', email: 'operator@jcb.com', role: 'operator', dept: 'Production Operations', title: 'Senior CNC Line Operator', shift: 'Shift A' },
      { code: 'EMP-OPR-002', name: 'Mahesh Shinde', email: 'mahesh.press@jcb.com', role: 'operator', dept: 'Press Operations', title: 'Hydraulic Press Operator', shift: 'Shift A' },
      { code: 'EMP-OPR-003', name: 'Kavita Sharma', email: 'kavita.assembly@jcb.com', role: 'operator', dept: 'Final Assembly', title: 'Testing Line Operator', shift: 'Shift B' },
    ];

    const userMap = {};
    for (const u of usersData) {
      const res = await client.query(`
        INSERT INTO users (employee_code, full_name, email, role, department, designation, shift, password_hash, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        ON CONFLICT (email) DO UPDATE SET 
          full_name = EXCLUDED.full_name,
          employee_code = EXCLUDED.employee_code,
          role = EXCLUDED.role,
          department = EXCLUDED.department,
          designation = EXCLUDED.designation,
          shift = EXCLUDED.shift,
          password_hash = EXCLUDED.password_hash
        RETURNING id, email;
      `, [u.code, u.name, u.email, u.role, u.dept, u.title, u.shift, passHash]);
      userMap[u.email] = res.rows[0].id;
    }

    // 4. Machines (16 Heavy Industrial Assets)
    console.log('Seeding 16 Heavy Industrial Machine Assets...');
    const machinesData = [
      { code: 'CNC-001', name: 'Mazak Horizontal Machining Center 1', shop: shopMap['SHP-CNC-01'], cat: 'HMC', oem: 'Mazak', model: 'HCN-6800 NEO', sn: 'MZK-2023-8991', bay: 'Bay 1 / Line 4', crit: 'class_a', status: 'running', hrs: 4320.50 },
      { code: 'CNC-002', name: 'Doosan 5-Axis Heavy Machining Center', shop: shopMap['SHP-CNC-01'], cat: 'VMC', oem: 'Doosan Machine Tools', model: 'DVF-8000', sn: 'DSN-2022-7712', bay: 'Bay 1 / Line 2', crit: 'class_a', status: 'running', hrs: 5890.00 },
      { code: 'CNC-003', name: 'Makino Heavy Horizontal Milling Bay', shop: shopMap['SHP-CNC-01'], cat: 'HMC', oem: 'Makino', model: 'a81nx High-Torque', sn: 'MKN-9021-3341', bay: 'Bay 2 / Line 1', crit: 'class_b', status: 'running', hrs: 7120.00 },
      { code: 'CNC-004', name: 'DMG Mori Universal Turning Lathe', shop: shopMap['SHP-CNC-01'], cat: 'CNC Lathe', oem: 'DMG Mori', model: 'NLX 2500|700', sn: 'DMG-2021-4409', bay: 'Bay 2 / Line 3', crit: 'class_b', status: 'idle', hrs: 3100.25 },
      
      { code: 'ROB-012', name: 'Fanuc 6-Axis Robotic Welding Station A', shop: shopMap['SHP-ROB-01'], cat: 'Robotic Welder', oem: 'Fanuc', model: 'ARC Mate 120iD', sn: 'FNC-9912-3341', bay: 'Bay 2 / Line ROB-1', crit: 'class_a', status: 'running', hrs: 6140.00 },
      { code: 'ROB-014', name: 'ABB IRB 6700 Boom Fabrication Robot', shop: shopMap['SHP-ROB-01'], cat: 'Heavy Welder', oem: 'ABB Robotics', model: 'IRB 6700-200/2.60', sn: 'ABB-6700-1192', bay: 'Bay 3 / Line FAB-2', crit: 'class_a', status: 'breakdown', hrs: 8940.50 },
      { code: 'ROB-016', name: 'KUKA High-Payload Tracked Arm Welder', shop: shopMap['SHP-ROB-01'], cat: 'Robotic Welder', oem: 'KUKA Robotics', model: 'KR QUANTEC ultra', sn: 'KUK-2023-5501', bay: 'Bay 3 / Line FAB-4', crit: 'class_b', status: 'running', hrs: 4210.00 },
      
      { code: 'PRS-101', name: 'Schuler 1000T Hydraulic Forming Press', shop: shopMap['SHP-PRS-01'], cat: 'Hydraulic Press', oem: 'Schuler Pressen', model: 'HP-1000-ECO', sn: 'SCH-1000-091', bay: 'Press Bay 1', crit: 'class_a', status: 'running', hrs: 11200.00 },
      { code: 'PRS-102', name: 'Komatsu 600T Mechanical Blanking Press', shop: shopMap['SHP-PRS-01'], cat: 'Mechanical Press', oem: 'Komatsu', model: 'OBS-600-H', sn: 'KMT-600-449', bay: 'Press Bay 2', crit: 'class_b', status: 'under_maintenance', hrs: 9400.00 },
      { code: 'PRS-105', name: 'AIDA 400T Progressive Stamping Press', shop: shopMap['SHP-PRS-01'], cat: 'Stamping Press', oem: 'AIDA Global', model: 'NC1-4000', sn: 'AID-400-881', bay: 'Press Bay 3', crit: 'class_b', status: 'running', hrs: 6730.00 },

      { code: 'PNT-001', name: 'Eisenmann Automated Surface Coating Line', shop: shopMap['SHP-PNT-01'], cat: 'Paint Line', oem: 'Eisenmann', model: 'E-Coat Continuous', sn: 'EIS-2020-001', bay: 'Paint Bay A', crit: 'class_b', status: 'running', hrs: 12450.00 },
      { code: 'PNT-002', name: 'Nordson Powder Application Booth', shop: shopMap['SHP-PNT-01'], cat: 'Powder Booth', oem: 'Nordson Industrial', model: 'ColorMax 3', sn: 'NRD-2022-108', bay: 'Paint Bay B', crit: 'class_c', status: 'running', hrs: 4300.00 },

      { code: 'HYD-001', name: 'High-Pressure Hydraulic Valve Test Rig', shop: shopMap['SHP-ASM-01'], cat: 'Test Rig', oem: 'Rexroth Bosch', model: 'HPTR-350-BAR', sn: 'RXT-TEST-901', bay: 'Assembly Line 1', crit: 'class_a', status: 'running', hrs: 3900.00 },
      { code: 'ASM-001', name: 'Backhoe Loader Final Chassis Conveyor', shop: shopMap['SHP-ASM-01'], cat: 'Conveyor', oem: 'JCB In-House Systems', model: 'FLC-50M-HEAVY', sn: 'JCB-CNV-2019', bay: 'Main Line', crit: 'class_a', status: 'running', hrs: 15400.00 },
      { code: 'EXC-PUN-01', name: 'Pune Heavy Excavator Boom Test Stand', shop: shopMap['SHP-PUN-01'], cat: 'Boom Test Rig', oem: 'Liebherr Systems', model: 'BTR-500', sn: 'LBH-PUN-01', bay: 'Talegaon Bay 1', crit: 'class_a', status: 'running', hrs: 5400.00 },
      { code: 'TEL-JAI-01', name: 'Jaipur Loadall Robotic Chassis Welder', shop: shopMap['SHP-JAI-01'], cat: 'Robotic Welder', oem: 'Fanuc', model: 'M-900iB/360', sn: 'FNC-JAI-900', bay: 'Jaipur Bay 2', crit: 'class_a', status: 'running', hrs: 2800.00 }
    ];

    const machineMap = {};
    for (const m of machinesData) {
      const qrUid = `QR-JCB-${m.code}-ASSET`;
      const snUnique = `${m.sn}-${m.code}`;
      
      // Check if machine already exists
      const existing = await client.query('SELECT id, machine_code FROM machines WHERE machine_code = $1', [m.code]);
      if (existing.rows.length > 0) {
        await client.query(`
          UPDATE machines SET
            name = $1, category = $2, oem_manufacturer = $3, status = $4, operating_hours = $5
          WHERE id = $6
        `, [m.name, m.cat, m.oem, m.status, m.hrs, existing.rows[0].id]);
        machineMap[m.code] = existing.rows[0].id;
      } else {
        const res = await client.query(`
          INSERT INTO machines (
            shop_id, machine_code, name, category, oem_manufacturer, 
            model_number, serial_number, bay_line_location, criticality, status, operating_hours, qr_code_uid
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id, machine_code;
        `, [m.shop, m.code, m.name, m.cat, m.oem, m.model, snUnique, m.bay, m.crit, m.status, m.hrs, qrUid]);
        machineMap[m.code] = res.rows[0].id;
      }
    }

    // 5. Spare Parts (15 Genuine JCB SKUs with GIN Trigram Search)
    console.log('Seeding Genuine JCB Spare Parts SKUs...');
    const sparesData = [
      { no: '332/Y2415', oem: 'OEM-HYD-2415', name: 'Main Hydraulic Boom Cylinder Seal Kit', cat: 'Hydraulics', bin: 'BIN-A-01-05', phy: 45, res: 5, min: 10, max: 100, cost: 4850.00, supp: 'JCB Fluid Power Systems' },
      { no: '02/201808', oem: 'BOSCH-0445010', name: 'JCB EcoMAX Common Rail High-Pressure Fuel Pump', cat: 'Engine', bin: 'BIN-B-02-01', phy: 8, res: 1, min: 3, max: 20, cost: 58500.00, supp: 'Bosch Diesel Systems' },
      { no: '32/925682', oem: 'PARKER-10MIC', name: 'Hydraulic Return Line Filter Element (10 Micron)', cat: 'Filters', bin: 'BIN-A-03-08', phy: 120, res: 15, min: 25, max: 300, cost: 1850.00, supp: 'Parker Hannifin India' },
      { no: '701/80145', oem: 'SW-COL-801', name: 'Forward/Reverse Transmission Column Switch', cat: 'Electrical', bin: 'BIN-E-01-02', phy: 32, res: 2, min: 8, max: 50, cost: 7450.00, supp: 'JCB Electrical Components' },
      { no: '991/00147', oem: 'OEM-RAM-147', name: 'Front Loader Bucket Hydraulic Ram Seal Kit', cat: 'Hydraulics', bin: 'BIN-A-01-09', phy: 60, res: 8, min: 15, max: 120, cost: 3600.00, supp: 'JCB Fluid Power Systems' },
      { no: '333/C8542', oem: 'ZFL-8542', name: 'Heavy Duty Planetary Hub Carrier Assembly', cat: 'Transmission', bin: 'BIN-T-04-01', phy: 6, res: 0, min: 2, max: 15, cost: 42000.00, supp: 'ZF Transmissions India' },
      { no: '25/222658', oem: 'RXT-4WRPEH', name: 'Rexroth Proportional Directional Control Valve', cat: 'Hydraulics', bin: 'BIN-A-04-03', phy: 5, res: 1, min: 2, max: 12, cost: 72000.00, supp: 'Bosch Rexroth AG' },
      { no: '05/903811', oem: 'FRIC-PLATE-11', name: 'PowerShift Transmission Sintered Friction Plate', cat: 'Transmission', bin: 'BIN-T-02-06', phy: 90, res: 10, min: 20, max: 200, cost: 2400.00, supp: 'JCB Heavy Transmission' },
      { no: '450/10206', oem: 'CROWN-PIN-206', name: 'Drive Axle Differential Bevel Pinion & Crown Gear', cat: 'Axles', bin: 'BIN-X-01-01', phy: 4, res: 0, min: 2, max: 10, cost: 68000.00, supp: 'Carraro Drivetech' },
      { no: '716/30255', oem: 'ALT-12V-95A', name: 'Heavy Duty Dust-Proof Alternator 12V 95A', cat: 'Electrical', bin: 'BIN-E-03-04', phy: 18, res: 2, min: 5, max: 40, cost: 16500.00, supp: 'Denso Corporation' },
      { no: '123/04882', oem: 'FANUC-SERVO-01', name: 'Fanuc AC Servo Motor 3.5kW Feedback Encoder', cat: 'Robotics', bin: 'BIN-R-01-01', phy: 3, res: 0, min: 2, max: 8, cost: 95000.00, supp: 'Fanuc India Robotics' },
      { no: '320/07155', oem: 'INJECTOR-CR-01', name: 'Electronic Fuel Injector Assembly (EcoMAX)', cat: 'Engine', bin: 'BIN-B-02-04', phy: 24, res: 4, min: 6, max: 50, cost: 22000.00, supp: 'Delphi Technologies' },
      { no: '331/14861', oem: 'HOSE-HI-PRESS', name: 'High-Pressure 4-Spiral Hydraulic Hose 1/2" (2m)', cat: 'Hydraulics', bin: 'BIN-A-02-11', phy: 85, res: 12, min: 20, max: 150, cost: 3100.00, supp: 'Gates India' },
      { no: '813/00460', oem: 'BRG-TIMKEN-460', name: 'Timken Tapered Roller Bearing 120x80x30mm', cat: 'Bearings', bin: 'BIN-M-05-02', phy: 40, res: 4, min: 10, max: 80, cost: 4600.00, supp: 'Timken Bearings Ltd' },
      { no: '477/00824', oem: 'SOLENOID-24V', name: '24V Hydraulic Pilot Manifold Solenoid Valve', cat: 'Hydraulics', bin: 'BIN-A-04-07', phy: 14, res: 1, min: 4, max: 30, cost: 9800.00, supp: 'Hydac India' }
    ];

    const partMap = {};
    for (const sp of sparesData) {
      const res = await client.query(`
        INSERT INTO spare_parts (
          part_number, oem_part_number, name, category, bin_location,
          current_physical_stock, reserved_stock, min_reorder_level, max_stock_level, unit_cost, supplier_name
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (part_number) DO UPDATE SET 
          current_physical_stock = EXCLUDED.current_physical_stock,
          reserved_stock = EXCLUDED.reserved_stock,
          unit_cost = EXCLUDED.unit_cost,
          bin_location = EXCLUDED.bin_location
        RETURNING id, part_number;
      `, [sp.no, sp.oem, sp.name, sp.cat, sp.bin, sp.phy, sp.res, sp.min, sp.max, sp.cost, sp.supp]);
      partMap[sp.no] = res.rows[0].id;
    }

    // 6. Maintenance Complaints (CMP)
    console.log('Seeding Breakdown Complaints...');
    const cmp1 = await client.query(`
      INSERT INTO maintenance_requests (
        complaint_number, machine_id, reported_by_id, shift, issue_category, priority, problem_title, description, status, breakdown_occurred_at
      )
      VALUES (
        'CMP-2026-00001',
        $1,
        $2,
        'Shift A',
        'Hydraulic',
        'critical',
        'Main Boom Hydraulic Cylinder Seal Blowout',
        'Severe hydraulic fluid pressure loss during backhoe boom extension. Oil leaking onto Bay 3 floor. Emergency stop triggered.',
        'new',
        NOW() - INTERVAL '35 minutes'
      )
      ON CONFLICT (complaint_number) DO NOTHING
      RETURNING id;
    `, [machineMap['ROB-014'], userMap['operator@jcb.com']]);

    const cmp2 = await client.query(`
      INSERT INTO maintenance_requests (
        complaint_number, machine_id, reported_by_id, shift, issue_category, priority, problem_title, description, status, breakdown_occurred_at
      )
      VALUES (
        'CMP-2026-00002',
        $1,
        $2,
        'Shift A',
        'Electrical',
        'high',
        'Fanuc 6-Axis Robotic Servo Axis Error 401',
        'Robotic welding cell stopped mid-cycle with joint axis J2 servo drive overload alarm.',
        'work_order_created',
        NOW() - INTERVAL '2 hours'
      )
      ON CONFLICT (complaint_number) DO NOTHING
      RETURNING id;
    `, [machineMap['ROB-012'], userMap['operator@jcb.com']]);

    // 7. Work Orders (WO)
    console.log('Seeding Active Work Orders...');
    const cmpTargetId = cmp2.rows.length > 0 ? cmp2.rows[0].id : (await client.query("SELECT id FROM maintenance_requests WHERE complaint_number='CMP-2026-00002'")).rows[0]?.id;
    
    if (cmpTargetId) {
      await client.query(`
        INSERT INTO work_orders (
          wo_number, complaint_id, machine_id, assigned_technician_id, assigned_manager_id,
          priority, status, is_major_breakdown, sla_deadline, work_instructions,
          breakdown_time, reported_time, manager_ack_time, technician_assigned_time, work_started_time
        )
        VALUES (
          'WO-2026-00001',
          $1,
          $2,
          $3,
          $4,
          'high',
          'under_diagnosis',
          false,
          NOW() + INTERVAL '2 hours',
          'Check Fanuc J2 servo drive cable harness, verify encoder feedback signal, test insulation resistance.',
          NOW() - INTERVAL '2 hours',
          NOW() - INTERVAL '1 hour 55 minutes',
          NOW() - INTERVAL '1 hour 45 minutes',
          NOW() - INTERVAL '1 hour 30 minutes',
          NOW() - INTERVAL '20 minutes'
        )
        ON CONFLICT (wo_number) DO NOTHING;
      `, [cmpTargetId, machineMap['ROB-012'], userMap['anil.tech@jcb.com'], userMap['manager@jcb.com']]);
    }

    // 8. Purchase Requisitions (PR)
    console.log('Seeding Purchase Requisitions (PR)...');
    await client.query(`
      INSERT INTO purchase_requisitions (
        pr_number, machine_id, part_id, quantity_required, urgency, technical_justification, status, requested_by
      )
      VALUES (
        'PR-2026-00001',
        $1,
        $2,
        2,
        'critical',
        'Emergency zero-stock replacement for Rexroth Proportional Valve on Schuler 1000T Press.',
        'new',
        $3
      )
      ON CONFLICT (pr_number) DO NOTHING;
    `, [machineMap['PRS-101'], partMap['25/222658'], userMap['suresh.hydraulic@jcb.com']]);

    await client.query(`
      INSERT INTO purchase_requisitions (
        pr_number, machine_id, part_id, quantity_required, urgency, technical_justification, status, po_number, supplier_name, requested_by
      )
      VALUES (
        'PR-2026-00002',
        $1,
        $2,
        50,
        'medium',
        'Monthly preventive replacement batch for 10 Micron return filters across CNC bays.',
        'po_created',
        'PO-JCB-98214',
        'Parker Hannifin India Ltd.',
        $3
      )
      ON CONFLICT (pr_number) DO NOTHING;
    `, [machineMap['CNC-001'], partMap['32/925682'], userMap['technician@jcb.com']]);

    // 9. Returnable Delivery Challan (RDC)
    console.log('Seeding Returnable Delivery Challan (RDC)...');
    await client.query(`
      INSERT INTO rdc_challans (
        challan_number, rdc_type, machine_id, vendor_party_name, purpose, expected_return_date, gate_pass_number, status, created_by
      )
      VALUES (
        'RDC-2026-00001',
        'RDC',
        $1,
        'Siemens Drive Overhaul Service Center, Okhla',
        'Spindle 15kW Drive Motor Stator Rewinding & Dynamic V-Balancing',
        CURRENT_DATE + INTERVAL '5 days',
        'GP-JCB-48910',
        'dispatched',
        $2
      )
      ON CONFLICT (challan_number) DO NOTHING;
    `, [machineMap['CNC-001'], userMap['manager@jcb.com']]);

    // 10. PM Plans
    console.log('Seeding Preventive Maintenance Schedules...');
    await client.query(`
      INSERT INTO pm_plans (
        plan_code, machine_id, title, frequency, interval_days, operating_hour_threshold, next_pm_date, is_active
      )
      VALUES (
        'PM-2026-0001',
        $1,
        'Monthly Hydraulic Oil De-aeration & Filter Replacement',
        'monthly',
        30,
        500,
        CURRENT_DATE + INTERVAL '4 days',
        true
      )
      ON CONFLICT (plan_code) DO NOTHING;
    `, [machineMap['PRS-101']]);

    await client.query(`
      INSERT INTO pm_plans (
        plan_code, machine_id, title, frequency, interval_days, operating_hour_threshold, next_pm_date, is_active
      )
      VALUES (
        'PM-2026-0002',
        $1,
        '250-Hour Spindle Taper Runout & Lubrication Inspection',
        'monthly',
        20,
        250,
        CURRENT_DATE - INTERVAL '1 day',
        true
      )
      ON CONFLICT (plan_code) DO NOTHING;
    `, [machineMap['CNC-001']]);

    // 11. Audit Logs
    console.log('Seeding System Audit Trail...');
    await client.query(`
      INSERT INTO inventory_transactions (
        part_id, transaction_type, quantity, performed_by, remarks
      )
      VALUES (
        $1,
        'STOCK_IN',
        20,
        $2,
        'Initial SAP ERP to CMMS Master Opening Stock Inwarding'
      );
    `, [partMap['332/Y2415'], userMap['admin@jcb.com']]);

    await client.query('COMMIT');
    console.log('--- ALL REAL-TIME DATA COMMITTED DIRECTLY TO SUPABASE POSTGRESQL SUCCESSFULLY! ---');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedRichDatabase();
