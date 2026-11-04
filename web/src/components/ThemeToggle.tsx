"use client";

import { useTheme } from "@/context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} aria-label="切换主题">
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
