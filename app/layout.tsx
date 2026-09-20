import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barbearia em Uberaba | Barbearia Almeida",
  description: "Agende corte, barba e serviços com Lucas ou Sinvas na Barbearia Almeida, em Uberaba. Consulte horários e reserve online.",
  applicationName: "Barbearia Almeida",
  manifest: "/manifest-v2.webmanifest",
  robots: { index: true, follow: true },
  openGraph: { title: "Barbearia Almeida — Uberaba", description: "Escolha o barbeiro, serviço e horário. Agendamento online rápido e seguro.", type: "website", locale: "pt_BR" },
  icons: {
    icon: "/almeida-viking-192-v2.png",
    shortcut: "/almeida-viking-192-v2.png",
    apple: "/almeida-viking-192-v2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
