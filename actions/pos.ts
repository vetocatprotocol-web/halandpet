'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const productSearchSchema = z.object({
  query: z.string().trim().min(1),
});

const createPosSaleSchema = z.object({
  customerId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.coerce.number().int().positive(),
        price: z.coerce.number().min(0),
        description: z.string().min(1),
      }),
    )
    .min(1),
  discountAmount: z.coerce.number().min(0).optional(),
  paymentMethod: z.enum(['CASH', 'NON_CASH']),
  paymentAmount: z.coerce.number().min(0),
});

function getActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string } | undefined)?.role;
}

function isStaff(role?: string) {
  return role === 'OWNER' || role === 'ADMIN_KLINIK';
}

export async function searchProducts(input: z.infer<typeof productSearchSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = productSearchSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Query pencarian tidak valid.' };
  }

  if (!isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mencari produk.' };
  }

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: parsed.data.query } },
        { sku: { contains: parsed.data.query } },
        { barcode: { contains: parsed.data.query } },
      ],
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      sellPrice: true,
      stock: true,
      category: { select: { name: true } },
    },
    take: 20,
  });

  const result = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    sellPrice: product.sellPrice,
    stock: product.stock,
    categoryName: product.category?.name ?? null,
  }));

  return { success: true, products: result };
}

export async function createPosSale(input: z.infer<typeof createPosSaleSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = createPosSaleSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data transaksi tidak valid.' };
  }

  if (!isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melakukan penjualan POS.' };
  }

  const customer = await prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
  if (!customer) {
    return { success: false, message: 'Pelanggan tidak ditemukan.' };
  }

  const items = parsed.data.items;
  const totalSubtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discountAmount = parsed.data.discountAmount ?? 0;
  const totalAmount = Math.max(0, totalSubtotal - discountAmount);

  if (parsed.data.paymentAmount < totalAmount) {
    return { success: false, message: 'Jumlah pembayaran kurang dari total transaksi.' };
  }

  const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const status = parsed.data.paymentAmount >= totalAmount ? 'PAID' : 'UNPAID';

  const invoice = await prisma.$transaction(async (tx) => {
    const createdInvoice = await tx.invoice.create({
      data: {
        customerId: parsed.data.customerId,
        invoiceNumber,
        status,
        totalAmount,
        items: {
          create: items.map((item) => ({
            type: 'PRODUK',
            description: item.description,
            qty: item.qty,
            price: item.price,
            subtotal: item.qty * item.price,
          })),
        },
        payments: {
          create: {
            method: parsed.data.paymentMethod,
            amount: parsed.data.paymentAmount,
          },
        },
      },
      include: {
        customer: true,
        items: true,
        payments: true,
      },
    });

    for (const item of items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        throw new Error('Produk tidak ditemukan saat memproses penjualan.');
      }
      if (product.stock < item.qty) {
        throw new Error(`Stok produk ${product.name} tidak cukup.`);
      }

      await tx.product.update({
        where: { id: item.productId },
        data: { stock: product.stock - item.qty },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          quantity: item.qty,
          note: `Penjualan POS - ${invoiceNumber}`,
        },
      });
    }

    return createdInvoice;
  });

  revalidatePath('/pos');
  revalidatePath('/billing');
  revalidatePath('/dashboard');
  revalidatePath('/portal/invoices');

  return {
    success: true,
    invoice,
    changeAmount: parsed.data.paymentAmount - totalAmount,
  };
}
