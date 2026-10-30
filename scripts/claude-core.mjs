import { XMLParser } from "fast-xml-parser";

// Official Claude Desktop MSIX (Windows x64). The URL redirects to the current build.
export const CLAUDE_PACKAGE_SOURCE =
  "https://claude.ai/api/desktop/win32/x64/msix/latest/redirect";
export const CLAUDE_DOCS =
  "https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows";
export const CLAUDE_NAMESPACE = "releases/claude-windows-x64";
export const CLAUDE_CATALOG = "data/claude-latest.json";
export const CLAUDE_STATUS = "data/claude-status.json";

export function claudeFileName(version) {
  if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(version))
    throw new Error("Invalid package version");
  return `Claude-${version}-windows-x64.msix`;
}

export function parseClaudeManifest(xml) {
  const document = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    processEntities: false,
  }).parse(xml);
  const pkg = document.Package;
  // The package name is checked loosely (it contains "Claude") and the
  // architecture strictly; the Authenticode signature is verified separately.
  if (
    !pkg ||
    !/claude/i.test(pkg.Identity?.Name || "") ||
    pkg.Identity?.ProcessorArchitecture !== "x64"
  )
    throw new Error("Unexpected MSIX identity or architecture");
  if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(pkg.Identity.Version))
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

export function validateClaudeCatalog(value, mirrorBase) {
  if (value?.schemaVersion !== 1 || !value.release)
    throw new Error("Invalid catalog");
  const r = value.release;
  if (
    !/claude/i.test(r.packageName || "") ||
    r.architecture !== "x64" ||
    !/^\d+\.\d+\.\d+(\.\d+)?$/.test(r.version) ||
    !/^[a-f0-9]{64}$/.test(r.sha256) ||
    !Number.isSafeInteger(r.size) ||
    r.size <= 0 ||
    !Number.isFinite(Date.parse(value.checkedAt))
  )
    throw new Error("Invalid release metadata");
  if (
    r.fileName !== claudeFileName(r.version) ||
    new URL(r.url).pathname.split("/").at(-1) !== r.fileName
  )
    throw new Error("Package filename does not match its version or URL");
  for (const address of [r.url, r.checksumsUrl]) {
    const url = new URL(address);
    if (
      url.origin !== new URL(mirrorBase).origin ||
      !url.pathname.startsWith(`/${CLAUDE_NAMESPACE}/`) ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid mirror download URL");
  }
  return value;
}

export function claudeContentId(version, sha256) {
  if (
    !/^\d+\.\d+\.\d+(\.\d+)?$/.test(version) ||
    !/^[a-f0-9]{64}$/.test(sha256)
  )
    throw new Error("Invalid release identity");
  return `${version}-${sha256.slice(0, 12)}`;
}

export function removableClaudeReleases(previous, currentId, now = Date.now()) {
  return (previous?.retired || []).filter(
    (r) =>
      r.id !== currentId &&
      /^\d+\.\d+\.\d+(\.\d+)?-[a-f0-9]{12}$/.test(r.id) &&
      now - Date.parse(r.retiredAt) >= 86400000,
  );
}
