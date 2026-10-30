import { Client } from "basic-ftp";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { Readable, Writable } from "node:stream";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import { ftpOptions, readManifest, fileHash, needsFullDownload } from "./core.mjs";
import {
  CLAUDE_PACKAGE_SOURCE,
  CLAUDE_NAMESPACE,
  CLAUDE_CATALOG,
  CLAUDE_STATUS,
  CLAUDE_NOTES_SOURCE,
  parseClaudeNotes,
  claudeFileName,
  claudeContentId,
  parseClaudeManifest,
  validateClaudeCatalog,
  removableClaudeReleases,
} from "./claude-core.mjs";

const env = process.env;
const base = (env.MIRROR_BASE_URL || "https://codex.shenxw.cn").replace(/\/$/, "");
if (new URL(base).protocol !== "https:") throw new Error("HTTPS is required");
const options = ftpOptions(env);
const work = path.resolve(".mirror-work-claude");
const probeOnly = process.argv.includes("--preflight");
const id = randomUUID();
let phase = "preflight";
let ftp;
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

async function connect() {
  ftp?.close();
  ftp = new Client(60000);
  await ftp.access(options);
  await ftp.cd(options.root);
  return ftp;
}
async function put(relative, content) {
  await ftp.uploadFrom(
    Readable.from([typeof content === "string" ? Buffer.from(content) : content]),
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
    write(chunk, _e, cb) {
      size += chunk.length;
      if (size > 1024 * 1024) return cb(new Error("Oversized remote metadata"));
      chunks.push(chunk);
      cb();
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
  const result = await fetch(url, { signal: AbortSignal.timeout(30000), ...init });
  if (!result.ok)
    throw new Error(`HTTP ${result.status} for ${new URL(url).pathname}`);
  return result;
}
// The official endpoint rejects HEAD (405), so fall back to a one-byte ranged GET
// and rebuild content-length from the Content-Range total.
async function sourceHead() {
  try {
    return await response(CLAUDE_PACKAGE_SOURCE, { method: "HEAD" });
  } catch (error) {
    log(`HEAD unavailable (${error.message}); using ranged GET`);
  }
  const result = await response(CLAUDE_PACKAGE_SOURCE, {
    headers: { Range: "bytes=0-0" },
  });
  await result.body?.cancel();
  const headers = new Headers(result.headers);
  const total = /\/(\d+)$/.exec(result.headers.get("content-range") || "")?.[1];
  if (total) headers.set("content-length", total);
  return { headers };
}async function retry(label, action) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (attempt === 3) throw error;
      log(`${label}: retry ${attempt}/2`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
}
function download() {
  const target = path.join(work, "source.msix");
  return new Promise((resolve, reject) => {
    const child = spawn(
      "curl",
      [
        "--fail", "--location", "--retry", "3", "--retry-delay", "5",
        "--connect-timeout", "30", "--speed-limit", "1024", "--speed-time", "120",
        "--max-time", "3600", "--silent", "--show-error",
        "--output", target,
        "--dump-header", path.join(work, "source.headers"),
        CLAUDE_PACKAGE_SOURCE,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let error = "";
    child.stderr.on("data", (d) => (error += d.toString()));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(target)
        : reject(new Error(`Official download failed (${code}): ${error.slice(0, 400)}`)),
    );
  });
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
      log(`HTTPS verification: ${(received / 1048576).toFixed(0)} / ${(expectedSize / 1048576).toFixed(0)} MiB`);
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
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
      path.resolve("scripts/verify-signature.ps1"), "-PackagePath", file],
    { encoding: "utf8", timeout: 180000 },
  );
  if (result.status !== 0)
    throw new Error(
      `MSIX signature verification failed: ${(result.stderr || result.error?.message || "").slice(0, 400)}`,
    );
  const value = JSON.parse(result.stdout.replace(/^﻿/, "").trim());
  if (value.status !== "Valid") throw new Error("Invalid package signature");
  return value;
}

await mkdir(work, { recursive: true });
try {
  await connect();
  await ftp.ensureDir("data");
  await ftp.cd(options.root);
  await ftp.ensureDir(CLAUDE_NAMESPACE);
  await ftp.cd(options.root);
  if (probeOnly) {
    log("Preflight complete");
    process.exit(0);
  }
  const previousRaw = await readRemoteJson(CLAUDE_CATALOG);
  const previous = previousRaw ? validateClaudeCatalog(previousRaw, base) : null;
  ftp.close();
  phase = "source-check";
  const head = await sourceHead();
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
  let release = previous?.release;
  let lastFullCheckAt = previous?.lastFullCheckAt;
  let source = previous?.source;
  if (changed) {
    phase = "download";
    let file = path.join(work, "source.msix");
    const canReuse =
      process.argv.includes("--reuse-download") &&
      (await stat(file).catch(() => null))?.size ===
        Number(head.headers.get("content-length"));
    if (!canReuse) file = await download();
    phase = "verification";
    const info = await readManifest(file, parseClaudeManifest);
    const verifiedSignature = signature(file);
    const sha256 = await fileHash(file);
    const size = (await stat(file)).size;
    const downloadHeaders = await readFile(path.join(work, "source.headers"), "utf8").catch(() => "");
    const etag = [...downloadHeaders.matchAll(/^etag:\s*(.+)$/gim)].at(-1)?.[1].trim() || null;
    const lastModified =
      [...downloadHeaders.matchAll(/^last-modified:\s*(.+)$/gim)].at(-1)?.[1].trim() || null;
    lastFullCheckAt = new Date().toISOString();
    source = { etag, lastModified, url: CLAUDE_PACKAGE_SOURCE };
    if (previous?.release.sha256 === sha256) {
      log("Full recheck confirmed the same signed package");
    } else {
      const releaseId = claudeContentId(info.version, sha256);
      const directory = `${CLAUDE_NAMESPACE}/${releaseId}`;
      const fileName = claudeFileName(info.version);
      const url = `${base}/${directory}/${fileName}`;
      phase = "upload";
      await retry("FTP upload", async () => {
        await connect();
        await ftp.ensureDir(directory);
        await ftp.cd(options.root);
        let last = 0;
        ftp.trackProgress((p) => {
          if (Date.now() - last > 30000) {
            log(`Uploading: ${(p.bytesOverall / 1048576).toFixed(0)} MiB`);
            last = Date.now();
          }
        });
        await ftp.uploadFrom(file, `${directory}/${fileName}.part`);
        ftp.trackProgress();
        if ((await ftp.size(`${directory}/${fileName}.part`)) !== size)
          throw new Error("FTP upload length mismatch");
        await ftp.rename(`${directory}/${fileName}.part`, `${directory}/${fileName}`);
        await put(`${directory}/SHA256SUMS.txt`, `${sha256}  ${fileName}\n`);
        ftp.close();
      });
      phase = "mirror-verification";
      await verifyRange(url, size);
      await verifyRemote(url, sha256, size);
      release = {
        ...info,
        id: releaseId,
        fileName,
        size,
        sha256,
        url,
        sourceUrl: CLAUDE_PACKAGE_SOURCE,
        mirroredAt: new Date().toISOString(),
        sourceModifiedAt: lastModified ? new Date(lastModified).toISOString() : null,
        signature: verifiedSignature,
        checksumsUrl: `${base}/${directory}/SHA256SUMS.txt`,
      };
      log(`Signed version ${info.version} verified on the mirror`);
    }
  } else {
    log("Official package unchanged; no large file transfer");
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
    { version: release.version, mirroredAt: release.mirroredAt, sha256: release.sha256 },
    ...(previous?.history || []).filter((r) => r.sha256 !== release.sha256),
  ].slice(0, 30);
  phase = "release-notes";
  let notes = previous?.notes || {
    sourceUrl: CLAUDE_NOTES_SOURCE,
    fetchedAt: null,
    entries: [],
  };
  let notesWarning = false;
  try {
    const text = await (await response(CLAUDE_NOTES_SOURCE)).text();
    notes = {
      sourceUrl: CLAUDE_NOTES_SOURCE,
      fetchedAt: new Date().toISOString(),
      entries: parseClaudeNotes(text),
    };
  } catch {
    notesWarning = true;
    log("Official Claude notes unavailable; preserving previous notes");
  }
  phase = "publish";  const catalog = {
    schemaVersion: 1,
    checkedAt: now,
    lastFullCheckAt,
    source,
    release,
    notes,
    history,
    retired,
  };
  validateClaudeCatalog(catalog, base);
  await writeFile(path.join(work, "latest.json"), JSON.stringify(catalog, null, 2));
  await connect();
  await atomicJson(CLAUDE_CATALOG, catalog);
  await atomicJson(CLAUDE_STATUS, {
    attemptedAt: now,
    successfulAt: now,
    outcome: "success",
    notesWarning,
  });
  phase = "cleanup";
  const removable = removableClaudeReleases(catalog, release.id);
  for (const old of removable) {
    const name = claudeFileName(old.id.split("-")[0]);
    for (const n of [name, `${name}.part`, "SHA256SUMS.txt"])
      await ftp.remove(`${CLAUDE_NAMESPACE}/${old.id}/${n}`, true);
    await ftp.removeEmptyDir(`${CLAUDE_NAMESPACE}/${old.id}`).catch(() => {});
  }
  if (removable.length) {
    catalog.retired = retired.filter((r) => !removable.some((o) => o.id === r.id));
    await atomicJson(CLAUDE_CATALOG, catalog);
  }
  log(`Claude mirror published successfully: ${release.version}`);
} catch (error) {
  const safe = String(error.message)
    .replaceAll(options.password, "[redacted]")
    .replaceAll(options.user, "[user]");
  log(`FAILED at ${phase}: ${safe}`);
  try {
    await connect();
    await atomicJson(CLAUDE_STATUS, {
      attemptedAt: new Date().toISOString(),
      outcome: "failed",
      phase,
    });
  } catch {
    /* previous catalog remains authoritative */
  }
  process.exitCode = 1;
} finally {
  ftp?.close();
}
