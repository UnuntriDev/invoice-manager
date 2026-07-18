import { randomUUID } from "crypto";
import { promises as fs, type Dirent } from "fs";
import path from "path";

export interface AttachmentReconciliationReport {
  deletedOrphans: string[];
  errors: Array<{ fileKey: string; error: unknown }>;
}

function getUploadRoot(): string {
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads",
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export function normalizeAttachmentKey(fileKey: string): string {
  const normalized = fileKey.trim();
  if (
    normalized.length === 0 ||
    normalized === "." ||
    normalized === ".." ||
    path.isAbsolute(normalized) ||
    normalized !== path.basename(normalized) ||
    normalized.includes("/") ||
    normalized.includes("\\")
  ) {
    throw new Error("Nieprawidłowy klucz załącznika");
  }

  return normalized;
}

export function resolveAttachmentPath(fileKey: string): string {
  const key = normalizeAttachmentKey(fileKey);
  const uploadRoot = getUploadRoot();
  const resolved = path.resolve(/*turbopackIgnore: true*/ uploadRoot, key);
  const relative = path.relative(uploadRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Ścieżka załącznika znajduje się poza katalogiem uploadów");
  }

  return resolved;
}

export function createAttachmentLocation(extension: ".pdf" | ".xml") {
  const fileName = `${randomUUID()}${extension}`;
  return { fileName, fileKey: fileName };
}

export async function writeAttachment(
  fileKey: string,
  contents: Buffer,
): Promise<void> {
  const resolved = resolveAttachmentPath(fileKey);
  await fs.mkdir(/* turbopackIgnore: true */ path.dirname(resolved), {
    recursive: true,
  });
  await fs.writeFile(/* turbopackIgnore: true */ resolved, contents, {
    flag: "wx",
  });
}

export async function readAttachment(fileKey: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(
      /* turbopackIgnore: true */ resolveAttachmentPath(fileKey),
    );
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

export async function removeAttachmentIfExists(
  fileKey: string,
): Promise<boolean> {
  try {
    await fs.unlink(
      /* turbopackIgnore: true */ resolveAttachmentPath(fileKey),
    );
    return true;
  } catch (error) {
    if (isMissingFileError(error)) return false;
    throw error;
  }
}

async function isOlderThan(fileKey: string, cutoff: number): Promise<boolean> {
  const stats = await fs.stat(
    /* turbopackIgnore: true */ resolveAttachmentPath(fileKey),
  );
  return stats.mtimeMs <= cutoff;
}

export async function reconcileAttachmentStorage(
  referencedFileKeys: string[],
  gracePeriodMs = 60 * 60 * 1000,
): Promise<AttachmentReconciliationReport> {
  const report: AttachmentReconciliationReport = {
    deletedOrphans: [],
    errors: [],
  };
  const referenced = new Set<string>();
  for (const fileKey of referencedFileKeys) {
    try {
      referenced.add(normalizeAttachmentKey(fileKey));
    } catch (error) {
      report.errors.push({ fileKey, error });
    }
  }

  const uploadRoot = getUploadRoot();
  const cutoff = Date.now() - gracePeriodMs;
  let entries: Dirent[];
  try {
    entries = await fs.readdir(/* turbopackIgnore: true */ uploadRoot, {
      withFileTypes: true,
    });
  } catch (error) {
    if (isMissingFileError(error)) return report;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fileKey = entry.name;
    if (referenced.has(fileKey)) continue;

    try {
      if (!(await isOlderThan(fileKey, cutoff))) continue;
      if (await removeAttachmentIfExists(fileKey)) {
        report.deletedOrphans.push(fileKey);
      }
    } catch (error) {
      report.errors.push({ fileKey, error });
    }
  }

  return report;
}
