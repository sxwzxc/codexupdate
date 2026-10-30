import {
  getCatalog,
  getClaudeCatalog,
  safeClaudeUrl,
  safeDownloadUrl,
} from "@/lib/catalog";
const claudeAssets = ["claude-windows-x64", "claude-windows-x64-backup", "claude-checksums"];
export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string }> },
) {
  const { asset } = await context.params;
  if (
    ![
      "windows-x64",
      "windows-x64-backup",
      "license",
      "checksums",
      ...claudeAssets,
    ].includes(asset)
  )
    return new Response("Not found", { status: 404 });
  const unavailable = () =>
    new Response("镜像暂不可用，请稍后重试。", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  let mirrorUrl: string;
  if (claudeAssets.includes(asset)) {
    const claude = await getClaudeCatalog();
    if (!claude) return unavailable();
    mirrorUrl = safeClaudeUrl(
      asset === "claude-checksums" ? claude.release.checksumsUrl : claude.release.url,
    );
  } else {
    const catalog = await getCatalog();
    if (!catalog) return unavailable();
    mirrorUrl = safeDownloadUrl(
      asset === "license"
        ? catalog.release.license.url
        : asset === "checksums"
          ? catalog.release.checksumsUrl
          : catalog.release.url,
    );
  }
  const location = asset.endsWith("-backup")
    ? new URL(new URL(mirrorUrl).pathname, "http://codexdown.sxwzxc.cn/").href
    : mirrorUrl;
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}
