import { jsonError } from "@/lib/api/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, _context: RouteContext) {
  return jsonError(
    403,
    "Manual price refresh is disabled. Prices update automatically on schedule."
  );
}
