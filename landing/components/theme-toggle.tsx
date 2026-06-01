"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("setpoint-theme") as "light" | "dark" | null;
    const initial =
      saved ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    if (initial === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("setpoint-theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-full border border-ink-700 bg-ink-900/30 text-ink-300 hover:border-ink-500 hover:text-ink-50 active:scale-95 transition duration-200 cursor-pointer flex items-center justify-center shrink-0"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M17.293 13.293A8 8 0 0 1 6.707 2.707a8.001 8.001 0 1 0 10.586 10.586z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
          <path fillRule="evenodd" d="M10 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm4 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm-.464-4.95a1 1 0 1 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 1.414l-.707.707zm-9.9 9.9a1 1 0 1 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 1.414l-.707.707zm9.9 0a1 1 0 1 1 1.414-1.414l-.707-.707a1 1 0 1 1-1.414 1.414l.707.707zm-9.9-9.9a1 1 0 1 1 1.414-1.414l-.707-.707a1 1 0 0 1-1.414 1.414l.707-.707zM10 15a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1zm4.95-1.464a1 1 0 1 1 1.414 1.414l-.707.707a1 1 0 0 1-1.414-1.414l.707-.707zm-9.9-9.9a1 1 0 1 1 1.414 1.414l-.707.707a1 1 0 0 1-1.414-1.414l.707-.707z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}
