import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  logger.info('✅ Database connected');

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
    logger.info(`📝 Environment: ${env.NODE_ENV}`);
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  logger.error(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
