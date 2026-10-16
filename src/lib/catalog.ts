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
