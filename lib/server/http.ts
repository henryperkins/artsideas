import { ServiceError } from "./errors.ts";

export async function readBoundedText(response: Response | Request, maxBytes: number): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) throw new ServiceError(413, "body-too-large", "This request exceeds the permitted size.");
  if (!response.body) return "";
  const reader = response.body.getReader(); let total = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new ServiceError(413, "body-too-large", "This request exceeds the permitted size."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(joined);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) throw new ServiceError(415, "json-required", "Send this request as JSON.");
  const text = await readBoundedText(request, 64 * 1024);
  try { return JSON.parse(text); } catch { throw new ServiceError(400, "invalid-json", "The request body is not valid JSON."); }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new ServiceError(403, "origin-rejected", "This action must be submitted from the workspace.");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") throw new ServiceError(403, "origin-rejected", "This action must be submitted from the workspace.");
}
