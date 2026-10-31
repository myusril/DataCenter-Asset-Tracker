import request from 'supertest';
import { createApp } from '../app.js';
import { disconnectDatabase, resetDatabase } from '../../test/support/database.js';

const app = createApp();

describe('application shell', () => {
  beforeEach(resetDatabase);
  afterAll(disconnectDatabase);

  it('GET /health reports the runtime environment without authentication', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Server is healthy',
      data: { status: 'ok', environment: 'test' },
    });
    expect(new Date(response.body.data.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('answers unknown routes with the 404 envelope', async () => {
    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Route GET /api/does-not-exist not found',
    });
  });

  it('answers malformed JSON with 400 instead of crashing', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": ');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, message: 'Invalid JSON body' });
  });
});
