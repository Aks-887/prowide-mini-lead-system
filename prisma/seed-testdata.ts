import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // NOTE: This script does NOT clear production data by default.
  // It only inserts an initial small set of test leads & assignments.
  // If you want a clean slate, run prisma:reset / db reset separately.

  const services = await prisma.service.findMany({ orderBy: { id: 'asc' } });
  const providers = await prisma.provider.findMany({ orderBy: { id: 'asc' } });

  if (services.length < 3 || providers.length < 8) {
    throw new Error('Seed-testdata requires services (3) and providers (8) to already exist. Run prisma seed first.');
  }

  const service1 = services.find((s) => s.name === 'Service 1');
  const service2 = services.find((s) => s.name === 'Service 2');
  const service3 = services.find((s) => s.name === 'Service 3');

  if (!service1 || !service2 || !service3) {
    throw new Error('Could not find Service 1/2/3 in DB. Run prisma seed first.');
  }

  // Reset allocation cursors to a known starting point for predictable demo behavior.
  // (Only affects fair rotation state.)
  await prisma.serviceAllocationCursor.updateMany({
    where: { serviceId: service1.id },
    data: { nextOffset: 0 },
  });
  await prisma.serviceAllocationCursor.updateMany({
    where: { serviceId: service2.id },
    data: { nextOffset: 0 },
  });
  await prisma.serviceAllocationCursor.updateMany({
    where: { serviceId: service3.id },
    data: { nextOffset: 0 },
  });

  // For test/demo stability, reset all providers counters.
  // This script is intended for a fresh demo environment.
  await prisma.provider.updateMany({
    data: { leadsReceivedCount: 0 },
  });
  await prisma.leadAssignment.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.quotaResetHistory.deleteMany();

  // Generate 12 leads across services (4 per service), with unique phone+service.
  // Duplicate phone+service is avoided to prevent 409 conflicts.
  // Calls the same allocation logic indirectly by creating leads + assignments.
  // Here we re-run allocation by calling the same DB logic is complex to share,
  // so we create leads and then allocate using the production allocation function logic
  // by posting to the API would require HTTP; instead we mimic by importing isn't allowed.
  // Simpler: we use the same allocation algorithm implementation here.

  type MandatoryRule = { mandatory: number[]; pool: number[] };
  const mandatoryPoolMap: Record<number, MandatoryRule> = {
    [service1.id]: { mandatory: [1], pool: [2, 3, 4] },
    [service2.id]: { mandatory: [5], pool: [6, 7, 8] },
    [service3.id]: { mandatory: [1, 4], pool: [2, 3, 5, 6, 7, 8] },
  };

  // Ensure provider IDs exist (1..8)
  const providerIdSet = new Set(providers.map((p) => p.id));
  for (let i = 1; i <= 8; i++) {
    if (!providerIdSet.has(i)) throw new Error(`Missing provider id=${i} in DB.`);
  }

  const phoneBase = 7000000000;

  const createLeadAndAllocate = async (params: {
    phone: string;
    name: string;
    city: string;
    description: string;
    serviceId: number;
  }) => {
    await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          phone: params.phone,
          name: params.name,
          city: params.city,
          description: params.description,
          serviceId: params.serviceId,
        },
      });

      const rule = mandatoryPoolMap[params.serviceId];
      if (!rule) throw new Error(`Unsupported serviceId=${params.serviceId}`);

      const assigned: number[] = [];

      // Lock cursor for fairness
      const cursorRows = (await (tx as any).$queryRaw<Array<{ next_offset: number }>>`
        SELECT "nextOffset" as next_offset
        FROM "ServiceAllocationCursor"
        WHERE "serviceId" = ${params.serviceId}
        FOR UPDATE
      `) as Array<{ next_offset: number }>;

      if (!cursorRows?.length) {
        throw new Error(`Missing cursor for serviceId=${params.serviceId}`);
      }

      let nextOffset = cursorRows[0].next_offset ?? 0;

      const tryAddProvider = (pid: number) => {
        if (assigned.includes(pid)) return false;
        assigned.push(pid);
        return true;
      };

      // Mandatory first
      for (const pid of rule.mandatory) {
        const p = await tx.provider.findUnique({ where: { id: pid } });
        if (!p) throw new Error(`Provider missing id=${pid}`);
        if (p.leadsReceivedCount >= p.monthlyQuota) {
          throw new Error(`Provider ${pid} exhausted quota unexpectedly during test seeding.`);
        }
        tryAddProvider(pid);
      }

      // Fill remaining to exactly 3
      const pool = rule.pool;
      while (assigned.length < 3) {
        const startIdx = nextOffset % pool.length;
        let picked = false;

        for (let step = 0; step < pool.length && assigned.length < 3; step++) {
          const idx = (startIdx + step) % pool.length;
          const candidateId = pool[idx];

          if (assigned.includes(candidateId)) continue;

          const p = await tx.provider.findUnique({ where: { id: candidateId } });
          if (!p) throw new Error(`Provider missing id=${candidateId}`);
          if (p.leadsReceivedCount >= p.monthlyQuota) continue;

          tryAddProvider(candidateId);
          nextOffset = idx + 1;
          picked = true;
          break;
        }

        if (!picked) {
          throw new Error(`Insufficient providers available for serviceId=${params.serviceId}`);
        }
      }

      // Persist assignments and increment quota usage
      for (const pid of assigned) {
        await tx.leadAssignment.create({
          data: { leadId: lead.id, providerId: pid },
        });
        await tx.provider.update({
          where: { id: pid },
          data: { leadsReceivedCount: { increment: 1 } },
        });
      }

      await tx.serviceAllocationCursor.update({
        where: { serviceId: params.serviceId },
        data: { nextOffset: nextOffset % pool.length },
      });
    });
  };

  const leads: Array<{ service: any; idx: number }> = [
    { service: service1, idx: 0 },
    { service: service1, idx: 1 },
    { service: service1, idx: 2 },
    { service: service1, idx: 3 },
    { service: service2, idx: 0 },
    { service: service2, idx: 1 },
    { service: service2, idx: 2 },
    { service: service2, idx: 3 },
    { service: service3, idx: 0 },
    { service: service3, idx: 1 },
    { service: service3, idx: 2 },
    { service: service3, idx: 3 },
  ];

  for (const [i, l] of leads.entries()) {
    const phone = String(phoneBase + i).padStart(10, '0');
    await createLeadAndAllocate({
      phone,
      name: `Demo Customer ${i + 1}`,
      city: `Demo City ${i + 1}`,
      description: `Demo seeded lead #${i + 1}`,
      serviceId: l.service.id,
    });
  }

  console.log('Test data seeded successfully (12 leads across Service 1/2/3).');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

