# Codex 下载站

Windows x64 官方 MSIX 的个人镜像站。正式页面：https://codex.sxwzxc.cn ，文件镜像：https://codex.shenxw.cn 。

## 结构

- Next.js 15 + TypeScript：下载页、中文安装指南、原文更新日志、主题切换。
- `GET /api/releases`：读取 FTP 网站公开的版本清单，只返回公开元数据。
- `/download/windows-x64`、`/download/license`：302 到镜像不可变文件地址，不代理大文件。
- `scripts/sync.mjs`：Windows 上校验 MSIX 数字签名和包身份，上传 FTP，HTTPS 全量核对哈希，再切换清单。
- GitHub Actions：每天 01:17 UTC（北京时间 09:17），以及手动触发。

官方包名现在为 `ChatGPT-x64.msix`，MSIX Identity 为 `OpenAI.Codex`。不镜像 Codex CLI 或其他架构，不改动、重新签名或重新打包官方文件。

## 本地开发

需要 Node.js 22。执行 `npm ci`、`npm run dev`，浏览 http://localhost:3000 。页面默认读取真实镜像的公开元数据，没有镜像时显示准备中。

检查：`npm test`、`npm run lint`、`npm run build`。

## 同步配置

GitHub 仓库 Secrets：`FTP_URL`、`FTP_USER`、`FTP_PASSWORD`。`FTP_URL` 可使用 `ftp://host:port` 或 `ftps://host:port`；后者使用显式 TLS 并校验证书。

仓库 Variable `FTP_REMOTE_DIR` 为 FTP 中的网站根目录，默认 `/`。首次同步会上传随机探针，验证该目录确实映射到文件网站，然后删除探针。FTP 服务必须支持数据连接、SIZE 和 RNFR/RNTO 覆盖重命名，网站必须支持 HTTPS 和 HTTP Range。

本地同步复制 `.env.example` 为 `.env` 并填入配置，使用 Windows：

```powershell
node --env-file=.env scripts/sync.mjs --preflight
node --env-file=.env scripts/sync.mjs
```

`--force` 强制完整检查；`--reuse-download` 供本地复用 `.mirror-work/source.msix`，仍然检查大小、MSIX 身份、签名和 SHA-256。完整下载通过 curl 完成，临时文件不会提交。

GitHub Actions 的 **Sync Codex MSIX mirror** 工作流提供 `preflight`、`sync`、`force` 三种手动模式。同步最大运行两小时，使用全局并发锁。

## 发布约定

文件位于 `releases/codex-windows-x64/<version>-<package hash>-<license hash>/`。官方包和许可证验证成功后，上传 MSIX 临时文件，再重命名；经公网全量 SHA-256 和 206 Range 校验通过后，最后原子切换 `data/latest.json`。

`data/latest.json` 是发布事实来源；`data/status.json` 记录成功或失败阶段，不含错误详情和凭据。FTP 首页生成备用下载页。官方更新说明独立抓取并转换成纯文本段落，最多保留 20 条；没有匹配的更新内容时不编造说明。更新日志失败不会阻止包发布。

仅展示最新版。旧包在切换后保留 24 小时，随后按清单清理；不会递归删除 FTP 根目录或不属于本项目的文件。按目前约 0.9 GiB 的安装包大小，建议预留至少 3 GB。每次新版本需要源下载、FTP 上传、镜像下载校验三次大文件传输；未变更时只进行小请求，每周做一次完整复核。

公开仓库的每日任务可能因 GitHub 调度延迟而晚到。独立的 `mirror-maintenance` 分支每周写入状态，不更改 main；Makers 生产部署应仅跟踪 main，关闭其他分支的自动预览部署。超过 36 小时未成功检查，页面显示过期提示。

## 部署与缓存

现有 Makers 项目应使用 `npm run build`、`.next` 输出目录，生产分支 main。Next.js 由 Makers 原生构建，不需要其他平台适配器。

将 `codex.sxwzxc.cn` 绑定至现有项目并按控制台指示配置 DNS/HTTPS。`codex.shenxw.cn` 保持现有源站线路。小清单/首页应短缓存（不超过 300 秒），版本目录可长期缓存；`.msix` 应使用 `application/vnd.ms-appx`，下载不能被 HTML 挑战页替换。CDN 和 Web 服务器配置不由 FTP 客户端自动修改。

上线验收应实际下载完整 MSIX、比对 SHA-256，并测试断点续传。网站可访问不等于大文件 CDN 已通过验收。

## 安全边界

生产页面不需要 FTP 凭据。不要设置 `NEXT_PUBLIC_FTP_*`，不要将 `.env`、安装包、原始调试转储提交到仓库。PR 检查不接收同步 Secrets。工作流 Actions 固定到提交，运行前使用锁文件安装依赖。

本项目与 OpenAI 无隶属关系；Codex、ChatGPT 商标及官方软件归其所有者所有。离线安装包仅用于安装，服务使用仍需联网。
