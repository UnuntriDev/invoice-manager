import { PayloadTooLargeError } from "@/lib/errors/validation-errors";

export async function readBoundedFormData(
  request: Request,
  maxBodyBytes: number,
): Promise<FormData> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBodyBytes) {
      throw new PayloadTooLargeError("Żądanie uploadu przekracza dozwolony rozmiar");
    }
  }

  if (!request.body) return request.formData();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBodyBytes) {
      await reader.cancel("upload limit exceeded");
      throw new PayloadTooLargeError("Żądanie uploadu przekracza dozwolony rozmiar");
    }
    chunks.push(value);
  }

  const boundedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
  });
  return boundedRequest.formData();
}
