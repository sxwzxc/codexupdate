import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { load } from "cheerio";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import yauzl from "yauzl";

export const PACKAGE_SOURCE =
  "https://persistent.oaistatic.com/codex-app-prod/ChatGPT-x64.msix";
export const LICENSE_SOURCE =
  "https://persistent.oaistatic.com/codex-app-prod/ChatGPT-License.xml";
export const NOTES_SOURCE =
  "https://learn.chatgpt.com/docs/changelog?type=codex-app";
export const NAMESPACE = "releases/codex-windows-x64";

export function validateLicense(bytes) {
  const xml = bytes.toString("utf8");
  if (
    bytes.length > 2 * 1024 * 1024 ||
    /<!DOCTYPE/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new Error("Invalid offline license XML");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
  }).parse(xml);
  if (
    !parsed.License?.Signature ||
    !parsed.License.SPLicenseBlock ||
    !parsed.License.LicenseInfo
  )
    throw new Error("Unexpected offline license document");
  return bytes;
}

export function ftpOptions(env) {
  if (!env.FTP_URL || !env.FTP_USER || !env.FTP_PASSWORD)
    throw new Error("Missing FTP configuration");
  const url = new URL(
    env.FTP_URL.includes("://") ? env.FTP_URL : `ftp://${env.FTP_URL}`,
  );
  if (!["ftp:", "ftps:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid FTP_URL");
  const root = env.FTP_REMOTE_DIR || decodeURIComponent(url.pathname) || "/";
  if (root.split("/").includes("..") || /[\r\n\0]/.test(root))
    throw new Error("Unsafe FTP directory");
  return {
    host: url.hostname,
    port: Number(url.port || 21),
    user: env.FTP_USER,
    password: env.FTP_PASSWORD,
    secure: url.protocol === "ftps:",
    root,
  };
}

export function parsePackageManifest(xml) {
  const document = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    processEntities: false,
  }).parse(xml);
  const pkg = document.Package;
  if (
    !pkg ||
    pkg.Identity?.Name !== "OpenAI.Codex" ||
    pkg.Identity?.ProcessorArchitecture !== "x64"
  )
    throw new Error("Unexpected MSIX identity or architecture");
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(pkg.Identity.Version))
    throw new Error("Invalid MSIX version");
  const families = [pkg.Dependencies?.TargetDeviceFamily]
    .flat()
    .filter(Boolean);
  const dependencies = [pkg.Dependencies?.PackageDependency]
    .flat()
    .filter(Boolean)
    .map((d) => ({
      name: d.Name,
      minVersion: d.MinVersion || "",
      publisher: d.Publisher || "",
    }));
  return {
    version: pkg.Identity.Version,
    packageName: pkg.Identity.Name,
    publisher: pkg.Identity.Publisher,
    architecture: "x64",
    minWindowsVersion:
      families.find((f) => f.Name === "Windows.Desktop")?.MinVersion ||
      families[0]?.MinVersion ||
      "",
    dependencies,
  };
}

export function readManifest(file) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      let found = false;
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        if (entry.fileName !== "AppxManifest.xml") return zip.readEntry();
        found = true;
        if (entry.uncompressedSize > 2 * 1024 * 1024) {
          zip.close();
          return reject(new Error("Oversized manifest"));
        }
        zip.openReadStream(entry, (err, stream) => {
          if (err) {
            zip.close();
            return reject(err);
          }
          const chunks = [];
          stream.on("data", (c) => chunks.push(c));
          stream.on("error", reject);
          stream.on("end", () => {
            zip.close();
            try {
              resolve(
                parsePackageManifest(Buffer.concat(chunks).toString("utf8")),
              );
            } catch (e) {
              reject(e);
            }
          });
        });
      });
      zip.on("end", () => {
        if (!found) reject(new Error("Missing AppxManifest.xml"));
      });
      zip.readEntry();
    });
  });
}

export async function fileHash(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export function contentId(version, sha256, licenseSha256) {
  if (
    !/^\d+\.\d+\.\d+\.\d+$/.test(version) ||
    !/^[a-f0-9]{64}$/.test(sha256) ||
    !/^[a-f0-9]{64}$/.test(licenseSha256)
  )
    throw new Error("Invalid release identity");
  return `${version}-${sha256.slice(0, 12)}-${licenseSha256.slice(0, 8)}`;
}

export function needsFullDownload(
  previous,
  headers,
  now = Date.now(),
  force = false,
) {
  if (
    force ||
    !previous?.release ||
    !previous.lastFullCheckAt ||
    now - Date.parse(previous.lastFullCheckAt) >= 7 * 86400000
  )
    return true;
  const etag = headers.get("etag");
  const length = Number(headers.get("content-length"));
  return (
    !etag ||
    etag !== previous.source?.etag ||
    !length ||
    length !== previous.release.size
  );
}

export function parseNotes(html) {
  const $ = load(html);
  const entries = [];
  $("li[data-codex-topics]").each((_, element) => {
    const row = $(element);
    if (
      !(row.attr("data-codex-topics") || "").split(/\s+/).includes("codex-app")
    )
      return;
    const id = row.attr("id");
    const date = row.find("time").first().text().trim();
    const heading = row.children("div").find("h3").first();
    heading.find("button,svg").remove();
    const title = heading.text().replace(/\s+/g, " ").trim();
    const article = row.children("article").clone();
    article.find("script,style,iframe,object,form,img,svg").remove();
    const blocks = [];
    article.find("p,li,h2,h3,h4,pre").each((__, node) => {
      if ($(node).parents("li").length) return;
      const text = $(node).text().replace(/\s+/g, " ").trim();
      if (text)
        blocks.push({
          kind:
            node.tagName === "li"
              ? "bullet"
              : /^h[234]$/.test(node.tagName)
                ? "heading"
                : "paragraph",
          text: text.slice(0, 4000),
        });
    });
    if (
      id &&
      /^[\w-]+$/.test(id) &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      title &&
      blocks.length
    ) {
      entries.push({
        id,
        date,
        title,
        version: title.match(/\b\d{2}\.\d{3,4}(?:\.\d+)*\b/)?.[0] || null,
        url: `https://learn.chatgpt.com/docs/changelog#${id}`,
        blocks: blocks.slice(0, 40),
      });
    }
  });
  if (!entries.length)
    throw new Error("No desktop release notes found; retaining previous notes");
  return entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
}

export function validateCatalog(value, mirrorBase) {
  if (value?.schemaVersion !== 1 || !value.release)
    throw new Error("Invalid catalog");
  const r = value.release;
  if (
    r.packageName !== "OpenAI.Codex" ||
    r.architecture !== "x64" ||
    !/^\d+\.\d+\.\d+\.\d+$/.test(r.version) ||
    !/^[a-f0-9]{64}$/.test(r.sha256) ||
    !Number.isSafeInteger(r.size) ||
    r.size <= 0 ||
    !Number.isFinite(Date.parse(value.checkedAt))
  )
    throw new Error("Invalid release metadata");
  for (const address of [r.url, r.license?.url, r.checksumsUrl]) {
    const url = new URL(address);
    if (
      url.origin !== new URL(mirrorBase).origin ||
      !url.pathname.startsWith(`/${NAMESPACE}/`) ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid mirror download URL");
  }
  return value;
}

export function removableReleases(previous, currentId, now = Date.now()) {
  return (previous?.retired || []).filter(
    (r) =>
      r.id !== currentId &&
      /^\d+\.\d+\.\d+\.\d+-[a-f0-9]{12}-[a-f0-9]{8}$/.test(r.id) &&
      now - Date.parse(r.retiredAt) >= 86400000,
  );
}

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

export function fallbackPage(catalog, siteBase) {
  const r = catalog.release;
  const e = escapeHtml;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Codex 离线包 · 备用下载</title><style>body{font:16px/1.7 system-ui,sans-serif;background:#10121a;color:#e9ecf5;margin:0;padding:8vw 6vw}main{max-width:760px;margin:auto}h1{font-size:40px;letter-spacing:-1px}a{color:#ada4ff}nav{display:flex;gap:16px;flex-wrap:wrap}nav a{padding:12px 20px;background:#292541;border-radius:10px;text-decoration:none}code{overflow-wrap:anywhere;font-size:13px}small{color:#a0a8bd}</style><main><small>CODEX / WINDOWS x64</small><h1>离线安装，随时开始。</h1><p>最新版本 ${e(r.version)} · ${(r.size / 1048576).toFixed(1)} MiB</p><nav><a href="${e(r.url)}">下载 MSIX 安装包</a><a href="${e(r.license.url)}">下载离线许可证</a><a href="${e(siteBase)}">前往正式下载站 ↗</a></nav><p>SHA-256<br><code>${e(r.sha256)}</code></p><p><a href="${e(r.checksumsUrl)}">下载校验文件</a> · <a href="https://learn.chatgpt.com/docs/enterprise/windows-deployment">官方安装说明</a></p><h2>官方直接下载</h2><p>如果可以访问官方网络，可使用以下原始地址；官方版本可能先于镜像更新。</p><p>官方 MSIX 安装包<br><a href="${e(PACKAGE_SOURCE)}" target="_blank" rel="noopener noreferrer"><code>${e(PACKAGE_SOURCE)}</code></a></p><p>官方离线许可证<br><a href="${e(LICENSE_SOURCE)}" target="_blank" rel="noopener noreferrer"><code>${e(LICENSE_SOURCE)}</code></a></p><small>这是独立下载镜像，文件保持官方原样。当前官方文件名为 ChatGPT-x64.msix，包标识为 OpenAI.Codex。离线包用于安装，使用服务仍需联网。镜像更新时间：${e(r.mirroredAt)}</small></main></html>`;
}
