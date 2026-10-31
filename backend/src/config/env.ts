import { resolve } from 'node:path';
import { z } from 'zod';

// Load .env when present. Variables already exported by the shell win because
// process.loadEnvFile does not overwrite existing keys.
try {
  process.loadEnvFile(resolve(process.cwd(), '.env'));
} catch {
  // .env is optional (CI or exported variables); validation below reports gaps.
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  // Comma-separated allowlist. Empty means "reflect the request origin",
  // which is convenient for local Expo/web clients but not for production.
  CORS_ORIGIN: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_TECH_PASSWORD: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[ERROR] - ❌ Invalid environment configuration');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  console.error('Copy backend/.env.example to backend/.env and fill in every value.');
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
