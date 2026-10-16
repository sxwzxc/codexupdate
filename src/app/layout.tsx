import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Python + EdgeOne Pages | EdgeOne Makers",
  description: "Deploy lightweight Python serverless functions on EdgeOne Pages without any web framework dependency. Pure Python, maximum performance. · Demo only · EdgeOne Makers",
  keywords: "EdgeOne Makers, Demo only",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US">
      <head>
        <link rel="icon" href="/python-favicon.svg" />
      </head>
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
