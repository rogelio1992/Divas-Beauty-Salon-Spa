import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Divas Beauty Spa | Belleza y cuidado",
  description: "Conoce nuestros servicios, trabajos y promociones. Reserva tu hora en Divas Beauty Spa."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
