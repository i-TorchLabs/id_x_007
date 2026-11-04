"use client";

import { ThemeProvider } from "@/context/ThemeContext";
import { UserProvider } from "@/context/UserContext";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { Toast } from "@heroui/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <UserProvider>
          <Toast.Provider placement="bottom end" maxVisibleToasts={5} />
          {children}
        </UserProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
