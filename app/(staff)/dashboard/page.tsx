'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Banknote, BarChart3, CalendarDays, PawPrint, Receipt, Stethoscope, Users, Warehouse } from 'lucide-react';
import { getReportSummary } from '@/actions/report';
import { formatCurrency } from '@/lib/utils';

type DoctorSummary = {
  myAppointmentsToday: number;
  waitingAppointments: number;
  medicalRecordsThisMonth: number;
};

type StaffSummary = {
  totalCustomers: number;
  totalPets: number;
  appointmentsToday: number;
  occupiedRooms: number;
  lowStockCount: number;
  unpaidInvoices: number;
  revenueToday: number;
  salesToday: number;
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [doctorSummary, setDoctorSummary] = useState<DoctorSummary | null>(null);
  const [staffSummary, setStaffSummary] = useState<StaffSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const result = await getReportSummary();
      if (!isMounted) return;

      if (result.success && result.data) {
        if (result.data.role === 'DOKTER') {
          setDoctorSummary(result.data.summary as DoctorSummary);
        } else {
          setStaffSummary(result.data.summary as StaffSummary);
        }
      }
      setIsLoading(false);
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const isDoctor = role === 'DOKTER';
  const isOwner = role === 'OWNER';

  const doctorCards = doctorSummary
    ? [
        { title: 'Appointment Saya Hari Ini', value: String(doctorSummary.myAppointmentsToday), subtitle: 'Jadwal pemeriksaan hari ini', icon: CalendarDays },
        { title: 'Pasien Menunggu', value: String(doctorSummary.waitingAppointments), subtitle: 'Antrian menunggu pemeriksaan', icon: Stethoscope },
        { title: 'Pasien Bulan Ini', value: String(doctorSummary.medicalRecordsThisMonth), subtitle: 'Rekam medis dibuat bulan ini', icon: Users },
      ]
    : [];

  const staffCards = staffSummary
    ? [
        { title: 'Pelanggan', value: String(staffSummary.totalCustomers), subtitle: 'Total pelanggan terdaftar', icon: Users },
        { title: 'Hewan Peliharaan', value: String(staffSummary.totalPets), subtitle: 'Total hewan terdaftar', icon: PawPrint },
        { title: 'Appointment Hari Ini', value: String(staffSummary.appointmentsToday), subtitle: 'Jadwal pemeriksaan hari ini', icon: CalendarDays },
        { title: 'Kamar Terisi', value: String(staffSummary.occupiedRooms), subtitle: 'Pet hotel sedang digunakan', icon: BarChart3 },
        { title: 'Stok Menipis', value: String(staffSummary.lowStockCount), subtitle: 'Produk di bawah stok minimum', icon: Warehouse },
        { title: 'Penjualan Hari Ini', value: String(staffSummary.salesToday), subtitle: 'Transaksi lunas hari ini', icon: Receipt },
        ...(isOwner
          ? [
              { title: 'Pendapatan Hari Ini', value: formatCurrency(staffSummary.revenueToday), subtitle: 'Total invoice lunas hari ini', icon: Banknote },
              { title: 'Invoice Belum Lunas', value: String(staffSummary.unpaidInvoices), subtitle: 'Tagihan menunggu pembayaran', icon: Receipt },
            ]
          : []),
      ]
    : [];

  const cards = isDoctor ? doctorCards : staffCards;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Dashboard Staff</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">
          {isDoctor ? 'Jadwal & pasien saya' : 'Ringkasan operasional'}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {isDoctor
            ? 'Ringkasan appointment dan pasien yang Anda tangani.'
            : 'Ringkasan operasional klinik hari ini.'}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-32 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-600">{card.title}</p>
                  <div className="rounded-lg bg-zinc-100 p-2 text-zinc-700">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-4 text-2xl font-semibold text-zinc-900">{card.value}</p>
                <p className="mt-1 text-sm text-zinc-500">{card.subtitle}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
