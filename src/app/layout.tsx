import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://codex.sxwzxc.cn"),
  title: "Codex 下载站 · Windows 官方离线安装包",
  description:
    "下载最新 Codex Windows x64 MSIX 离线安装包与许可证，查看官方更新说明和安装指南。官方签名校验，每日自动同步。",
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('codex-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
