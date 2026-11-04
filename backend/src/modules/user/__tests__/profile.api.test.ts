import request from 'supertest';
import { createApp } from '../../../app.js';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
} from '../../../../test/support/database.js';
import { auth, createUser, TEST_PASSWORD } from '../../../../test/support/fixtures.js';
import { verifyPassword } from '../../../utils/password.js';

const app = createApp();

afterAll(disconnectDatabase);

describe('PATCH /api/users/me', () => {
  beforeEach(resetDatabase);

  it('updates the full name and email of the caller', async () => {
    const user = await createUser({ username: 'admin', role: 'ADMIN' });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(user.token))
      .send({ fullName: 'Administrator DC', email: 'admin.dc@test.local' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          username: 'admin',
          role: 'ADMIN',
          fullName: 'Administrator DC',
          email: 'admin.dc@test.local',
          isActive: true,
        },
      },
    });
    expect(response.body.data.user).not.toHaveProperty('passwordHash');

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.fullName).toBe('Administrator DC');
    expect(stored.email).toBe('admin.dc@test.local');
  });

  it('accepts the caller keeping their own email', async () => {
    const user = await createUser({
      username: 'owner',
      email: 'owner@test.local',
      fullName: 'Old Name',
    });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(user.token))
      .send({ email: 'owner@test.local', fullName: 'New Name' });

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe('owner@test.local');
    expect(response.body.data.user.fullName).toBe('New Name');
  });

  it('lets a technician edit their own profile', async () => {
    const technician = await createUser({ username: 'tech', role: 'TECHNICIAN' });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(technician.token))
      .send({ fullName: 'Teknisi Lapangan' });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      username: 'tech',
      role: 'TECHNICIAN',
      fullName: 'Teknisi Lapangan',
    });
  });

  it('changes the password, rejects the old one, and keeps the current token valid', async () => {
    const user = await createUser({ username: 'secure' });
    const newPassword = 'N3wPassw0rd!';

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(user.token))
      .send({ password: newPassword, currentPassword: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).not.toBe(newPassword);
    await expect(verifyPassword(newPassword, stored.passwordHash)).resolves.toBe(true);
    await expect(verifyPassword(TEST_PASSWORD, stored.passwordHash)).resolves.toBe(false);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'secure', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'secure', password: newPassword });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.data.user.fullName).toBe('Fixture secure');

    const stillValid = await request(app).get('/api/auth/me').set(auth(user.token));
    expect(stillValid.status).toBe(200);
    expect(stillValid.body.data.user.username).toBe('secure');
  });

  it('can combine a name, an email, and a password change', async () => {
    const user = await createUser({ username: 'combo' });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(user.token))
      .send({
        fullName: 'Kombinasi',
        email: 'combo@test.local',
        password: 'C0mb0Pass!',
        currentPassword: TEST_PASSWORD,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      fullName: 'Kombinasi',
      email: 'combo@test.local',
    });
  });

  it('rejects a wrong current password with 400 and stores nothing', async () => {
    const user = await createUser({ username: 'wrongpass' });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(user.token))
      .send({
        fullName: 'Should Not Apply',
        password: 'An0therPass!',
        currentPassword: 'not-the-password',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Current password is incorrect',
      errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }],
    });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.fullName).toBe(before.fullName);
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('requires currentPassword when a new password is sent', async () => {
    const user = await createUser({ username: 'nocurrent' });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(user.token))
      .send({ password: 'An0therPass!' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'currentPassword' }],
    });
  });

  it('rejects currentPassword without a new password', async () => {
    const user = await createUser({ username: 'onlycurrent' });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(user.token))
      .send({ currentPassword: TEST_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: 'password', message: 'Provide a new password when sending the current password' },
    ]);
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const user = await createUser({ username: 'shortpass' });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(user.token))
      .send({ password: 'short', currentPassword: TEST_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: 'password', message: 'Password must be at least 8 characters' },
    ]);
  });

  it('rejects an invalid email with 400', async () => {
    const user = await createUser({ username: 'bademail' });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(user.token))
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([{ field: 'email', message: 'Invalid email format' }]);
  });

  it('returns 409 when another user already owns the email', async () => {
    const caller = await createUser({ username: 'caller' });
    await createUser({ username: 'other', email: 'taken@test.local' });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(caller.token))
      .send({ email: 'taken@test.local' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: 'A user with this email already exists',
      errors: [{ field: 'email', message: 'A user with this email already exists' }],
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: caller.id } });
    expect(stored.email).toBe('caller@test.local');
  });

  it('rejects username, role, and isActive instead of ignoring them', async () => {
    const user = await createUser({ username: 'immutable', role: 'TECHNICIAN' });

    for (const body of [
      { username: 'renamed' },
      { role: 'ADMIN' },
      { isActive: false },
    ]) {
      const response = await request(app)
        .patch('/api/users/me')
        .set(auth(user.token))
        .send({ ...body, fullName: 'Still Me' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors[0].message).toContain('Unrecognized key');
    }

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.username).toBe('immutable');
    expect(stored.role).toBe('TECHNICIAN');
    expect(stored.isActive).toBe(true);
    expect(stored.fullName).toBe('Fixture immutable');
  });

  it('rejects an empty body with 400', async () => {
    const user = await createUser({ username: 'emptybody' });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(user.token))
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: 'body', message: 'Provide at least one of fullName, email, or password' },
    ]);
  });

  it('requires a bearer token', async () => {
    const response = await request(app)
      .patch('/api/users/me')
      .send({ fullName: 'Anonymous' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: 'Authentication required',
    });
  });

  it('rejects an invalid token', async () => {
    const response = await request(app)
      .patch('/api/users/me')
      .set(auth('not-a-token'))
      .send({ fullName: 'Forged' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or expired token');
  });

  it('has no route for editing another user by id', async () => {
    const caller = await createUser({ username: 'self' });
    const other = await createUser({ username: 'target' });

    const response = await request(app)
      .patch(`/api/users/${other.id}`)
      .set(auth(caller.token))
      .send({ fullName: 'Hijacked' });

    expect(response.status).toBe(404);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: other.id } });
    expect(stored.fullName).toBe('Fixture target');
  });

  it('rejects a deactivated account even with a token issued earlier', async () => {
    const user = await createUser({ username: 'inactive' });
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const response = await request(app)
      .patch('/api/users/me')
      .set(auth(user.token))
      .send({ fullName: 'Blocked' });

    expect(response.status).toBe(401);
  });
});
