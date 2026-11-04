import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../../utils/logger.js';
import { createMaintenanceReminders } from './maintenance.service.js';

/** 07:00 on the server's local clock, every day. */
const PATTERN = '0 7 * * *';

let task: ScheduledTask | null = null;

/**
 * The job only schedules the scan; tests exercise
 * `createMaintenanceReminders` directly instead of waiting for a timer.
 */
export function startReminderJob(): void {
  if (task) {
    return;
  }

  task = cron.schedule(
    PATTERN,
    async () => {
      try {
        const result = await createMaintenanceReminders();
        logger.info(
          `⏰ Maintenance reminders: scanned ${result.scanned} schedule(s), created ${result.created}, skipped ${result.skipped}`,
        );
      } catch (error) {
        logger.error(
          `Maintenance reminder job failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    { noOverlap: true, name: 'maintenance-reminders' },
  );

  const nextRun = task.getNextRun();
  logger.info(
    `⏰ Maintenance reminder job enabled (${PATTERN}, next run ${nextRun ? nextRun.toISOString() : 'unknown'})`,
  );
}

export function stopReminderJob(): void {
  if (!task) {
    return;
  }
  void task.stop();
  task = null;
}
