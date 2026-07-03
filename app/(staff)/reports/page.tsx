'use client';

import { useEffect, useState } from 'react';
import { getReportSummary } from '@/actions/report';

type ReportSummary = Record<string, number | string>;

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadReport();
  }, []);

  async function loadReport() {
    const result = await getReportSummary();
    if (result.success) {
      setSummary(((result.data?.summary) as unknown) as ReportSummary ?? null);
    } else {
      setMessage(result.message ?? 'Gagal memuat laporan.');
    }
  }

  if (!summary) {
    return <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">{message || 'Memuat laporan...'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Laporan</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">Ringkasan sesuai peran Anda</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(summary).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-zinc-600">{key.replace(/([A-Z])/g, ' $1')}</p>
            <p className="mt-3 text-2xl font-semibold text-zinc-900">{typeof value === 'number' ? value : String(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
