import * as genomicLabService from './genomicLabService.js';

let isSyncRunning = false;

export const startHinaiScheduler = () => {
  const intervalMinutes = parseInt(process.env.HINAI_SYNC_INTERVAL_MINUTES || '15', 10);
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[Hinai Scheduler] Background Oracle HIS Sync Scheduler initialized (Interval: ${intervalMinutes} mins)`);

  const runSyncTask = async () => {
    if (isSyncRunning) {
      console.log('[Hinai Scheduler] Sync process already running. Skipping cycle.');
      return;
    }

    isSyncRunning = true;
    try {
      const daysBack = parseInt(process.env.HINAI_SYNC_DAYS_BACK || '90', 10);
      console.log(`[Hinai Scheduler] Running scheduled Oracle HIS sync (Last ${daysBack} days)...`);
      const res = await genomicLabService.syncHinaiOrdersToDb(daysBack);
      console.log(`[Hinai Scheduler] Sync Cycle Finished: Inserted: ${res.inserted}, Updated: ${res.updated}, Total: ${res.total}`);
    } catch (err) {
      console.error('[Hinai Scheduler Error]:', err.message);
    } finally {
      isSyncRunning = false;
    }
  };

  // Run initial sync after 10 seconds of app start
  setTimeout(runSyncTask, 10000);

  // Set recurring timer
  setInterval(runSyncTask, intervalMs);
};
