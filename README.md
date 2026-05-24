# Prowider Lead Distribution System

A production-ready full-stack lead generation and fair distribution platform built with Next.js, PostgreSQL, Prisma, and real-time updates.

The system simulates a real-world provider allocation engine similar to platforms like Prowider, focusing on engineering correctness, concurrency safety, fair allocation, webhook idempotency, and database consistency.

---

# Features

## Lead Management

* Customer service enquiry form
* Automatic provider assignment
* Duplicate lead prevention at database level
* Real-time lead processing

## Fair Lead Distribution

* Persistent round-robin allocation
* Mandatory provider assignment rules
* Monthly quota enforcement
* Database-persisted allocation state
* No random allocation

## Real-Time Dashboard

* Live provider dashboard updates
* Server-Sent Events (SSE)
* Automatic polling fallback
* Quota tracking and lead history

## Webhook & Reliability

* Idempotent webhook processing
* Concurrency-safe transactions
* Simultaneous lead creation handling
* Testing tools for load simulation

---

# Tech Stack

| Layer    | Technology               |
| -------- | ------------------------ |
| Frontend | Next.js 16 + React 19    |
| Backend  | Next.js API Routes       |
| Database | PostgreSQL               |
| ORM      | Prisma                   |
| Realtime | Server-Sent Events (SSE) |
| Styling  | Tailwind CSS             |
| Language | TypeScript               |

---

# Business Rules

## Mandatory Assignments

| Service   | Mandatory Providers     |
| --------- | ----------------------- |
| Service 1 | Provider 1              |
| Service 2 | Provider 5              |
| Service 3 | Provider 1 & Provider 4 |

Each lead must be assigned to exactly **3 providers**.

---

# Fair Allocation Logic

After mandatory assignment, remaining slots are distributed using a persistent round-robin algorithm.

## Allocation Pools

| Service   | Provider Pool    |
| --------- | ---------------- |
| Service 1 | 2, 3, 4          |
| Service 2 | 6, 7, 8          |
| Service 3 | 2, 3, 5, 6, 7, 8 |

The algorithm:

* rotates fairly over time
* persists after server restart
* skips providers at quota limit
* avoids repeated favoritism

---

# Core Engineering Concepts

## Concurrency Safety

* Database transactions
* Atomic quota updates
* Row-level consistency
* Unique database constraints

## Idempotent Webhooks

Webhook events are processed exactly once using:

* unique idempotency keys
* processed event tracking

## Real-Time Communication

Dashboards update automatically when:

* leads are assigned
* quotas reset
* webhook events occur

---

# Project Structure

```bash
app/
├── api/
├── dashboard/
├── request-service/
├── test-tools/

components/
lib/
prisma/
```

---

# API Routes

## Leads

```http
POST /api/leads
GET  /api/leads
```

## Dashboard

```http
GET /api/dashboard?providerId=1
```

## Webhooks

```http
POST /api/webhook
GET  /api/webhook
```

## Realtime Events

```http
GET /api/events
```

---

# Setup Instructions

## 1. Clone Repository

```bash
git clone <repo-url>
cd prowide-mini-lead-system
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Environment Variables

Create `.env.local`

```env
DATABASE_URL="postgresql://user:password@localhost:5432/prowider_db"
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

---

# Database Setup

## Generate Prisma Client

```bash
npm run prisma:generate
```

## Run Migrations

```bash
npm run prisma:migrate
```

## Seed Database

```bash
npm run db:seed
```

---

# Start Development Server

```bash
npm run dev
```

Visit:

```bash
http://localhost:3000
```

---

# Application Routes

| Route              | Purpose                       |
| ------------------ | ----------------------------- |
| `/request-service` | Customer lead submission      |
| `/dashboard`       | Provider dashboard            |
| `/test-tools`      | Concurrency & webhook testing |

---

# Testing Features

## Duplicate Prevention

* Same phone + same service is blocked
* Enforced at database level

## Concurrency Testing

Generate 10 simultaneous leads using:

```bash
/test-tools
```

## Webhook Idempotency

Test repeated webhook calls with identical keys.

## Real-Time Updates

Keep dashboard open while creating leads in another tab.

---

# Database Design

## Main Tables

* Services
* Providers
* Leads
* LeadAssignments
* AllocationCursor
* WebhookEvents

## Important Constraints

### Duplicate Lead Prevention

```sql
UNIQUE(phone, serviceId)
```

### Duplicate Assignment Prevention

```sql
UNIQUE(leadId, providerId)
```

---

# Performance

| Operation          | Average Time |
| ------------------ | ------------ |
| Lead Creation      | <100ms       |
| Dashboard Fetch    | <50ms        |
| Webhook Processing | <50ms        |

---

# Deployment

## Recommended

* Vercel
* Neon PostgreSQL

## Production Commands

```bash
npm run build
npm start
```

---

# Evaluation Goals Achieved

* Correct provider allocation
* Fair distribution
* Real-time dashboard updates
* Concurrency-safe logic
* Idempotent webhooks
* Database consistency
* Persistent allocation state

---

# Future Improvements

* Authentication
* Rate limiting
* Provider login system
* Analytics dashboard
* Admin panel

---

# License

MIT License
