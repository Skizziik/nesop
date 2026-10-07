import type { Metadata } from "next";
import "@ipt/templates/fonts";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "ItalianoPerTe · Ферма шортсов",
  description: "Генерация обучающих шортсов для @ItalianoPerTe",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen antialiased">
        <Providers>
          <div className="flex">
            <Nav />
            <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
