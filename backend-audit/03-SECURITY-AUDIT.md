# JCB Smart CMMS — Application Security & Vulnerability Audit
**Document ID:** `03-SECURITY-AUDIT.md`  
**Date:** November 4, 2026  
**Auditor Roles:** Senior Application Security Engineer, Penetration Tester, Backend Architect  
**Scope:** Source Code Security Review, Authentication & Authorization Auditing, Sensitive Data Protection  
**Compliance Standard:** OWASP Top 10 API Security Risks (2023)  

---

## 1. Security Posture Executive Summary

The security posture of the JCB CMMS backend exhibits **critical, exploitable vulnerabilities** in authentication, access control, and credential management. 

Most critically:
1. Cleartext administrative database credentials are hardcoded into production configuration and migration files.
2. An intentional or testing universal backdoor exists in the login controller that permits access to any account using a static password.
3. Critical business operations (work order verification, purchase requisition approvals, stock inwarding, gate pass generation) are completely unauthenticated by role-based guards.
4. No multi-tenancy scoping exists to prevent cross-plant horizontal privilege escalation (IDOR).

All actual credentials, secrets, and connection strings have been strictly **redacted** in this document.

---

## 2. Vulnerability Findings Register

### Vulnerability Index:
- **SEC-01 (CRITICAL):** Hardcoded Cleartext Database Credentials in Source Code
- **SEC-02 (CRITICAL):** Hardcoded Universal Authentication Bypass Backdoor
- **SEC-03 (CRITICAL):** Broken Object-Level Authorization on Work Order Verification (Technician Self-Approval)
- **SEC-04 (HIGH):** Missing Role-Based Authorization on State Mutations (BOLA/BAC)
- **SEC-05 (HIGH):** Insecure Direct Object References (IDOR) & Zero Multi-Tenant Scoping
- **SEC-06 (HIGH):** Hardcoded Cryptographic Fallback Secrets
- **SEC-07 (MEDIUM):** Concurrency Race Condition in Identifier Sequence Generation
- **SEC-08 (MEDIUM):** Permissive Cross-Origin Resource Sharing (CORS) with Credentials
- **SEC-09 (MEDIUM):** Missing Atomicity and Transactions on Financial/Inventory Mutations
- **SEC-10 (LOW):** Absence of API Rate Limiting on Authentication Endpoints
- **SEC-11 (LOW):** Information Leakage via Stack Traces and Error Silencing

---

## 3. Detailed Vulnerability Reports

### SEC-01: Hardcoded Cleartext Database Credentials in Source Code
- **Severity:** `CRITICAL` (CVSS v3.1 Score: 9.8)
- **CWE:** CWE-798: Use of Hard-coded Credentials
- **OWASP API:** API2:2023 Broken Authentication
- **Affected Files & Exact Lines:**
  - [`backend/src/config/db.ts`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/config/db.ts#L24-L26) (Lines 24–26):
    ```typescript
    // Default Supabase PostgreSQL connection string with password [REDACTED] URL-encoded (%40)
    const DEFAULT_SUPABASE_DB_URL = 'postgresql://postgres:[REDACTED]@db.enarwtsppwwwldvtmoee.supabase.co:5432/postgres';
    export const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_SUPABASE_DB_URL;
    ```
  - [`backend/scripts/migrate.js`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/scripts/migrate.js#L5) (Line 5):
    ```javascript
    const DATABASE_URL = 'postgresql://postgres:[REDACTED]@db.enarwtsppwwwldvtmoee.supabase.co:5432/postgres';
    ```
  - [`backend/scripts/seed_rich_db.js`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/scripts/seed_rich_db.js#L4) (Line 4):
    ```javascript
    const DATABASE_URL = 'postgresql://postgres:[REDACTED]@db.enarwtsppwwwldvtmoee.supabase.co:5432/postgres';
    ```
- **Technical Explanation:**
  The direct administrative database URI containing the `postgres` username and cleartext master password is committed directly to the git repository. Anyone with read access to the repository has unrestricted read, write, alter, and drop privileges on the live database.
- **Recommended Remediation:**
  1. Immediately rotate the database password in the Supabase control panel.
  2. Invalidate existing connection pools.
  3. Remove the hardcoded fallback URI from all three files.
  4. Ensure `DATABASE_URL` is strictly loaded from the `.env` file and enforce application termination on startup if `process.env.DATABASE_URL` is undefined.

---

### SEC-02: Hardcoded Universal Authentication Bypass Backdoor
- **Severity:** `CRITICAL` (CVSS v3.1 Score: 9.8)
- **CWE:** CWE-287: Improper Authentication
- **OWASP API:** API2:2023 Broken Authentication
- **Affected File & Exact Lines:**
  - [`backend/src/modules/auth/auth.controller.ts`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/auth/auth.controller.ts#L75) (Line 75) & (Lines 86–92):
    ```typescript
    // Line 75:
    const isMatch = await bcrypt.compare(password, dbUser.password_hash);
    const isValid = isMatch || password === 'password123';
    
    // Lines 86-92:
    if (!user) {
      const lowerId = identifier.toLowerCase();
      const fallback = SEEDED_FALLBACK_USERS[lowerId];
      if (fallback && password === 'password123') {
        user = fallback;
      }
    }
    ```
- **Technical Explanation:**
  Line 75 contains an explicit logical OR condition that evaluates to `true` whenever the string `'password123'` is submitted, completely bypassing bcrypt hash validation. Any attacker possessing the email or employee code of any user (including the Enterprise Administrator `admin@jcb.com`) can log in and obtain a valid administrative JWT. Furthermore, lines 86–92 authenticate against an in-memory dictionary if the database is unreachable, issuing tokens with zero credential validation.
- **Recommended Remediation:**
  1. Delete line 75's fallback: enforce `if (!isMatch) { return res.status(401)... }`.
  2. Completely remove the `SEEDED_FALLBACK_USERS` in-memory bypass dictionary.
  3. Require proper password reset workflows rather than testing backdoors.

---

### SEC-03: Broken Object-Level Authorization on Work Order Verification
- **Severity:** `CRITICAL` (CVSS v3.1 Score: 9.1)
- **CWE:** CWE-306: Missing Authentication for Critical Function / CWE-862: Missing Authorization
- **OWASP API:** API1:2023 Broken Object Level Authorization / API5:2023 Broken Function Level Authorization
- **Affected File & Exact Line:**
  - [`backend/src/modules/work-orders/work-orders.routes.ts`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/work-orders/work-orders.routes.ts#L17) (Line 17):
    ```typescript
    router.post('/:id/verify', verifyAndCloseWorkOrder);
    ```
- **Technical Explanation:**
  The endpoint `POST /api/v1/work-orders/:id/verify` accepts any valid JWT token regardless of user role. A technician assigned to repair a critical hydraulic press or robotic arm can submit an approval request to this endpoint and verify their own work order without manager oversight, marking the machine as `'verified_closed'` and `'running'`.
- **Recommended Remediation:**
  Attach strict RBAC middleware:
  ```typescript
  router.post('/:id/verify', requireRoles('manager', 'admin'), verifyAndCloseWorkOrder);
  ```

---

### SEC-04: Missing Role-Based Authorization on State Mutations
- **Severity:** `HIGH` (CVSS v3.1 Score: 8.5)
- **CWE:** CWE-862: Missing Authorization
- **OWASP API:** API5:2023 Broken Function Level Authorization
- **Affected Files & Exact Lines:**
  - [`work-orders.routes.ts:15`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/work-orders/work-orders.routes.ts#L15): `POST /assign` lacks `requireRoles('manager', 'admin')`. Operators can assign work orders.
  - [`work-orders.routes.ts:16`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/work-orders/work-orders.routes.ts#L16): `POST /:id/milestone` lacks role restrictions. Any user can falsify technician repair progress.
  - [`procurement.routes.ts:14`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/procurement/procurement.routes.ts#L14): `POST /pr` lacks role restrictions. Operators can initiate purchase requisitions.
  - [`procurement.routes.ts:16`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/procurement/procurement.routes.ts#L16): `PUT /pr/:id` lacks role restrictions. Technicians or operators can approve PRs, select vendors, and assign PO numbers.
  - [`procurement.routes.ts:17`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/procurement/procurement.routes.ts#L17): `POST /pr/:id/grn` lacks role restrictions. Any user can trigger physical inventory increments.
  - [`rdc.routes.ts:14`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/rdc/rdc.routes.ts#L14): `POST /` lacks role restrictions.
  - [`rdc.routes.ts:16`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/rdc/rdc.routes.ts#L16): `PUT /:id/approve` lacks role restrictions. Any user can authorize equipment dispatch and generate Gate Passes.
  - [`pm.routes.ts:9, 11`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/pm/pm.routes.ts#L9): `POST /plans` and `POST /generate-due` lack role restrictions.
- **Technical Explanation:**
  The `requireRoles` middleware exists and functions correctly when attached, but developers omitted it from almost all mutation routes outside of user and machine creation.
- **Recommended Remediation:**
  Systematically apply `requireRoles(...)` to every state-mutating route across all modules.

---

### SEC-05: Insecure Direct Object References (IDOR) & Zero Multi-Tenant Scoping
- **Severity:** `HIGH` (CVSS v3.1 Score: 8.1)
- **CWE:** CWE-639: Authorization Bypass Through User-Controlled Key
- **OWASP API:** API1:2023 Broken Object Level Authorization
- **Affected Files:** All controller files in `backend/src/modules/`.
- **Technical Explanation:**
  Although the JWT token includes `plant_id` and `shop_id`, not a single query in the application filters data based on the requesting user's plant or shop. For example:
  - In `breakdowns.controller.ts:113-136`, `getBreakdowns` executes `SELECT * FROM maintenance_requests WHERE 1=1`. A manager stationed in Ballabgarh receives breakdown complaints from Pune and Jaipur.
  - In `work-orders.controller.ts:5-75`, a manager in Ballabgarh can assign a technician in Pune to a machine located in Jaipur.
- **Recommended Remediation:**
  Implement a tenant-scoping query utility or middleware that automatically appends `AND plant_id = $x` to queries unless the requesting user has the enterprise `admin` role.

---

### SEC-06: Hardcoded Cryptographic Fallback Secrets
- **Severity:** `HIGH` (CVSS v3.1 Score: 7.5)
- **CWE:** CWE-321: Use of Hard-coded Cryptographic Key
- **OWASP API:** API2:2023 Broken Authentication
- **Affected Files & Exact Lines:**
  - [`backend/src/middlewares/auth.middleware.ts`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/middlewares/auth.middleware.ts#L33) (Line 33):
    ```typescript
    const secret = process.env.JWT_SECRET || 'jcb_enterprise_cmms_jwt_secret_key_2026_super_secure';
    ```
  - [`backend/src/modules/auth/auth.controller.ts`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/auth/auth.controller.ts#L6-L7) (Lines 6–7):
    ```typescript
    const JWT_SECRET = process.env.JWT_SECRET || 'jcb_enterprise_cmms_jwt_secret_key_2026_super_secure';
    const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'jcb_enterprise_cmms_refresh_token_secret_key_2026';
    ```
  - [`backend/.env.example`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/.env.example#L7-L10) (Lines 7–10): Contains identical secret keys.
- **Technical Explanation:**
  If the application is deployed into an environment where `JWT_SECRET` is not explicitly declared, the application falls back to a public, predictable secret, enabling trivial token forgery.
- **Recommended Remediation:**
  Remove fallback strings. Assert that `process.env.JWT_SECRET` is defined at server boot, exiting immediately if missing.

---

### SEC-07: Concurrency Race Condition in Identifier Sequence Generation
- **Severity:** `MEDIUM` (CVSS v3.1 Score: 6.5)
- **CWE:** CWE-362: Concurrent Execution using Shared Resource with Improper Synchronization
- **Affected Files & Exact Lines:**
  - `breakdowns.controller.ts:50-52` (`CMP-YYYY-XXXXX`)
  - `work-orders.controller.ts:25-27` (`WO-YYYY-XXXXX`)
  - `procurement.controller.ts:24-26` (`PR-YYYY-XXXXX`)
  - `rdc.controller.ts:26-28` (`RDC-YYYY-XXXXX`)
  - `pm.controller.ts:21-23` (`PM-YYYY-XXXX`)
- **Technical Explanation:**
  The application generates formatted sequential reference numbers using `SELECT COUNT(*) FROM <table>` followed by `COUNT + 1`. Under concurrent user activity (e.g. multiple operators reporting breakdowns at shift turnover), simultaneous requests calculate the identical sequence integer, resulting in duplicate key violations and failed transactions.
- **Recommended Remediation:**
  Create native PostgreSQL sequences (`CREATE SEQUENCE seq_complaint_num...`) or compute sequence values inside an atomic database trigger.

---

### SEC-08: Permissive CORS Configuration with Credentials
- **Severity:** `MEDIUM` (CVSS v3.1 Score: 6.5)
- **CWE:** CWE-942: Permissive Cross-Domain Policy with Untrusted Domains
- **Affected Files & Exact Lines:**
  - [`backend/src/app.ts:24-27`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/app.ts#L24-L27):
    ```typescript
    app.use(cors({ origin: '*', credentials: true }));
    ```
  - [`backend/src/server.ts:12-16`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/server.ts#L12-L16):
    ```typescript
    export const io = new SocketIOServer(server, { cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] } });
    ```
- **Technical Explanation:**
  Setting `origin: '*'` in combination with `credentials: true` violates standard browser security specifications and allows any untrusted web domain visited by an authenticated technician to execute authenticated API calls via ambient credentials.
- **Recommended Remediation:**
  Configure a whitelist of trusted frontend origins from `process.env.CORS_ALLOWED_ORIGINS`.

---

### SEC-09: Missing Atomicity and Transactions on Financial/Inventory Mutations
- **Severity:** `MEDIUM` (CVSS v3.1 Score: 6.2)
- **CWE:** CWE-943: Improper Neutralization of Special Elements in Data Query Logic
- **Affected Files & Exact Lines:**
  - `inventory.controller.ts:148-185`: Stock reservation executes `SELECT FOR UPDATE` without an active transaction, rendering row locking inert.
  - `procurement.controller.ts:124-177`: GRN stock receipt executes four sequential `UPDATE` and `INSERT` queries outside of a transaction block.
- **Technical Explanation:**
  If a network partition or database constraint failure occurs midway through GRN processing, physical inventory is incremented but the purchase requisition is not marked received, leading to physical/digital inventory discrepancies.
- **Recommended Remediation:**
  Wrap multi-step database mutations inside `client.query('BEGIN') ... client.query('COMMIT')` blocks with automatic rollback on error.

---

### SEC-10: Absence of API Rate Limiting on Authentication Endpoints
- **Severity:** `LOW` (CVSS v3.1 Score: 3.7)
- **CWE:** CWE-307: Improper Restriction of Excessive Authentication Attempts
- **Affected File:** [`backend/src/app.ts`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/app.ts) / [`auth.routes.ts`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/auth/auth.routes.ts)
- **Technical Explanation:**
  The `POST /api/v1/auth/login` endpoint does not apply any IP or account-level rate limiting, leaving the service vulnerable to automated credential stuffing and brute-force attacks.
- **Recommended Remediation:**
  Implement `express-rate-limit` middleware limiting login attempts to 5 requests per minute per IP.

---

### SEC-11: Information Leakage via Stack Traces and Error Silencing
- **Severity:** `LOW` (CVSS v3.1 Score: 3.3)
- **CWE:** CWE-209: Generation of Error Message Containing Sensitive Information
- **Affected File & Exact Lines:**
  - [`backend/src/middlewares/error.middleware.ts:17`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/middlewares/error.middleware.ts#L17):
    ```typescript
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    ```
- **Technical Explanation:**
  When `NODE_ENV` is set to development (or if omitted), full stack traces exposing file system paths and library internals are returned to the client. Conversely, multiple controllers catch errors and return fake success responses, masking database anomalies.
- **Recommended Remediation:**
  Log stack traces server-side only; return standardized, non-revealing error payloads to the client.
