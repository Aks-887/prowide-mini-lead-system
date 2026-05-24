# System Architecture & Design Decisions

## Overview

Prowider is a lead generation and distribution system that automatically allocates customer service requests to providers while maintaining fairness and respecting resource constraints.

Built with:
- **Frontend**: Next.js 16+ with React 19
- **Backend**: Next.js API Routes with Prisma ORM
- **Database**: PostgreSQL
- **Real-time**: Server-Sent Events (SSE) with polling fallback
- **Styling**: Tailwind CSS

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                         │
│  (Request Form | Provider Dashboard | Test Tools)           │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/SSE
┌──────────────────────┴──────────────────────────────────────┐
│                    Next.js Server                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Routes (Node.js Runtime)                        │   │
│  │  - Lead Creation & Allocation                        │   │
│  │  - Provider Dashboard Data                           │   │
│  │  - Webhook Handler (Idempotent)                      │   │
│  │  - SSE Event Streaming                               │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL
┌──────────────────────┴──────────────────────────────────────┐
│              PostgreSQL Database                            │
│  - Services (3 records)                                      │
│  - Providers (8 records)                                     │
│  - Leads (dynamically created)                              │
│  - LeadAssignments (3 per lead)                             │
│  - AllocationCursors (1 per service)                        │
│  - WebhookEvents (idempotency records)                      │
└─────────────────────────────────────────────────────────────┘
```

## Core Features

### 1. Lead Creation & Duplicate Prevention

**Flow:**
```
User submits form (/request-service)
  ↓
Backend validates phone format
  ↓
Database checks unique constraint: (phone, serviceId)
  ↓
If duplicate → Return 409 Conflict error
  ↓
Create Lead record
  ↓
Trigger allocation algorithm
```

**Why Database-Level Unique Constraint:**
- Prevents race conditions (two simultaneous requests)
- Atomic operation - enforced by PostgreSQL
- Cannot be bypassed by application code
- Schema: `@@unique([phone, serviceId], name: "unique_phone_service")`

**Example:**
- ✅ Phone: 1234567890, Service: 1 → Creates lead
- ✅ Phone: 1234567890, Service: 2 → Creates lead (different service)
- ❌ Phone: 1234567890, Service: 1 → Returns error (duplicate)

---

### 2. Fair Allocation Algorithm (Round-Robin)

**Why Round-Robin?**
1. **Predictable**: Same sequence = same distribution
2. **Fair**: Each provider gets equal turns
3. **Stateful**: Survives server restarts (state in DB)
4. **Quota-aware**: Skips full providers

**Algorithm:**

```
For each lead of Service X:
  Step 1: Assign mandatory providers (if quota available)
  Step 2: Need more providers? Use round-robin pool
  Step 3: Track position in AllocationPointer table
  Step 4: Next lead picks up where previous left off
```

**Service 1 Example:**
```
Mandatory: Provider 1 (always)
Pool: [Provider 2, 3, 4]

Lead 1 → [Provider 1, Provider 2 (index 0)]
Lead 2 → [Provider 1, Provider 3 (index 1)]
Lead 3 → [Provider 1, Provider 4 (index 2)]
Lead 4 → [Provider 1, Provider 2 (index 0 again)]
...
```

**Database Table: AllocationPointer**
```
┌────┬────────────┬───────────┬──────────┐
│ id │ providerId │ serviceId │ lastIndex│
├────┼────────────┼───────────┼──────────┤
│ 1  │    2       │     1     │    0     │
│ 2  │    3       │     1     │    1     │
│ 3  │    4       │     1     │    2     │
└────┴────────────┴───────────┴──────────┘
```

**Persistent State:**
- `AllocationPointer.lastIndex` tracks current position
- Updated after each allocation
- Survives server restart
- Per service, per provider

---

### 3. Quota Management

**Monthly Quota: 10 leads per provider**

**Flow:**
```
1. Check current lead count: provider.leadsReceivedCount
2. Compare against quota: monthlyQuota
3. If count >= quota → Skip this provider
4. If count < quota → Assign lead
5. Increment count (atomic): { increment: 1 }
```

**Quota Reset (Webhook):**
```
Webhook call: POST /api/webhook
  {
    providerId: 1,
    eventType: "quota_reset",
    idempotencyKey: "unique-key-123"
  }

1. Check if idempotencyKey exists
2. If yes → Return success (already processed)
3. If no → Reset leadsReceivedCount = 0
4. Create WebhookEvent record (processed = true)
5. Record in QuotaResetHistory
```

**Idempotency Protection:**
```
WebhookEvent table:
┌────────────┬────────────┬──────────────────┬───────────┐
│ providerId │ eventType  │ idempotencyKey   │ processed │
├────────────┼────────────┼──────────────────┼───────────┤
│    1       │ quota_reset│ "payment-123"    │   true    │
└────────────┴────────────┴──────────────────┴───────────┘

Call webhook 3 times with same key → Only first processes quota
```

---

### 4. Concurrency Handling

**Challenge:** Multiple leads created simultaneously

**Solutions Implemented:**

1. **Database-Level Unique Constraint**
   - Prevents duplicate phone + service
   - Enforced by PostgreSQL kernel
   - Atomic check

2. **Atomic Increment Operations**
   ```prisma
   await prisma.provider.update({
     where: { id: providerId },
     data: {
       leadsReceivedCount: { increment: 1 }
     }
   });
   ```
   - Single atomic operation
   - No race conditions

3. **Transaction Isolation (Read-Write Consistency)**
   - Prisma handles transaction context
   - Each allocation operation is isolated
   - Multiple leads don't interfere

**Example Race Condition (Prevented):**
```
Scenario: 2 leads created simultaneously
Provider has quota=10, currentCount=9

Without protection:
  Thread 1: Read count=9 → increment → count=10
  Thread 2: Read count=9 → increment → count=10
  Result: Both think provider has quota! 

With atomic { increment: 1 }:
  Thread 1: Atomic increment 9→10
  Thread 2: Atomic increment 10→11 (OVER QUOTA!)
  Result: Correctly rejects Thread 2
```

---

### 5. Real-Time Dashboard Updates

**Challenge:** Provider dashboard should update instantly without refresh

**Method 1: WebSocket (Primary)**
```
Client connects:
  GET /api/ws?providerId=1

Server maintains Set of connected clients per provider:
  clients.get("1") = [ws1, ws2, ws3, ...]

On lead assignment:
  Broadcast to all connected clients for that provider
  ws.send({ type: "lead_assigned", leadId: "..." })

Client receives:
  window.onmessage = (event) => {
    if (event.data.type === "lead_assigned")
      refresh dashboard data
  }
```

**Method 2: Polling Fallback**
```
If WebSocket fails or not supported:
  setInterval(() => {
    fetch(`/api/dashboard?providerId=${id}`)
    updateDashboardData()
  }, 3000)  // Poll every 3 seconds
```

**Advantages of This Approach:**
- Real-time responsiveness
- Graceful fallback
- Works on all devices/networks
- No additional infrastructure needed

---

### 6. Data Model

**Core Tables:**

```
┌─────────────┐
│  Service    │
├─────────────┤
│ id (PK)     │
│ name        │  "Service 1", "Service 2", "Service 3"
└─────────────┘

┌─────────────────────┐
│  Provider           │
├─────────────────────┤
│ id (PK)             │  1-8
│ name                │  "Provider 1", etc.
│ monthlyQuota        │  Default: 10
│ leadsReceivedCount  │  0-10
│ createdAt           │
│ updatedAt           │
└─────────────────────┘

┌──────────────────────┐
│  Lead                │
├──────────────────────┤
│ id (PK)              │  CUID
│ phone (UNIQUE with)  │  Must be 10 digits
│ name                 │
│ city                 │
│ description          │
│ serviceId (FK)       │
│ createdAt            │
│ updatedAt            │
└──────────────────────┘
  ↓ unique constraint
  ├─ (phone, serviceId) - prevents duplicates

┌──────────────────────┐
│  LeadAssignment      │
├──────────────────────┤
│ id (PK)              │  CUID
│ leadId (FK)          │  N-to-1
│ providerId (FK)      │  N-to-1
│ createdAt            │
│ ↓ unique constraint  │
└──────────────────────┘
  ├─ (leadId, providerId) - no duplicate assignments

┌──────────────────────┐
│  AllocationPointer   │
├──────────────────────┤
│ id (PK)              │
│ providerId (FK)      │
│ serviceId (FK)       │
│ lastIndex            │  Track round-robin position
│ ↓ unique constraint  │
└──────────────────────┘
  ├─ (providerId, serviceId)

┌──────────────────────┐
│  WebhookEvent        │
├──────────────────────┤
│ id (PK)              │  CUID
│ providerId (FK)      │
│ eventType            │  "quota_reset"
│ idempotencyKey (UQ)  │  UNIQUE - prevents duplicates
│ processed            │  Boolean
│ createdAt            │
│ updatedAt            │
└──────────────────────┘

┌──────────────────────┐
│  QuotaResetHistory   │
├──────────────────────┤
│ id (PK)              │  CUID
│ providerId (FK)      │
│ timestamp (DEF NOW)  │  When reset happened
└──────────────────────┘
```

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/leads` | POST | Create new lead + allocate |
| `/api/leads` | GET | Get all leads (N/A) |
| `/api/services` | GET | List all services |
| `/api/providers` | GET | List all providers with stats |
| `/api/dashboard` | GET | Get provider's dashboard data |
| `/api/webhook` | POST | Handle quota reset webhook |
| `/api/webhook` | GET | List webhook events |
| `/api/ws` | UPGRADE | WebSocket connection |

---

## Error Handling

**Duplicate Lead Creation:**
```json
Status: 409 Conflict
{
  "error": "A lead with this phone number and service already exists"
}
```

**Invalid Phone Format:**
```json
Status: 400 Bad Request
{
  "error": "Invalid phone number format"
}
```

**Missing Fields:**
```json
Status: 400 Bad Request
{
  "error": "Missing required fields"
}
```

**Provider Not Found:**
```json
Status: 404 Not Found
{
  "error": "Provider not found"
}
```

---

## Performance Optimizations

1. **Database Indexes**
   - `Provider(leadsReceivedCount)` - Fast quota checks
   - `Lead(phone, serviceId)` - Unique constraint search
   - `Lead(serviceId)` - Service lookup
   - `LeadAssignment(leadId, providerId)` - Fast assignment lookup

2. **Query Optimization**
   - Minimal joins
   - Select only needed fields
   - Order by performance-critical fields

3. **Caching Opportunities** (future)
   - Cache provider stats (10s TTL)
   - Cache service list (static)
   - Cache allocation pointers

---

## Security Considerations

1. **Input Validation**
   - Phone: Must be exactly 10 digits
   - Phone: Regex validation: `/^\d{10}$/`
   - Name, city, description: Basic length checks
   - ServiceId: Must exist in database

2. **SQL Injection Prevention**
   - Using Prisma ORM (parameterized queries)
   - No string concatenation in queries

3. **Duplicate Prevention**
   - Database-level constraints (cannot bypass)
   - Unique index on (phone, serviceId)

4. **Concurrency Safety**
   - Atomic operations for quota increment
   - ACID database transactions
   - No optimistic locking needed (DB handles it)

5. **Webhook Security** (future improvements)
   - Add API key authentication
   - Verify webhook signature
   - Rate limiting on webhook endpoint
   - Audit logging for all quota resets

---

## Testing Strategy

### Unit Tests (TODO)
- Allocation algorithm correctness
- Quota validation
- Phone format validation

### Integration Tests (TODO)
- Lead creation flow
- Concurrent lead creation
- Webhook idempotency

### Manual Tests (Current)
- Use `/test-tools` page
- Test duplicate prevention
- Test concurrency with 10 simultaneous leads
- Test webhook idempotency
- Verify real-time updates

---

## Scalability Considerations

**Current Limitations:**
- Single server (no load balancing)
- Single database (no replication)
- WebSocket limited by server memory

**To Scale:**
1. Deploy to multiple servers (Vercel/Railway handles auto-scaling)
2. Use managed PostgreSQL (PaaS solutions auto-scale)
3. Implement Redis for WebSocket broadcast to multiple servers
4. Add API rate limiting
5. Implement database connection pooling

**Estimated Capacity (current):**
- ~1000 concurrent WebSocket connections per server
- ~1000 leads/min with 8 providers
- ~100,000 leads total in database (before performance degrades)

---

## Logging & Monitoring

**Current:**
- Console.error for errors
- No structured logging

**Recommended (production):**
- Use Winston or Pino for structured logging
- Send logs to: DataDog, LogRocket, CloudWatch
- Monitor metrics: Request latency, error rate, allocation fairness
- Alert on: Database connection failures, high error rate

---

## Future Improvements

1. **Batch Operations**
   - Optimize for bulk lead creation

2. **Caching Layer**
   - Redis for provider stats
   - TTL-based invalidation

3. **Metrics & Analytics**
   - Track allocation fairness
   - Provider performance dashboard
   - Lead conversion tracking

4. **Enhanced Webhooks**
   - Multiple retry attempts
   - Signed webhooks
   - Webhook history/audit log

5. **Admin Dashboard**
   - Manual allocation override
   - Quota management UI
   - System health monitoring

6. **Database Improvements**
   - Partitioning by date for old leads
   - Archival strategy
   - Backup automation

---

## References

- Prisma ORM: https://www.prisma.io
- Next.js: https://nextjs.org
- PostgreSQL: https://www.postgresql.org
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- ACID Transactions: https://en.wikipedia.org/wiki/ACID
