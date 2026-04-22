import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "megorov · аналитика и данные",
  description: "Личный сервер для аналитики, ботов и API.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="antialiased min-h-screen font-sans">{children}</body>
    </html>
  );
}
