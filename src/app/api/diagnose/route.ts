import { diagnoseClaude } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await diagnoseClaude(), {
    headers: { "Cache-Control": "no-store" },
  });
}
