import {
  ArrowUpRight,
  ChevronRight,
  Globe2,
  HardDrive,
  History,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { ThemeToggle } from "@/components/controls";
import type { UpdateEntry } from "@/lib/catalog";

export type Product = "codex" | "claude";
const copy = {
  codex: {
    name: "Codex",
    lead: "获取最新 Codex 桌面端离线安装包。",
    banner: "一个独立的 Codex 下载镜像，为获取官方安装包多提供一种选择。",
    guide: "https://learn.chatgpt.com/docs/enterprise/windows-deployment",
    trademark: "独立镜像，与 OpenAI 无隶属关系。Codex 与 ChatGPT 商标归其所有者所有。",
  },
  claude: {
    name: "Claude",
    lead: "获取最新 Claude 桌面端离线安装包。",
    banner: "一个独立的 Claude 下载镜像，为获取官方安装包多提供一种选择。",
    guide:
      "https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows",
    trademark: "独立镜像，与 Anthropic 无隶属关系。Claude 商标归其所有者所有。",
  },
} as const;
export const date = (v?: string | null) =>
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
export function WindowsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden>
      <path d="M2 4.1 10.4 3v8.4H2zm9.5-1.2L22 1.5v9.9H11.5zM2 12.5h8.4V21L2 19.9zm9.5 0H22v10l-10.5-1.4z" />
    </svg>
  );
}
export function SiteShell({
  product,
  children,
}: {
  product: Product;
  children: React.ReactNode;
}) {
  const p = copy[product];
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
            <a className={product === "codex" ? "nav-active" : ""} href="/">
              Codex
            </a>
            <a className={product === "claude" ? "nav-active" : ""} href="/claude">
              Claude
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
            {p.lead}
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
        {children}
        <section className="bottom-banner">
          <HardDrive size={23} aria-hidden />
          <div>
            <h2>网络有边界，创造不必等待。</h2>
            <p>{p.banner}</p>
          </div>
          <a href={p.guide} target="_blank" rel="noopener noreferrer">
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
        <p>{p.trademark}</p>
      </footer>
    </>
  );
}
export function TrustNote() {
  return (
    <div className="trust-note">
      <ShieldCheck size={19} aria-hidden />
      <p>
        先验证，再发布。
        <br />
        <span>每个新包均核验数字签名与 SHA-256，验证通过后才更新下载地址。</span>
      </p>
    </div>
  );
}
export function UpdatesCard({
  notes,
  allUrl,
  description,
}: {
  notes: UpdateEntry[];
  allUrl: string;
  description: string;
}) {
  return (
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
                {description}
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
                href={allUrl}
                target="_blank"
                rel="noreferrer"
              >
                查看全部官方更新
                <ArrowUpRight size={15} aria-hidden />
              </a>
            </section>
  );
}