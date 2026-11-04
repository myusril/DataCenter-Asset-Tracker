import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { publicUserSelect, type PublicUser } from '../auth/auth.service.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { AppError } from '../../utils/response.js';
import type { UpdateProfileInput } from './user.schema.js';

const EMAIL_CONFLICT = 'A user with this email already exists';

function emailConflict(): AppError {
  return new AppError(409, EMAIL_CONFLICT, [{ field: 'email', message: EMAIL_CONFLICT }]);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/**
 * Updates the caller's own profile. The username, role, and activation flag
 * are not part of the input type, so this endpoint cannot escalate privileges.
 *
 * Changing the password does not sign the user out: the JWT carries the user
 * id, not a credential fingerprint, and every request reloads the row. The
 * client decides whether to force a re-login.
 */
export async function updateOwnProfile(
  userId: number,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, isActive: true },
  });

  if (!current || !current.isActive) {
    throw new AppError(401, 'User account is not available');
  }

  const data: { fullName?: string; email?: string; passwordHash?: string } = {};

  if (input.fullName !== undefined) {
    data.fullName = input.fullName;
  }

  if (input.email !== undefined) {
    // Excluding the caller's own row keeps a case-only or unchanged email a
    // no-op instead of a conflict with the user's current address.
    const duplicate = await prisma.user.findFirst({
      where: { email: input.email, id: { not: userId } },
      select: { id: true },
    });
    if (duplicate) {
      throw emailConflict();
    }
    data.email = input.email;
  }

  if (input.password !== undefined) {
    const matches =
      input.currentPassword !== undefined &&
      (await verifyPassword(input.currentPassword, current.passwordHash));
    if (!matches) {
      throw new AppError(400, 'Current password is incorrect', [
        { field: 'currentPassword', message: 'Current password is incorrect' },
      ]);
    }
    data.passwordHash = await hashPassword(input.password);
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: publicUserSelect,
    });
  } catch (error) {
    // The pre-check can lose a race with a concurrent registration; the unique
    // index is the authority, and the caller still deserves a field-level 409.
    if (isUniqueViolation(error)) {
      throw emailConflict();
    }
    throw error;
  }
}
