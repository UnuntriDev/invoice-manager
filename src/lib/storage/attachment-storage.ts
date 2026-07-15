import { randomUUID } from "crypto";
import { promises as fs, type Dirent } from "fs";
import path from "path";

const uploadRoot = path.resolve(
  /*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads"
);
const trashRoot = path.join(/*turbopackIgnore: true*/ uploadRoot, ".trash");

export interface StagedAttachment {
  originalPath: string;
  stagedPath: string;
}

export interface AttachmentReconciliationReport {
  deletedOrphans: string[];
  restoredStaged: string[];
  deletedStaged: string[];
  errors: Array<{ filePath: string; error: unknown }>;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

function resolveStoragePath(filePath: string): string {
  const resolved = path.resolve(/*turbopackIgnore: true*/ filePath);
  const relative = path.relative(uploadRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Ścieżka załącznika znajduje się poza katalogiem uploadów");
  }

  return resolved;
}

export function normalizeAttachmentPath(filePath: string): string {
  return resolveStoragePath(filePath);
}

export function createAttachmentLocation(extension: ".pdf" | ".xml") {
  const fileName = `${randomUUID()}${extension}`;
  return {
    fileName,
    filePath: path.join(/*turbopackIgnore: true*/ uploadRoot, fileName),
  };
}

export async function writeAttachment(
  filePath: string,
  contents: Buffer
): Promise<void> {
  const resolved = resolveStoragePath(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, contents, { flag: "wx" });
}

export async function readAttachment(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(resolveStoragePath(filePath));
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

export async function removeAttachmentIfExists(
  filePath: string
): Promise<boolean> {
  try {
    await fs.unlink(resolveStoragePath(filePath));
    return true;
  } catch (error) {
    if (isMissingFileError(error)) return false;
    throw error;
  }
}

export async function stageAttachmentForDeletion(
  filePath: string
): Promise<StagedAttachment | null> {
  const originalPath = resolveStoragePath(filePath);
  const stagedPath = path.join(
    /*turbopackIgnore: true*/ trashRoot,
    `${randomUUID()}-${path.basename(originalPath)}`
  );

  await fs.mkdir(trashRoot, { recursive: true });
  try {
    await fs.rename(originalPath, stagedPath);
    return { originalPath, stagedPath };
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

export async function restoreStagedAttachment(
  attachment: StagedAttachment
): Promise<void> {
  await fs.rename(
    resolveStoragePath(attachment.stagedPath),
    resolveStoragePath(attachment.originalPath)
  );
}

export async function finalizeStagedAttachment(
  attachment: StagedAttachment
): Promise<void> {
  await removeAttachmentIfExists(attachment.stagedPath);
}

async function isOlderThan(filePath: string, cutoff: number): Promise<boolean> {
  const stats = await fs.stat(filePath);
  return stats.mtimeMs <= cutoff;
}

export async function reconcileAttachmentStorage(
  referencedFilePaths: string[],
  gracePeriodMs = 60 * 60 * 1000
): Promise<AttachmentReconciliationReport> {
  const report: AttachmentReconciliationReport = {
    deletedOrphans: [],
    restoredStaged: [],
    deletedStaged: [],
    errors: [],
  };
  const referenced = new Set<string>();
  for (const filePath of referencedFilePaths) {
    try {
      referenced.add(resolveStoragePath(filePath));
    } catch (error) {
      report.errors.push({ filePath, error });
    }
  }

  const cutoff = Date.now() - gracePeriodMs;
  let entries: Dirent[];
  try {
    entries = await fs.readdir(uploadRoot, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) return report;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(
      /*turbopackIgnore: true*/ uploadRoot,
      entry.name
    );
    if (referenced.has(filePath)) continue;

    try {
      if (!(await isOlderThan(filePath, cutoff))) continue;
      if (await removeAttachmentIfExists(filePath)) {
        report.deletedOrphans.push(filePath);
      }
    } catch (error) {
      report.errors.push({ filePath, error });
    }
  }

  let stagedEntries: Dirent[];
  try {
    stagedEntries = await fs.readdir(trashRoot, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) return report;
    throw error;
  }

  for (const entry of stagedEntries) {
    if (!entry.isFile()) continue;
    const stagedPath = path.join(
      /*turbopackIgnore: true*/ trashRoot,
      entry.name
    );

    try {
      if (!(await isOlderThan(stagedPath, cutoff))) continue;
      const originalName = entry.name.replace(/^[0-9a-f-]{36}-/i, "");
      const originalPath = path.join(
        /*turbopackIgnore: true*/ uploadRoot,
        originalName
      );

      if (referenced.has(originalPath)) {
        try {
          await fs.rename(stagedPath, originalPath);
          report.restoredStaged.push(originalPath);
        } catch (error) {
          if (!isAlreadyExistsError(error)) throw error;
          await removeAttachmentIfExists(stagedPath);
          report.deletedStaged.push(stagedPath);
        }
      } else if (await removeAttachmentIfExists(stagedPath)) {
        report.deletedStaged.push(stagedPath);
      }
    } catch (error) {
      report.errors.push({ filePath: stagedPath, error });
    }
  }

  return report;
}
