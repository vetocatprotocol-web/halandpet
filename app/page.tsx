import { redirect } from 'next/navigation';
import { auth } from '../lib/auth';

const STAFF_ROLES = ['OWNER', 'ADMIN_KLINIK', 'DOKTER'];

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const role = (session.user as { role?: string } | undefined)?.role ?? 'CUSTOMER';

  if (STAFF_ROLES.includes(role)) {
    redirect('/dashboard');
  }

  redirect('/portal');
}
