'use server';

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
});

const changePinSchema = z.object({
  currentPin: z.string().trim().min(6),
  newPin: z.string().trim().min(6),
});

export async function getProfileData() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, name: true, phone: true, role: true },
  });

  if (!user) {
    return { success: false, message: 'Data pengguna tidak ditemukan.', data: null };
  }

  return { success: true, message: 'Profil berhasil dimuat.', data: { user } };
}

export async function updateProfile(input: z.infer<typeof profileSchema>) {
  const session = await auth();
  const parsed = profileSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data profil tidak valid.', data: null };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
    },
  });

  return { success: true, message: 'Profil berhasil disimpan.', data: { user } };
}

export async function changePin(input: z.infer<typeof changePinSchema>) {
  const session = await auth();
  const parsed = changePinSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data PIN tidak valid.', data: null };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return { success: false, message: 'Pengguna tidak ditemukan.', data: null };
  }

  const isValid = await bcrypt.compare(parsed.data.currentPin, user.pinHash);
  if (!isValid) {
    return { success: false, message: 'PIN saat ini tidak sesuai.', data: null };
  }

  const newPinHash = await bcrypt.hash(parsed.data.newPin, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      pinHash: newPinHash,
      mustChangePin: false,
      failedPinAttempts: 0,
      isLocked: false,
      lockedUntil: null,
    },
  });

  return { success: true, message: 'PIN berhasil diperbarui.', data: null };
}
