import test from "node:test";
import assert from "node:assert/strict";
import {
  ftpOptions,
  parsePackageManifest,
  contentId,
  needsFullDownload,
  parseNotes,
  removableReleases,
  validateCatalog,
  validateLicense,
  fallbackPage,
  packageFileName,
} from "../scripts/core.mjs";
import {
  claudeFileName,
  claudeContentId,
  parseClaudeManifest,
  validateClaudeCatalog,
  removableClaudeReleases,
} from "../scripts/claude-core.mjs";
const sha = "a".repeat(64);
test("Claude package names, identity and catalog URLs are validated", () => {
  assert.equal(claudeFileName("1.2.3.4"), "Claude-1.2.3.4-windows-x64.msix");
  assert.throws(() => claudeFileName("../x"));
  const manifest = (name = "Claude", arch = "x64") =>
    `<Package><Identity Name="${name}" Version="1.2.3.4" ProcessorArchitecture="${arch}" Publisher="CN=t"/><Dependencies><TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0"/></Dependencies></Package>`;
  assert.equal(parseClaudeManifest(manifest()).version, "1.2.3.4");
  assert.throws(() => parseClaudeManifest(manifest("Other.App")));
  assert.throws(() => parseClaudeManifest(manifest("Claude", "arm64")));
  const fileName = claudeFileName("1.2.3.4");
  const url = `https://codex.shenxw.cn/releases/claude-windows-x64/${claudeContentId("1.2.3.4", sha)}/${fileName}`;
  const catalog = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    release: {
      packageName: "Claude",
      architecture: "x64",
      version: "1.2.3.4",
      fileName,
      size: 100,
      sha256: sha,
      url,
      checksumsUrl: url,
    },
  };
  assert.equal(validateClaudeCatalog(catalog, "https://codex.shenxw.cn"), catalog);
  assert.throws(() =>
    validateClaudeCatalog(
      { ...catalog, release: { ...catalog.release, url: "https://evil.example/a.msix" } },
      "https://codex.shenxw.cn",
    ),
  );
  const id = claudeContentId("1.2.3.4", sha);
  const old = new Date(Date.now() - 25 * 3600000).toISOString();
  assert.equal(
    removableClaudeReleases({ retired: [{ id, retiredAt: old }, { id: "../x", retiredAt: old }] }, "other").length,
    1,
  );
});
test("versioned package names are path-safe and correspond to published metadata", () => {
  assert.equal(
    packageFileName("26.1013.3656.0"),
    "Codex-26.1013.3656.0-windows-x64.msix",
  );
  assert.throws(() => packageFileName("../escape"));
  const fileName = packageFileName("26.1013.3656.0");
  const url = `https://codex.shenxw.cn/releases/codex-windows-x64/release/${fileName}`;
  const catalog = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    release: {
      packageName: "OpenAI.Codex",
      architecture: "x64",
      version: "26.1013.3656.0",
      fileName,
      size: 100,
      sha256: sha,
      url,
      license: { url },
      checksumsUrl: url,
    },
  };
  assert.equal(validateCatalog(catalog, "https://codex.shenxw.cn"), catalog);
  assert.throws(() =>
    validateCatalog(
      {
        ...catalog,
        release: {
          ...catalog.release,
          fileName: "Codex-1.0.0.0-windows-x64.msix",
        },
      },
      "https://codex.shenxw.cn",
    ),
  );
});
const base = "https://codex.shenxw.cn";
const xml = (name = "OpenAI.Codex", arch = "x64") =>
  `<Package><Identity Name="${name}" Version="26.1007.9446.0" ProcessorArchitecture="${arch}" Publisher="CN=test"/><Dependencies><TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0"/></Dependencies></Package>`;
test("offline license rejects HTML error pages and malformed XML", () => {
  assert.throws(() =>
    validateLicense(Buffer.from("<html><p>Blocked</p></html>")),
  );
  assert.throws(() => validateLicense(Buffer.from("<License>")));
  assert.doesNotThrow(() =>
    validateLicense(
      Buffer.from(
        "<License><Signature>signed</Signature><SPLicenseBlock>data</SPLicenseBlock><LicenseInfo>info</LicenseInfo></License>",
      ),
    ),
  );
});
test("MSIX identity, architecture, OS version come from package manifest", () => {
  assert.equal(parsePackageManifest(xml()).minWindowsVersion, "10.0.19041.0");
  assert.throws(() => parsePackageManifest(xml("Other.App")));
  assert.throws(() => parsePackageManifest(xml("OpenAI.Codex", "arm64")));
});
test("FTP options support explicit TLS, paths, and reject credential URLs/traversal", () => {
  const env = {
    FTP_URL: "ftps://example.com:2121/site",
    FTP_USER: "name",
    FTP_PASSWORD: "secret",
  };
  assert.deepEqual(ftpOptions(env), {
    host: "example.com",
    port: 2121,
    secure: true,
    root: "/site",
    user: "name",
    password: "secret",
  });
  assert.throws(() => ftpOptions({ ...env, FTP_REMOTE_DIR: "/a/../b" }));
  assert.throws(() =>
    ftpOptions({ ...env, FTP_URL: "ftp://name:secret@example.com" }),
  );
});
test("unchanged package avoids transfer, missing validators and weekly checks require it", () => {
  const now = Date.now();
  const previous = {
    release: { size: 9000 },
    source: { etag: "abc" },
    lastFullCheckAt: new Date(now).toISOString(),
  };
  const headers = new Headers({ etag: "abc", "content-length": "9000" });
  assert.equal(needsFullDownload(previous, headers, now), false);
  assert.equal(needsFullDownload(previous, headers, now + 7 * 86400000), true);
  assert.equal(needsFullDownload(previous, new Headers(), now), true);
  assert.equal(needsFullDownload(previous, headers, now, true), true);
});
test("desktop notes discard CLI entries and executable content", () => {
  const html = `<li id="desktop-1" data-codex-topics="codex-app"><div><time>2026-10-08</time><h3><span>Codex app 26.1007</span><button>copy</button></h3></div><article><h3>Fixes</h3><ul><li>Fixed downloads.</li></ul><script>alert(1)</script><p><img src=x onerror=alert(1)>Safe text</p></article></li><li data-codex-topics="codex-cli"><article>not a desktop package</article></li>`;
  const notes = parseNotes(html);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].version, "26.1007");
  assert.equal(notes[0].blocks[1].text, "Fixed downloads.");
  assert(!JSON.stringify(notes).includes("alert"));
  assert.throws(() => parseNotes("<p>layout changed</p>"));
});
test("cleanup respects 24-hour grace and refuses outside paths or current release", () => {
  const id = contentId("26.1007.9446.0", sha, sha);
  const old = new Date(Date.now() - 25 * 3600000).toISOString();
  const previous = {
    retired: [
      { id, retiredAt: old },
      { id: "../unrelated", retiredAt: old },
    ],
  };
  assert.equal(removableReleases(previous, "different").length, 1);
  assert.equal(removableReleases(previous, id).length, 0);
  assert.equal(
    removableReleases(
      { retired: [{ id, retiredAt: new Date().toISOString() }] },
      "different",
    ).length,
    0,
  );
});
test("public download metadata cannot redirect to a foreign origin", () => {
  const url = `${base}/releases/codex-windows-x64/valid/ChatGPT-x64.msix`;
  const catalog = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    release: {
      version: "26.1007.9446.0",
      architecture: "x64",
      packageName: "OpenAI.Codex",
      size: 100,
      sha256: sha,
      url,
      license: { url },
      checksumsUrl: url,
    },
  };
  assert.equal(validateCatalog(catalog, base), catalog);
  assert.throws(() =>
    validateCatalog(
      {
        ...catalog,
        release: { ...catalog.release, url: "https://evil.example/a.msix" },
      },
      base,
    ),
  );
  const html = fallbackPage(
    {
      release: {
        ...catalog.release,
        version: "<script>alert(1)</script>",
        mirroredAt: "now",
      },
    },
    "https://codex.sxwzxc.cn",
  );
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
});
