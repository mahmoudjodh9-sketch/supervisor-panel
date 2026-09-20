import type { Metadata } from "next";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/outfit/800.css";
import "./globals.css";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MobileNavProvider } from "@/contexts/MobileNavContext";

export const metadata: Metadata = {
  title: "The Night King | لوحة التحكم الرئيسية",
  description: "Owner control panel for TNK Academy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="dark">
      <body className="antialiased">
        <div className="frost-scrim" />
        <ThemeProvider>
          <LocaleProvider>
            <MobileNavProvider>{children}</MobileNavProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
