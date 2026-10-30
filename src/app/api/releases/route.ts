import {
  getCatalog,
  getClaudeCatalog,
  getClaudeSyncStatus,
  getSyncStatus,
} from "@/lib/catalog";
export async function GET() {
  const [catalog, status, claude, claudeStatus] = await Promise.all([
    getCatalog(),
    getSyncStatus(),
    getClaudeCatalog(),
    getClaudeSyncStatus(),
  ]);
  if (!catalog && !claude)
    return Response.json(
      { error: "镜像数据暂不可用，请稍后重试。" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "60" },
      },
    );
  return Response.json(
    {
      schemaVersion: 1,
      checkedAt: catalog?.checkedAt ?? null,
      release: catalog && {
        ...catalog.release,
        url: "/download/windows-x64",
        license: { ...catalog.release.license, url: "/download/license" },
        checksumsUrl: "/download/checksums",
      },
      notes: catalog?.notes ?? null,
      history: catalog?.history ?? [],
      status,
      claude: claude && {
        checkedAt: claude.checkedAt,
        release: {
          ...claude.release,
          url: "/download/claude-windows-x64",
          checksumsUrl: "/download/claude-checksums",
        },
        history: claude.history,
        status: claudeStatus,
      },
    },
    {
      headers: { "Cache-Control": "public, s-maxage=60, stale-if-error=86400" },
    },
  );
}
