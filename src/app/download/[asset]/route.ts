import { getCatalog, safeDownloadUrl } from "@/lib/catalog";
export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string }> },
) {
  const { asset } = await context.params;
  if (
    !["windows-x64", "windows-x64-backup", "license", "checksums"].includes(
      asset,
    )
  )
    return new Response("Not found", { status: 404 });
  const catalog = await getCatalog();
  if (!catalog)
    return new Response("镜像暂不可用，请稍后重试。", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  const mirrorUrl = safeDownloadUrl(
    asset === "license"
      ? catalog.release.license.url
      : asset === "checksums"
        ? catalog.release.checksumsUrl
        : catalog.release.url,
  );
  const location =
    asset === "windows-x64-backup"
      ? new URL(new URL(mirrorUrl).pathname, "http://codexdown.sxwzxc.cn/").href
      : mirrorUrl;
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  });
}
