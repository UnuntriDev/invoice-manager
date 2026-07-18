import { getMaxUploadSizeBytes } from "@/lib/validators/upload";

export const dynamic = "force-dynamic";

export async function GET() {
  const maxSizeBytes = getMaxUploadSizeBytes();
  return Response.json({
    data: {
      maxSizeBytes,
      maxSizeMb: maxSizeBytes / 1024 / 1024,
    },
  });
}
