import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { broadcastToProvider } from '../ws';






export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerId, eventType, idempotencyKey } = body;

    if (!providerId || !eventType || !idempotencyKey) {
      return NextResponse.json(
        { error: 'Missing required fields: providerId, eventType, idempotencyKey' },
        { status: 400 }
      );
    }

    const pid = parseInt(providerId);

    if (eventType !== 'quota_reset') {
      return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
    }

    // Idempotency must be concurrency-safe.
    // Do the whole operation inside a transaction using create-first semantics.
    // If two requests race on the same idempotencyKey, only one will create; the other will reuse it.
    const { processed, performedReset, eventId } = await prisma.$transaction(async (tx) => {
      const existing = await tx.webhookEvent.findUnique({
        where: { idempotencyKey },
      });

      if (existing?.processed) {
        return { processed: true, performedReset: false, eventId: existing.id };
      }

      // Attempt to create the idempotency record first.
      // This will fail with a unique constraint if another request already created it.
      let event = existing;
      try {
        event = await tx.webhookEvent.create({
          data: {
            providerId: pid,
            eventType,
            idempotencyKey,
            processed: false,
          },
        });
      } catch (e) {
        // Another transaction likely created it; fetch it.
        event = await tx.webhookEvent.findUnique({
          where: { idempotencyKey },
        });
      }

      if (!event) {
        throw new Error('Failed to create or load webhook event');
      }

      if (event.processed) {
        return { processed: true, performedReset: false, eventId: event.id };
      }

      const provider = await tx.provider.findUnique({ where: { id: pid } });
      if (!provider) {
        throw new Error('Provider not found');
      }

      await tx.provider.update({
        where: { id: pid },
        data: {
          // Requirement: reset provider quota to 10 on successful payment simulation.
          leadsReceivedCount: 0,
          monthlyQuota: 10,
        },
      });

      await tx.quotaResetHistory.create({
        data: { providerId: pid },
      });

      const updated = await tx.webhookEvent.update({
        where: { id: event.id },
        data: { processed: true },
      });

      return { processed: true, performedReset: true, eventId: updated.id };
    });

    // Broadcast only when we actually performed the reset in this request.
    if (performedReset) {
      broadcastToProvider(String(pid), {
        type: 'quota_reset',
        providerId: pid,
      });
    }

    // Return success.
    return NextResponse.json({
      success: true,
      message: processed ? 'Quota reset successfully' : 'Webhook already processed',
      eventId,
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const events = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching webhook events:', error);
    return NextResponse.json({ error: 'Failed to fetch webhook events' }, { status: 500 });
  }
}
