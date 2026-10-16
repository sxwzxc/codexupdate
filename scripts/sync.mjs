import { Client } from "basic-ftp";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { Readable, Writable } from "node:stream";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import {
  PACKAGE_SOURCE,
  LICENSE_SOURCE,
  NOTES_SOURCE,
  NAMESPACE,
  ftpOptions,
  readManifest,
  fileHash,
  contentId,
  packageFileName,
  needsFullDownload,
  parseNotes,
  validateCatalog,
  validateLicense,
  removableReleases,
  fallbackPage,
} from "./core.mjs";

const env = process.env;
const base = (env.MIRROR_BASE_URL || "https://codex.shenxw.cn").replace(
  /\/$/,
  "",
);
const site = (env.SITE_BASE_URL || "https://codex.sxwzxc.cn").replace(
  /\/$/,
  "",
);
if (new URL(base).protocol !== "https:" || new URL(site).protocol !== "https:")
  throw new Error("HTTPS is required");
const options = ftpOptions(env);
const work = path.resolve(".mirror-work");
const probeOnly = process.argv.includes("--preflight");
const id = randomUUID();
let phase = "preflight";
let ftp;
const log = (message) =>
  console.log(`[${new Date().toISOString()}] ${message}`);

async function connect() {
  ftp?.close();
  ftp = new Client(60000);
  await ftp.access(options);
  await ftp.cd(options.root);
  return ftp;
}
async function put(relative, content) {
  await ftp.uploadFrom(
    Readable.from([
      typeof content === "string" ? Buffer.from(content) : content,
    ]),
    relative,
  );
}
async function atomicJson(relative, value) {
  const temporary = `${relative}.${id}.tmp`;
  await put(temporary, JSON.stringify(value, null, 2));
  await ftp.rename(temporary, relative);
}
async function readRemoteJson(relative) {
  let size = 0;
  const chunks = [];
  const stream = new Writable({
    write(chunk, encoding, callback) {
      size += chunk.length;
      if (size > 1024 * 1024)
        return callback(new Error("Oversized remote metadata"));
      chunks.push(chunk);
      callback();
    },
  });
  try {
    await ftp.downloadTo(stream, relative);
  } catch (error) {
    if (error.code === 550) return null;
    throw error;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function response(url, init = {}) {
  const result = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    ...init,
  });
  if (!result.ok)
    throw new Error(`HTTP ${result.status} for ${new URL(url).pathname}`);
  return result;
}
async function preflight() {
  await connect();
  const name = `codex-check-${id}.txt`;
  const marker = `codex-downloads:${id}`;
  try {
    await put(name, "before");
    await put(`${name}.new`, marker);
    await ftp.rename(`${name}.new`, name);
    const result = await response(`${base}/${name}?check=${id}`);
    if ((await result.text()) !== marker)
      throw new Error("FTP directory does not match the mirror website");
    log("FTP upload, replacement rename, and HTTPS website mapping verified");
  } finally {
    await ftp.remove(name, true).catch(() => {});
    await ftp.remove(`${name}.new`, true).catch(() => {});
  }
  await ftp.ensureDir("data");
  await ftp.cd(options.root);
  await ftp.ensureDir(NAMESPACE);
  await ftp.cd(options.root);
}
async function retry(label, action) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (attempt === 3) throw error;
      log(`${label}: retry ${attempt}/2`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }
}
async function download() {
  const target = path.join(work, "source.msix");
  await new Promise((resolve, reject) => {
    const child = spawn(
      "curl",
      [
        "--fail",
        "--location",
        "--retry",
        "3",
        "--retry-delay",
        "5",
        "--connect-timeout",
        "30",
        "--speed-limit",
        "1024",
        "--speed-time",
        "120",
        "--max-time",
        "3600",
        "--silent",
        "--show-error",
        "--output",
        target,
        "--dump-header",
        path.join(work, "source.headers"),
        PACKAGE_SOURCE,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let error = "";
    child.stderr.on("data", (data) => {
      error += data.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `Official download failed (${code}): ${error.slice(0, 400)}`,
            ),
          ),
    );
  });
  return target;
}
async function verifyRange(url, expectedSize) {
  const result = await response(`${url}?verify=${id}`, {
    headers: { Range: "bytes=0-1023" },
  });
  if (
    result.status !== 206 ||
    result.headers.get("content-range") !== `bytes 0-1023/${expectedSize}`
  ) {
    await result.body?.cancel();
    throw new Error("Mirror does not provide a correct byte-range response");
  }
  if ((await result.arrayBuffer()).byteLength !== 1024)
    throw new Error("Incorrect range body");
}
async function verifyRemote(url, expectedHash, expectedSize) {
  const result = await response(`${url}?verify=${id}`, {
    signal: AbortSignal.timeout(3600000),
  });
  let received = 0;
  let progressAt = Date.now();
  const hash = createHash("sha256");
  for await (const chunk of result.body) {
    hash.update(chunk);
    received += chunk.length;
    if (Date.now() - progressAt > 30000) {
      log(
        `HTTPS verification: ${(received / 1048576).toFixed(0)} / ${(expectedSize / 1048576).toFixed(0)} MiB`,
      );
      progressAt = Date.now();
    }
  }
  if (received !== expectedSize || hash.digest("hex") !== expectedHash)
    throw new Error("Mirror SHA-256 or byte length mismatch");
}
function signature(file) {
  if (process.platform !== "win32")
    throw new Error("MSIX signature verification requires a Windows runner");
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.resolve("scripts/verify-signature.ps1"),
      "-PackagePath",
      file,
    ],
    { encoding: "utf8", timeout: 180000 },
  );
  if (result.status !== 0)
    throw new Error(
      `MSIX signature verification failed: ${(result.stderr || result.error?.message || "").slice(0, 400)}`,
    );
  const value = JSON.parse(result.stdout.replace(/^\uFEFF/, "").trim());
  if (value.status !== "Valid") throw new Error("Invalid package signature");
  return value;
}

await mkdir(work, { recursive: true });
try {
  await preflight();
  if (probeOnly) {
    log("Preflight complete");
    ftp.close();
    process.exit(0);
  }
  const previousRaw = await readRemoteJson("data/latest.json");
  const previous = previousRaw ? validateCatalog(previousRaw, base) : null;
  ftp.close();
  phase = "source-check";
  const head = await response(PACKAGE_SOURCE, { method: "HEAD" });
  let changed = needsFullDownload(
    previous,
    head.headers,
    Date.now(),
    process.argv.includes("--force"),
  );
  if (!changed) {
    try {
      await verifyRange(previous.release.url, previous.release.size);
    } catch {
      log("Existing mirror needs repair; downloading source again");
      changed = true;
    }
  }
  const licenseResponse = await response(LICENSE_SOURCE);
  const licenseBytes = Buffer.from(await licenseResponse.arrayBuffer());
  validateLicense(licenseBytes);
  const licenseSha = createHash("sha256").update(licenseBytes).digest("hex");
  const licenseChanged = licenseSha !== previous?.release.license.sha256;
  let release = previous?.release;
  let lastFullCheckAt = previous?.lastFullCheckAt;
  let source = previous?.source;
  const filenameChanged =
    previous?.release.fileName !==
    (previous?.release.version
      ? packageFileName(previous.release.version)
      : null);
  if (changed || licenseChanged || filenameChanged) {
    phase = "download";
    let file = path.join(work, "source.msix");
    const canReuse =
      process.argv.includes("--reuse-download") &&
      (await stat(file).catch(() => null))?.size ===
        Number(head.headers.get("content-length"));
    if (!canReuse) file = await download();
    phase = "verification";
    const info = await readManifest(file);
    const verifiedSignature = signature(file);
    const sha256 = await fileHash(file);
    const size = (await stat(file)).size;
    const downloadHeaders = await readFile(
      path.join(work, "source.headers"),
      "utf8",
    ).catch(() => "");
    const etag =
      [...downloadHeaders.matchAll(/^etag:\s*(.+)$/gim)].at(-1)?.[1].trim() ||
      null;
    const lastModified =
      [...downloadHeaders.matchAll(/^last-modified:\s*(.+)$/gim)]
        .at(-1)?.[1]
        .trim() || null;
    lastFullCheckAt = new Date().toISOString();
    source = { etag, lastModified, url: PACKAGE_SOURCE };
    if (
      previous?.release.sha256 === sha256 &&
      !licenseChanged &&
      !filenameChanged
    ) {
      log("Full recheck confirmed the same signed package");
    } else {
      const releaseId = contentId(info.version, sha256, licenseSha);
      const directory = `${NAMESPACE}/${releaseId}`;
      const fileName = packageFileName(info.version);
      const url = `${base}/${directory}/${fileName}`;
      phase = "upload";
      await retry("FTP upload", async () => {
        await connect();
        await ftp.ensureDir(directory);
        await ftp.cd(options.root);
        let lastProgress = 0;
        ftp.trackProgress((progress) => {
          if (Date.now() - lastProgress > 30000) {
            log(
              `Uploading: ${(progress.bytesOverall / 1048576).toFixed(0)} MiB`,
            );
            lastProgress = Date.now();
          }
        });
        await ftp.uploadFrom(file, `${directory}/${fileName}.part`);
        ftp.trackProgress();
        if ((await ftp.size(`${directory}/${fileName}.part`)) !== size)
          throw new Error("FTP upload length mismatch");
        await ftp.rename(
          `${directory}/${fileName}.part`,
          `${directory}/${fileName}`,
        );
        await put(`${directory}/ChatGPT-License.xml`, licenseBytes);
        await put(
          `${directory}/SHA256SUMS.txt`,
          `${sha256}  ${fileName}\n${licenseSha}  ChatGPT-License.xml\n`,
        );
        ftp.close();
      });
      phase = "mirror-verification";
      await verifyRange(url, size);
      await verifyRemote(url, sha256, size);
      const licenseUrl = `${base}/${directory}/ChatGPT-License.xml`;
      await verifyRemote(licenseUrl, licenseSha, licenseBytes.length);
      release = {
        ...info,
        id: releaseId,
        fileName,
        size,
        sha256,
        url,
        sourceUrl: PACKAGE_SOURCE,
        mirroredAt: new Date().toISOString(),
        sourceModifiedAt: lastModified
          ? new Date(lastModified).toISOString()
          : null,
        signature: verifiedSignature,
        license: {
          url: licenseUrl,
          sha256: licenseSha,
          size: licenseBytes.length,
        },
        checksumsUrl: `${base}/${directory}/SHA256SUMS.txt`,
      };
      log(`Signed version ${info.version} verified on the mirror`);
    }
  } else {
    log("Official package and license unchanged; no large file transfer");
  }
  phase = "release-notes";
  let notes = previous?.notes || {
    sourceUrl: NOTES_SOURCE,
    fetchedAt: null,
    entries: [],
  };
  let notesWarning = false;
  try {
    const html = await (await response(NOTES_SOURCE)).text();
    notes = {
      sourceUrl: NOTES_SOURCE,
      fetchedAt: new Date().toISOString(),
      entries: parseNotes(html),
    };
  } catch {
    notesWarning = true;
    log("Official notes unavailable; preserving previous notes");
  }
  phase = "publish";
  const now = new Date().toISOString();
  let retired = previous?.retired || [];
  if (previous?.release.id && previous.release.id !== release.id)
    retired = [
      ...retired.filter((r) => r.id !== previous.release.id),
      { id: previous.release.id, retiredAt: now },
    ];
  retired = retired.filter((r) => r.id !== release.id);
  const history = [
    {
      version: release.version,
      mirroredAt: release.mirroredAt,
      sha256: release.sha256,
    },
    ...(previous?.history || []).filter((r) => r.sha256 !== release.sha256),
  ].slice(0, 30);
  const catalog = {
    schemaVersion: 1,
    checkedAt: now,
    lastFullCheckAt,
    source,
    release,
    notes,
    history,
    retired,
    legacyFiles: [
      ...(previous?.legacyFiles || []),
      ...(previous?.release &&
      previous.release.fileName !== release.fileName &&
      !previous.release.fileName
        ? [
            {
              releaseId: previous.release.id,
              name: "ChatGPT-x64.msix",
              retiredAt: now,
            },
          ]
        : []),
    ],
  };
  validateCatalog(catalog, base);
  await writeFile(
    path.join(work, "latest.json"),
    JSON.stringify(catalog, null, 2),
  );
  await connect();
  await atomicJson("data/latest.json", catalog);
  await put(`index.html.${id}.tmp`, fallbackPage(catalog, site));
  await ftp.rename(`index.html.${id}.tmp`, "index.html");
  await atomicJson("data/status.json", {
    attemptedAt: now,
    successfulAt: now,
    outcome: "success",
    notesWarning,
  });
  phase = "cleanup";
  const removable = removableReleases(catalog, release.id);
  for (const old of removable) {
    // Remove only names emitted by this publisher, never arbitrary remote trees.
    for (const name of [
      packageFileName(old.id.split("-")[0]),
      `${packageFileName(old.id.split("-")[0])}.part`,
      "ChatGPT-x64.msix",
      "ChatGPT-x64.msix.part",
      "ChatGPT-License.xml",
      "SHA256SUMS.txt",
    ])
      await ftp.remove(`${NAMESPACE}/${old.id}/${name}`, true);
    await ftp.removeEmptyDir(`${NAMESPACE}/${old.id}`).catch(() => {});
  }
  const expiredLegacyFiles = catalog.legacyFiles.filter(
    (old) =>
      /^\d+\.\d+\.\d+\.\d+-[a-f0-9]{12}-[a-f0-9]{8}$/.test(old.releaseId) &&
      old.name === "ChatGPT-x64.msix" &&
      Date.now() - Date.parse(old.retiredAt) >= 86400000,
  );
  for (const old of expiredLegacyFiles)
    await ftp.remove(`${NAMESPACE}/${old.releaseId}/${old.name}`, true);
  catalog.legacyFiles = catalog.legacyFiles.filter(
    (old) => !expiredLegacyFiles.includes(old),
  );
  if (removable.length || expiredLegacyFiles.length) {
    catalog.retired = retired.filter(
      (r) => !removable.some((old) => old.id === r.id),
    );
    await atomicJson("data/latest.json", catalog);
  }
  log(`Mirror published successfully: ${base} · ${release.version}`);
} catch (error) {
  const safeMessage = String(error.message)
    .replaceAll(options.password, "[redacted]")
    .replaceAll(options.user, "[user]");
  log(`FAILED at ${phase}: ${safeMessage}`);
  try {
    await connect();
    await atomicJson("data/status.json", {
      attemptedAt: new Date().toISOString(),
      outcome: "failed",
      phase,
    });
  } catch {
    /* The previous catalog remains authoritative when FTP is unavailable. */
  }
  process.exitCode = 1;
} finally {
  ftp?.close();
}
