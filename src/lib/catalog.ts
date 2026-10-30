import "server-only";
export type UpdateEntry = {
  id: string;
  date: string;
  title: string;
  version: string | null;
  url: string;
  blocks: { kind: string; text: string }[];
};
export type Release = {
  fileName?: string;
  id: string;
  version: string;
  architecture: string;
  packageName: string;
  publisher: string;
  minWindowsVersion: string;
  size: number;
  sha256: string;
  mirroredAt: string;
  sourceModifiedAt: string | null;
  url: string;
  sourceUrl: string;
  signature: { status: string; subject: string };
  license: { url: string; sha256: string; size: number };
  checksumsUrl: string;
  dependencies: { name: string; minVersion: string }[];
};
export type Catalog = {
  schemaVersion: 1;
  checkedAt: string;
  lastFullCheckAt: string;
  release: Release;
  notes: {
    sourceUrl: string;
    fetchedAt: string | null;
    entries: UpdateEntry[];
  };
  history: { version: string; mirroredAt: string; sha256: string }[];
};
export type SyncStatus = {
  attemptedAt?: string;
  outcome?: string;
  phase?: string;
  notesWarning?: boolean;
};
const origin = process.env.MIRROR_BASE_URL || "https://codex.shenxw.cn";
export function safeDownloadUrl(address: string) {
  const url = new URL(address);
  if (
    url.protocol !== "https:" ||
    url.origin !== new URL(origin).origin ||
    !/^\/releases\/codex-windows-x64\/[\w.-]+\/[\w.-]+$/.test(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid mirror URL");
  return url.href;
}
export async function getCatalog(): Promise<Catalog | null> {
  try {
    const response = await fetch(`${origin}/data/latest.json`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const raw = await response.text();
    if (raw.length > 1024 * 1024) return null;
    const data = JSON.parse(raw) as Catalog;
    const r = data.release;
    if (
      data.schemaVersion !== 1 ||
      r?.packageName !== "OpenAI.Codex" ||
      r.architecture !== "x64" ||
      !/^\d+\.\d+\.\d+\.\d+$/.test(r.version) ||
      !/^[a-f0-9]{64}$/.test(r.sha256) ||
      !Number.isSafeInteger(r.size) ||
      r.size <= 0 ||
      r.signature?.status !== "Valid" ||
      !Number.isFinite(Date.parse(data.checkedAt))
    )
      return null;
    [r.url, r.license.url, r.checksumsUrl].forEach(safeDownloadUrl);
    if (
      r.fileName &&
      (r.fileName !== `Codex-${r.version}-windows-x64.msix` ||
        new URL(r.url).pathname.split("/").at(-1) !== r.fileName)
    )
      return null;
    data.notes.entries = (data.notes?.entries || [])
      .filter((e) => {
        try {
          return (
            new URL(e.url).origin === "https://learn.chatgpt.com" &&
            Array.isArray(e.blocks) &&
            typeof e.title === "string"
          );
        } catch {
          return false;
        }
      })
      .slice(0, 20);
    return data;
  } catch {
    return null;
  }
}
export type ClaudeRelease = Omit<Release, "license"> & { fileName: string };
export type ClaudeCatalog = {
  schemaVersion: 1;
  checkedAt: string;
  lastFullCheckAt: string;
  release: ClaudeRelease;
  history: { version: string; mirroredAt: string; sha256: string }[];
};
export function safeClaudeUrl(address: string) {
  const url = new URL(address);
  if (
    url.protocol !== "https:" ||
    url.origin !== new URL(origin).origin ||
    !/^\/releases\/claude-windows-x64\/[\w.-]+\/[\w.-]+$/.test(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid mirror URL");
  return url.href;
}
export async function getClaudeCatalog(): Promise<ClaudeCatalog | null> {
  try {
    const response = await fetch(`${origin}/data/claude-latest.json`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const raw = await response.text();
    if (raw.length > 1024 * 1024) return null;
    const data = JSON.parse(raw) as ClaudeCatalog;
    const r = data.release;
    if (
      data.schemaVersion !== 1 ||
      !/claude/i.test(r?.packageName || "") ||
      r.architecture !== "x64" ||
      !/^\d+\.\d+\.\d+(\.\d+)?$/.test(r.version) ||
      !/^[a-f0-9]{64}$/.test(r.sha256) ||
      !Number.isSafeInteger(r.size) ||
      r.size <= 0 ||
      r.signature?.status !== "Valid" ||
      !Number.isFinite(Date.parse(data.checkedAt)) ||
      r.fileName !== `Claude-${r.version}-windows-x64.msix` ||
      new URL(r.url).pathname.split("/").at(-1) !== r.fileName
    )
      return null;
    [r.url, r.checksumsUrl].forEach(safeClaudeUrl);
    return data;
  } catch {
    return null;
  }
}
export async function diagnoseClaude() {
  const checks: { name: string; ok: boolean; detail: string }[] = [];
  const add = (name: string, ok: boolean, detail: string) =>
    checks.push({ name, ok, detail });
  add("MIRROR_BASE_URL", true, origin);
  let data: ClaudeCatalog | null = null;
  try {
    const res = await fetch(`${origin}/data/claude-latest.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    add(
      "fetch claude-latest.json",
      res.ok,
      `HTTP ${res.status}, ${text.length} bytes, content-type=${res.headers.get("content-type")}${res.ok ? "" : "（同步尚未运行或清单未上传到该目录）"}`,
    );
    if (res.ok) {
      try {
        data = JSON.parse(text);
        add("parse JSON", true, "ok");
      } catch {
        add("parse JSON", false, `不是 JSON，开头：${text.slice(0, 80)}`);
      }
    }
  } catch (e) {
    add("fetch claude-latest.json", false, String(e));
  }
  const r = data?.release;
  if (r) {
    add("schemaVersion", data!.schemaVersion === 1, String(data!.schemaVersion));
    add("packageName", /claude/i.test(r.packageName || ""), String(r.packageName));
    add("architecture", r.architecture === "x64", String(r.architecture));
    add("version", /^\d+\.\d+\.\d+(\.\d+)?$/.test(r.version), String(r.version));
    add("sha256", /^[a-f0-9]{64}$/.test(r.sha256), String(r.sha256));
    add("size", Number.isSafeInteger(r.size) && r.size > 0, String(r.size));
    add("signature", r.signature?.status === "Valid", JSON.stringify(r.signature));
    add("fileName", r.fileName === `Claude-${r.version}-windows-x64.msix`, String(r.fileName));
    for (const [k, v] of [["url", r.url], ["checksumsUrl", r.checksumsUrl]] as const) {
      try {
        safeClaudeUrl(v);
        add(k, true, v);
      } catch {
        add(k, false, `被拒绝：${v}`);
      }
    }
    try {
      const head = await fetch(r.url, {
        headers: { Range: "bytes=0-1023" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      await head.body?.cancel();
      add(
        "mirror Range",
        head.status === 206,
        `HTTP ${head.status}, content-range=${head.headers.get("content-range")}, type=${head.headers.get("content-type")}`,
      );
    } catch (e) {
      add("mirror Range", false, String(e));
    }
  }
  for (const f of ["claude-status.json", "latest.json"]) {
    try {
      const res = await fetch(`${origin}/data/${f}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const t = await res.text();
      add(`data/${f}`, res.ok, res.ok ? t.slice(0, 300) : `HTTP ${res.status}`);
    } catch (e) {
      add(`data/${f}`, false, String(e));
    }
  }
  return { ok: checks.every((c) => c.ok), checks };
}
export async function getClaudeSyncStatus(): Promise<SyncStatus | null> {
  try {
    const r = await fetch(`${origin}/data/claude-status.json`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const text = await r.text();
    return text.length < 4096 ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
export async function getSyncStatus(): Promise<SyncStatus | null> {
  try {
    const r = await fetch(`${origin}/data/status.json`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const text = await r.text();
    return text.length < 4096 ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
