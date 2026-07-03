import { auth } from '@/lib/auth';
import { requireModuleAccess } from '@/lib/permissions';

export default async function PetshopLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  
  requireModuleAccess(role, 'petshop');

  return children;
}
