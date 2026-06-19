import { jsonError } from "./errors";
import { captureException } from "@/lib/observability/capture-exception";
import { PipelineBusyError } from "@/lib/pipeline/pipeline-lock";

export function productFetchErrorResponse(err: unknown) {
  captureException(err, { layer: "product_fetch" });
  if (err instanceof PipelineBusyError) {
    return jsonError(409, err.message);
  }
  const message = err instanceof Error ? err.message : "Fetch failed";
  if (message.includes("ZenRows")) {
    return jsonError(502, "Cannot fetch price temporarily");
  }
  if (message.includes("Cannot parse price")) {
    return jsonError(422, "Cannot parse price from page");
  }
  if (message.includes("Frankfurter")) {
    return jsonError(502, "Cannot fetch exchange rates temporarily");
  }
  if (message.includes("Unsupported currency")) {
    return jsonError(422, message);
  }
  return jsonError(500, "Internal error");
}
