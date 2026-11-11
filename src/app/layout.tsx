import type { Metadata } from "next";
import "vazirmatn/Vazirmatn-Variable-font-face.css";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "تسک منیجر",
  description: "مدیریت تسک‌ها با کانبان برد",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
