# JCB Smart CMMS — Prioritized Development Roadmap
**Document ID:** `08-PRIORITIZED-DEVELOPMENT-ROADMAP.md`  
**Date:** November 4, 2026  
**Auditor Roles:** Senior Backend Architect, Technical Lead, QA Lead  
**Scope:** Remediation Architecture, Work Breakdown Structure (WBS), and Execution Sequencing  

---

## 1. Roadmap Architecture & Execution Strategy

To transition the JCB CMMS backend from its current prototype state to a secure, resilient enterprise platform, development must follow a **strict four-phase sequencing**:

```mermaid
flowchart TD
    subgraph "Phase 1: Security & Schema Stabilization (Immediate Blocker)"
        S1["Rotate DB Credentials & Purge Cleartext Fallbacks"] --> S2["Execute Migration 002: 6 Missing Tables & FK Indexes"]
        S2 --> S3["Remove Authentication Universal Backdoor"]
        S3 --> S4["Fix wo_parts_consumed Column Mismatch"]
        S4 --> S5["Attach Missing requireRoles Guards"]
    end

    subgraph "Phase 2: Data Integrity & Multi-Tenancy"
        T1["Convert Identifier Sequences to Native DB Sequences"] --> T2["Wrap Multi-Step Operations in BEGIN...COMMIT Transactions"]
        T2 --> T3["Implement Plant & Shop Multi-Tenant Query Scoping"]
        T3 --> T4["Fix Downtime Query Filter Ignored Parameters"]
    end

    subgraph "Phase 3: Core Endpoints & Validation"
        E1["Implement Zod Schema Validation Middleware"] --> E2["Implement Missing Detail Routes (WO, CMP, Parts)"]
        E2 --> E3["Implement Token Refresh & Logout Endpoints"]
        E3 --> E4["Implement Operator Digital Handover Sign-Off"]
    end

    subgraph "Phase 4: Automated Testing & CI/CD"
        Q1["Install Vitest & Supertest Test Infrastructure"] --> Q2["Configure Disposable Test Database Fixtures"]
        Q2 --> Q3["Implement End-to-End API Test Suites"]
    end

    Phase 1 --> Phase 2
    Phase 2 --> Phase 3
    Phase 3 --> Phase 4
```

---

## 2. Phase 1: Security & Schema Stabilization (Sprint 1 — Days 1–3)

**Objective:** Neutralize critical security vulnerabilities, align the database schema with codebase references, and eliminate runtime 500 crashes.

| Task ID | Item | Affected Files | Effort | Priority |
|---|---|---|---|---|
| **P1-01** | Rotate Supabase master password; purge all cleartext fallback connection strings. | `backend/src/config/db.ts`, `migrate.js`, `seed_rich_db.js` | 2h | **P0 (Critical)** |
| **P1-02** | Remove universal password backdoor (`password === 'password123'`) and in-memory mock fallback. | `backend/src/modules/auth/auth.controller.ts:75, 86-92` | 2h | **P0 (Critical)** |
| **P1-03** | Author and apply `002_missing_relations.sql` migration creating: `bays`, `production_lines`, `inspection_templates`, `inspection_records`, `notifications`, `audit_logs`. | `database/migrations/002_missing_relations.sql` | 4h | **P0 (Critical)** |
| **P1-04** | Fix column name in stock reservation (`quantity_installed`); remove `(Demo Mode)` error swallow. | `backend/src/modules/inventory/inventory.controller.ts:173, 185` | 2h | **P0 (Critical)** |
| **P1-05** | Attach missing `requireRoles` middleware across: work order assignment, verification, PR approvals, GRN inwarding, RDC dispatch, and PM generation. | `work-orders.routes.ts`, `procurement.routes.ts`, `rdc.routes.ts`, `pm.routes.ts` | 3h | **P0 (Critical)** |
| **P1-06** | Enforce startup check asserting `process.env.JWT_SECRET` is set; eliminate hardcoded fallback secrets. | `auth.middleware.ts:33`, `auth.controller.ts:6-7` | 1h | **P1 (High)** |

---

## 3. Phase 2: Data Integrity & Multi-Tenancy (Sprint 2 — Days 4–6)

**Objective:** Guarantee transaction atomicity, eliminate concurrency race conditions, and enforce multi-tenant plant isolation.

| Task ID | Item | Affected Files | Effort | Priority |
|---|---|---|---|---|
| **P2-01** | Implement PostgreSQL native sequences for formatted identifiers (`CMP-`, `WO-`, `PR-`, `RDC-`, `PM-`). | `database/migrations/003_sequences.sql`, all controllers | 4h | **P1 (High)** |
| **P2-02** | Refactor multi-step database mutations (work order creation, GRN inwarding, RDC creation) into explicit `BEGIN ... COMMIT` transaction blocks. | `work-orders.controller.ts`, `procurement.controller.ts`, `rdc.controller.ts` | 6h | **P1 (High)** |
| **P2-03** | Implement multi-tenant scoping utility injecting `AND plant_id = req.user.plant_id` on all read/write queries for non-admin users. | New `backend/src/utils/tenancy.ts`, all controllers | 6h | **P1 (High)** |
| **P2-04** | Fix `downtime.controller.ts` to actively apply `machine_id` and `shop_id` query filters in SQL clauses. | `backend/src/modules/downtime/downtime.controller.ts` | 2h | **P1 (High)** |
| **P2-05** | Add missing foreign key indexes across all 14 tables in Migration 002 to avoid sequential scans. | `database/migrations/002_missing_relations.sql` | 2h | **P1 (High)** |
| **P2-06** | Fix PM schedule advancement: advance `next_pm_date` upon work order closure, not upon generation. | `pm.controller.ts:124`, `work-orders.controller.ts:155` | 3h | **P1 (High)** |

---

## 4. Phase 3: Core Endpoints & Validation Layer (Sprint 3 — Days 7–10)

**Objective:** Implement missing endpoints, eliminate mock fallbacks, and enforce strict Zod schema validation.

| Task ID | Item | Affected Files | Effort | Priority |
|---|---|---|---|---|
| **P3-01** | Implement Zod request validation middleware and schemas for all endpoints. | New `backend/src/middlewares/validate.ts`, module `*.schema.ts` | 8h | **P1 (High)** |
| **P3-02** | Implement single-record detail endpoints: `GET /work-orders/:id`, `GET /breakdowns/:id`, `GET /inventory/:id`. | Controllers and route files | 6h | **P1 (High)** |
| **P3-03** | Implement token refresh endpoint (`POST /auth/refresh`) and logout endpoint (`POST /auth/logout`). | `auth.routes.ts`, `auth.controller.ts` | 4h | **P2 (Medium)** |
| **P3-04** | Implement operator digital handover sign-off endpoint (`POST /work-orders/:id/handover`). | `work-orders.routes.ts`, `work-orders.controller.ts` | 3h | **P2 (Medium)** |
| **P3-05** | Remove all error-swallowing catch blocks and mock fallbacks across `auth`, `machines`, and `reports`. | `auth.controller.ts`, `machines.controller.ts`, `reports.controller.ts` | 3h | **P2 (Medium)** |
| **P3-06** | Implement master CRUD for Plants and Shops (`POST/PUT/DELETE /org/plants`, `/org/shops`). | `org.routes.ts`, `org.controller.ts` | 4h | **P2 (Medium)** |

---

## 5. Phase 4: Automated Testing & CI/CD Pipeline (Sprint 4 — Days 11–14)

**Objective:** Establish 80%+ automated regression test coverage and automated integration pipelines.

| Task ID | Item | Affected Files | Effort | Priority |
|---|---|---|---|---|
| **P4-01** | Install and configure Vitest, Supertest, and test database runner. | `package.json`, `vitest.config.ts`, `tests/setup.ts` | 4h | **P1 (High)** |
| **P4-02** | Implement Unit & Integration Test Suite for Authentication & RBAC. | `tests/auth.test.ts` | 6h | **P1 (High)** |
| **P4-03** | Implement End-to-End Breakdown to Work Order Lifecycle Test Suite. | `tests/work-order-lifecycle.test.ts` | 8h | **P1 (High)** |
| **P4-04** | Implement Inventory Reservation, Stock Ledger, and Procurement Test Suite. | `tests/inventory-procurement.test.ts` | 6h | **P1 (High)** |
| **P4-05** | Configure GitHub Actions CI workflow executing linter, build, and test suites on pull requests. | `.github/workflows/backend-ci.yml` | 3h | **P2 (Medium)** |
