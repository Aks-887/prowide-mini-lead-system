# Testing Guide & Validation Checklist

## Pre-Testing Setup

### 1. Local Environment
```bash
# Terminal 1: Start development server
npm run dev
# Should start at http://localhost:3000

# Terminal 2: Monitor database (optional)
npx prisma studio
# Opens at http://localhost:5555
```

### 2. Open Browser
- Main app: http://localhost:3000
- Prisma Studio: http://localhost:5555 (optional, for DB inspection)

### 3. Verify Database
```sql
-- Check if services exist
SELECT * FROM "Service";
-- Should show: Service 1, Service 2, Service 3

-- Check providers
SELECT id, name, "monthlyQuota", "leadsReceivedCount" FROM "Provider" ORDER BY id;
-- Should show 8 providers with quota 10
```

---

## Feature Tests

### Test 1: Service Request Form (Happy Path)

**Objective:** Verify lead creation and allocation works

**Steps:**
1. Open http://localhost:3000/request-service
2. Fill form:
   - Name: "John Doe"
   - Phone: "1234567890"
   - City: "New York"
   - Service: "Service 1"
   - Description: "I need a service"
3. Click "Submit Request"

**Expected Results:**
- ✅ Green success message: "Service request submitted successfully!"
- ✅ Form clears
- ✅ Lead created in database
- ✅ 3 providers allocated (Provider 1, + 2 from pool [2,3,4])

**Verify in Database:**
```sql
SELECT * FROM "Lead" WHERE phone = '1234567890';
-- Should show 1 lead with serviceId = 1

SELECT l.*, laa."providerId" FROM "LeadAssignment" laa
JOIN "Lead" l ON l.id = laa."leadId"
WHERE l.phone = '1234567890'
ORDER BY laa."providerId";
-- Should show 3 assignments
```

---

### Test 2: Duplicate Prevention

**Objective:** Verify same phone + service cannot create duplicate lead

**Steps:**
1. From previous test, you have:
   - Phone: 1234567890
   - Service: Service 1
2. Try submitting again with same phone and Service 1
3. Change service to Service 2 and submit (should work)
4. Try Service 1 with same phone again (should fail)

**Expected Results:**
- ✅ First duplicate: Red error "A lead with this phone number and service already exists"
- ✅ Different service: Success (2 different leads for same phone)
- ✅ Service 1 duplicate again: Error message

**Why This Matters:**
- Prevents accidental resubmissions
- Enforced at database level (cannot bypass)
- Survives across server restarts

---

### Test 3: Fair Allocation Distribution

**Objective:** Verify round-robin allocation works correctly

**Steps:**
1. Generate multiple Service 1 leads and observe allocation
2. Record which providers receive each lead

**Setup Test Data:**
```bash
# Go to /test-tools and click "Generate 10 Leads"
# This creates 10 leads across all services
```

**Check Results:**
1. Go to http://localhost:3000/dashboard
2. Check each provider's lead count
3. Service 1 leads should distributed across:
   - Provider 1 (mandatory - every lead)
   - Provider 2, 3, 4 (pool - rotating)

**Expected Pattern:**
```
Service 1 Leads:
├─ Lead 1: Provider 1, Provider 2, Provider X
├─ Lead 2: Provider 1, Provider 3, Provider Y  
├─ Lead 3: Provider 1, Provider 4, Provider Z
├─ Lead 4: Provider 1, Provider 2, Provider X (cycle repeats)
...
```

**Verify in Database:**
```sql
-- Count Service 1 leads per provider
SELECT p.name, COUNT(laa.id) as "lead_count"
FROM "Provider" p
LEFT JOIN "LeadAssignment" laa ON p.id = laa."providerId"
LEFT JOIN "Lead" l ON laa."leadId" = l.id
WHERE l."serviceId" = 1
GROUP BY p.id, p.name
ORDER BY p.id;
```

---

### Test 4: Quota Respect

**Objective:** Verify providers cannot receive more than 10 leads

**Steps:**
1. Select a provider in Dashboard
2. Check "Remaining Quota"
3. Generate leads until quota is full (see progress bar reach 100%)
4. Try to generate more

**Expected Results:**
- ✅ Progress bar fills green→yellow→red
- ✅ "Remaining Quota" decreases
- ✅ Once quota = 0, provider not assigned to new leads
- ✅ Other providers in pool still receive leads

**Verify:**
```sql
SELECT id, name, "monthlyQuota", "leadsReceivedCount",
       ("monthlyQuota" - "leadsReceivedCount") as "remainingQuota"
FROM "Provider"
ORDER BY id;
```

---

### Test 5: Real-Time Dashboard Updates

**Objective:** Verify dashboard updates without page refresh

**Steps:**
1. Open Dashboard (Tab 1): http://localhost:3000/dashboard
   - Note initial lead count
2. Open Request Service form (Tab 2): http://localhost:3000/request-service
3. In Tab 2, submit a new lead:
   - Phone: "9999999999"
   - Service: "Service 1"
   - Other fields: Fill in
4. Watch Tab 1 (Dashboard) - NO REFRESH

**Expected Results:**
- ✅ Within 3 seconds, Tab 1 updates with new lead
- ✅ Lead count increases for assigned providers
- ✅ New lead appears in "Assigned Leads" list
- ✅ No page refresh needed

**How It Works:**
- WebSocket broadcasts to connected clients (instant)
- Polling fallback every 3 seconds if WebSocket fails
- Automatic fallback, no user action needed

---

### Test 6: Webhook Quota Reset

**Objective:** Verify webhook resets quota and is idempotent

**Steps:**
1. Go to /test-tools
2. Select a provider (e.g., Provider 1)
3. Check current lead count on dashboard
4. Click "Reset Quota to 10"
5. Check dashboard again

**Expected Results:**
- ✅ Lead count resets to 0
- ✅ "Remaining Quota" becomes 10
- ✅ Success message in test results

**Verify:**
```sql
SELECT id, name, "leadsReceivedCount" FROM "Provider" WHERE id = 1;
-- Should show leadsReceivedCount = 0
```

---

### Test 7: Webhook Idempotency

**Objective:** Verify same webhook call doesn't process multiple times

**Steps:**
1. Go to /test-tools
2. Select Provider 1
3. Note current lead count (should be 0 after previous test)
4. Click "Test Idempotency"
5. Watch test results carefully

**Expected Results in Test Results:**
- ✅ "Webhook call 1: Quota reset successfully"
- ✅ "Webhook call 2: Webhook already processed"
- ✅ "Webhook call 3: Webhook already processed"
- ✅ Final message: "Idempotency test completed. Webhook called 3 times with same key - should only process once."

**Critical Verification:**
- Provider's lead count should still be 0 (not reset 3 times)
- Only 1 entry in WebhookEvent table with that idempotencyKey

```sql
-- Check webhook events
SELECT * FROM "WebhookEvent" 
ORDER BY "createdAt" DESC LIMIT 5;

-- Should see 1 event marked as processed

-- Check quota reset history
SELECT * FROM "QuotaResetHistory" 
ORDER BY "timestamp" DESC LIMIT 5;

-- Should only have 1 recent reset
```

---

### Test 8: Concurrency & Race Conditions

**Objective:** Verify system handles simultaneous lead creation correctly

**Steps:**
1. Get provider stats before test:
   ```sql
   SELECT id, name, "leadsReceivedCount" FROM "Provider" ORDER BY id;
   ```
2. Go to /test-tools
3. Click "Generate 10 Leads"
4. Watch results (should create 10 leads)
5. Check lead counts after

**Expected Results:**
- ✅ 10 leads created successfully (or some duplicates with error)
- ✅ Total lead count increases by 10 (or less if duplicates)
- ✅ No lead count overflow (providers not over quota)
- ✅ Allocation is fair (each service type properly distributed)

**Verify Allocation Correctness:**
```sql
-- Count Service 1 leads
SELECT p.name, COUNT(*) as "lead_count"
FROM "LeadAssignment" laa
JOIN "Provider" p ON p.id = laa."providerId"
JOIN "Lead" l ON l.id = laa."leadId"
WHERE l."serviceId" = 1
GROUP BY p.id, p.name
ORDER BY p.id;

-- Provider 1 should have most (mandatory)
-- Providers 2,3,4 should be fairly distributed
```

---

### Test 9: Phone Validation

**Objective:** Verify phone number validation

**Steps:**
1. Go to /request-service
2. Try invalid phone numbers:
   - "123" (too short)
   - "12345678901" (too long)
   - "123456789a" (non-numeric)
   - "12 34 56 78 90" (with spaces)
3. Try valid phone: "1234567890"

**Expected Results:**
- ✅ Invalid formats: Browser prevents submission
- ✅ Valid format: Submission allowed

---

### Test 10: Service Selection

**Objective:** Verify correct allocation based on service type

**Steps:**
1. Create leads for each service:
   - Service 1: Phone "1111111111"
   - Service 2: Phone "2222222222"
   - Service 3: Phone "3333333333"
2. Check dashboard for each provider

**Expected Results for Service 1:**
- Always assigned to Provider 1
- + 1 provider from pool [2, 3, 4]

**Expected Results for Service 2:**
- Always assigned to Provider 5
- + 1 provider from pool [6, 7, 8]

**Expected Results for Service 3:**
- Always assigned to Providers 1 AND 4
- + 1 provider from pool [2, 3, 5, 6, 7, 8]

---

## Test Execution Checklist

### Phase 1: Basic Functionality
- [ ] Service form submits successfully
- [ ] Leads created in database
- [ ] Providers allocated (3 per lead)
- [ ] Duplicate prevention works

### Phase 2: Distribution
- [ ] Mandatory providers always assigned
- [ ] Fair allocation (round-robin) works
- [ ] Quota respected (max 10/provider)
- [ ] Services allocated correctly

### Phase 3: Real-Time
- [ ] Dashboard updates without refresh
- [ ] WebSocket connects (check browser console)
- [ ] Polling fallback works if WebSocket fails
- [ ] Real-time lead list updates

### Phase 4: Webhooks
- [ ] Quota reset resets lead count
- [ ] Idempotency prevents duplicate processing
- [ ] WebhookEvent table populated correctly
- [ ] QuotaResetHistory recorded

### Phase 5: Concurrency
- [ ] 10 concurrent leads create successfully
- [ ] Allocation is fair under load
- [ ] No quota overflows
- [ ] No data corruption

### Phase 6: Edge Cases
- [ ] Phone validation works
- [ ] Service dropdown populated
- [ ] Error messages clear and helpful
- [ ] Database state consistent after errors

---

## Performance Testing

### Load Test Scenario
```bash
# Generate 100 leads concurrently
# Use browser dev tools (Network tab)

1. Go to /test-tools
2. Click "Generate 10 Leads" 5 times (total 50 leads)
3. Monitor:
   - Response times (should be < 500ms per lead)
   - Database connections (should not exhaust)
   - Memory usage (should be stable)
4. Check /dashboard - should still be responsive
```

### Expected Performance:
- Lead creation: < 500ms per request
- Dashboard load: < 1s
- Real-time update: < 3s

---

## Debugging Tips

### WebSocket Not Working?
```javascript
// In browser console:
new WebSocket('ws://localhost:3000/api/ws?providerId=1')
// Should connect successfully
```

### Database Connection Issues?
```bash
# Test connection
psql "postgresql://user:password@localhost:5432/prowider_db"
\dt  # List tables

# Check migrations
npx prisma migrate status
```

### Check Database State
```bash
# View in Prisma Studio
npx prisma studio
# Opens GUI at http://localhost:5555

# Or use SQL directly
psql "postgresql://user:password@localhost:5432/prowider_db" < query.sql
```

---

## Sign-Off Checklist

Before considering the system ready for production:

- [ ] All 10 tests pass
- [ ] No console errors on any page
- [ ] Database queries optimized (indices working)
- [ ] WebSocket or polling real-time working
- [ ] Webhook idempotency verified
- [ ] Concurrency tested with 50+ simultaneous requests
- [ ] Error handling graceful (no 500 errors)
- [ ] Code deployed and running on live URL
- [ ] Documentation complete and accurate
- [ ] Monitoring/logging in place

---

## Regression Testing (After Deployments)

After each deployment, quickly verify:

1. **Form Submission**: Submit a test lead
2. **Dashboard**: View provider dashboard (real-time update)
3. **Webhook**: Trigger quota reset
4. **Database**: Query providers table for correct data

All should work in < 2 minutes before considering deployment successful.

---

## Support

If tests fail:
1. Check database connection
2. Verify migrations ran: `npx prisma migrate status`
3. Restart development server: Ctrl+C and `npm run dev`
4. Clear .next folder: `rm -rf .next && npm run build`
5. Check browser console for errors: F12 → Console tab
