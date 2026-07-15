import prisma from "@/lib/prisma";
import { reconcileAttachmentStorage } from "@/lib/storage/attachment-storage";
import { logAttachmentCleanupError } from "@/lib/storage/attachment-logger";

export async function reconcileOrphanedAttachments() {
  // Najpierw pobieramy kompletny zbiór referencji z DB. Jeżeli zapytanie nie
  // powiedzie się, żaden plik nie jest dotykany.
  const documents = await prisma.document.findMany({
    where: { filePath: { not: null } },
    select: { filePath: true },
  });
  const report = await reconcileAttachmentStorage(
    documents.flatMap((document) =>
      document.filePath ? [document.filePath] : []
    )
  );

  for (const failure of report.errors) {
    logAttachmentCleanupError(
      "scheduled-orphan-reconciliation",
      failure.filePath,
      failure.error
    );
  }

  if (
    report.deletedOrphans.length > 0 ||
    report.deletedStaged.length > 0 ||
    report.restoredStaged.length > 0
  ) {
    console.info("[attachment-reconciliation]", {
      deletedOrphans: report.deletedOrphans.length,
      deletedStaged: report.deletedStaged.length,
      restoredStaged: report.restoredStaged.length,
    });
  }

  return report;
}
