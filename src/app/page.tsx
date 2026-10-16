import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUpRight,
  ChevronRight,
  Download,
  FileCheck2,
  FileKey2,
  Globe2,
  HardDrive,
  History,
  PackageCheck,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { CopyButton, ThemeToggle } from "@/components/controls";
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
const command = `# 将安装包和许可证放在同一文件夹\n# 以管理员身份打开 Windows PowerShell\nAdd-AppxProvisionedPackage -Online \`\n  -PackagePath .\\ChatGPT-x64.msix \`\n  -LicensePath .\\ChatGPT-License.xml \`\n  -Regions all`;
const date = (v?: string | null) =>
  v
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(v))
    : "等待首次同步";
function WindowsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="currentColor"
      aria-hidden
    >
      <path d="M2 4.1 10.4 3v8.4H2zm9.5-1.2L22 1.5v9.9H11.5zM2 12.5h8.4V21L2 19.9zm9.5 0H22v10l-10.5-1.4z" />
    </svg>
  );
}
export default async function Home() {
  const [catalog, status] = await Promise.all([getCatalog(), getSyncStatus()]);
  const r = catalog?.release;
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
  const notes = catalog?.notes.entries || [];
  return (
    <>
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="/" className="brand" aria-label="Codex 下载站首页">
            <span className="brand-mark">
              <Terminal size={22} aria-hidden />
            </span>
            <span>
              Codex<span className="brand-label">下载站</span>
            </span>
          </a>
          <nav aria-label="主导航">
            <a className="nav-active" href="#download">
              下载
            </a>
            <a href="#updates">更新日志</a>
            <a href="#install">安装指南</a>
          </nav>
          <div className="header-actions">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="container">
        <section className="hero" aria-labelledby="hero-title">
          <div className="eyebrow">
            <span className="pulse-dot" /> WINDOWS 离线安装包
            <span className="eyebrow-divider">/</span> DAILY SYNC
          </div>
          <h1 id="hero-title">
            让下载更简单。
            <br />
            <span>让想法更快开始。</span>
          </h1>
          <p className="hero-description">
            获取最新 Codex 桌面端离线安装包。
            <br className="mobile-break" />
            官方原始文件，每日自动检查，下载后即可安装。
          </p>
          <div className="hero-chips">
            <span>
              <ShieldCheck size={15} aria-hidden /> 官方签名校验
            </span>
            <span>
              <History size={15} aria-hidden /> 每日自动同步
            </span>
            <span>
              <Globe2 size={15} aria-hidden /> 独立下载镜像
            </span>
          </div>
          <div className="hero-art" aria-hidden>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="terminal-tile">
              <Terminal size={58} strokeWidth={1.6} />
            </div>
            <div className="art-spark spark-one">+</div>
            <div className="art-spark spark-two">+</div>
          </div>
        </section>
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
                    <p>
                      将 ChatGPT-x64.msix 和 ChatGPT-License.xml
                      放入同一文件夹。
                    </p>
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
                    OpenAI.Codex。本镜像保持官方文件内容不变。
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
                          Get-FileHash .\ChatGPT-x64.msix -Algorithm SHA256
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
            <section
              id="updates"
              className="updates-card panel"
              aria-labelledby="updates-title"
            >
              <div className="side-heading">
                <h2 id="updates-title">最近更新</h2>
                <History size={18} aria-hidden />
              </div>
              <p className="updates-description">
                官方桌面应用更新说明 · 原文镜像
              </p>
              {notes.length ? (
                <div className="update-list">
                  {notes.map((note, index) => (
                    <details
                      className="update-item"
                      key={note.id}
                      open={index === 0}
                    >
                      <summary>
                        <span className="timeline-dot" />
                        <span>
                          <time dateTime={note.date}>
                            {note.date}
                            {index === 0 && <em>最近</em>}
                          </time>
                          <strong>{note.title}</strong>
                        </span>
                        <ChevronRight size={16} aria-hidden />
                      </summary>
                      <div className="update-content">
                        {note.blocks.map((block, i) =>
                          block.kind === "heading" ? (
                            <h3 key={i}>{block.text}</h3>
                          ) : (
                            <p
                              key={i}
                              className={
                                block.kind === "bullet" ? "update-bullet" : ""
                              }
                            >
                              {block.text}
                            </p>
                          ),
                        )}
                        <a href={note.url} target="_blank" rel="noreferrer">
                          阅读官方原文
                          <ArrowUpRight size={12} aria-hidden />
                        </a>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="updates-empty">
                  <History size={28} aria-hidden />
                  <p>
                    更新说明正在同步。
                    <br />
                    你也可以先查看官方日志。
                  </p>
                </div>
              )}
              <a
                className="all-updates"
                href="https://learn.chatgpt.com/docs/changelog?type=codex-app"
                target="_blank"
                rel="noreferrer"
              >
                查看全部官方更新
                <ArrowUpRight size={15} aria-hidden />
              </a>
            </section>
            <div className="trust-note">
              <ShieldCheck size={19} aria-hidden />
              <p>
                先验证，再发布。
                <br />
                <span>
                  每个新包均核验数字签名与 SHA-256，验证通过后才更新下载地址。
                </span>
              </p>
            </div>
          </aside>
        </div>
        <section className="bottom-banner">
          <HardDrive size={23} aria-hidden />
          <div>
            <h2>网络有边界，创造不必等待。</h2>
            <p>一个独立的 Codex 下载镜像，为获取官方安装包多提供一种选择。</p>
          </div>
          <a href={official} target="_blank" rel="noopener noreferrer">
            官方安装指南
            <ArrowUpRight size={16} aria-hidden />
          </a>
        </section>
      </main>
      <footer className="site-footer container">
        <div className="footer-brand">
          <Terminal size={18} aria-hidden />
          <span>Codex 下载站</span>
        </div>
        <p>
          独立镜像，与 OpenAI 无隶属关系。Codex 与 ChatGPT 商标归其所有者所有。
        </p>
      </footer>
    </>
  );
}
