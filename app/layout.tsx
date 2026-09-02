import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luna | Agenda del salón",
  description: "Agenda y organización del salón de belleza"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
