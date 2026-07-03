'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

function getActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string } | undefined)?.role;
}

function getActorId(session: Awaited<ReturnType<typeof auth>>) {
  return session?.user?.id;
}

function isDoctor(role?: string) {
  return role === 'DOKTER';
}

export async function getReportSummary() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  if (!['OWNER', 'ADMIN_KLINIK', 'DOKTER'].includes(actorRole ?? '')) {
    return { success: false, message: 'Anda tidak berwenang melihat laporan.', data: null };
  }

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  if (isDoctor(actorRole)) {
    const myAppointmentsToday = await prisma.appointment.count({
      where: { doctorId: actorId, date: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
    });

    const waitingAppointments = await prisma.appointment.count({
      where: { doctorId: actorId, status: 'WAITING' },
    });

    const medicalRecordsThisMonth = await prisma.medicalRecord.count({
      where: {
        doctorId: actorId,
        date: { gte: new Date(today.getFullYear(), today.getMonth(), 1), lt: new Date(today.getFullYear(), today.getMonth() + 1, 1) },
      },
    });

    return {
      success: true,
      message: 'Ringkasan laporan dokter berhasil dimuat.',
      data: {
        role: 'DOKTER',
        summary: {
          myAppointmentsToday,
          waitingAppointments,
          medicalRecordsThisMonth,
        },
      },
    };
  }

  const totalCustomers = await prisma.customer.count();
  const totalPets = await prisma.pet.count();
  const appointmentsToday = await prisma.appointment.count({
    where: { date: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
  });
  const occupiedRooms = await prisma.petHotelBooking.count({ where: { status: 'CHECKED_IN' } });
  const allProducts = await prisma.product.findMany({ select: { stock: true, minStock: true } });
  const lowStockCount = allProducts.filter((product) => product.stock < product.minStock).length;
  const unpaidInvoices = await prisma.invoice.count({ where: { status: 'UNPAID' } });
  const revenueToday = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    where: { date: { gte: start, lt: end }, status: 'PAID' },
  });
  const salesToday = await prisma.invoice.count({ where: { date: { gte: start, lt: end }, status: 'PAID' } });

  return {
    success: true,
    message: 'Ringkasan laporan berhasil dimuat.',
    data: {
      role: actorRole,
      summary: {
        totalCustomers,
        totalPets,
        appointmentsToday,
        occupiedRooms,
        lowStockCount,
        unpaidInvoices,
        revenueToday: revenueToday._sum.totalAmount ?? 0,
        salesToday,
      },
    },
  };
}
