import { dispatch } from "../../../../lib/server/runtime.ts";
export function POST(request: Request) { return dispatch("approve", request); }
