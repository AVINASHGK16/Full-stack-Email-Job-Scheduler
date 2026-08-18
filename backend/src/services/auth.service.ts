import { Profile } from 'passport-google-oauth20';
import { prisma } from '../db';
import type { UserRecord } from '../types/express';

/**
 * Finds an existing User by Google ID or email, or creates a new one.
 *
 * Lookup order:
 *  1. Match by googleId — the stable identifier from Google.
 *  2. If not found by googleId, check whether this email already exists.
 *     If so, safely associate the Google account with that existing user.
 *  3. Otherwise, create a brand-new User record.
 *
 * This prevents duplicate users for repeated logins and safely handles
 * the case where a user previously registered with a matching email.
 */
export async function findOrCreateUser(profile: Profile): Promise<UserRecord> {
  const googleId = profile.id;
  const email = profile.emails?.[0]?.value;
  const name = profile.displayName ?? null;
  const avatarUrl = profile.photos?.[0]?.value ?? null;

  if (!email) {
    throw new Error('Google profile did not provide an email address.');
  }

  // 1. Try to find an existing user by their stable Google ID.
  const existingByGoogleId = await prisma.user.findUnique({
    where: { googleId },
  });

  if (existingByGoogleId) {
    // Update mutable fields (name/avatar may change on Google's side).
    return prisma.user.update({
      where: { id: existingByGoogleId.id },
      data: { name, avatarUrl },
    });
  }

  // 2. No user found by googleId — check if this email already exists.
  const existingByEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingByEmail) {
    // Associate the Google account with the existing email-based user.
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: { googleId, name, avatarUrl },
    });
  }

  // 3. Completely new user — create a fresh record.
  return prisma.user.create({
    data: {
      googleId,
      email,
      name,
      avatarUrl,
    },
  });
}
