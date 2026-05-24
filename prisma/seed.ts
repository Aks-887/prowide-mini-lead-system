import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


async function main() {
  // Clear existing data
  await prisma.webhookEvent.deleteMany();
  await prisma.quotaResetHistory.deleteMany();
  await prisma.allocationPointer.deleteMany();
  await prisma.leadAssignment.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.service.deleteMany();

  // Create services
  console.log('Creating services...');
  const service1 = await prisma.service.create({
    data: { name: 'Service 1' },
  });
  const service2 = await prisma.service.create({
    data: { name: 'Service 2' },
  });
  const service3 = await prisma.service.create({
    data: { name: 'Service 3' },
  });

  console.log('Creating providers...');
  // Create 8 providers
  const providers = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      prisma.provider.create({
        data: {
          name: `Provider ${i + 1}`,
          monthlyQuota: 10,
          leadsReceivedCount: 0,
        },
      })
    )
  );

  console.log('Initializing service allocation cursors...');

  // Persisted cursor per service for the pool of *remaining* providers.
  // Service 1: Pool [2,3,4]
  // Service 2: Pool [6,7,8]
  // Service 3: Pool [2,3,5,6,7,8]
  await prisma.serviceAllocationCursor.upsert({
    where: { serviceId: service1.id },
    create: { serviceId: service1.id, nextOffset: 0 },
    update: { nextOffset: 0 },
  });

  await prisma.serviceAllocationCursor.upsert({
    where: { serviceId: service2.id },
    create: { serviceId: service2.id, nextOffset: 0 },
    update: { nextOffset: 0 },
  });

  await prisma.serviceAllocationCursor.upsert({
    where: { serviceId: service3.id },
    create: { serviceId: service3.id, nextOffset: 0 },
    update: { nextOffset: 0 },
  });

  console.log('Seed data created successfully!');
  console.log(`Services: ${[service1.name, service2.name, service3.name].join(', ')}`);
  console.log(`Providers: ${providers.map((p: any) => p.name).join(', ')}`);

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
