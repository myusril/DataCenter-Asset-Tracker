import request from 'supertest';
import { createApp } from '../../../app.js';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
} from '../../../../test/support/database.js';
import { auth, createUser, TEST_PASSWORD } from '../../../../test/support/fixtures.js';

const app = createApp();

afterAll(disconnectDatabase);

const validRegistration = {
  username: 'admin',
  email: 'admin@test.local',
  password: 'Passw0rd!',
  fullName: 'Administrator',
};

describe('POST /api/auth/register', () => {
  beforeEach(resetDatabase);

  it('lets the very first account register as ADMIN', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, role: 'ADMIN' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          username: 'admin',
          email: 'admin@test.local',
          fullName: 'Administrator',
          role: 'ADMIN',
          isActive: true,
        },
      },
    });
    expect(response.body.data.user).not.toHaveProperty('passwordHash');

    const stored = await prisma.user.findUniqueOrThrow({
      where: { username: 'admin' },
    });
    expect(stored.role).toBe('ADMIN');
    expect(stored.passwordHash).not.toBe(validRegistration.password);
  });

  it('defaults the role to TECHNICIAN for anonymous registration after bootstrap', async () => {
    await createUser({ username: 'root', role: 'ADMIN' });

    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, username: 'tech', email: 'tech@test.local' });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('TECHNICIAN');
  });

  it('rejects an anonymous ADMIN registration after bootstrap with 403', async () => {
    await createUser({ username: 'root', role: 'ADMIN' });

    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, username: 'sneaky', email: 'sneaky@test.local', role: 'ADMIN' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: 'Only an administrator can register another administrator',
    });
    expect(await prisma.user.count({ where: { username: 'sneaky' } })).toBe(0);
  });

  it('lets an authenticated administrator create another administrator', async () => {
    const admin = await createUser({ username: 'root', role: 'ADMIN' });

    const response = await request(app)
      .post('/api/auth/register')
      .set(auth(admin.token))
      .send({ ...validRegistration, username: 'admin2', email: 'admin2@test.local', role: 'ADMIN' });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('ADMIN');
  });

  it('returns 409 with the conflicting field for a duplicate username', async () => {
    await createUser({ username: 'root', role: 'ADMIN' });

    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, username: 'root', email: 'other@test.local' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: 'A user with this username already exists',
      errors: [{ field: 'username', message: 'A user with this username already exists' }],
    });
  });

  it('returns 409 with the conflicting field for a duplicate email', async () => {
    await createUser({ username: 'root', role: 'ADMIN' });

    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, username: 'another', email: 'root@test.local' });

    expect(response.status).toBe(409);
    expect(response.body.errors).toEqual([
      { field: 'email', message: 'A user with this email already exists' },
    ]);
  });

  it('returns 400 with per-field issues for an invalid payload', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: 'x', email: 'not-an-email', password: 'short', fullName: '' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Validation failed');
    const fields = response.body.errors.map((issue: { field: string }) => issue.field);
    expect(fields).toEqual(expect.arrayContaining(['username', 'email', 'password', 'fullName']));
  });

  it('rejects an invalid bearer token instead of registering anonymously', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Authorization', 'Bearer not-a-jwt')
      .send(validRegistration);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or expired token');
    expect(await prisma.user.count()).toBe(0);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(resetDatabase);

  it('returns a token, updates lastLogin, and never leaks the hash', async () => {
    const user = await createUser({ username: 'tech', role: 'TECHNICIAN' });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'tech', password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Login successful',
      data: { user: { id: user.id, username: 'tech', role: 'TECHNICIAN' } },
    });
    expect(typeof response.body.data.token).toBe('string');
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    expect(response.body.data.user.lastLogin).toEqual(expect.any(String));

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.lastLogin).not.toBeNull();
  });

  it('returns 401 for a wrong password', async () => {
    await createUser({ username: 'tech' });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'tech', password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: 'Invalid username or password',
    });
  });

  it('returns 401 for an unknown username', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: TEST_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid username or password');
  });

  it('returns 403 for a deactivated account with valid credentials', async () => {
    await createUser({ username: 'inactive', isActive: false });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'inactive', password: TEST_PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Account is inactive');
  });

  it('returns 400 when body fields are missing', async () => {
    const response = await request(app).post('/api/auth/login').send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(response.body.errors).toEqual([
      { field: 'username', message: 'Required' },
      { field: 'password', message: 'Required' },
    ]);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(resetDatabase);

  it('returns the authenticated profile', async () => {
    const user = await createUser({ username: 'tech', fullName: 'Budi Santoso' });

    const response = await request(app).get('/api/auth/me').set(auth(user.token));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: { id: user.id, username: 'tech', fullName: 'Budi Santoso', role: 'TECHNICIAN' },
      },
    });
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('returns 401 without a token', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication required');
  });

  it('returns 401 for an empty bearer token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer   ');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication required');
  });

  it('returns 401 for a token whose user was deactivated', async () => {
    const user = await createUser({ username: 'tech' });
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const response = await request(app).get('/api/auth/me').set(auth(user.token));

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or expired token');
  });
});
