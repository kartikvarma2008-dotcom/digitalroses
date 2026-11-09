import type { Metadata, Viewport } from "next";
import { Parisienne } from "next/font/google";
import "./globals.css";

const script = Parisienne({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-script",
});

export const metadata: Metadata = {
  title: "ROSERIE — Roses",
  description: "A field of red roses, drawn entirely in code.",
  applicationName: "ROSERIE",
};

export const viewport: Viewport = {
  themeColor: "#060305",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={script.variable}>{children}</body>
    </html>
  );
}
