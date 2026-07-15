function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
}

export function logAttachmentCleanupError(
  operation: string,
  filePath: string,
  error: unknown
) {
  console.error("[attachment-cleanup-failed]", {
    operation,
    filePath,
    error: errorDetails(error),
  });
}

export function logMissingAttachment(documentId: string, filePath: string) {
  console.warn("[attachment-missing]", { documentId, filePath });
}
