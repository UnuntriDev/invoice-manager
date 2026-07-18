import prisma from "@/lib/prisma";
import {
  reconcileAttachmentStorage,
  removeAttachmentIfExists,
} from "@/lib/storage/attachment-storage";
import { logAttachmentCleanupError } from "@/lib/storage/attachment-logger";

const MAX_CLEANUP_BATCH = 100;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

function retryDelayMs(attempt: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, attempt - 1), MAX_RETRY_DELAY_MS);
}

export async function processAttachmentCleanupTask(
  fileKey: string,
): Promise<boolean> {
  try {
    // Brak pliku = sukces (idempotentność)
    await removeAttachmentIfExists(fileKey);
    await prisma.attachmentCleanupTask.deleteMany({ where: { fileKey } });
    return true;
  } catch (error) {
    logAttachmentCleanupError("retryable-document-attachment-delete", fileKey, error);
    try {
      const existing = await prisma.attachmentCleanupTask.findUnique({
        where: { fileKey },
        select: { attempts: true },
      });
      if (existing) {
        const attempts = existing.attempts + 1;
        await prisma.attachmentCleanupTask.updateMany({
          where: { fileKey },
          data: {
            attempts,
            lastError: error instanceof Error ? error.message : String(error),
            nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
          },
        });
      }
    } catch (persistenceError) {
      // Tombstone zostaje; reconciler ponowi po odzyskaniu DB
      logAttachmentCleanupError(
        "retryable-document-attachment-delete-state",
        fileKey,
        persistenceError,
      );
    }
    return false;
  }
}

export async function reconcileOrphanedAttachments() {
  // Bez DB nie usuwamy ze storage
  const [documents, cleanupTasks] = await prisma.$transaction([
    prisma.document.findMany({
      where: { fileKey: { not: null } },
      select: { fileKey: true },
    }),
    prisma.attachmentCleanupTask.findMany({
      where: { nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: "asc" },
      take: MAX_CLEANUP_BATCH,
      select: { fileKey: true },
    }),
  ]);

  for (const task of cleanupTasks) {
    await processAttachmentCleanupTask(task.fileKey);
  }

  const referencedKeys = [
    ...documents.flatMap((document) =>
      document.fileKey ? [document.fileKey] : [],
    ),
    // Pending cleanup nie jest orphanem
    ...cleanupTasks.map((task) => task.fileKey),
  ];
  const report = await reconcileAttachmentStorage(referencedKeys);

  for (const failure of report.errors) {
    logAttachmentCleanupError(
      "scheduled-orphan-reconciliation",
      failure.fileKey,
      failure.error,
    );
  }

  if (report.deletedOrphans.length > 0) {
    console.info("[attachment-reconciliation]", {
      deletedOrphans: report.deletedOrphans.length,
      processedCleanupTasks: cleanupTasks.length,
    });
  }

  return {
    ...report,
    processedCleanupTasks: cleanupTasks.length,
  };
}
