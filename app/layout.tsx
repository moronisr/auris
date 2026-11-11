import "./globals.css";
import type { Metadata, Viewport } from "next";
import Navegacao from "@/components/Navegacao";

export const metadata: Metadata = {
  title: "Ditado Clínico",
  description: "Registro clínico por voz com IA",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F7F7F4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" translate="no">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <Navegacao />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
