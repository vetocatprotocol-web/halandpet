import { getServerSession } from 'next-auth/next';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './db';

const loginSchema = z.object({
  username: z.string().trim().min(1),
  pin: z.string().trim().min(1),
});

export const authOptions: any = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) {
            console.error('[authorize] Validasi schema gagal:', parsed.error);
            return null;
          }

          const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
          if (!user) {
            console.error('[authorize] User tidak ditemukan:', parsed.data.username);
            return null;
          }
          if (!user.isActive) {
            console.error('[authorize] User tidak aktif:', parsed.data.username);
            return null;
          }

        const now = new Date();
        if (user.isLocked && user.lockedUntil && user.lockedUntil > now) {
          return null;
        }

        if (user.isLocked && (!user.lockedUntil || user.lockedUntil <= now)) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isLocked: false,
              lockedUntil: null,
              failedPinAttempts: 0,
            },
          });
        }

        let isValidPin = false;
        try {
          isValidPin = await bcrypt.compare(parsed.data.pin, user.pinHash);
        } catch (error) {
          console.error('[authorize] bcrypt.compare failed:', error, { username: parsed.data.username, pinHashLength: user.pinHash?.length });
          return null;
        }

        if (!isValidPin) {
          console.error('[authorize] PIN tidak valid untuk user:', parsed.data.username);
          const nextAttempts = (user.failedPinAttempts ?? 0) + 1;
          const shouldLock = nextAttempts >= 5;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedPinAttempts: nextAttempts,
              isLocked: shouldLock,
              lockedUntil: shouldLock ? new Date(now.getTime() + 15 * 60 * 1000) : null,
            },
          });

          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedPinAttempts: 0,
            isLocked: false,
            lockedUntil: null,
          },
        });

        console.log('[authorize] Login berhasil untuk user:', parsed.data.username, 'dengan role:', user.role);
        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          mustChangePin: user.mustChangePin,
        };
        } catch (error) {
          console.error('[authorize] Error tidak terduga:', error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role as string;
        token.mustChangePin = Boolean((user as { mustChangePin?: boolean }).mustChangePin);
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as { id?: string; role?: string; mustChangePin?: boolean }).id = token.id as string;
        (session.user as { id?: string; role?: string; mustChangePin?: boolean }).role = token.role as string;
        (session.user as { id?: string; role?: string; mustChangePin?: boolean }).mustChangePin = Boolean(token.mustChangePin);
      }
      return session;
    },
  },
};

export const auth = () => getServerSession(authOptions) as Promise<any>;

