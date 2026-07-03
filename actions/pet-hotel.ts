'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const petHotelRoomSchema = z.object({
  name: z.string().min(1).max(100),
});

const updatePetHotelRoomSchema = petHotelRoomSchema.extend({
  id: z.string().min(1),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE']).optional(),
});

const petHotelBookingSchema = z.object({
  petId: z.string().min(1),
  roomId: z.string().optional().or(z.literal('')),
  checkInDate: z.string().min(1),
  checkOutDate: z.string().min(1),
  requestedByCustomer: z.boolean().optional(),
});

const updatePetHotelBookingSchema = petHotelBookingSchema.extend({
  id: z.string().min(1),
  status: z.enum(['BOOKED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']).optional(),
});

const petHotelLogSchema = z.object({
  bookingId: z.string().min(1),
  type: z.enum(['FEEDING', 'MEDICINE', 'NOTE']),
  description: z.string().max(500),
  photo: z.string().optional(),
});

function getActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string } | undefined)?.role;
}

function getActorId(session: Awaited<ReturnType<typeof auth>>) {
  return session?.user?.id;
}

async function getCustomerForSession(sessionId: string) {
  return prisma.customer.findFirst({ where: { userId: sessionId } });
}

// PET HOTEL ROOMS
export async function listPetHotelRooms() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || (actorRole === 'CUSTOMER')) {
    return { success: false, message: 'Anda tidak berwenang melihat data ini.' };
  }

  const rooms = await prisma.petHotelRoom.findMany({
    orderBy: { name: 'asc' },
    include: { bookings: { where: { status: 'CHECKED_IN' }, select: { id: true, pet: { select: { name: true } } } } },
  });

  return { success: true, rooms };
}

export async function createPetHotelRoom(input: z.infer<typeof petHotelRoomSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = petHotelRoomSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !['OWNER', 'ADMIN_KLINIK'].includes(actorRole ?? '')) {
    return { success: false, message: 'Anda tidak berwenang membuat kamar.' };
  }

  const room = await prisma.petHotelRoom.create({
    data: { name: parsed.data.name },
  });

  revalidatePath('/pet-hotel');
  return { success: true, room };
}

export async function updatePetHotelRoom(input: z.infer<typeof updatePetHotelRoomSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = updatePetHotelRoomSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !['OWNER', 'ADMIN_KLINIK'].includes(actorRole ?? '')) {
    return { success: false, message: 'Anda tidak berwenang mengubah kamar.' };
  }

  const room = await prisma.petHotelRoom.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, status: (parsed.data.status ?? undefined) as any },
  });

  revalidatePath('/pet-hotel');
  return { success: true, room };
}

export async function deletePetHotelRoom(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || actorRole !== 'OWNER') {
    return { success: false, message: 'Hanya Owner yang dapat menghapus kamar.' };
  }

  await prisma.petHotelRoom.delete({ where: { id } });

  revalidatePath('/pet-hotel');
  return { success: true };
}

// PET HOTEL BOOKINGS
export async function listPetHotelBookings() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer) {
      return { success: true, bookings: [] };
    }

    const bookings = await prisma.petHotelBooking.findMany({
      where: { pet: { customerId: customer.id } },
      orderBy: { checkInDate: 'desc' },
      include: { pet: { select: { id: true, name: true } }, room: { select: { id: true, name: true } } },
    });

    return { success: true, bookings };
  }

  const bookings = await prisma.petHotelBooking.findMany({
    orderBy: { checkInDate: 'desc' },
    include: { pet: { select: { id: true, name: true, customer: { select: { name: true } } } }, room: { select: { id: true, name: true } } },
  });

  return { success: true, bookings };
}

export async function createPetHotelBooking(input: z.infer<typeof petHotelBookingSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = petHotelBookingSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer) {
      return { success: false, message: 'Data pelanggan belum terhubung ke akun Anda.' };
    }

    const pet = await prisma.pet.findFirst({ where: { id: parsed.data.petId, customerId: customer.id } });
    if (!pet) {
      return { success: false, message: 'Hewan yang dipilih tidak milik Anda.' };
    }

    const booking = await prisma.petHotelBooking.create({
      data: {
        petId: parsed.data.petId,
        roomId: parsed.data.roomId || null,
        checkInDate: new Date(parsed.data.checkInDate),
        checkOutDate: new Date(parsed.data.checkOutDate),
        status: 'BOOKED',
        requestedByCustomer: true,
      },
    });

    revalidatePath('/portal/pet-hotel');
    revalidatePath('/pet-hotel');
    return { success: true, booking };
  }

  if (!['OWNER', 'ADMIN_KLINIK'].includes(actorRole ?? '')) {
    return { success: false, message: 'Anda tidak berwenang membuat reservasi.' };
  }

  const booking = await prisma.petHotelBooking.create({
    data: {
      petId: parsed.data.petId,
      roomId: parsed.data.roomId || null,
      checkInDate: new Date(parsed.data.checkInDate),
      checkOutDate: new Date(parsed.data.checkOutDate),
      status: 'BOOKED',
      requestedByCustomer: parsed.data.requestedByCustomer ?? false,
    },
  });

  revalidatePath('/pet-hotel');
  return { success: true, booking };
}

export async function updatePetHotelBooking(input: z.infer<typeof updatePetHotelBookingSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = updatePetHotelBookingSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !['OWNER', 'ADMIN_KLINIK'].includes(actorRole ?? '')) {
    return { success: false, message: 'Anda tidak berwenang mengubah reservasi.' };
  }

  const booking = await prisma.petHotelBooking.update({
    where: { id: parsed.data.id },
    data: {
      roomId: parsed.data.roomId || null,
      checkInDate: new Date(parsed.data.checkInDate),
      checkOutDate: new Date(parsed.data.checkOutDate),
      status: (parsed.data.status ?? undefined) as any,
    },
  });

  revalidatePath('/pet-hotel');
  return { success: true, booking };
}

export async function cancelPetHotelBooking(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const booking = await prisma.petHotelBooking.findUnique({ 
    where: { id },
    include: { pet: { select: { customerId: true } } },
  });
  
  if (!booking) {
    return { success: false, message: 'Reservasi tidak ditemukan.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer || booking.pet.customerId !== customer.id) {
      return { success: false, message: 'Anda tidak berwenang membatalkan reservasi ini.' };
    }
    if (booking.status !== 'BOOKED') {
      return { success: false, message: 'Hanya reservasi yang belum check-in yang bisa dibatalkan.' };
    }
  } else if (!['OWNER', 'ADMIN_KLINIK'].includes(actorRole ?? '')) {
    return { success: false, message: 'Anda tidak berwenang membatalkan reservasi.' };
  }

  await prisma.petHotelBooking.update({
    where: { id },
    data: { status: 'CANCELLED' as any },
  });

  revalidatePath('/pet-hotel');
  revalidatePath('/portal/pet-hotel');
  return { success: true };
}

// PET HOTEL LOGS
export async function createPetHotelLog(input: z.infer<typeof petHotelLogSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = petHotelLogSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !['OWNER', 'ADMIN_KLINIK'].includes(actorRole ?? '')) {
    return { success: false, message: 'Anda tidak berwenang membuat log.' };
  }

  const log = await prisma.petHotelLog.create({
    data: {
      bookingId: parsed.data.bookingId,
      type: parsed.data.type,
      description: parsed.data.description,
      photo: parsed.data.photo || null,
    },
  });

  revalidatePath('/pet-hotel');
  return { success: true, log };
}

export async function listPetHotelLogs(bookingId: string) {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!actorRole) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const logs = await prisma.petHotelLog.findMany({
    where: { bookingId },
    orderBy: { date: 'desc' },
  });

  return { success: true, logs };
}

export async function getPetHotelSummary() {
  const occupiedRooms = await prisma.petHotelBooking.count({
    where: { status: 'CHECKED_IN' },
  });

  const totalRooms = await prisma.petHotelRoom.count();

  return { success: true, occupiedRooms, totalRooms };
}
