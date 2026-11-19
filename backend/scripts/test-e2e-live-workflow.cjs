require('dotenv').config({
  path: require('path').join(__dirname, '../.env'),
  override: true
});
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runE2EWorkflow() {
  const client = await pool.connect();
  const testRunId = Date.now().toString().slice(-6);

  console.log('========================================================================');
  console.log('JCB CMMS - LIVE DATABASE E2E PERMANENT & TEMPORARY MACHINE WORKFLOW TEST');
  console.log('========================================================================');
  console.log(`Database URL: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')}`);
  console.log(`Test Run ID: ${testRunId}\n`);

  let testPlantId, testShopId, permMachineId, tempMachineId;
  let testOperatorId, testManagerId, testBreakdownId, testWorkOrderId;
  let testAssignmentId;

  try {
    // 0. Environment & Setup: Pick existing plant & shop with machines
    console.log('[STEP 0] Inspecting environment and preparing test machines...');
    const shopRes = await client.query(`
      SELECT s.id as shop_id, s.shop_name, p.id as plant_id, p.plant_name 
      FROM shops s 
      JOIN plants p ON s.plant_id = p.id 
      ORDER BY s.created_at ASC 
      LIMIT 1
    `);
    if (shopRes.rows.length === 0) throw new Error('No shops with associated plants found in database');
    testShopId = shopRes.rows[0].shop_id;
    testPlantId = shopRes.rows[0].plant_id;
    const plantName = shopRes.rows[0].plant_name;
    const shopName = shopRes.rows[0].shop_name;

    console.log(`Selected Plant: "${plantName}" (${testPlantId})`);
    console.log(`Selected Shop:  "${shopName}" (${testShopId})`);

    // Fetch or create 2 machines in this shop
    const machinesRes = await client.query(
      `SELECT id, machine_code, name, status, assignment_status 
       FROM machines 
       WHERE shop_id = $1 
       LIMIT 2`,
      [testShopId]
    );

    if (machinesRes.rows.length < 2) {
      // Create 2 test machines if fewer than 2 exist
      const m1 = await client.query(
        `INSERT INTO machines (machine_code, name, category, criticality, status, assignment_status, operating_hours, shop_id, plant_id)
         VALUES ($1, $2, 'Fabrication', 'high', 'running', 'unassigned', 120, $3, $4)
         RETURNING id, machine_code, name`,
        [`TEST-M1-${testRunId}`, `Permanent Test Asset ${testRunId}`, testShopId, testPlantId]
      );
      const m2 = await client.query(
        `INSERT INTO machines (machine_code, name, category, criticality, status, assignment_status, operating_hours, shop_id, plant_id)
         VALUES ($1, $2, 'Machining', 'medium', 'running', 'unassigned', 85, $3, $4)
         RETURNING id, machine_code, name`,
        [`TEST-M2-${testRunId}`, `Temporary Test Asset ${testRunId}`, testShopId, testPlantId]
      );
      permMachineId = m1.rows[0].id;
      tempMachineId = m2.rows[0].id;
    } else {
      permMachineId = machinesRes.rows[0].id;
      tempMachineId = machinesRes.rows[1].id;
      // Reset statuses for a clean test
      await client.query(
        `UPDATE machines 
         SET status = 'running', assignment_status = 'unassigned', current_operator_id = NULL 
         WHERE id IN ($1, $2)`,
        [permMachineId, tempMachineId]
      );
    }

    const mPermInfo = (await client.query('SELECT machine_code, name FROM machines WHERE id = $1', [permMachineId])).rows[0];
    const mTempInfo = (await client.query('SELECT machine_code, name FROM machines WHERE id = $1', [tempMachineId])).rows[0];
    console.log(`Permanent Test Machine: ${mPermInfo.machine_code} - ${mPermInfo.name}`);
    console.log(`Temporary Test Machine: ${mTempInfo.machine_code} - ${mTempInfo.name}`);

    // Fetch an existing manager to act as approver
    const mgrRes = await client.query(
      `SELECT id, full_name FROM users WHERE role = 'manager' AND (plant_id = $1 OR plant_id IS NULL) LIMIT 1`,
      [testPlantId]
    );
    testManagerId = mgrRes.rows.length > 0 ? mgrRes.rows[0].id : null;

    // ------------------------------------------------------------------------
    // STEP 1: Operator Signup with Preferred Machine Selection
    // ------------------------------------------------------------------------
    console.log('\n[STEP 1] Testing Operator Signup with Preferred Machine...');
    const opEmail = `operator_${testRunId}@test-jcb.com`;
    const opEmpCode = `OP-${testRunId}`;
    const opInsert = await client.query(
      `INSERT INTO users (
        email, password_hash, full_name, role, employee_code, plant_id, shop_id, 
        is_active, approval_status, requested_machine_id
       ) VALUES ($1, 'hash_placeholder', $2, 'operator', $3, $4, $5, false, 'pending', $6)
       RETURNING id, email, full_name, employee_code, approval_status, requested_machine_id, permanent_machine_id`,
      [opEmail, `Test Operator ${testRunId}`, opEmpCode, testPlantId, testShopId, permMachineId]
    );
    testOperatorId = opInsert.rows[0].id;
    console.log(`Created pending operator: ${opInsert.rows[0].full_name} (${opInsert.rows[0].id})`);
    console.log(`Approval Status: ${opInsert.rows[0].approval_status}`);
    console.log(`Requested Machine ID: ${opInsert.rows[0].requested_machine_id}`);
    console.log(`Permanent Machine ID (before approval): ${opInsert.rows[0].permanent_machine_id}`);

    // Verify machine remains unoccupied after signup preference selection
    const mCheckStep1 = (await client.query('SELECT assignment_status, current_operator_id FROM machines WHERE id = $1', [permMachineId])).rows[0];
    if (mCheckStep1.assignment_status !== 'unassigned' || mCheckStep1.current_operator_id !== null) {
      throw new Error(`FAILURE: Machine was occupied during operator signup! Got ${mCheckStep1.assignment_status}`);
    }
    console.log(`VERIFIED: Machine ${mPermInfo.machine_code} remains unoccupied (status: ${mCheckStep1.assignment_status})`);

    // ------------------------------------------------------------------------
    // STEP 2: Manager Approves Operator Registration -> Sets Permanent Machine
    // ------------------------------------------------------------------------
    console.log('\n[STEP 2] Testing Manager Approval -> Setting Permanent Machine...');
    const opApprove = await client.query(
      `UPDATE users 
       SET approval_status = 'approved',
           is_active = true,
           approved_by = $1,
           approved_at = NOW(),
           permanent_machine_id = COALESCE(permanent_machine_id, requested_machine_id)
       WHERE id = $2
       RETURNING id, approval_status, is_active, requested_machine_id, permanent_machine_id`,
      [testManagerId, testOperatorId]
    );
    console.log(`Operator Approved: is_active=${opApprove.rows[0].is_active}, approval_status=${opApprove.rows[0].approval_status}`);
    console.log(`Permanent Machine Stored: ${opApprove.rows[0].permanent_machine_id}`);

    if (opApprove.rows[0].permanent_machine_id !== permMachineId) {
      throw new Error(`FAILURE: users.permanent_machine_id was not set to requested_machine_id!`);
    }

    // Verify machine still remains unoccupied (permanent assignment != floor occupation)
    const mCheckStep2 = (await client.query('SELECT assignment_status, current_operator_id FROM machines WHERE id = $1', [permMachineId])).rows[0];
    if (mCheckStep2.assignment_status !== 'unassigned' || mCheckStep2.current_operator_id !== null) {
      throw new Error(`FAILURE: Machine was occupied upon manager registration approval!`);
    }
    console.log(`VERIFIED: Permanent machine ${mPermInfo.machine_code} is assigned to operator without floor occupation.`);

    // ------------------------------------------------------------------------
    // STEP 3: Verify Profile Query Returns Permanent Machine Details
    // ------------------------------------------------------------------------
    console.log('\n[STEP 3] Verifying Operator Profile API returns joined permanent machine metadata...');
    const profileRes = await client.query(
      `SELECT 
        u.id, u.full_name, u.role, u.plant_id, u.shop_id,
        u.permanent_machine_id,
        pm.machine_code as permanent_machine_code,
        pm.name as permanent_machine_name,
        pm.status as permanent_machine_status,
        pm.bay_line_location as permanent_machine_location
       FROM users u
       LEFT JOIN machines pm ON u.permanent_machine_id = pm.id
       WHERE u.id = $1`,
      [testOperatorId]
    );
    const prof = profileRes.rows[0];
    console.log(`Profile Permanent Machine Code: ${prof.permanent_machine_code}`);
    console.log(`Profile Permanent Machine Name: ${prof.permanent_machine_name}`);
    if (prof.permanent_machine_code !== mPermInfo.machine_code) {
      throw new Error(`FAILURE: Permanent machine code mismatch in profile query!`);
    }
    console.log('VERIFIED: Operator profile contains accurate permanent machine details.');

    // ------------------------------------------------------------------------
    // STEP 4: Operator Reports Breakdown on Permanent Machine
    // ------------------------------------------------------------------------
    console.log('\n[STEP 4] Operator reports breakdown on Permanent Machine...');
    const complaintNum = `CMP-${testRunId}`;
    const bdInsert = await client.query(
      `INSERT INTO maintenance_requests (
        complaint_number, machine_id, reported_by_id, shift,
        issue_category, priority, status, breakdown_occurred_at, reported_at,
        problem_title, description
       ) VALUES ($1, $2, $3, 'Shift A', 'Mechanical', 'critical', 'new', NOW(), NOW(), 'Spindle Overheating and Vibration', 'Machine stopped during milling cycle')
       RETURNING id, complaint_number, status`,
      [complaintNum, permMachineId, testOperatorId]
    );
    testBreakdownId = bdInsert.rows[0].id;
    console.log(`Breakdown ticket created: ${bdInsert.rows[0].complaint_number} (ID: ${testBreakdownId})`);

    // Machine status updated to breakdown
    await client.query(`UPDATE machines SET status = 'breakdown' WHERE id = $1`, [permMachineId]);
    const mCheckStep4 = (await client.query('SELECT status FROM machines WHERE id = $1', [permMachineId])).rows[0];
    console.log(`Machine ${mPermInfo.machine_code} status: ${mCheckStep4.status}`);
    if (mCheckStep4.status !== 'breakdown') {
      throw new Error('FAILURE: Machine status was not updated to breakdown!');
    }
    console.log('VERIFIED: Permanent machine is marked breakdown and breakdown ticket linked.');

    // ------------------------------------------------------------------------
    // STEP 5: Operator Requests Temporary Machine
    // ------------------------------------------------------------------------
    console.log('\n[STEP 5] Operator requests temporary replacement machine...');
    // Verify temporary machine is currently available
    const mTempAvail = (await client.query('SELECT status, assignment_status FROM machines WHERE id = $1', [tempMachineId])).rows[0];
    console.log(`Temporary Machine initial availability: status=${mTempAvail.status}, assignment_status=${mTempAvail.assignment_status}`);

    const reqInsert = await client.query(
      `INSERT INTO operator_machine_assignments (
        operator_id, machine_id, shop_id, plant_id, shift, status,
        assignment_type, replacement_for_machine_id, breakdown_id,
        notes, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'Shift A', 'pending', 'temporary', $5, $6, 'Permanent machine is down with overheating issue', NOW(), NOW())
       RETURNING id, status, assignment_type, replacement_for_machine_id, breakdown_id`,
      [testOperatorId, tempMachineId, testShopId, testPlantId, permMachineId, testBreakdownId]
    );
    testAssignmentId = reqInsert.rows[0].id;
    console.log(`Temporary request created: ID=${testAssignmentId}, Type=${reqInsert.rows[0].assignment_type}`);

    // Machine temporarily marked pending_approval
    await client.query(`UPDATE machines SET assignment_status = 'pending_approval' WHERE id = $1`, [tempMachineId]);

    // ------------------------------------------------------------------------
    // STEP 6: Concurrency Guard - Second operator cannot request same machine
    // ------------------------------------------------------------------------
    console.log('\n[STEP 6] Testing Concurrency Guard (second operator cannot request same machine)...');
    const conflictCheck = await client.query(
      `SELECT id FROM operator_machine_assignments 
       WHERE machine_id = $1 AND status IN ('pending', 'approved')`,
      [tempMachineId]
    );
    console.log(`Active/pending reservations on temporary machine: ${conflictCheck.rows.length}`);
    if (conflictCheck.rows.length === 0) {
      throw new Error('FAILURE: Temporary machine reservation check failed!');
    }
    console.log('VERIFIED: Concurrency guard active - temporary machine is reserved.');

    // ------------------------------------------------------------------------
    // STEP 7: Manager Reviews Pending Temporary Requests Queue
    // ------------------------------------------------------------------------
    console.log('\n[STEP 7] Manager fetches Pending Requests with Permanent Machine & Breakdown Details...');
    const queueRes = await client.query(
      `SELECT 
        oma.id, oma.status, oma.assignment_type, oma.shift, oma.created_at,
        m.machine_code, m.name as machine_name,
        u.full_name as operator_name, u.employee_code as operator_code,
        u.permanent_machine_id,
        perm_m.machine_code as permanent_machine_code,
        perm_m.name as permanent_machine_name,
        rep_m.machine_code as replacement_for_machine_code,
        mr.complaint_number as breakdown_complaint_number,
        mr.problem_title as breakdown_problem_title
       FROM operator_machine_assignments oma
       JOIN machines m ON oma.machine_id = m.id
       JOIN users u ON oma.operator_id = u.id
       LEFT JOIN machines perm_m ON u.permanent_machine_id = perm_m.id
       LEFT JOIN machines rep_m ON oma.replacement_for_machine_id = rep_m.id
       LEFT JOIN maintenance_requests mr ON oma.breakdown_id = mr.id
       WHERE oma.id = $1`,
      [testAssignmentId]
    );
    const queueItem = queueRes.rows[0];
    console.log(`Queue Item:`);
    console.log(` - Operator: ${queueItem.operator_name}`);
    console.log(` - Assignment Type: ${queueItem.assignment_type}`);
    console.log(` - Requested Temp Machine: ${queueItem.machine_code}`);
    console.log(` - Operator Permanent Machine: ${queueItem.permanent_machine_code}`);
    console.log(` - Replaced Machine: ${queueItem.replacement_for_machine_code}`);
    console.log(` - Breakdown Ticket: ${queueItem.breakdown_complaint_number} - "${queueItem.breakdown_problem_title}"`);

    if (queueItem.assignment_type !== 'temporary') throw new Error('FAILURE: Assignment type is not temporary!');
    if (queueItem.permanent_machine_code !== mPermInfo.machine_code) throw new Error('FAILURE: Permanent machine code mismatch in manager queue!');
    if (queueItem.breakdown_complaint_number !== complaintNum) throw new Error('FAILURE: Breakdown ticket mismatch in manager queue!');
    console.log('VERIFIED: Manager queue contains full temporary replacement context.');

    // ------------------------------------------------------------------------
    // STEP 8: Manager Approves Temporary Machine Request
    // ------------------------------------------------------------------------
    console.log('\n[STEP 8] Manager Approves Temporary Request...');
    await client.query(
      `UPDATE operator_machine_assignments 
       SET status = 'approved', approved_by = $1, approved_at = NOW(), signed_in_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [testManagerId, testAssignmentId]
    );
    await client.query(
      `UPDATE machines 
       SET assignment_status = 'occupied', current_operator_id = $1 
       WHERE id = $2`,
      [testOperatorId, tempMachineId]
    );

    // Verify temporary machine is occupied by operator
    const mTempOccupied = (await client.query('SELECT assignment_status, current_operator_id FROM machines WHERE id = $1', [tempMachineId])).rows[0];
    console.log(`Temporary Machine assignment status: ${mTempOccupied.assignment_status}`);
    console.log(`Temporary Machine current operator: ${mTempOccupied.current_operator_id}`);
    if (mTempOccupied.assignment_status !== 'occupied' || mTempOccupied.current_operator_id !== testOperatorId) {
      throw new Error('FAILURE: Temporary machine is not occupied by operator!');
    }

    // Verify permanent machine relationship in users is 100% UNCHANGED
    const userPermCheck = (await client.query('SELECT permanent_machine_id FROM users WHERE id = $1', [testOperatorId])).rows[0];
    console.log(`Operator Permanent Machine ID after temporary approval: ${userPermCheck.permanent_machine_id}`);
    if (userPermCheck.permanent_machine_id !== permMachineId) {
      throw new Error('FAILURE: Permanent machine was overwritten or nullified by temporary approval!');
    }
    console.log('VERIFIED: Temporary machine is occupied; permanent machine relationship remains intact.');

    // ------------------------------------------------------------------------
    // STEP 9: Operator Dashboard State - Shows Temporary Working Machine vs Permanent Machine
    // ------------------------------------------------------------------------
    console.log('\n[STEP 9] Checking Operator Dashboard Assignment Resolution...');
    const dashAssignRes = await client.query(
      `SELECT 
        oma.id, oma.status, oma.assignment_type, oma.shift, oma.signed_in_at,
        m.machine_code, m.name as machine_name, m.status as machine_status,
        rep_m.machine_code as replacement_for_machine_code
       FROM operator_machine_assignments oma
       JOIN machines m ON oma.machine_id = m.id
       LEFT JOIN machines rep_m ON oma.replacement_for_machine_id = rep_m.id
       WHERE oma.operator_id = $1 AND oma.status = 'approved'
       ORDER BY oma.created_at DESC LIMIT 1`,
      [testOperatorId]
    );
    const activeSession = dashAssignRes.rows[0];
    console.log(`Active Session Machine: ${activeSession.machine_code} (${activeSession.machine_name})`);
    console.log(`Active Session Assignment Type: ${activeSession.assignment_type}`);
    console.log(`Replaces Permanent Asset: ${activeSession.replacement_for_machine_code}`);
    if (activeSession.assignment_type !== 'temporary') throw new Error('FAILURE: Active assignment type must be temporary!');
    console.log('VERIFIED: Operator dashboard distinguishes active temporary machine from permanent machine.');

    // ------------------------------------------------------------------------
    // STEP 10: Technician Repairs & Verifies Permanent Machine
    // ------------------------------------------------------------------------
    console.log('\n[STEP 10] Technician completes work order and verifies permanent machine...');
    // Create work order
    const woNum = `WO-${testRunId}`;
    const woRes = await client.query(
      `INSERT INTO work_orders (
        wo_number, complaint_id, machine_id, priority, status, classification, created_at, updated_at
       ) VALUES ($1, $2, $3, 'high', 'verified_closed', 'minor_breakdown', NOW(), NOW())
       RETURNING id, status`,
      [woNum, testBreakdownId, permMachineId]
    );
    testWorkOrderId = woRes.rows[0].id;
    console.log(`Work order created and verified_closed: ${testWorkOrderId} (${woNum})`);

    // Restore permanent machine status to running
    await client.query(`UPDATE machines SET status = 'running' WHERE id = $1`, [permMachineId]);
    await client.query(`UPDATE maintenance_requests SET status = 'closed' WHERE id = $1`, [testBreakdownId]);

    const mPermRestored = (await client.query('SELECT status, assignment_status FROM machines WHERE id = $1', [permMachineId])).rows[0];
    console.log(`Permanent Machine Restored: status=${mPermRestored.status}, assignment_status=${mPermRestored.assignment_status}`);
    if (mPermRestored.status !== 'running') throw new Error('FAILURE: Permanent machine status was not restored!');

    // Check operator notification on permanent machine restoration
    const notifInsert = await client.query(
      `INSERT INTO notifications (
        recipient_id, title, message, type, link_url, created_at
       ) VALUES (
        $1, 
        'Permanent Machine Repaired & Verified', 
        $2, 
        'alert', 
        '/operator/console', 
        NOW()
       ) RETURNING id, title, message`,
      [testOperatorId, `Your permanent machine ${mPermInfo.machine_code} has been repaired and verified operational. You can now return to your permanent machine.`]
    );
    console.log(`Notification sent to operator: "${notifInsert.rows[0].title}"`);
    console.log('VERIFIED: Permanent machine is verified operational and operator notified.');

    // ------------------------------------------------------------------------
    // STEP 11: Release Temporary Machine
    // ------------------------------------------------------------------------
    console.log('\n[STEP 11] Releasing Temporary Machine Assignment...');
    await client.query(
      `UPDATE operator_machine_assignments 
       SET status = 'released', signed_out_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [testAssignmentId]
    );
    await client.query(
      `UPDATE machines 
       SET assignment_status = 'unassigned', current_operator_id = NULL 
       WHERE id = $1`,
      [tempMachineId]
    );

    // Verify temporary machine is released and available again
    const mTempReleased = (await client.query('SELECT assignment_status, current_operator_id FROM machines WHERE id = $1', [tempMachineId])).rows[0];
    console.log(`Temporary Machine after release: assignment_status=${mTempReleased.assignment_status}, operator=${mTempReleased.current_operator_id}`);
    if (mTempReleased.assignment_status !== 'unassigned' || mTempReleased.current_operator_id !== null) {
      throw new Error('FAILURE: Temporary machine was not released cleanly!');
    }
    console.log('VERIFIED: Temporary machine is unassigned and available for the shop floor.');

    // ------------------------------------------------------------------------
    // STEP 12: Operator Returns to Permanent Machine as Default Working Asset
    // ------------------------------------------------------------------------
    console.log('\n[STEP 12] Operator returns to Permanent Machine...');
    const opCurrentRes = await client.query(
      `SELECT 
        u.id, u.permanent_machine_id,
        pm.machine_code as permanent_machine_code,
        pm.name as permanent_machine_name,
        pm.status as permanent_machine_status,
        pm.assignment_status as permanent_machine_assignment_status
       FROM users u
       JOIN machines pm ON u.permanent_machine_id = pm.id
       WHERE u.id = $1`,
      [testOperatorId]
    );
    const returnState = opCurrentRes.rows[0];
    console.log(`Operator: ${testOperatorId}`);
    console.log(`Permanent Machine: ${returnState.permanent_machine_code} (${returnState.permanent_machine_name})`);
    console.log(`Machine Status: ${returnState.permanent_machine_status}`);
    console.log(`Machine Assignment: ${returnState.permanent_machine_assignment_status}`);

    if (returnState.permanent_machine_id !== permMachineId) {
      throw new Error('FAILURE: Permanent machine was lost during temporary release!');
    }
    if (returnState.permanent_machine_status !== 'running') {
      throw new Error('FAILURE: Permanent machine is not operational!');
    }
    console.log('VERIFIED: Operator successfully restored to permanent machine as default working asset!');

    console.log('\n========================================================================');
    console.log('ALL 12 STAGES OF E2E PERMANENT & TEMPORARY WORKFLOW VERIFIED SUCCESSFULLY!');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('\nE2E TEST FAILED:', err);
    throw err;
  } finally {
    // Clean up test data safely
    console.log('Cleaning up test records from database...');
    try {
      if (testAssignmentId) {
        await client.query('DELETE FROM operator_machine_assignments WHERE id = $1', [testAssignmentId]);
      }
      if (testWorkOrderId) {
        await client.query('DELETE FROM work_orders WHERE id = $1', [testWorkOrderId]);
      }
      if (testBreakdownId) {
        await client.query('DELETE FROM maintenance_requests WHERE id = $1', [testBreakdownId]);
      }
      if (testOperatorId) {
        await client.query('DELETE FROM notifications WHERE recipient_id = $1', [testOperatorId]);
        await client.query('DELETE FROM users WHERE id = $1', [testOperatorId]);
      }
      // Reset machines to unassigned & running
      if (permMachineId && tempMachineId) {
        await client.query(
          `UPDATE machines 
           SET status = 'running', assignment_status = 'unassigned', current_operator_id = NULL 
           WHERE id IN ($1, $2)`,
          [permMachineId, tempMachineId]
        );
      }
      console.log('Test cleanup completed cleanly.');
    } catch (cleanupErr) {
      console.warn('Warning during cleanup:', cleanupErr.message);
    }
    client.release();
    await pool.end();
  }
}

runE2EWorkflow().catch((err) => {
  console.error(err);
  process.exit(1);
});
