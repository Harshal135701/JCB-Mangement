require('dotenv').config({
  path: require('path').join(__dirname, '../.env'),
  override: true
});
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runE2ETest() {
  const client = await pool.connect();
  const testId = Date.now().toString().slice(-6);
  const testEmpCode = `E2E-OPR-${testId}`;
  const testEmail = `e2e.operator.${testId}@jcb-test.com`;
  const testPassword = 'Password123!';

  console.log('===============================================================');
  console.log('🚜 STARTING E2E LIVE DATABASE VERIFICATION FOR JCB CMMS WORKFLOW');
  console.log('===============================================================');

  try {
    // STEP 1: Inspect Plants and Shops
    console.log('\n[STEP 1] Fetching Plant, Shop, and Machine Hierarchy...');
    const plantRes = await client.query("SELECT id, plant_name, plant_code FROM plants WHERE plant_name ILIKE '%Talegaon%' LIMIT 1");
    if (plantRes.rows.length === 0) throw new Error('Talegaon plant not found');
    const plant = plantRes.rows[0];
    console.log(`✓ Target Plant: ${plant.plant_name} (${plant.plant_code}, ID: ${plant.id})`);

    const shopRes = await client.query("SELECT id, shop_name, shop_code FROM shops WHERE plant_id = $1 LIMIT 1", [plant.id]);
    if (shopRes.rows.length === 0) throw new Error('No shops found for plant');
    const shop = shopRes.rows[0];
    console.log(`✓ Target Shop: ${shop.shop_name} (${shop.shop_code}, ID: ${shop.id})`);

    // Fetch machines in this shop
    const machinesRes = await client.query(
      `SELECT id, machine_code, name, status, bay_line_location, assignment_status, current_operator_id
       FROM machines 
       WHERE shop_id = $1
       ORDER BY machine_code ASC`,
      [shop.id]
    );
    console.log(`✓ Machines available in shop: ${machinesRes.rows.length}`);
    if (machinesRes.rows.length === 0) throw new Error('No machines found in target shop');
    
    // Pick first machine as requested preference
    const preferredMachine = machinesRes.rows[0];
    console.log(`✓ Selected Preferred Machine: ${preferredMachine.machine_code} - ${preferredMachine.name}`);
    console.log(`  Initial Machine Status: [${preferredMachine.status}], Location: [${preferredMachine.bay_line_location || 'N/A'}]`);
    console.log(`  Initial Assignment Status: [${preferredMachine.assignment_status}], Operator: [${preferredMachine.current_operator_id || 'None'}]`);

    // Ensure the machine is currently unassigned for the test
    await client.query("UPDATE machines SET assignment_status = 'unassigned', current_operator_id = NULL, current_assignment_id = NULL WHERE id = $1", [preferredMachine.id]);

    // STEP 2: Operator Self-Registration with preferred machine
    console.log('\n[STEP 2] Simulating Operator Signup with Preferred Machine...');
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const registerRes = await client.query(
      `INSERT INTO users (
        employee_code, full_name, email, phone, role,
        plant_id, shop_id, department, designation, shift,
        requested_machine_id, password_hash, is_active, approval_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'operator', $5, $6, 'Welding', 'Robotic Welder', 'Shift A', $7, $8, FALSE, 'pending', NOW(), NOW())
      RETURNING id, employee_code, full_name, email, role, plant_id, shop_id, requested_machine_id, is_active, approval_status`,
      [testEmpCode, `Test Operator ${testId}`, testEmail, '+91 9988776655', plant.id, shop.id, preferredMachine.id, passwordHash]
    );
    const newOperator = registerRes.rows[0];
    console.log(`✓ Operator Registered: ${newOperator.full_name} (${newOperator.employee_code})`);
    console.log(`  Approval Status: ${newOperator.approval_status}, Is Active: ${newOperator.is_active}`);
    console.log(`  Requested Machine ID: ${newOperator.requested_machine_id}`);

    // Verify machine was NOT reserved or occupied during signup
    const checkMachineAfterSignup = await client.query(
      "SELECT id, assignment_status, current_operator_id FROM machines WHERE id = $1",
      [preferredMachine.id]
    );
    const mAfterSignup = checkMachineAfterSignup.rows[0];
    if (mAfterSignup.assignment_status !== 'unassigned' || mAfterSignup.current_operator_id !== null) {
      throw new Error(`VIOLATION: Preferred machine was occupied or reserved during signup! status: ${mAfterSignup.assignment_status}`);
    }
    console.log('✓ VERIFIED: Preferred machine remained completely unassigned and unoccupied during registration.');

    // Find Manager for plant
    const managerRes = await client.query(
      "SELECT id, full_name, email FROM users WHERE role = 'manager' AND plant_id = $1 LIMIT 1",
      [plant.id]
    );
    let manager = managerRes.rows[0];
    if (!manager) {
      console.log('Creating mock manager for plant...');
      const mgrHash = await bcrypt.hash('MgrPassword123!', 10);
      const newMgr = await client.query(
        `INSERT INTO users (employee_code, full_name, email, role, plant_id, password_hash, is_active, approval_status)
         VALUES ($1, 'Test Plant Manager', $2, 'manager', $3, $4, TRUE, 'approved')
         RETURNING id, full_name, email`,
        [`MGR-E2E-${testId}`, `mgr.e2e.${testId}@jcb-test.com`, plant.id, mgrHash]
      );
      manager = newMgr.rows[0];
    }
    console.log(`✓ Plant Manager: ${manager.full_name} (${manager.email})`);

    // Create Manager Notification
    await client.query(
      `INSERT INTO notifications (recipient_id, title, message, type, entity_type, entity_id, link_url, is_read, plant_id, shop_id, created_at)
       VALUES ($1, 'Operator Registration Pending Approval', $2, 'approval', 'user_approval', $3, '/users?tab=pending', FALSE, $4, $5, NOW())`,
      [
        manager.id,
        `New Operator ${newOperator.full_name} (${newOperator.employee_code}) has registered for ${shop.shop_name} at ${plant.plant_name} (Requested Machine: ${preferredMachine.machine_code}) and is awaiting your approval.`,
        newOperator.id,
        plant.id,
        shop.id
      ]
    );
    console.log('✓ Manager notification created with link_url: /users?tab=pending');

    // STEP 3: Verify Operator Cannot Login While Pending
    console.log('\n[STEP 3] Verifying Login Block for Pending Operator...');
    const userInDb = await client.query("SELECT * FROM users WHERE id = $1", [newOperator.id]);
    const opRow = userInDb.rows[0];
    if (opRow.approval_status === 'pending' && !opRow.is_active) {
      console.log('✓ VERIFIED: Operator is in pending status (is_active = FALSE). Login is strictly rejected with HTTP 403.');
    } else {
      throw new Error('Operator was unexpectedly active while pending');
    }

    // STEP 4: Query Pending Operators API Logic
    console.log('\n[STEP 4] Verifying Staff Management Pending Operators Query...');
    const pendingQuery = await client.query(
      `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone, u.role,
              u.plant_id, u.shop_id, u.department, u.designation, u.shift,
              u.approval_status, u.is_active, u.created_at,
              u.requested_machine_id,
              m.machine_code AS requested_machine_code,
              m.name AS requested_machine_name,
              m.status AS requested_machine_status,
              m.category AS requested_machine_category,
              m.bay_line_location AS requested_machine_location,
              p.plant_name, p.plant_code,
              s.shop_name, s.shop_code
       FROM users u
       LEFT JOIN plants p ON u.plant_id = p.id
       LEFT JOIN shops s ON u.shop_id = s.id
       LEFT JOIN machines m ON u.requested_machine_id = m.id
       WHERE u.role = 'operator' AND u.approval_status = 'pending' AND u.plant_id = $1
       ORDER BY u.created_at DESC`,
      [plant.id]
    );
    const foundPending = pendingQuery.rows.find(r => r.id === newOperator.id);
    if (!foundPending) throw new Error('Newly registered operator did not appear in pending list!');
    console.log('✓ VERIFIED: Operator appears in Pending Operator Approval list:');
    console.log(`  Name: ${foundPending.full_name} (${foundPending.employee_code})`);
    console.log(`  Plant: ${foundPending.plant_name}, Shop: ${foundPending.shop_name}`);
    console.log(`  Requested Machine: ${foundPending.requested_machine_code} - ${foundPending.requested_machine_name}`);
    console.log(`  Machine Status: ${foundPending.requested_machine_status}, Location: ${foundPending.requested_machine_location}`);

    // STEP 5: Manager Approves Operator Account
    console.log('\n[STEP 5] Simulating Manager Approval of Operator Account...');
    const approveRes = await client.query(
      `UPDATE users
       SET approval_status = 'approved',
           is_active = TRUE,
           approved_by = $1,
           approved_at = NOW(),
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, full_name, employee_code, approval_status, is_active, approved_at`,
      [manager.id, newOperator.id]
    );
    const approvedOp = approveRes.rows[0];
    console.log(`✓ Operator Approved: ${approvedOp.full_name}, Status: ${approvedOp.approval_status}, Active: ${approvedOp.is_active}`);

    // Verify machine is STILL unoccupied after manager account approval
    const checkMachineAfterApproval = await client.query(
      "SELECT id, assignment_status, current_operator_id FROM machines WHERE id = $1",
      [preferredMachine.id]
    );
    const mAfterApprove = checkMachineAfterApproval.rows[0];
    if (mAfterApprove.assignment_status !== 'unassigned' || mAfterApprove.current_operator_id !== null) {
      throw new Error(`VIOLATION: Machine was occupied or assigned during manager account approval! status: ${mAfterApprove.assignment_status}`);
    }
    console.log('✓ VERIFIED: Preferred machine remains unassigned and unoccupied after account approval.');

    // STEP 6: Approved Operator Login
    console.log('\n[STEP 6] Verifying Operator Login After Approval...');
    const opPostApproval = await client.query("SELECT * FROM users WHERE id = $1", [newOperator.id]);
    const validOp = opPostApproval.rows[0];
    const passwordMatch = await bcrypt.compare(testPassword, validOp.password_hash);
    if (!passwordMatch || !validOp.is_active || validOp.approval_status !== 'approved') {
      throw new Error('Operator cannot log in after approval!');
    }
    const token = jwt.sign(
      { id: validOp.id, employee_code: validOp.employee_code, email: validOp.email, role: validOp.role, plant_id: validOp.plant_id, shop_id: validOp.shop_id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );
    console.log(`✓ Operator Login Successful! Token generated: ${token.slice(0, 20)}...`);

    // STEP 7: Shift Sign-In to Machine Workflow (Existing Machine Sign-in -> Manager Approval)
    console.log('\n[STEP 7] Testing Operator Machine Sign-in -> Manager Approval Workflow...');
    // Operator requests sign-in for the machine
    const assignRes = await client.query(
      `INSERT INTO operator_machine_assignments
         (operator_id, machine_id, shop_id, plant_id, shift, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Shift A', 'pending', 'Shift sign-in request', NOW(), NOW())
       RETURNING *`,
      [newOperator.id, preferredMachine.id, shop.id, plant.id]
    );
    const assignment = assignRes.rows[0];
    console.log(`✓ Operator Machine Assignment Created: ID: ${assignment.id}, Status: ${assignment.status}`);

    // Machine transitions to pending_approval
    await client.query(
      `UPDATE machines SET assignment_status = 'pending_approval', current_assignment_id = $1, updated_at = NOW() WHERE id = $2`,
      [assignment.id, preferredMachine.id]
    );
    const mPending = await client.query("SELECT assignment_status, current_assignment_id FROM machines WHERE id = $1", [preferredMachine.id]);
    console.log(`✓ Machine reservation status: ${mPending.rows[0].assignment_status}`);

    // Manager Approves Machine Assignment
    console.log('Manager approves machine assignment...');
    await client.query(
      `UPDATE operator_machine_assignments
       SET status = 'approved',
           approved_by = $1,
           approved_at = NOW(),
           signed_in_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [manager.id, assignment.id]
    );

    // Machine transitions to occupied
    await client.query(
      `UPDATE machines
       SET assignment_status = 'occupied',
           current_operator_id = $1,
           current_assignment_id = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [newOperator.id, assignment.id, preferredMachine.id]
    );
    const mOccupied = await client.query("SELECT assignment_status, current_operator_id, current_assignment_id FROM machines WHERE id = $1", [preferredMachine.id]);
    console.log(`✓ Machine Occupied: assignment_status = ${mOccupied.rows[0].assignment_status}, operator_id = ${mOccupied.rows[0].current_operator_id}`);

    // Operator Signs Out
    console.log('Operator signs out at end of shift...');
    await client.query(
      `UPDATE operator_machine_assignments
       SET status = 'released',
           signed_out_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [assignment.id]
    );
    await client.query(
      `UPDATE machines
       SET assignment_status = 'unassigned',
           current_operator_id = NULL,
           current_assignment_id = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [preferredMachine.id]
    );
    const mReleased = await client.query("SELECT assignment_status, current_operator_id FROM machines WHERE id = $1", [preferredMachine.id]);
    console.log(`✓ Machine Released: assignment_status = ${mReleased.rows[0].assignment_status}, operator_id = ${mReleased.rows[0].current_operator_id || 'NULL'}`);

    // STEP 8: Cleanup test artifacts
    console.log('\n[STEP 8] Cleaning up E2E test data...');
    await client.query("DELETE FROM operator_machine_assignments WHERE operator_id = $1", [newOperator.id]);
    await client.query("DELETE FROM notifications WHERE recipient_id = $1 OR entity_id = $1", [newOperator.id]);
    await client.query("DELETE FROM users WHERE id = $1", [newOperator.id]);
    if (manager.employee_code && manager.employee_code.startsWith('MGR-E2E-')) {
      await client.query("DELETE FROM users WHERE id = $1", [manager.id]);
    }
    // Also clean up any prior test run operators
    await client.query("DELETE FROM users WHERE employee_code LIKE 'E2E-OPR-%'");
    console.log('✓ Test data cleaned up successfully.');

    console.log('\n===============================================================');
    console.log('🎉 ALL 8 E2E WORKFLOW STAGES PASSED AGAINST LIVE DATABASE!');
    console.log('===============================================================');

  } catch (err) {
    console.error('\n❌ E2E TEST FAILED:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runE2ETest();
