# JCB Smart CMMS — Architecture Audit Report
**Document ID:** `01-ARCHITECTURE-REPORT.md`  
**Date:** November 4, 2026  
**Auditor Roles:** Senior Backend Architect, Database Architect, Application Security Engineer, QA Automation Engineer  
**Scope:** Read-Only Source Code Analysis, Module Layout, Technology Stack, and Runtime Topography  
**Repository Location:** `backend/`  

---

## 1. Executive Architecture Summary

The JCB Smart Machine Maintenance Management System (CMMS) backend is an enterprise Node.js/TypeScript REST API and real-time Socket.IO gateway designed to manage industrial manufacturing assets across multiple heavy engineering production facilities.

The codebase implements a **flat, controller-heavy Express architecture** without service or repository abstraction layers. While 14 business modules are mounted in the HTTP router, significant architectural shortcomings exist:
- **No Domain Service or Repository Layer:** Business logic, data transformation, HTTP response formatting, and raw SQL queries are directly coupled within single controller handler functions.
- **Unused Validation Layer:** While `zod` is installed in `backend/package.json`, it is not imported or used anywhere in the codebase.
- **Silent Exception Silencing:** Multiple controllers implement `try/catch` blocks that swallow database errors and return hardcoded mock/demo data, masking schema mismatches.
- **Zero Automated Testing:** No test frameworks, test scripts, or test files exist in the repository.

---

## 2. Technology Stack & Runtime Configuration

### 2.1 Runtime & Dependencies (from `backend/package.json`)

| Package / Tool | Version | Purpose | Architectural Assessment |
|---|---|---|---|
| `node` | v22.17.0 (Current) | Runtime Environment | Current Active LTS. |
| `typescript` | `^5.7.3` | Language Compiler | Target ES2022, CommonJS module resolution. |
| `express` | `^4.21.2` | Web Framework | Mature, standard REST routing. |
| `pg` | `^8.13.3` | PostgreSQL Client | Direct client connection pool (`pg.Pool`). |
| `@supabase/supabase-js` | `^2.49.1` | Supabase Cloud SDK | Instantiated in `db.ts`, but raw SQL (`pg.Pool`) is used for all queries. |
| `socket.io` | `^4.8.1` | WebSockets Gateway | Real-time event dispatching for work orders and breakdowns. |
| `bcryptjs` | `^2.4.3` | Password Hashing | Used for hashing, but bypassed by backdoor code. |
| `jsonwebtoken` | `^9.0.2` | Token Authentication | JWT signing and verification. |
| `cors` | `^2.8.5` | Cross-Origin Sharing | Wildcard configuration with credentials enabled. |
| `dotenv` | `^16.4.7` | Env Configuration | Loads environment variables into `process.env`. |
| `zod` | `^3.24.2` | Schema Validation | **Dead dependency.** Declared in dependencies, never imported. |
| `ts-node-dev` | `^2.0.0` | Dev Transpilation | Used for rapid development in `npm run dev`. |

### 2.2 TypeScript Configuration (`backend/tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "rootDir": "./src",
    "outDir": "./dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```
**Compilation Observation:** Statically compiling via `tsc --noEmit` exits with code 0. Because queries are constructed as raw strings and parameters use `any`, TypeScript is incapable of detecting missing database tables or mismatched column names at build time.

---

## 3. Directory Structure & Codebase Topography

```
backend/
├── .env                              # Active environment configuration
├── .env.example                      # Sample configuration (contains hardcoded fallback secrets)
├── package.json                      # Backend dependencies and scripts
├── tsconfig.json                     # TypeScript compilation settings
├── scripts/
│   ├── migrate.js                    # Node.js script to run 001_initial_schema.sql
│   └── seed_rich_db.js               # Seed script populating enterprise demonstration data
└── src/
    ├── app.ts                        # Express app initialization & route registration
    ├── server.ts                     # HTTP server and Socket.IO initialization
    ├── config/
    │   ├── db.ts                     # pg.Pool connection and Supabase client
    │   └── migrate.ts                # TypeScript migration runner
    ├── middlewares/
    │   ├── auth.middleware.ts        # JWT verification middleware
    │   ├── error.middleware.ts       # Global Express error handler
    │   └── rbac.middleware.ts        # Role-based access control guard
    └── modules/
        ├── audit/                    # audit.routes.ts, audit.controller.ts
        ├── auth/                     # auth.routes.ts, auth.controller.ts
        ├── breakdowns/               # breakdowns.routes.ts, breakdowns.controller.ts
        ├── downtime/                 # downtime.routes.ts, downtime.controller.ts
        ├── inspections/              # inspections.routes.ts, inspections.controller.ts
        ├── inventory/                # inventory.routes.ts, inventory.controller.ts
        ├── machines/                 # machines.routes.ts, machines.controller.ts
        ├── notifications/            # notifications.routes.ts, notifications.controller.ts
        ├── org/                      # org.routes.ts, org.controller.ts
        ├── pm/                       # pm.routes.ts, pm.controller.ts
        ├── procurement/              # procurement.routes.ts, procurement.controller.ts
        ├── rdc/                      # rdc.routes.ts, rdc.controller.ts
        ├── reports/                  # reports.routes.ts, reports.controller.ts
        └── work-orders/              # work-orders.routes.ts, work-orders.controller.ts
```

---

## 4. Entry Point & Server Bootstrap

### 4.1 Server Lifecycle (`backend/src/server.ts`)
1. Imports `http`, `dotenv`, `SocketIOServer`, and `app`.
2. Invokes `dotenv.config()`.
3. Creates HTTP server: `const server = http.createServer(app);`.
4. Initializes Socket.IO with permissive CORS:
   ```typescript
   export const io = new SocketIOServer(server, {
     cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
   });
   ```
5. Binds `connection` and `disconnect` loggers.
6. Starts listening on `PORT` (default 5000).

### 4.2 Application Configuration (`backend/src/app.ts`)
1. Instantiates `app: Application = express()`.
2. Applies standard middleware:
   - `cors({ origin: '*', credentials: true })`
   - `express.json({ limit: '15mb' })`
   - `express.urlencoded({ extended: true, limit: '15mb' })`
3. Registers root diagnostic endpoints:
   - `GET /health` — Reports service health, uptime, and timestamp.
   - `GET /api/v1` — Returns JSON metadata listing all 14 modules.
4. Mounts 14 module routers under `/api/v1/<module>`.
5. Attaches centralized `errorHandler` as terminal middleware.

---

## 5. Architectural Layer Analysis

```mermaid
flowchart TD
    Client["Client (Web / Mobile / API Consumer)"]
    
    subgraph "Express Pipeline (backend/src/app.ts)"
        CORS["CORS & BodyParsers"]
        AuthMW["auth.middleware.ts (JWT Verify)"]
        RBACMW["rbac.middleware.ts (Role Check)"]
        Router["Module Router (*.routes.ts)"]
        Ctrl["Controller Function (*.controller.ts)"]
        ErrMW["error.middleware.ts (Global Catcher)"]
    end
    
    subgraph "Persistence Layer (backend/src/config/db.ts)"
        PGPool["pg.Pool (Direct PostgreSQL Connection)"]
        SupaSDK["@supabase/supabase-js (Unused Client)"]
    end
    
    subgraph "Database (Supabase PostgreSQL 15+)"
        LiveTables["14 Live Tables"]
        MissingTables["6 Missing Referenced Tables"]
    end
    
    Client --> CORS --> Router
    Router --> AuthMW --> RBACMW --> Ctrl
    Ctrl --> PGPool --> LiveTables
    Ctrl -.->|Fails (500 Error)| PGPool -.-> MissingTables
    Ctrl -.->|Unhandled Error| ErrMW
    Ctrl --> Client
```

### 5.1 Layer Responsibilities & Deficiencies

1. **Routes Layer (`*.routes.ts`):**
   - Configures URL path patterns and attaches middleware.
   - **Flaw:** Multiple state-mutating endpoints (e.g. work order assignment, verification, PR approval, GRN inwarding, RDC gate pass dispatch) omit `requireRoles`, leaving them unguarded.

2. **Controller Layer (`*.controller.ts`):**
   - Directly extracts HTTP parameters (`req.body`, `req.params`, `req.query`).
   - Executes ad-hoc input presence checks (`if (!field)`).
   - Writes and executes raw SQL queries directly against `pg.Pool`.
   - Formats and sends HTTP responses.
   - **Flaw:** High coupling and zero separation of concerns. No reusable domain logic or DTOs exist.

3. **Service Layer:**
   - **Completely Missing.** No service classes or functions exist. Business logic cannot be tested in isolation from the Express HTTP lifecycle.

4. **Repository Layer:**
   - **Completely Missing.** Data queries are hardcoded directly inside controllers. There is no centralized data access layer or ORM abstraction.

5. **Utilities / Helpers Layer:**
   - **Completely Missing.** Functions for identifier sequence generation, date calculations, and pagination formatting are duplicated redundantly across multiple controllers.

---

## 6. Middleware Architecture

### 6.1 `authenticateJWT` (`backend/src/middlewares/auth.middleware.ts`)
- Extracts `Authorization: Bearer <token>`.
- Decodes token using `process.env.JWT_SECRET || 'jcb_enterprise_cmms_jwt_secret_key_2026_super_secure'`.
- Decorates `req.user` with `AuthenticatedUser`:
  - `id: string`
  - `employee_code: string`
  - `email: string`
  - `role: string`
  - `plant_id?: string`
  - `shop_id?: string`
- **Defects:**
  - Hardcoded fallback secret allows token forgery if environment variables are missing.
  - No verification of `is_active` against database on request; deactivated users retain valid access until token expires.

### 6.2 `requireRoles` (`backend/src/middlewares/rbac.middleware.ts`)
- Compares `req.user.role` against `...allowedRoles`.
- Returns `401 Unauthorized` if `req.user` is undefined.
- Returns `403 Forbidden` if user's role is not in `allowedRoles`.
- **Defects:**
  - Not applied to several critical operational endpoints.
  - Checks role only; does not provide plant/shop multi-tenancy isolation.

### 6.3 `errorHandler` (`backend/src/middlewares/error.middleware.ts`)
- Standard Express 4-parameter error handler `(err, req, res, next)`.
- Returns JSON payload: `{ success: false, message: ... }`.
- Appends `stack` trace when `NODE_ENV === 'development'`.
- **Defects:**
  - Does not distinguish between database constraint violations (23505, 23503), client validation errors (400), and internal server crashes (500).

---

## 7. Database Connection Configuration (`backend/src/config/db.ts`)

- Instantiates `pg.Pool` with `ssl: { rejectUnauthorized: false }`.
- Sets `DATABASE_URL` with a hardcoded fallback string containing cleartext credentials:
  ```typescript
  // Line 25-26
  const DEFAULT_SUPABASE_DB_URL = 'postgresql://postgres:REDACTED@db.enarwtsppwwwldvtmoee.supabase.co:5432/postgres';
  export const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_SUPABASE_DB_URL;
  ```
- Exports helper `query(text: string, params?: any[])`:
  - Executes `pool.query(text, params)`.
  - Logs execution duration in development mode.
- Instantiates a Supabase JavaScript client:
  ```typescript
  // Lines 13-22
  export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || 'dummy_key_for_init', ...
  );
  ```
  **Note:** The `supabase` client is never used for data queries in any controller; all modules query PostgreSQL via `query()`.

---

## 8. Available NPM Scripts & Build Artifacts

### 8.1 Backend `package.json`
```json
"scripts": {
  "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js"
}
```
- `npm run dev`: Transpiles on the fly without strict type checking (`--transpile-only`).
- `npm run build`: Compiles TypeScript into CommonJS JavaScript in `dist/`.
- `npm start`: Runs production build from `dist/server.js`.
- **Missing Scripts:** No `test`, `test:watch`, `lint`, `migrate`, or `seed` scripts are defined in `backend/package.json`.

### 8.2 Untracked File in Repository
An anomalous, untracked file named `backend/pool.end())` exists in the backend root directory. It appears to be an errant file created by a previous terminal execution. Per read-only audit rules, it has been documented and preserved without modification.

---

## 9. Architectural Gap Analysis Summary

1. **Architecture Level:** The backend is currently a prototype-grade monolithic Express application. It lacks structural separation into Domain, Service, and Repository layers.
2. **Type Safety & Data Integrity:** TypeScript provides build-time syntax checking, but database operations are completely untyped raw SQL strings. Column mismatches and missing relations fail only at runtime.
3. **Resilience & Fallbacks:** Fallback logic returning mock data in `auth`, `machines`, `inventory`, and `reports` conceals database failures during ad-hoc manual testing.
4. **Modularity Assessment:** While the folder structure is organized into 14 distinct modules, cross-cutting concerns (authentication, tenant scoping, transaction management, error handling) are implemented inconsistently.
