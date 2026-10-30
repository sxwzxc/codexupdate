import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUpRight,
  ChevronRight,
  Download,
  FileCheck2,
  Globe2,
  PackageCheck,
  Terminal,
} from "lucide-react";
import type { Metadata } from "next";
import { CopyButton } from "@/components/controls";
import {
  SiteShell,
  TrustNote,
  UpdatesCard,
  WindowsIcon,
  date,
} from "@/components/site";
import { getClaudeCatalog, getClaudeSyncStatus } from "@/lib/catalog";
export const revalidate = 300;
export const metadata: Metadata = {
  title: "Claude 下载站 · Windows 官方离线安装包",
  description:
    "下载最新 Claude Desktop Windows x64 MSIX 离线安装包，查看官方更新日志和安装指南。官方签名校验，每日自动同步。",
  alternates: { canonical: "/claude" },
};
const claudeOfficial =
  "https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows";
const claudeSource =
  "https://claude.ai/api/desktop/win32/x64/msix/latest/redirect";
export default async function ClaudePage() {
  const [catalog, status] = await Promise.all([
    getClaudeCatalog(),
    getClaudeSyncStatus(),
  ]);
  const c = catalog?.release;
  const r = c;
  const claudeFile = c?.fileName || "Claude-x64.msix";
  const claudeCommand = `# 以管理员身份打开 Windows PowerShell，进入安装包所在文件夹\nAdd-AppxProvisionedPackage -Online \`\n  -PackagePath .\\${claudeFile} \`\n  -SkipLicense`;
  const stale =
    !catalog || Date.now() - Date.parse(catalog.checkedAt) > 36 * 3600000;
  const failed =
    status?.outcome === "failed" &&
    Date.parse(status.attemptedAt || "") > Date.parse(catalog?.checkedAt || "");
  const state = !r
    ? "镜像准备中"
    : failed
      ? "同步待重试"
      : stale
        ? "检查已过期"
        : "镜像已就绪";
  const notes = catalog?.notes?.entries || [];  return (
    <SiteShell product="claude">
        <div className="main-grid">
          <div className="primary-column">
            <section
              id="claude"
              className="download-card panel"
              aria-labelledby="claude-title"
            >
              <div className="card-heading">
                <div className="platform-icon">
                  <WindowsIcon />
                </div>
                <div>
                  <div className="small-label">DESKTOP APP</div>
                  <h2 id="claude-title">Claude for Windows</h2>
                </div>
                <span className="stable-badge">稳定版</span>
              </div>
              <p className="card-description">
                适用于 Intel / AMD 64 位 Windows 电脑 · MSIX 离线包
              </p>
              <div className="package-metrics">
                <div>
                  <span>当前版本</span>
                  <strong className="mono">{c?.version || "—"}</strong>
                </div>
                <div>
                  <span>安装包大小</span>
                  <strong>
                    {c ? `${(c.size / 1048576).toFixed(1)} MiB` : "—"}
                    <em>MSIX</em>
                  </strong>
                </div>
                <div>
                  <span>同步于</span>
                  <strong>{date(c?.mirroredAt)}</strong>
                </div>
              </div>
              <div className="download-actions">
                {c ? (
                  <a
                    className="download-button"
                    href="/download/claude-windows-x64"
                  >
                    <ArrowDownToLine size={21} aria-hidden />
                    <span>下载 Claude 安装包</span>
                    <span className="button-extension">.msix</span>
                  </a>
                ) : (
                  <div
                    className="download-button unavailable"
                    aria-disabled="true"
                  >
                    <Download size={21} aria-hidden /> 安装包准备中
                  </div>
                )}
                {c ? (
                  <a
                    className="backup-download-button"
                    href="/download/claude-windows-x64-backup"
                  >
                    备用下载
                    <ArrowDownToLine size={16} aria-hidden />
                  </a>
                ) : (
                  <div
                    className="backup-download-button unavailable"
                    aria-disabled="true"
                  >
                    备用下载
                    <ArrowDownToLine size={16} aria-hidden />
                  </div>
                )}
              </div>
              <div className="download-secondary">
                {c ? (
                  <a href="/download/claude-checksums">
                    <FileCheck2 size={16} aria-hidden />
                    SHA-256 校验文件
                    <ArrowDown size={13} aria-hidden />
                  </a>
                ) : (
                  <p>首次同步完成后，将提供经过校验的下载地址。</p>
                )}
                {(stale || failed) && c && (
                  <p className="status-warning">
                    同步需要再次检查，已验证的安装包仍可下载。
                  </p>
                )}
              </div>
              <section
                className="official-downloads"
                aria-labelledby="claude-official-title"
              >
                <h3 id="claude-official-title">
                  <Globe2 size={16} aria-hidden />
                  官方直接下载
                </h3>
                <p>
                  如果可以访问官方网络，可直接使用以下原始地址。官方版本可能先于镜像更新。
                </p>
                <div className="official-download">
                  <a href={claudeSource} target="_blank" rel="noopener noreferrer">
                    <span>
                      官方 MSIX 安装包 · Windows x64
                      <ArrowUpRight size={14} aria-hidden />
                    </span>
                    <code>{claudeSource}</code>
                  </a>
                  <CopyButton text={claudeSource} label="复制地址" />
                </div>
              </section>
              <div className="card-foot">
                <span>
                  <PackageCheck size={14} aria-hidden />
                  {c
                    ? "原始文件 · 保留官方数字签名"
                    : "仅发布验证通过的官方文件"}
                </span>
                <a href={claudeOfficial} target="_blank" rel="noreferrer">
                  官方部署说明
                  <ArrowUpRight size={13} aria-hidden />
                </a>
              </div>
            </section>
            <section
              id="install"
              className="install-section"
              aria-labelledby="install-title"
            >
              <div className="section-title">
                <Terminal size={19} aria-hidden />
                <h2 id="install-title">三步，准备就绪</h2>
                <span className="section-caption">INSTALLATION</span>
              </div>
              <ol className="steps">
                <li>
                  <span className="step-number">01</span>
                  <div>
                    <h3>下载安装包</h3>
                    <p>
                      下载 {claudeFile}。Claude 的 MSIX 包无需单独的许可证文件。
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-number">02</span>
                  <div>
                    <h3>以管理员身份运行安装</h3>
                    <p>在安装包所在文件夹打开 Windows PowerShell，执行下面的命令。</p>
                  </div>
                </li>
              </ol>
              <div className="code-box">
                <div className="code-toolbar">
                  <span>
                    <span className="code-dot" />
                    Windows PowerShell
                  </span>
                  <CopyButton text={claudeCommand} label="复制命令" />
                </div>
                <pre>
                  <code>{claudeCommand}</code>
                </pre>
              </div>
              <ol className="steps last-step" start={3}>
                <li>
                  <span className="step-number">03</span>
                  <div>
                    <h3>打开应用，开始工作</h3>
                    <p>
                      从开始菜单打开应用。如果没有出现，请注销 Windows
                      后重新登录。使用 Claude 服务仍需联网和登录账号。
                    </p>
                  </div>
                </li>
              </ol>
              <details className="details-box">
                <summary>
                  关于系统要求与校验
                  <ChevronRight size={16} aria-hidden />
                </summary>
                <div className="details-body">
                  <p>
                    <code>-Online</code> 表示安装到当前运行的 Windows
                    系统，不表示这条命令必须联网。
                  </p>
                  {c && (
                    <>
                      {c.minWindowsVersion && (
                        <p>
                          包声明的最低系统版本：<code>{c.minWindowsVersion}</code>。
                        </p>
                      )}
                      {c.dependencies.length > 0 && (
                        <p>
                          包依赖：
                          {c.dependencies
                            .map((d) => `${d.name} ${d.minVersion}`)
                            .join("；")}
                          。
                        </p>
                      )}
                      <p>
                        使用{" "}
                        <code>{`Get-FileHash .\\${claudeFile} -Algorithm SHA256`}</code>{" "}
                        核对完整性。
                      </p>
                      <div className="hash-row">
                        <code>{c.sha256}</code>
                        <CopyButton text={c.sha256} label="复制 SHA-256" />
                      </div>
                    </>
                  )}
                </div>
              </details>
            </section>
          </div>
          <aside className="secondary-column">
            <section
              className="status-card panel"
              aria-labelledby="status-title"
            >
              <div className="side-heading">
                <h2 id="status-title">镜像状态</h2>
                <span
                  className={`status-pill ${stale || failed ? "warning" : ""}`}
                >
                  <span />
                  {state}
                </span>
              </div>
              <p>每日北京时间 09:17 自动检查更新</p>
              <dl className="status-list">
                <div>
                  <dt>最近成功检查</dt>
                  <dd>{date(catalog?.checkedAt)}</dd>
                </div>
                <div>
                  <dt>安装包同步于</dt>
                  <dd>{date(r?.mirroredAt)}</dd>
                </div>
                <div>
                  <dt>文件下载节点</dt>
                  <dd>独立镜像节点</dd>
                </div>
              </dl>
              {(stale || failed) && r && (
                <p className="status-warning">
                  同步需要再次检查，已验证的安装包仍可下载。
                </p>
              )}
            </section>
            <UpdatesCard notes={notes} description="官方 Claude Desktop 更新日志 · 原文镜像" allUrl="https://claude.com/docs/cowork/changelog" />
            <TrustNote />
          </aside>
        </div>
    </SiteShell>
  );
}