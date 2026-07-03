'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getNotifications } from '@/actions/notification';

export function NotificationBell() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 45000);

    return () => clearInterval(interval);
  }, []);

  async function loadNotifications() {
    const result = await getNotifications();
    if (result.success) {
      setCount(result.data?.unreadCount ?? 0);
    }
  }

  return (
    <button className="relative rounded-full border border-zinc-200 p-2.5 text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900" aria-label="Notifikasi">
      <Bell className="h-4 w-4" />
      {count > 0 ? <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">{count}</span> : null}
    </button>
  );
}
