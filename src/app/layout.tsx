import type { Metadata } from "next";
import { Geist_Mono, Roboto } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const robotoSans = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vet English Training",
  description: "Technical and professional English training for veterinarians (US workplace readiness).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${robotoSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="bg-background text-foreground min-h-full flex flex-col"
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
