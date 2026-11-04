import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import type { AuthUser } from '../../middlewares/auth.middleware.js';
import { signToken } from '../../utils/jwt.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { AppError } from '../../utils/response.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

/** Everything except passwordHash, safe to send to clients. */
export const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export async function registerUser(
  input: RegisterInput,
  requester?: AuthUser,
): Promise<PublicUser> {
  const userCount = await prisma.user.count();

  // Bootstrap rule: the very first account may be an admin; afterwards an
  // admin can only be created by another admin.
  if (input.role === 'ADMIN' && userCount > 0 && requester?.role !== 'ADMIN') {
    throw new AppError(403, 'Only an administrator can register another administrator');
  }

  const duplicate = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { email: input.email }] },
    select: { username: true, email: true },
  });

  if (duplicate) {
    const field = duplicate.username === input.username ? 'username' : 'email';
    const message = `A user with this ${field} already exists`;
    throw new AppError(409, message, [{ field, message }]);
  }

  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
      role: input.role,
    },
    select: publicUserSelect,
  });
}

export interface LoginResult {
  token: string;
  user: PublicUser;
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { username: input.username },
    select: { id: true, passwordHash: true, isActive: true },
  });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, 'Invalid username or password');
  }

  if (!user.isActive) {
    throw new AppError(403, 'Account is inactive');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
    select: publicUserSelect,
  });

  const token = signToken({ sub: updated.id, username: updated.username, role: updated.role });
  return { token, user: updated };
}

export async function getProfile(userId: number): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user || !user.isActive) {
    throw new AppError(401, 'User account is not available');
  }

  return user;
}
