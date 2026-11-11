import type { Metadata, Viewport } from "next";
import "vazirmatn/Vazirmatn-Variable-font-face.css";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ContextMenuProvider } from "@/components/ContextMenu";

export const metadata: Metadata = {
  title: "تسک منیجر",
  description: "مدیریت تسک‌ها با کانبان برد",
  applicationName: "تسک منیجر",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "تسک منیجر", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <ToastProvider>
          <ContextMenuProvider>{children}</ContextMenuProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
