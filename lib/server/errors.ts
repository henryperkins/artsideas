export class ServiceError extends Error {
  status: number; code: string; detail?: unknown; requestId?: string; retryAfter?: number;
  constructor(status: number, code: string, message: string, detail?: unknown) { super(message); this.status = status; this.code = code; this.detail = detail; }
}
export function errorResponse(error: unknown): Response {
  if (error instanceof ServiceError) return Response.json({ error: error.message, code: error.code, ...(error.detail ? { issues: error.detail } : {}), ...(error.requestId ? { requestId: error.requestId } : {}) }, { status: error.status, headers: { "Cache-Control": "no-store", ...(error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) } });
  // Do not expose SQL, credentials, provider responses, or internal exception text.
  return Response.json({ error: "The workspace could not complete this request. Please try again.", code: "service-unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
