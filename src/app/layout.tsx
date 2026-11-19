import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Plataforma Pessoal de Questões e Simulados — TJSP • PCSP • PRF • OAB",
  description:
    "Ambiente privado de alta precisão para resolução de questões reais, simulados oficiais, revisão espaçada e fundamentos jurídicos verificáveis.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
