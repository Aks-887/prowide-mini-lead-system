import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get('providerId');

    if (!providerId) {
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    const provider = await prisma.provider.findUnique({
      where: { id: parseInt(providerId) },
    });

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    const assignments = await prisma.leadAssignment.findMany({
      where: { providerId: parseInt(providerId) },
      include: {
        lead: {
          include: {
            service: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const remainingQuota = Math.max(0, provider.monthlyQuota - provider.leadsReceivedCount);

    return NextResponse.json({
      id: provider.id,
      name: provider.name,
      monthlyQuota: provider.monthlyQuota,
      leadsReceivedCount: provider.leadsReceivedCount,
      remainingQuota,
      leads: assignments.map((assignment: any) => ({
        id: assignment.lead.id,
        phone: assignment.lead.phone,
        name: assignment.lead.name,
        city: assignment.lead.city,
        service: assignment.lead.service.name,
        description: assignment.lead.description,
        assignedAt: assignment.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
