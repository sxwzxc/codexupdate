import { getCatalog, getSyncStatus } from '@/lib/catalog';
export async function GET() {
  const [catalog, status] = await Promise.all([getCatalog(), getSyncStatus()]);
  if (!catalog) return Response.json({ error: '镜像数据暂不可用，请稍后重试。' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  return Response.json({ schemaVersion: 1, checkedAt: catalog.checkedAt, release: catalog.release, notes: catalog.notes, history: catalog.history, status }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-if-error=86400' } });
}
