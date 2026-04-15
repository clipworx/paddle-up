import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NotificationsProvider } from "@/components/Notifications";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paddle Up",
  description: "Pickleball open play rotation and scoreboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NotificationsProvider>{children}</NotificationsProvider>
      </body>
    </html>
  );
}
