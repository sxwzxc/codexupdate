"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Moon, Sun } from "lucide-react";
export function CopyButton({
  text,
  label = "复制",
}: {
  text: string;
  label?: string;
}) {
  const [state, setState] = useState("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2500);
  }
  return (
    <button className="copy-button" onClick={copy} aria-label={label}>
      {state === "copied" ? (
        <Check size={15} aria-hidden />
      ) : (
        <Copy size={15} aria-hidden />
      )}
      <span aria-live="polite">
        {state === "copied"
          ? "已复制"
          : state === "failed"
            ? "请手动复制"
            : label}
      </span>
    </button>
  );
}
export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    setLight(document.documentElement.dataset.theme === "light");
  }, []);
  function toggle() {
    const value = !light;
    setLight(value);
    document.documentElement.dataset.theme = value ? "light" : "dark";
    try {
      localStorage.setItem("codex-theme", value ? "light" : "dark");
    } catch {}
  }
  return (
    <button
      className="theme-toggle"
      aria-label={light ? "切换深色主题" : "切换浅色主题"}
      onClick={toggle}
    >
      {light ? <Moon size={19} aria-hidden /> : <Sun size={19} aria-hidden />}
    </button>
  );
}
