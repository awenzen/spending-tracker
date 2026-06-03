import cron from 'node-cron';
import { sendMessage } from './whatsapp.js';
import { generateWeeklyReport } from './weekly-report.js';

/**
 * Sends weekly reports automatically.
 * Default: every Sunday at 9 AM Jakarta time (which is 2 AM UTC).
 *
 * Cron format: minute hour day month weekday
 *   '0 2 * * 0' = Sunday 02:00 UTC = Sunday 09:00 WIB
 */
export function startWeeklyScheduler() {
  const schedule = process.env.WEEKLY_CRON || '0 2 * * 0';
  const recipients = (process.env.WEEKLY_REPORT_RECIPIENTS || '').split(',').map(n => n.trim()).filter(Boolean);

  if (recipients.length === 0) {
    console.warn('⚠️  No WEEKLY_REPORT_RECIPIENTS set — weekly reports won\'t be sent automatically.');
    return;
  }

  cron.schedule(schedule, async () => {
    console.log('📅 Running weekly report job...');
    try {
      const report = await generateWeeklyReport();
      for (const number of recipients) {
        await sendMessage(number, report);
      }
      console.log(`✅ Weekly report sent to ${recipients.length} recipient(s)`);
    } catch (err) {
      console.error('Weekly report job failed:', err);
    }
  }, {
    timezone: 'UTC', 
  });

  console.log(`📅 Weekly report scheduled: "${schedule}" → ${recipients.length} recipient(s)`);
}
