import { promises as fs } from "fs";
import os from "os";
import path from "path";

describe("attachment filesystem storage", () => {
  let temporaryDirectory: string;
  let previousUploadDirectory: string | undefined;

  beforeEach(async () => {
    previousUploadDirectory = process.env.UPLOAD_DIR;
    temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "invoice-attachments-"),
    );
    process.env.UPLOAD_DIR = temporaryDirectory;
    jest.resetModules();
  });

  afterEach(async () => {
    if (previousUploadDirectory === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = previousUploadDirectory;
    }
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("writes, reads and removes an attachment by a relative key", async () => {
    const storage = await import("@/lib/storage/attachment-storage");
    const location = storage.createAttachmentLocation(".pdf");

    expect(path.isAbsolute(location.fileKey)).toBe(false);
    await storage.writeAttachment(location.fileKey, Buffer.from("pdf"));
    await expect(storage.readAttachment(location.fileKey)).resolves.toEqual(
      Buffer.from("pdf"),
    );
    await expect(
      storage.removeAttachmentIfExists(location.fileKey),
    ).resolves.toBe(true);
    await expect(storage.readAttachment(location.fileKey)).resolves.toBeNull();
  });

  it.each(["../outside.pdf", "folder/file.pdf", "C:\\outside.pdf", "/tmp/out.pdf"])(
    "rejects an unsafe attachment key: %s",
    async (fileKey) => {
      const storage = await import("@/lib/storage/attachment-storage");
      await expect(
        storage.writeAttachment(fileKey, Buffer.from("unsafe")),
      ).rejects.toThrow("Nieprawidłowy klucz");
    },
  );

  it("removes only old unreferenced files", async () => {
    const storage = await import("@/lib/storage/attachment-storage");
    const referenced = storage.createAttachmentLocation(".pdf");
    const orphan = storage.createAttachmentLocation(".pdf");
    await storage.writeAttachment(referenced.fileKey, Buffer.from("kept"));
    await storage.writeAttachment(orphan.fileKey, Buffer.from("orphan"));
    const oldTimestamp = new Date(Date.now() - 2_000);
    await fs.utimes(
      storage.resolveAttachmentPath(referenced.fileKey),
      oldTimestamp,
      oldTimestamp,
    );
    await fs.utimes(
      storage.resolveAttachmentPath(orphan.fileKey),
      oldTimestamp,
      oldTimestamp,
    );

    const report = await storage.reconcileAttachmentStorage(
      [referenced.fileKey],
      0,
    );

    expect(report.deletedOrphans).toContain(orphan.fileKey);
    await expect(storage.readAttachment(referenced.fileKey)).resolves.toEqual(
      Buffer.from("kept"),
    );
  });
});
