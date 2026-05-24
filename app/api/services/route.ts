import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: { id: 'asc' },
    });
    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}
