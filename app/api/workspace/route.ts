import { dispatch } from "../../../lib/server/runtime.ts";
export function GET(request: Request) { return dispatch("workspace", request); }
