import { prisma } from '@/lib/prisma';

import { NextRequest, NextResponse } from 'next/server';
import { broadcastToProvider } from '../ws';



export async function GET() {

  try {
    const services = await prisma.service.findMany();
    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, city, serviceId, description } = body;

    // Validation
    if (!name || !phone || !city || !serviceId || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Check for duplicate lead (same phone + same service)
    const existingLead = await prisma.lead.findUnique({
      where: {
        unique_phone_service: {
          phone,
          serviceId,
        },
      },
    });

    if (existingLead) {
      return NextResponse.json(
        { error: 'A lead with this phone number and service already exists' },
        { status: 409 }
      );
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        phone,
        name,
        city,
        description,
        serviceId,
      },
    });

    // Allocate providers
    await allocateProvidersToLead(lead.id, serviceId);

    // Trigger real-time update
    // WebSocket broadcast happens via websocket handler

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}

async function allocateProvidersToLead(leadId: string, serviceId: number) {
  // Provider ids are deterministic in the assignment problem statement (1..8)
  const mandatoryPoolMap: Record<number, { mandatory: number[]; pool: number[] }> = {
    1: { mandatory: [1], pool: [2, 3, 4] },
    2: { mandatory: [5], pool: [6, 7, 8] },
    3: { mandatory: [1, 4], pool: [2, 3, 5, 6, 7, 8] },
  };

  const rule = mandatoryPoolMap[serviceId];
  if (!rule) throw new Error(`Unsupported serviceId: ${serviceId}`);

  const assignedProviders: number[] = [];

  // Transaction for concurrency safety + exact 3 assignments + quota correctness
  await prisma.$transaction(async (tx) => {
    const pool = rule.pool;

    // Row-lock the cursor to guarantee fairness under concurrent lead creation.
    // This prevents multiple transactions from reading the same nextOffset.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cursorRows = (await (tx as any).$queryRaw<
      Array<{ next_offset: number }>
    >`
      SELECT "nextOffset" as next_offset
      FROM "ServiceAllocationCursor"
      WHERE "serviceId" = ${serviceId}
      FOR UPDATE
    `) as Array<{ next_offset: number }>;

    if (!cursorRows?.length) {
      throw new Error(`Missing serviceAllocationCursor for serviceId=${serviceId}`);
    }

    let nextOffset = cursorRows[0].next_offset ?? 0;

    const tryAddProvider = (providerId: number) => {
      if (assignedProviders.includes(providerId)) return false;
      assignedProviders.push(providerId);
      return true;
    };

    // 1) mandatory providers
    for (const pid of rule.mandatory) {
      const p = await tx.provider.findUnique({ where: { id: pid } });
      if (!p) throw new Error(`Provider missing id=${pid}`);
      if (p.leadsReceivedCount >= p.monthlyQuota) {
        throw new Error(
          `Mandatory provider ${pid} has exhausted quota for serviceId=${serviceId}`
        );
      }
      tryAddProvider(pid);
    }

    // 2) remaining providers using persisted round-robin cursor over the pool
    while (assignedProviders.length < 3) {
      const startIdx = nextOffset % pool.length;
      let picked = false;

      for (
        let step = 0;
        step < pool.length && assignedProviders.length < 3;
        step++
      ) {
        const idx = (startIdx + step) % pool.length;
        const candidateId = pool[idx];

        if (assignedProviders.includes(candidateId)) continue;

        const p = await tx.provider.findUnique({ where: { id: candidateId } });
        if (!p) throw new Error(`Provider missing id=${candidateId}`);
        if (p.leadsReceivedCount >= p.monthlyQuota) continue;

        tryAddProvider(candidateId);
        nextOffset = idx + 1;
        picked = true;
        break;
      }

      if (!picked) {
        throw new Error(
          `Not enough available providers to assign 3 providers for serviceId=${serviceId}`
        );
      }
    }

    // 3) commit assignments + quota increments
    for (const pid of assignedProviders) {
      await tx.leadAssignment.create({
        data: { leadId, providerId: pid },
      });
      await tx.provider.update({
        where: { id: pid },
        data: { leadsReceivedCount: { increment: 1 } },
      });
    }

    // Persist cursor for next lead
    await tx.serviceAllocationCursor.update({
      where: { serviceId },
      data: { nextOffset: nextOffset % pool.length },
    });
  });

  // Real-time broadcast AFTER transaction succeeds
  for (const providerId of assignedProviders) {
    broadcastToProvider(String(providerId), {
      type: 'lead_assigned',
      providerId,
      leadId,
      serviceId,
    });
  }
}

