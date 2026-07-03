'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Save, Upload, ShieldCheck } from 'lucide-react';
import { createBackup, getSettingsData, restoreBackup, updateSettings } from '@/actions/settings';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    clinicName: '',
    logo: '',
    address: '',
    phone: '',
    operationalHours: '',
    invoiceFormat: '',
    currency: '',
  });

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const result = await getSettingsData();
    if (result.success && result.data) {
      const data = result.data;
      setSettings(data.settings);
      setAuditLogs(data.auditLogs ?? []);
      setIsOwner(data.isOwner ?? false);
      setForm({
        clinicName: data.settings?.clinicName ?? '',
        logo: data.settings?.logo ?? '',
        address: data.settings?.address ?? '',
        phone: data.settings?.phone ?? '',
        operationalHours: data.settings?.operationalHours ?? '',
        invoiceFormat: data.settings?.invoiceFormat ?? '',
        currency: data.settings?.currency ?? '',
      });
    } else {
      setMessage(result.message ?? 'Gagal memuat pengaturan.');
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const result = await updateSettings(form);
    setMessage(result.message ?? 'Simpan pengaturan selesai.');
    if (result.success) {
      await loadData();
    }
  }

  async function handleBackup() {
    const result = await createBackup();
    if (!result.success) {
      setMessage(result.message ?? 'Gagal membuat backup.');
      return;
    }
    if (!result.data) {
      setMessage('Backup gagal: data kosong.');
      return;
    }

    const blob = new Blob([result.data.content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.data.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage('Backup berhasil diunduh.');
  }

  async function handleRestore() {
    if (!fileInputRef.current?.files?.[0]) return;
    const file = fileInputRef.current.files[0];
    const content = await file.text();
    const result = await restoreBackup({ content });
    setMessage(result.message ?? 'Restore selesai.');
    if (result.success) {
      await loadData();
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Pengaturan</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">Identitas klinik dan audit log</h1>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">{message}</div> : null}

      <form onSubmit={handleSave} className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="space-y-3">
            <label className="block text-sm text-zinc-600">
              Nama klinik
              <input type="text" value={form.clinicName} onChange={(event) => setForm({ ...form, clinicName: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Logo URL
              <input type="text" value={form.logo} onChange={(event) => setForm({ ...form, logo: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Alamat
              <input type="text" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Telepon
              <input type="text" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Jam operasional
              <input type="text" value={form.operationalHours} onChange={(event) => setForm({ ...form, operationalHours: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Format nomor invoice
              <input type="text" value={form.invoiceFormat} onChange={(event) => setForm({ ...form, invoiceFormat: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Mata uang
              <input type="text" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
          </div>

          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white">
            <Save className="h-4 w-4" /> Simpan pengaturan
          </button>
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-700">
            <ShieldCheck className="h-4 w-4" />
            <h2 className="text-base font-semibold">Audit log</h2>
          </div>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-zinc-500">Tidak ada catatan audit.</p>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-zinc-900">{log.action}</p>
                    <p className="text-xs text-zinc-500">{new Date(log.date).toLocaleString('id-ID')}</p>
                  </div>
                  <p>{log.description}</p>
                  <p className="text-xs text-zinc-500">Oleh {log.user.name}</p>
                </div>
              ))}
            </div>
          )}
          {isOwner ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                <button type="button" onClick={handleBackup} className="text-sm font-medium text-zinc-900">Backup sekarang</button>
              </div>
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <label className="text-sm font-medium text-zinc-900">
                  Restore backup
                  <input type="file" ref={fileInputRef} accept=".json" className="mt-2 block w-full text-sm text-zinc-500" />
                </label>
              </div>
              <button type="button" onClick={handleRestore} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900">
                <Upload className="h-4 w-4" /> Proses restore
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Fitur backup & restore hanya untuk Owner.</p>
          )}
        </div>
      </form>
    </div>
  );
}
