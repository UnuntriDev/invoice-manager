import { promises as fs } from "fs";
import os from "os";
import path from "path";

describe("attachment filesystem storage", () => {
  let temporaryDirectory: string;
  let previousUploadDirectory: string | undefined;

  beforeEach(async () => {
    previousUploadDirectory = process.env.UPLOAD_DIR;
    temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "invoice-attachments-")
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

  it("writes, reads and removes an attachment within the configured root", async () => {
    const storage = await import("@/lib/storage/attachment-storage");
    const location = storage.createAttachmentLocation(".pdf");

    await storage.writeAttachment(location.filePath, Buffer.from("pdf"));

    await expect(storage.readAttachment(location.filePath)).resolves.toEqual(
      Buffer.from("pdf")
    );
    await expect(
      storage.removeAttachmentIfExists(location.filePath)
    ).resolves.toBe(true);
    await expect(storage.readAttachment(location.filePath)).resolves.toBeNull();
  });

  it("rejects paths outside the configured upload root", async () => {
    const storage = await import("@/lib/storage/attachment-storage");
    const outsidePath = path.join(
      path.dirname(temporaryDirectory),
      "outside.pdf"
    );

    await expect(
      storage.writeAttachment(outsidePath, Buffer.from("unsafe"))
    ).rejects.toThrow("poza katalogiem uploadów");
  });

  it("removes unreferenced files and restores interrupted staged deletions", async () => {
    const storage = await import("@/lib/storage/attachment-storage");
    const referenced = storage.createAttachmentLocation(".pdf");
    const orphan = storage.createAttachmentLocation(".pdf");
    await storage.writeAttachment(referenced.filePath, Buffer.from("kept"));
    await storage.writeAttachment(orphan.filePath, Buffer.from("orphan"));
    const oldTimestamp = new Date(Date.now() - 2_000);
    await fs.utimes(referenced.filePath, oldTimestamp, oldTimestamp);
    await fs.utimes(orphan.filePath, oldTimestamp, oldTimestamp);

    const firstReport = await storage.reconcileAttachmentStorage(
      [referenced.filePath],
      0
    );

    expect(firstReport.deletedOrphans).toContain(orphan.filePath);
    await expect(storage.readAttachment(referenced.filePath)).resolves.toEqual(
      Buffer.from("kept")
    );

    const staged = await storage.stageAttachmentForDeletion(referenced.filePath);
    expect(staged).not.toBeNull();

    const secondReport = await storage.reconcileAttachmentStorage(
      [referenced.filePath],
      0
    );

    expect(secondReport.restoredStaged).toContain(referenced.filePath);
    await expect(storage.readAttachment(referenced.filePath)).resolves.toEqual(
      Buffer.from("kept")
    );
  });
});
