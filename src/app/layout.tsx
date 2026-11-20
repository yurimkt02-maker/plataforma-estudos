import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import {
  ReadingPrefsProvider,
  THEME_INIT_SCRIPT,
  ThemeProvider,
} from "@/components/ui";
import "@/styles/globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-reading",
  display: "swap",
});

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
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${sourceSerif.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <ReadingPrefsProvider>{children}</ReadingPrefsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
