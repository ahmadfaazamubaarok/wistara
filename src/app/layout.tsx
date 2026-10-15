import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/plus-jakarta-sans";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JelajahLokal",
    template: "%s · JelajahLokal",
  },
  description:
    "Waktu terbaik mengunjungi destinasi wisata di DIY dalam 3 hari ke depan, fasilitas di sekitarnya, dan saran saat cuaca buruk.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
