'use client';

import { useEffect, useMemo, useState } from 'react';
import { CreditCard, FileIcon, Lock, Printer, Plus, Trash2, Wallet } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cancelInvoice, createInvoice, getInvoiceLookups, listInvoices, recordInvoicePayment } from '@/actions/invoice';

type InvoiceItemForm = {
  type: 'KONSULTASI' | 'TINDAKAN' | 'OBAT' | 'PET_HOTEL' | 'PRODUK';
  description: string;
  qty: string;
  price: string;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  date: string;
  customer: { name: string };
};

type CustomerOption = { id: string; name: string };

export default function BillingPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [message, setMessage] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerId: '',
    discountAmount: '0',
    initialPaymentAmount: '0',
    initialPaymentMethod: 'CASH' as 'CASH' | 'NON_CASH',
  });
  const [itemForm, setItemForm] = useState<InvoiceItemForm>({ type: 'KONSULTASI', description: '', qty: '1', price: '0' });
  const [items, setItems] = useState<InvoiceItemForm[]>([]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const [lookupResult, invoicesResult] = await Promise.all([getInvoiceLookups(), listInvoices()]);
    if (lookupResult.success) setCustomers(lookupResult.customers ?? []);
    if (invoicesResult.success) setInvoices((invoicesResult.invoices ?? []).map((inv: any) => ({ ...inv, date: (inv.date as Date).toISOString() })));
  }

  const selectedInvoice = useMemo(() => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null, [invoices, selectedInvoiceId]);

  function addItem() {
    if (!itemForm.description.trim()) {
      setMessage('Deskripsi item harus diisi.');
      return;
    }
    if (Number(itemForm.qty) <= 0 || Number(itemForm.price) < 0) {
      setMessage('Jumlah dan harga harus valid.');
      return;
    }

    setItems((current) => [...current, itemForm]);
    setItemForm({ ...itemForm, description: '', qty: '1', price: '0' });
    setMessage('');
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, idx) => idx !== index));
  }

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty) * Number(item.price), 0), [items]);
  const discount = Number(form.discountAmount) || 0;
  const totalAmount = Math.max(0, subtotal - discount);

  async function handleCreateInvoice(event: React.FormEvent) {
    event.preventDefault();
    if (!form.customerId) {
      setMessage('Pilih pelanggan.');
      return;
    }
    if (items.length === 0) {
      setMessage('Tambahkan minimal satu item invoice.');
      return;
    }

    const result = await createInvoice({
      customerId: form.customerId,
      items: items.map((item) => ({
        type: item.type,
        description: item.description,
        qty: Number(item.qty),
        price: Number(item.price),
      })),
      discountAmount: discount,
      initialPaymentAmount: Number(form.initialPaymentAmount),
      initialPaymentMethod: form.initialPaymentMethod,
    });

    if (!result.success) {
      setMessage(result.message ?? 'Gagal membuat invoice.');
      return;
    }

    setMessage('Invoice berhasil dibuat.');
    setItems([]);
    setForm({ customerId: '', discountAmount: '0', initialPaymentAmount: '0', initialPaymentMethod: 'CASH' });
    await loadData();
  }

  async function handleRecordPayment(amount: number) {
    if (!selectedInvoiceId) return;
    const result = await recordInvoicePayment({ invoiceId: selectedInvoiceId, method: 'CASH', amount });
    if (!result.success) {
      setMessage(result.message ?? 'Gagal mencatat pembayaran.');
      return;
    }
    setMessage('Pembayaran berhasil dicatat.');
    await loadData();
  }

  async function handleCancelInvoice() {
    if (!selectedInvoiceId) return;
    const result = await cancelInvoice({ id: selectedInvoiceId });
    if (!result.success) {
      setMessage(result.message ?? 'Gagal membatalkan invoice.');
      return;
    }
    setMessage('Invoice dibatalkan.');
    setSelectedInvoiceId(null);
    await loadData();
  }

  function printInvoice(invoice: any) {
    const html = `<!DOCTYPE html><html><head><title>Invoice ${invoice.invoiceNumber}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1,h2,h3{margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px;border:1px solid #ccc;text-align:left}strong{display:inline-block;width:140px}</style></head><body><h1>Invoice</h1><p><strong>No. Invoice:</strong> ${invoice.invoiceNumber}</p><p><strong>Pelanggan:</strong> ${invoice.customer.name}</p><p><strong>Tanggal:</strong> ${formatDate(invoice.date)}</p><p><strong>Status:</strong> ${invoice.status}</p><table><thead><tr><th>Jenis</th><th>Deskripsi</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${invoice.items.map((item: any) => `<tr><td>${item.type}</td><td>${item.description}</td><td>${item.qty}</td><td>${formatCurrency(item.price)}</td><td>${formatCurrency(item.subtotal)}</td></tr>`).join('')}</tbody></table><p><strong>Total:</strong> ${formatCurrency(invoice.totalAmount)}</p><p><strong>Pembayaran:</strong> ${formatCurrency(invoice.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0))}</p></body></html>`;
    const popup = window.open('', '_blank');
    if (popup) {
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
    }
  }

  const tableRows = invoices.map((invoice) => ({
    ...invoice,
    date: formatDate(invoice.date),
    totalAmount: invoice.totalAmount,
    customer: invoice.customer,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-500">Modul Billing</p>
            <h1 className="text-xl font-semibold text-zinc-900">Invoice gabungan</h1>
          </div>
          <div className="flex items-center gap-2 text-zinc-700">
            <FileIcon className="h-5 w-5" />
            <span className="text-sm">Owner & Admin Klinik</span>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-zinc-700">
            <Plus className="h-4 w-4" />
            <h2 className="text-base font-semibold">Buat invoice baru</h2>
          </div>

          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <label className="block text-sm text-zinc-600">
              Pelanggan
              <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Pilih pelanggan</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="block text-sm text-zinc-600">
                Jenis item
                <select value={itemForm.type} onChange={(event) => setItemForm({ ...itemForm, type: event.target.value as InvoiceItemForm['type'] })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                  <option value="KONSULTASI">KONSULTASI</option>
                  <option value="TINDAKAN">TINDAKAN</option>
                  <option value="OBAT">OBAT</option>
                  <option value="PET_HOTEL">PET_HOTEL</option>
                  <option value="PRODUK">PRODUK</option>
                </select>
              </label>

              <label className="block text-sm text-zinc-600">
                Qty
                <input type="number" min="1" value={itemForm.qty} onChange={(event) => setItemForm({ ...itemForm, qty: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
              </label>

              <label className="block text-sm text-zinc-600">
                Harga
                <input type="number" min="0" step="0.01" value={itemForm.price} onChange={(event) => setItemForm({ ...itemForm, price: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
              </label>
            </div>

            <label className="block text-sm text-zinc-600">
              Deskripsi
              <input type="text" value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>

            <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              <Plus className="h-4 w-4" /> Tambah item
            </button>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm text-zinc-700">Item invoice saat ini</div>
              {items.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">Belum ada item.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {items.map((item, index) => (
                    <div key={`${item.description}-${index}`} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-zinc-700">
                        <p className="font-medium">{item.type}</p>
                        <p>{item.description}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-600">
                        <span>{item.qty} x {formatCurrency(Number(item.price))}</span>
                        <button type="button" onClick={() => removeItem(index)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700">Hapus</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-zinc-600">
                Diskon (Rp)
                <input type="number" min="0" value={form.discountAmount} onChange={(event) => setForm({ ...form, discountAmount: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
              </label>
              <label className="block text-sm text-zinc-600">
                Bayar awal (opsional)
                <input type="number" min="0" step="0.01" value={form.initialPaymentAmount} onChange={(event) => setForm({ ...form, initialPaymentAmount: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
              </label>
            </div>

            <label className="block text-sm text-zinc-600">
              Metode pembayaran awal
              <select value={form.initialPaymentMethod} onChange={(event) => setForm({ ...form, initialPaymentMethod: event.target.value as 'CASH' | 'NON_CASH' })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="CASH">Tunai</option>
                <option value="NON_CASH">Non-tunai</option>
              </select>
            </label>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex items-center justify-between"><span>Diskon</span><span>{formatCurrency(discount)}</span></div>
              <div className="mt-2 flex items-center justify-between text-base font-semibold text-zinc-900"><span>Total</span><span>{formatCurrency(totalAmount)}</span></div>
            </div>

            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white">
              <CreditCard className="h-4 w-4" /> Simpan invoice
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-zinc-700">
            <Wallet className="h-4 w-4" />
            <h2 className="text-base font-semibold">Daftar invoice</h2>
          </div>

          <DataTable
            title="Invoice terbaru"
            columns={[
              { key: 'invoiceNumber', header: 'No. Invoice' },
              { key: 'customer', header: 'Pelanggan', render: (row) => row.customer.name },
              { key: 'date', header: 'Tanggal' },
              { key: 'status', header: 'Status' },
              { key: 'totalAmount', header: 'Total', render: (row) => formatCurrency(row.totalAmount) },
              {
                key: 'id',
                header: 'Aksi',
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceId(row.id)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700"
                  >
                    Pilih
                  </button>
                ),
              },
            ]}
            rows={tableRows}
            emptyMessage="Belum ada invoice"
          />

          <div className="mt-4 space-y-3">
            {selectedInvoice ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-600">Invoice terpilih</p>
                    <h3 className="text-lg font-semibold text-zinc-900">{selectedInvoice.invoiceNumber}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => printInvoice(selectedInvoice)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                      <Printer className="h-4 w-4" /> Cetak
                    </button>
                    <button type="button" onClick={handleCancelInvoice} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <Trash2 className="h-4 w-4" /> Batalkan
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-zinc-700">
                  <p><strong>Pelanggan:</strong> {selectedInvoice.customer.name}</p>
                  <p><strong>Tanggal:</strong> {selectedInvoice.date}</p>
                  <p><strong>Status:</strong> {selectedInvoice.status}</p>
                  <p><strong>Total:</strong> {formatCurrency(selectedInvoice.totalAmount)}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">Pilih invoice dari daftar untuk melihat detail.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
