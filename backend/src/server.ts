import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import {
  startReminderJob,
  stopReminderJob,
} from './modules/maintenance/maintenance.reminder.job.js';
import { initPushProvider } from './modules/notification/push.provider.js';
import { logger } from './utils/logger.js';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  logger.info('✅ Database connected');

  // Resolves once: enabled FCM provider or a no-op with one boot warning.
  initPushProvider();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
    logger.info(`📝 Environment: ${env.NODE_ENV}`);
  });

  if (env.REMINDER_JOB_ENABLED) {
    startReminderJob();
  } else {
    logger.info('⏰ Maintenance reminder job disabled (REMINDER_JOB_ENABLED=false)');
  }

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down`);
    stopReminderJob();
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
