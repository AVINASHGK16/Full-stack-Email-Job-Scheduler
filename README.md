# Full-Stack Email Job Scheduler

A distributed, reliable, and idempotent email scheduling system built with **React 18**, **Node.js/Express**, **TypeScript**, **PostgreSQL (Prisma)**, **Redis**, **BullMQ**, and **Nodemailer (Ethereal SMTP)**.

---

## 🏗️ Architecture Overview

The system employs a queue-driven architecture utilizing BullMQ and Redis sorted sets for delayed execution instead of traditional polling cron jobs.

```
                ┌──────────────┐
                │   Browser    │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │   Frontend   │ (React 18 + Vite)
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Express API  │ (Authentication, Zod Validation, Transactions)
                └───┬──────┬───┘
                    │      │
                    ▼      ▼
               PostgreSQL  Redis (AOF Persistence)
               (Prisma)    │
                           ▼
                      BullMQ Queue (`email-scheduler`)
                           │
                           ▼
                      Email Worker Process
                           │
                           ▼
                      Ethereal / SMTP Transport
```

---

## 🌟 Key Features

1. **True Queue-Based Scheduling**:
   - Every recipient send is registered as a BullMQ delayed job in Redis using deterministic IDs (`email-${recipientId}`).
   - Jobs survive process restarts and server crashes.
2. **Distributed Atomic Rate Limiter**:
   - Enforces configurable hourly send limits per sender via atomic Lua scripts across all worker instances.
   - Throttled recipients remain `QUEUED` (never marked `FAILED`) and are automatically rescheduled for the next hourly window.
3. **Inter-Email Delay Staggering**:
   - Enforces minimum configurable delay between individual recipient sends (`startTime + index * delaySeconds`).
4. **Idempotency & Double-Send Protection**:
   - Pre-dispatch database check (`status === 'SENT'`) short-circuits any retried or duplicate BullMQ executions.
   - Unique constraints (`@@unique([campaignId, email])`) prevent duplicate database entries.
5. **Self-Healing Crash Recovery**:
   - `RecoveryService` verifies candidate records in PostgreSQL upon worker startup, detecting and re-enqueuing any orphaned or un-enqueued jobs.
6. **Multi-User Google OAuth 2.0 & Session Security**:
   - Passport.js Google OAuth with HTTP-only, secure, `SameSite=Lax` session cookies.
   - Strict server-side ownership enforcement across all sender, campaign, and recipient queries.
7. **Sender Management & SMTP Verification**:
   - Manage multiple SMTP sender configurations.
   - Dedicated SMTP verification test endpoint (`POST /senders/:id/verify`) with persisted database lifecycle badges (`VERIFIED`, `PENDING`, `FAILED`).
8. **Compose & File Import**:
   - Manual comma/newline-separated recipient entry with real-time malformed token detection.
   - Browser-side `.csv` and `.txt` file parsing with automatic case-insensitive deduplication.
   - Handles `201 Created` (full success) and `207 Multi-Status` (partial queue success with diagnostics).

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v20/v24)
- **Docker** & **Docker Compose**
- **Git**

### 2. Clone & Environment Setup
```bash
# Clone the repository
git clone https://github.com/AVINASHGK16/Full-stack-Email-Job-Scheduler.git
cd "Full-stack Email Job Scheduler"

# Copy environment template
cp .env.example .env
```

### 3. Start Infrastructure (PostgreSQL & Redis)
```bash
docker compose up -d
```

### 4. Install Dependencies & Initialize Database
```bash
# Install root, backend, and frontend dependencies
npm install
cd backend && npm install && npx prisma migrate deploy && cd ..
cd frontend && npm install && cd ..
```

### 5. Launch Development Servers
```bash
# Terminal 1: Backend API (Port 5000)
cd backend && npm run dev:api

# Terminal 2: Email Worker Process
cd backend && npm run dev:worker

# Terminal 3: Frontend Web Dashboard (Port 3000)
cd frontend && npm run dev
```

Navigate to `http://localhost:3000/login` to access the application.

---

## 🧪 Comprehensive Audit & Test Suite

The repository includes automated end-to-end verification suites in `backend/src/scripts/`:

```bash
# Run all audit test suites:
cd backend

# 1. Authentication & Cross-User Data Isolation Audit (16/16 Passed)
npx tsx src/scripts/test_auth_audit.ts

# 2. Sender Security & Lifecycle Audit (18/18 Passed)
npx tsx src/scripts/test_sender_security_audit.ts

# 3. Compose to Scheduler Staggered Delay Audit (16/16 Passed)
npx tsx src/scripts/test_compose_scheduler_e2e.ts

# 4. CSV/TXT Parsing & Deduplication Audit (20/20 Passed)
npx tsx src/scripts/test_csv_scheduler_e2e.ts

# 5. Server Restart Persistence Audit (14/14 Passed)
npx tsx src/scripts/test_restart_persistence_e2e.ts

# 6. Redis Restart & Data Loss Recovery Audit (6/6 Passed)
npx tsx src/scripts/test_redis_restart_recovery.ts

# 7. PostgreSQL Restart Resilience Audit (11/11 Passed)
npx tsx src/scripts/test_postgres_restart_audit.ts

# 8. Worker Multi-Hour Rate Limit Staggering Audit (12/12 Passed)
npx tsx src/scripts/test_ratelimit_worker_e2e.ts

# 9. Worker Failure & Retry Lifecycle Audit (15/15 Passed)
npx tsx src/scripts/test_worker_failure_audit.ts

# 10. Partial Queue Failure HTTP 207 Multi-Status Audit (16/16 Passed)
npx tsx src/scripts/test_partial_queue_failure_e2e.ts
```

---

## 📋 Requirement Compliance Matrix

| Requirement | Implementation Mechanism | Status |
|---|---|:---:|
| **API Email Scheduling** | `POST /campaigns` creates PostgreSQL campaign and schedules BullMQ delayed jobs. | ✅ |
| **PostgreSQL Persistence** | PostgreSQL models (`User`, `Sender`, `Campaign`, `Recipient`) via Prisma ORM. | ✅ |
| **BullMQ Delayed Jobs** | Deterministic `email-${recipient.id}` jobs delayed by `scheduledAt - now`. | ✅ |
| **No Cron Scheduler** | Pure event/delayed-queue-driven BullMQ scheduler, zero polling loops. | ✅ |
| **Multiple Senders** | Dedicated `Sender` model with encrypted SMTP credentials per user; Compose dropdown. | ✅ |
| **Ethereal SMTP** | Nodemailer transporter with dynamic per-sender credentials & preview URLs. | ✅ |
| **Restart Persistence** | BullMQ Redis AOF persistence + startup `RecoveryService` for orphaned jobs. | ✅ |
| **Worker Concurrency** | Configurable `WORKER_CONCURRENCY` in `.env` passed to BullMQ Worker. | ✅ |
| **Minimum Delay** | Inter-email interval calculation (`scheduledAt = startTime + index * delaySeconds`). | ✅ |
| **Hourly Rate Limit** | Atomic Lua script in Redis (`ratelimit:sender:<id>:hour:<bucket>`). Throttled stays `QUEUED`. | ✅ |
| **Distributed Rate Limiting** | Shared Redis state across all worker instances. | ✅ |
| **Retry Mechanism** | BullMQ exponential backoff retry; intermediate states stay `QUEUED`, final transitions to `FAILED`. | ✅ |
| **Idempotency** | Pre-send `status === 'SENT'` guard + deterministic job IDs + DB unique constraints. | ✅* |
| **Google OAuth 2.0** | Passport.js Google OAuth flow, session serialization, `/auth/me`, `/auth/logout`. | ✅ |
| **Dashboard Layout** | Header with user info & refresh, responsive sidebar navigation, clean UI. | ✅ |
| **Scheduled Page** | `GET /campaigns/scheduled` displaying pending/queued recipient cards with metadata. | ✅ |
| **Sent Page** | `GET /campaigns/sent` displaying delivered email records with timestamps. | ✅ |
| **CSV / TXT Import** | Browser-side `FileReader` parsing, regex extraction, automatic deduplication. | ✅ |
| **Recipient Validation** | Multi-recipient token parsing (comma/newline), malformed address warnings. | ✅ |
| **Sender Verification** | `POST /senders/:id/verify` testing SMTP credentials via `transporter.verify()`. | ✅ |
| **Error Handling** | Comprehensive handling for 201 Created, 207 Multi-Status, 400, 401, 403, 404, 409, 500. | ✅ |
| **Production Configuration** | Startup Zod schema validation, `.env` git-ignored, production cookie security. | ✅ |
| **Security** | Zero credential leakage, SQL injection immunity via Prisma, HTTP-only signed cookies. | ✅ |
| **Documentation** | Architecture diagram, setup instructions, test scripts, compliance matrix. | ✅ |

*\* Note on Idempotency: While deterministic job IDs and database status guards protect against duplicate sends during normal execution, retries, and restarts, true exactly-once external email delivery cannot be mathematically guaranteed across the narrow non-transactional crash window between SMTP acknowledgment and PostgreSQL commit (standard distributed systems at-least-once delivery boundary).*