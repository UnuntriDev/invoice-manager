export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronWorker } = await import("@/lib/cron/worker");
    startCronWorker();
  }
}
