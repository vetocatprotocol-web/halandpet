import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const STAFF_ROLES = ['OWNER', 'ADMIN_KLINIK', 'DOKTER'];

// Modul yang TIDAK boleh diakses Dokter (sesuai spesifikasi §5.3)
const DOKTER_BLOCKED_SEGMENTS = ['petshop', 'pos', 'billing', 'users', 'settings'];

const STAFF_SEGMENTS = [
  'dashboard',
  'customers',
  'pets',
  'appointments',
  'medical-records',
  'pet-hotel',
  'petshop',
  'pos',
  'billing',
  'reports',
  'users',
  'settings',
  'profile',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const role = token?.role as string | undefined;

  const firstSegment = pathname.split('/')[1] ?? '';
  const isStaffRoute = STAFF_SEGMENTS.includes(firstSegment);
  const isCustomerRoute = firstSegment === 'portal';

  if (!token) {
    if (isStaffRoute || isCustomerRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  }

  if (isStaffRoute) {
    if (!STAFF_ROLES.includes(role ?? '')) {
      return NextResponse.redirect(new URL('/portal', request.url));
    }

    if (role === 'DOKTER' && DOKTER_BLOCKED_SEGMENTS.includes(firstSegment)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  }

  if (isCustomerRoute) {
    if (role !== 'CUSTOMER') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/customers/:path*',
    '/pets/:path*',
    '/appointments/:path*',
    '/medical-records/:path*',
    '/pet-hotel/:path*',
    '/petshop/:path*',
    '/pos/:path*',
    '/billing/:path*',
    '/reports/:path*',
    '/users/:path*',
    '/settings/:path*',
    '/profile/:path*',
    '/portal/:path*',
  ],
};
