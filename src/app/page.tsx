import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUpRight,
  ChevronRight,
  Download,
  FileCheck2,
  FileKey2,
  Globe2,
  PackageCheck,
  Terminal,
} from "lucide-react";
import { CopyButton } from "@/components/controls";
import {
  SiteShell,
  TrustNote,
  UpdatesCard,
  WindowsIcon,
  date,
} from "@/components/site";
import { getCatalog, getSyncStatus } from "@/lib/catalog";
export const revalidate = 300;
const official = "https://learn.chatgpt.com/docs/enterprise/windows-deployment";
const officialDownloads = [
  {
    label: "官方 MSIX 安装包 · Windows x64",
    url: "https://persistent.oaistatic.com/codex-app-prod/ChatGPT-x64.msix",
  },
  {
    label: "官方离线许可证",
    url: "https://persistent.oaistatic.com/codex-app-prod/ChatGPT-License.xml",
  },
];
export default async function Home() {
  const [catalog, status] = await Promise.all([getCatalog(), getSyncStatus()]);
  const r = catalog?.release;
  const fileName = r?.fileName || "ChatGPT-x64.msix";
  const command = `# 将安装包和许可证放在同一文件夹\n# 以管理员身份打开 Windows PowerShell\nAdd-AppxProvisionedPackage -Online \`\n  -PackagePath .\\${fileName} \`\n  -LicensePath .\\ChatGPT-License.xml \`\n  -Regions all`;
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
  const notes = catalog?.notes.entries || [];  return (
    <SiteShell product="codex">
        <div className="main-grid">
          <div className="primary-column">
            <section
              id="download"
              className="download-card panel"
              aria-labelledby="download-title"
            >
              <div className="card-heading">
                <div className="platform-icon">
                  <WindowsIcon />
                </div>
                <div>
                  <div className="small-label">DESKTOP APP</div>
                  <h2 id="download-title">Codex for Windows</h2>
                </div>
                <span className="stable-badge">稳定版</span>
              </div>
              <p className="card-description">
                适用于 Intel / AMD 64 位 Windows 电脑
              </p>
              <div className="package-metrics">
                <div>
                  <span>当前版本</span>
                  <strong className="mono">{r?.version || "—"}</strong>
                </div>
                <div>
                  <span>安装包大小</span>
                  <strong>
                    {r ? `${(r.size / 1048576).toFixed(1)} MiB` : "—"}
                    <em>MSIX</em>
                  </strong>
                </div>
                <div>
                  <span>系统架构</span>
                  <strong>
                    x64<em>64 位</em>
                  </strong>
                </div>
              </div>
              <div className="download-actions">
                {r ? (
                  <a className="download-button" href="/download/windows-x64">
                    <ArrowDownToLine size={21} aria-hidden />
                    <span>下载 Windows 安装包</span>
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
                {r ? (
                  <a
                    className="backup-download-button"
                    href="/download/windows-x64-backup"
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
                {r ? (
                  <>
                    <a href="/download/license">
                      <FileKey2 size={16} aria-hidden />
                      下载离线许可证
                      <ArrowDown size={13} aria-hidden />
                    </a>
                    <a href="/download/checksums">
                      <FileCheck2 size={16} aria-hidden />
                      SHA-256 校验文件
                      <ArrowDown size={13} aria-hidden />
                    </a>
                  </>
                ) : (
                  <p>首次同步完成后，将提供经过校验的下载地址。</p>
                )}
              </div>
              <section
                className="official-downloads"
                aria-labelledby="official-downloads-title"
              >
                <h3 id="official-downloads-title">
                  <Globe2 size={16} aria-hidden />
                  官方直接下载
                </h3>
                <p>
                  如果可以访问官方网络，可直接使用以下原始地址。官方版本可能先于镜像更新。
                </p>
                {officialDownloads.map(({ label, url }) => (
                  <div className="official-download" key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <span>
                        {label}
                        <ArrowUpRight size={14} aria-hidden />
                      </span>
                      <code>{url}</code>
                    </a>
                    <CopyButton text={url} label="复制地址" />
                  </div>
                ))}
              </section>
              <div className="download-note">
                <span className="note-icon">i</span>
                <span>
                  离线安装需要 <strong>MSIX 安装包 + 许可证</strong> 两个文件。
                  <a href="#install">
                    查看安装步骤
                    <ChevronRight size={12} aria-hidden />
                  </a>
                </span>
              </div>
              <div className="card-foot">
                <span>
                  <PackageCheck size={14} aria-hidden />
                  {r
                    ? "原始文件 · 保留官方数字签名"
                    : "仅发布验证通过的官方文件"}
                </span>
                <a href={official} target="_blank" rel="noreferrer">
                  官方安装说明
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
                    <h3>下载两个文件</h3>
                    <p>将 {fileName} 和 ChatGPT-License.xml 放入同一文件夹。</p>
                  </div>
                </li>
                <li>
                  <span className="step-number">02</span>
                  <div>
                    <h3>以管理员身份运行安装</h3>
                    <p>在此文件夹打开 Windows PowerShell，执行下面的命令。</p>
                  </div>
                </li>
              </ol>
              <div className="code-box">
                <div className="code-toolbar">
                  <span>
                    <span className="code-dot" />
                    Windows PowerShell
                  </span>
                  <CopyButton text={command} label="复制命令" />
                </div>
                <pre>
                  <code>{command}</code>
                </pre>
              </div>
              <ol className="steps last-step" start={3}>
                <li>
                  <span className="step-number">03</span>
                  <div>
                    <h3>打开应用，开始工作</h3>
                    <p>
                      从开始菜单打开应用。如果没有出现，请注销 Windows
                      后重新登录。使用 Codex 服务仍需联网和登录账号。
                    </p>
                  </div>
                </li>
              </ol>
              <details className="details-box">
                <summary>
                  关于文件名、系统要求与校验
                  <ChevronRight size={16} aria-hidden />
                </summary>
                <div className="details-body">
                  <p>
                    官方当前使用 ChatGPT-x64.msix 文件名，应用包标识为
                    OpenAI.Codex。镜像下载文件名包含版本号，文件内容及数字签名保持不变。使用官方直接下载时，请将命令中的安装包名称改为
                    ChatGPT-x64.msix。
                  </p>
                  <p>
                    <code>-Online</code> 表示安装到当前运行的 Windows
                    系统，不表示这条命令必须联网。
                  </p>
                  {r && (
                    <>
                      <p>
                        包声明的最低系统版本：<code>{r.minWindowsVersion}</code>
                        。
                      </p>
                      {r.dependencies.length > 0 && (
                        <p>
                          包依赖：
                          {r.dependencies
                            .map((d) => `${d.name} ${d.minVersion}`)
                            .join("；")}
                          。
                        </p>
                      )}
                      <p>
                        使用{" "}
                        <code>
                          {`Get-FileHash .\\${fileName} -Algorithm SHA256`}
                        </code>{" "}
                        核对完整性。
                      </p>
                      <div className="hash-row">
                        <code>{r.sha256}</code>
                        <CopyButton text={r.sha256} label="复制 SHA-256" />
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
            <UpdatesCard notes={notes} description="官方桌面应用更新说明 · 原文镜像" allUrl="https://learn.chatgpt.com/docs/changelog?type=codex-app" />
            <TrustNote />
          </aside>
        </div>
    </SiteShell>
  );
}