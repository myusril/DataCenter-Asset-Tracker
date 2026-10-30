// Hermetic defaults for unit tests. The engine tests never touch the database;
// these values only satisfy env validation when the service module loads.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://jest@localhost:5432/jest_test';
process.env.JWT_SECRET ??= 'jest-only-secret-value-with-at-least-32-chars';
