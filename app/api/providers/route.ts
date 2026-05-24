import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        monthlyQuota: true,
        leadsReceivedCount: true,
      },
    });
    return NextResponse.json(providers);
  } catch (error) {
    console.error('Error fetching providers:', error);
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
  }
}
