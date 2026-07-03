'use server';

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(80),
  role: z.enum(['OWNER', 'ADMIN_KLINIK', 'DOKTER', 'CUSTOMER']),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
});

const resetPinSchema = z.object({
  userId: z.string().min(1),
});

const unlockUserSchema = z.object({
  userId: z.string().min(1),
});

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createUser(input: z.infer<typeof createUserSchema>) {
  const session = await auth();
  const actorRole = (session?.user as { role?: string } | undefined)?.role;
  const parsed = createUserSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'ADMIN_KLINIK' && parsed.data.role !== 'CUSTOMER') {
    return { success: false, message: 'Admin Klinik hanya dapat membuat akun Customer.' };
  }

  if (actorRole === 'DOKTER' || actorRole === 'CUSTOMER') {
    return { success: false, message: 'Role Anda tidak boleh membuat akun.' };
  }

  const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (existing) {
    return { success: false, message: 'Username sudah dipakai.' };
  }

  const temporaryPin = generatePin();
  const pinHash = await bcrypt.hash(temporaryPin, 10);

  const user = await prisma.user.create({
    data: {
      username: parsed.data.username,
      pinHash,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      role: parsed.data.role,
      mustChangePin: true,
      createdById: session.user.id,
    },
  });

  return { success: true, userId: user.id, temporaryPin };
}

export async function resetPin(input: z.infer<typeof resetPinSchema>) {
  const session = await auth();
  const actorRole = (session?.user as { role?: string } | undefined)?.role;
  const parsed = resetPinSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'OWNER') {
    // Owner can reset any user.
  } else if (actorRole === 'ADMIN_KLINIK') {
    const targetUser = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!targetUser || targetUser.role !== 'CUSTOMER') {
      return { success: false, message: 'Admin Klinik hanya dapat reset PIN Customer.' };
    }
  } else {
    return { success: false, message: 'Anda tidak berwenang melakukan reset PIN.' };
  }

  const temporaryPin = generatePin();
  const pinHash = await bcrypt.hash(temporaryPin, 10);

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      pinHash,
      mustChangePin: true,
      failedPinAttempts: 0,
      isLocked: false,
      lockedUntil: null,
    },
  });

  return { success: true, temporaryPin };
}

export async function unlockUser(input: z.infer<typeof unlockUserSchema>) {
  const session = await auth();
  const actorRole = (session?.user as { role?: string } | undefined)?.role;
  const parsed = unlockUserSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole !== 'OWNER' && actorRole !== 'ADMIN_KLINIK') {
    return { success: false, message: 'Anda tidak berwenang membuka kunci akun.' };
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      isLocked: false,
      lockedUntil: null,
      failedPinAttempts: 0,
    },
  });

  return { success: true };
}
