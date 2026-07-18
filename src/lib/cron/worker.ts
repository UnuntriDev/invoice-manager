import cron from "node-cron";
import { reconcileOrphanedAttachments } from "@/lib/services/attachment-reconciliation.service";
import { runCronTick } from "@/lib/cron/schedule-worker";
import { CRON_TIME_ZONE } from "@/lib/cron/timezone";

export function startCronWorker() {
  cron.schedule(
    "7 * * * *",
    async () => {
      try {
        await reconcileOrphanedAttachments();
      } catch (error) {
        console.error("[attachment-reconciliation-failed]", error);
      }
    },
    { timezone: CRON_TIME_ZONE, noOverlap: true }
  );

  cron.schedule(
    "* * * * *",
    async () => {
      try {
        await runCronTick(new Date());
      } catch (error) {
        console.error("[CRON] Błąd ticka harmonogramu", error);
      }
    },
    { timezone: CRON_TIME_ZONE, noOverlap: true }
  );

  console.log(
    `[CRON] KSeF worker started, timezone ${CRON_TIME_ZONE}, checking every minute`
  );
}
