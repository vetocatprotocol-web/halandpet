'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const settingsSchema = z.object({
  clinicName: z.string().trim().max(100).optional().or(z.literal('')),
  logo: z.string().trim().max(200).optional().or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  operationalHours: z.string().trim().max(100).optional().or(z.literal('')),
  invoiceFormat: z.string().trim().max(100).optional().or(z.literal('')),
  currency: z.string().trim().max(10).optional().or(z.literal('')),
});

const restoreBackupSchema = z.object({
  content: z.string().min(1),
});

function getActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string } | undefined)?.role;
}

function isOwner(role?: string) {
  return role === 'OWNER';
}

export async function getSettingsData() {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  const settings = await prisma.settings.findFirst();
  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { date: 'desc' },
    take: 20,
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      description: true,
      date: true,
      user: { select: { name: true } },
    },
  });

  return {
    success: true,
    message: 'Data pengaturan berhasil dimuat.',
    data: {
      settings,
      auditLogs,
      isOwner: isOwner(actorRole),
    },
  };
}

export async function updateSettings(input: z.infer<typeof settingsSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = settingsSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data pengaturan tidak valid.', data: null };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  if (!isOwner(actorRole)) {
    return { success: false, message: 'Hanya Owner yang bisa mengubah pengaturan ini.', data: null };
  }

  const settings = await prisma.settings.upsert({
    where: { id: 'default-settings' },
    create: {
      id: 'default-settings',
      clinicName: parsed.data.clinicName || null,
      logo: parsed.data.logo || null,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      operationalHours: parsed.data.operationalHours || null,
      invoiceFormat: parsed.data.invoiceFormat || null,
      currency: parsed.data.currency || null,
    },
    update: {
      clinicName: parsed.data.clinicName || null,
      logo: parsed.data.logo || null,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      operationalHours: parsed.data.operationalHours || null,
      invoiceFormat: parsed.data.invoiceFormat || null,
      currency: parsed.data.currency || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'UPDATE_SETTINGS',
      entity: 'Settings',
      entityId: settings.id,
      description: 'Mengubah pengaturan klinik.',
    },
  });

  revalidatePath('/settings');

  return { success: true, message: 'Pengaturan berhasil disimpan.', data: { settings } };
}

export async function createBackup() {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  if (!isOwner(actorRole)) {
    return { success: false, message: 'Hanya Owner yang dapat membuat backup.', data: null };
  }

  const settings = await prisma.settings.findFirst();
  const auditLogs = await prisma.auditLog.findMany({ orderBy: { date: 'desc' }, take: 100 });
  const payload = { settings, auditLogs };
  const content = JSON.stringify(payload, null, 2);
  const fileName = `haland-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return {
    success: true,
    message: 'Backup berhasil dibuat.',
    data: { fileName, content },
  };
}

export async function restoreBackup(input: z.infer<typeof restoreBackupSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = restoreBackupSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Konten backup tidak valid.', data: null };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  if (!isOwner(actorRole)) {
    return { success: false, message: 'Hanya Owner yang dapat melakukan restore.', data: null };
  }

  let payload;

  try {
    payload = JSON.parse(parsed.data.content) as { settings?: any; auditLogs?: Array<any> };
  } catch {
    return { success: false, message: 'Format file backup tidak valid.', data: null };
  }

  if (payload.settings) {
    await prisma.settings.upsert({
      where: { id: payload.settings.id ?? 'default-settings' },
      create: {
        id: payload.settings.id ?? 'default-settings',
        clinicName: payload.settings.clinicName || null,
        logo: payload.settings.logo || null,
        address: payload.settings.address || null,
        phone: payload.settings.phone || null,
        operationalHours: payload.settings.operationalHours || null,
        invoiceFormat: payload.settings.invoiceFormat || null,
        currency: payload.settings.currency || null,
      },
      update: {
        clinicName: payload.settings.clinicName || null,
        logo: payload.settings.logo || null,
        address: payload.settings.address || null,
        phone: payload.settings.phone || null,
        operationalHours: payload.settings.operationalHours || null,
        invoiceFormat: payload.settings.invoiceFormat || null,
        currency: payload.settings.currency || null,
      },
    });
  }

  if (Array.isArray(payload.auditLogs)) {
    for (const record of payload.auditLogs) {
      await prisma.auditLog.upsert({
        where: { id: record.id },
        create: {
          id: record.id,
          userId: record.userId,
          action: record.action,
          entity: record.entity,
          entityId: record.entityId,
          description: record.description,
          date: new Date(record.date),
        },
        update: {
          action: record.action,
          entity: record.entity,
          entityId: record.entityId,
          description: record.description,
          date: new Date(record.date),
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'RESTORE_BACKUP',
      entity: 'Settings',
      description: 'Melakukan restore backup manual.',
    },
  });

  revalidatePath('/settings');

  return { success: true, message: 'Restore backup selesai.', data: { restored: true } };
}
