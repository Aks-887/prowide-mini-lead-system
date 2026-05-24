# TODO - Mini Lead Distribution System

## Planned implementation steps

- [x] Add/adjust DB schema to support a correct persisted per-service round-robin cursor.

- [ ] Update lead allocation to run atomically in a single Prisma transaction (concurrency-safe), enforcing:
  - exactly 3 provider assignments
  - mandatory providers included when quota allows
  - provider monthly quota respected
  - no provider receives the same lead twice
  - round-robin fairness based on persisted cursor
- [ ] Ensure allocation state (cursor/pointer) persists after restart.
- [ ] Add WebSocket broadcasts after:
  - successful lead allocation (`lead_assigned`)
  - successful webhook quota reset (`quota_reset`)
- [x] Update webhook route to broadcast only when idempotency permits processing.

- [ ] Update seed/migrations for the new cursor data.
- [ ] Run build/lint and perform manual checks via `/test-tools`:
  - duplicate lead rejection
  - concurrency lead generation
  - webhook idempotency
  - dashboard real-time updates

