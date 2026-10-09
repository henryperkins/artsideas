import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../app/chatgpt-auth.ts";
import { errorResponse, ServiceError } from "./errors.ts";
import { DispatchService } from "./service.ts";
import { D1DispatchStore } from "./store.ts";

export async function dispatch(action: Parameters<DispatchService["handle"]>[0], request: Request): Promise<Response> {
  try {
    const actor = await getChatGPTUser();
    if (!actor) throw new ServiceError(401, "authentication-required", "Sign in with ChatGPT to save, review, and export drafts.");
    if (!env.DB) throw new ServiceError(503, "database-unavailable", "The persistent workspace database is unavailable.");
    return new DispatchService({ store: new D1DispatchStore(env.DB), authenticate: async () => actor, provider: { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL } }).handle(action, request);
  } catch (error) { return errorResponse(error); }
}
